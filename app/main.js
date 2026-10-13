const { app, BrowserWindow, ipcMain, clipboard, dialog, globalShortcut, session, screen } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
app.setPath('userData', path.join(app.getPath('appData'), 'blabby-local'));
let win, worker, ready = false, busy = false, seq = 0, active;
let errors = '';
let overlay, nativePython, externalTarget, recording = false, shortcutPending = false, shortcutAvailable = false, insertionInProgress = false;
const assets = app.isPackaged ? path.join(process.resourcesPath, 'blabby-local') : path.join(__dirname, '..');
const configPath = path.join(assets, 'config.json');
function status(message) { if(win && !win.isDestroyed()) win.webContents.send('local-status', {ready,busy,message,shortcutAvailable}); }
function bubble(message, visible = true) {
  if(!overlay || overlay.isDestroyed())return;
  overlay.webContents.send('local-status', {message,recording});
  if(visible)overlay.showInactive();else overlay.hide();
}
function native(action, target) {
  return new Promise((resolve,reject)=>{
    const helper=spawn(nativePython,['-u',path.join(assets,'native_input.py')],{windowsHide:true});
    let output='';const timer=setTimeout(()=>{helper.kill();reject(new Error('Intégration Windows indisponible'));},5000);
    helper.stdout.on('data',data=>{output+=data.toString();});
    helper.on('error',error=>{clearTimeout(timer);reject(error);});
    helper.on('exit',()=>{clearTimeout(timer);try{const result=JSON.parse(output);if(result.error)reject(new Error(result.error));else resolve(result);}catch(error){reject(new Error('Intégration Windows indisponible'));}});
    helper.stdin.on('error',()=>{});
    helper.stdin.end(JSON.stringify({action,target}));
  });
}
function startWorker() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  nativePython=config.python;
  worker = spawn(config.python, ['-u', path.join(assets, 'worker.py'), configPath], {
    windowsHide:true, env:{...process.env, HF_HUB_OFFLINE:'1', HF_HUB_DISABLE_TELEMETRY:'1'}
  });
  readline.createInterface({input:worker.stdout}).on('line', line=>{
    try {
      const msg=JSON.parse(line);
      if(msg.ready){ready=true;status('Modèle prêt · fonctionnement local');
        if(process.env.BLABBY_TEST_AUDIO){setTimeout(async()=>{try{const result=await transcribe(fs.readFileSync(process.env.BLABBY_TEST_AUDIO),'fr');fs.writeFileSync(path.join(app.getPath('userData'),'integration-test.json'),JSON.stringify(result));win.webContents.send('local-test-result',result);}catch(e){status(e.message);}},500);}return;}
      if(active && msg.id===active.id){const job=active;active=null;busy=false;clearTimeout(job.timer);
        if(msg.error) job.reject(new Error(msg.error)); else job.resolve(msg);
        status(msg.error || 'Transcription terminée');}
    } catch(e) { status('Erreur de communication avec le moteur'); }
  });
  worker.stderr.on('data',d=>{ errors=(errors+d.toString()).slice(-4000); });
  worker.on('error',e=>{ready=false;status(e.message);});
  worker.on('exit',()=>{ready=false;busy=false;if(active){clearTimeout(active.timer);active.reject(new Error(errors || 'Moteur arrêté'));active=null;}status(errors || 'Moteur arrêté');});
}
function transcribe(buffer, language) {
  if(!ready) throw new Error('Le modèle est encore en cours de chargement.');
  if(busy) throw new Error('Une transcription est déjà en cours.');
  if(!buffer || buffer.byteLength>50*1024*1024) throw new Error('Audio absent ou trop volumineux (maximum 50 Mo).');
  if(![null,'fr','en','es','ar','de','it','pt'].includes(language)) throw new Error('Langue invalide');
  busy=true;status('Transcription sur cet ordinateur…');
  return new Promise((resolve,reject)=>{
    const id=++seq;
    const timer=setTimeout(()=>{if(active?.id===id){active=null;busy=false;ready=false;reject(new Error('Transcription interrompue après 5 minutes'));worker.kill();}},300000);
    active={id,resolve,reject,timer};
    worker.stdin.write(JSON.stringify({id,audio:Buffer.from(buffer).toString('base64'),language})+'\n',e=>{if(e && active?.id===id){clearTimeout(timer);active=null;busy=false;reject(e);}});
  });
}
app.whenReady().then(()=>{
  // A separate, network-denied Electron session; no remote API, login or telemetry.
  const localSession=session.fromPartition('blabby-local-memory');
  localSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>callback({cancel:true}));
  win=new BrowserWindow({width:1000,height:760,minWidth:750,minHeight:600,title:'Blabby · Local',backgroundColor:'#14161b',
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,session:localSession}});
  const area=screen.getPrimaryDisplay().workArea;
  overlay=new BrowserWindow({width:360,height:76,x:area.x+Math.round((area.width-360)/2),y:area.y+16,
    show:false,frame:false,resizable:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,
    backgroundColor:'#14161b',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,session:localSession}});
  overlay.loadFile(path.join(__dirname,'overlay.html'));
  overlay.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  overlay.webContents.on('will-navigate',event=>event.preventDefault());
  win.on('closed',()=>{if(overlay&&!overlay.isDestroyed())overlay.close();});
  win.setMenuBarVisibility(false);
  win.once('ready-to-show',()=>win.show());
  win.webContents.on('console-message',(event,level,message)=>{fs.appendFileSync(path.join(app.getPath('userData'),'renderer.log'),String(event.message ?? message ?? level)+'\n');});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.loadFile(path.join(__dirname,'index.html'));
  ipcMain.handle('local-status',()=>({ready,busy,shortcutAvailable,message:ready?'Modèle prêt · fonctionnement local':'Chargement du modèle…'}));
  ipcMain.on('local-recording-state',(_,value)=>{
    recording=Boolean(value.recording);shortcutPending=false;
    if(recording)bubble('Enregistrement · Ctrl + Espace pour arrêter');
    if(!recording && value.failed){externalTarget=null;bubble('',false);}
  });
  ipcMain.on('local-audio-level',(event,value)=>{
    if(event.sender!==win.webContents || !recording || !Number.isFinite(value))return;
    if(overlay&&!overlay.isDestroyed())overlay.webContents.send('local-audio-level',Math.max(0,Math.min(1,value)));
  });
  ipcMain.handle('local-transcribe',async(_,buffer,lang,insert)=>{
    const target=insert?externalTarget:null;externalTarget=null;
    insertionInProgress=Boolean(target);
    bubble('Transcription locale…');
    try {
      const result=await transcribe(buffer,lang);
      if(target && result.text){
        try{await native('check',target);clipboard.writeText(result.text);await native('paste',target);result.inserted=true;bubble('Texte collé · Ctrl + Espace pour dicter');}
        catch(error){result.insertionError=error.message;bubble('Texte prêt · ouvrez Blabby pour le copier');}
      }else{bubble(result.text?'Texte prêt dans Blabby':'Aucune parole reconnue');}
      setTimeout(()=>{if(!recording&&!busy)bubble('',false);},2500);
      return result;
    }catch(error){bubble('',false);throw error;}finally{insertionInProgress=false;}
  });
  ipcMain.handle('local-copy',(_,text)=>{if(typeof text!=='string')throw new Error('Texte invalide');clipboard.writeText(text);return true;});
  ipcMain.handle('local-import',async()=>{
    const choice=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Audio',extensions:['wav','webm','mp3','m4a','ogg','flac']}]});
    if(choice.canceled)return null;
    const p=choice.filePaths[0];if(fs.statSync(p).size>50*1024*1024)throw new Error('Maximum 50 Mo');
    return {name:path.basename(p),buffer:fs.readFileSync(p)};
  });
  shortcutAvailable=globalShortcut.register('Control+Space',async()=>{
    if(!ready||busy||insertionInProgress||shortcutPending||!win||win.isDestroyed())return;
    shortcutPending=true;
    try{
      if(!recording){const result=await native('capture');externalTarget=result.target?.hwnd&&result.target.pid!==process.pid?result.target:null;}
      if(!recording && !externalTarget && win.isFocused())win.minimize();
      win.webContents.send('local-toggle-recording',{external:Boolean(externalTarget)});
    }catch(error){shortcutPending=false;status(error.message);}
  });
  startWorker();
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{globalShortcut.unregisterAll();worker?.kill();});

