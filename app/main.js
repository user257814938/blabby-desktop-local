const { app, BrowserWindow, ipcMain, clipboard, dialog, globalShortcut, session, screen, Tray, Menu } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
app.setPath('userData', path.join(app.getPath('appData'), 'blabby-local'));
let win, worker, ready = false, busy = false, seq = 0, active;
let errors = '';
let modelConfig,currentModel='base';
const modelLabels={base:'Whisper Base', 'large-v3':'Whisper Large-v3', 'large-v3-turbo':'Whisper Large-v3 Turbo'};
function modelStatus(){return {model:currentModel,models:Object.keys(modelLabels).filter(id=>modelConfig?.models?.[id]).map(id=>({id,label:modelLabels[id],available:fs.existsSync(path.join(modelConfig.models[id],'model.bin'))}))};}
let bubbleTimer;
let tray,quitting=false;
const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance)app.quit();
let overlay, nativePython, externalTarget, recording = false, shortcutPending = false, shortcutAvailable = false, insertionInProgress = false;
const assets = app.isPackaged ? path.join(process.resourcesPath, 'blabby-local') : path.join(__dirname, '..');
const configPath = path.join(assets, 'config.json');
function status(message) { if(win && !win.isDestroyed()) win.webContents.send('local-status', {ready,busy,message,shortcutAvailable,...modelStatus()}); }
function bubble(message, visible = true) {
  if(!overlay || overlay.isDestroyed())return;
  clearTimeout(bubbleTimer);
  overlay.webContents.send('local-status', {message,recording});
  if(visible && recording){
    const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    overlay.setPosition(area.x+Math.round((area.width-112)/2),area.y+area.height-40-16);
    if(overlay.isMinimized())overlay.restore();
    overlay.setAlwaysOnTop(true,'screen-saver');
    overlay.showInactive();
  }else overlay.hide();
}
function native(action, target, text) {
  return new Promise((resolve,reject)=>{
    const helper=spawn(nativePython,['-u',path.join(assets,'native_input.py')],{windowsHide:true});
    let output='';const timer=setTimeout(()=>{helper.kill();reject(new Error('Intégration Windows indisponible'));},5000);
    helper.stdout.on('data',data=>{output+=data.toString();});
    helper.on('error',error=>{clearTimeout(timer);reject(error);});
    helper.on('exit',()=>{clearTimeout(timer);try{const result=JSON.parse(output);if(result.error)reject(new Error(result.error));else resolve(result);}catch(error){reject(new Error('Intégration Windows indisponible'));}});
    helper.stdin.on('error',()=>{});
    helper.stdin.end(JSON.stringify({action,target,text}));
  });
}
function startWorker() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  modelConfig=config;config.models ||= {base:config.model};currentModel=config.selectedModel||'base';
  nativePython=config.python;
  worker = spawn(config.python, ['-u', path.join(assets, 'worker.py'), configPath], {
    windowsHide:true, env:{...process.env, HF_HUB_OFFLINE:'1', HF_HUB_DISABLE_TELEMETRY:'1'}
  });
  readline.createInterface({input:worker.stdout}).on('line', line=>{
    try {
      const msg=JSON.parse(line);
      if(msg.ready){ready=true;currentModel=msg.model||currentModel;status('Modèle prêt · fonctionnement local');
        if(process.env.BLABBY_TEST_AUDIO){setTimeout(async()=>{try{const result=await transcribe(fs.readFileSync(process.env.BLABBY_TEST_AUDIO),'fr');fs.writeFileSync(path.join(app.getPath('userData'),'integration-test.json'),JSON.stringify(result));win.webContents.send('local-test-result',result);}catch(e){status(e.message);}},500);}return;}
      if(active && msg.id===active.id){const job=active;active=null;busy=false;clearTimeout(job.timer);
        if(job.modelSwitch && !msg.error){currentModel=msg.model;modelConfig.selectedModel=currentModel;fs.writeFileSync(configPath,JSON.stringify(modelConfig,null,2));}
        if(msg.error) job.reject(new Error(msg.error)); else job.resolve(msg);
        status(msg.error || (job.modelSwitch?'Modèle prêt · fonctionnement local':'Transcription terminée'));}
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
app.on('second-instance',()=>{if(win&&!win.isDestroyed()){win.show();win.focus();}});
app.whenReady().then(async()=>{
  if(!singleInstance)return;
  // A separate, network-denied Electron session; no remote API, login or telemetry.
  const localSession=session.fromPartition('blabby-local-memory');
  localSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>callback({cancel:true}));
  win=new BrowserWindow({width:1000,height:760,minWidth:750,minHeight:600,title:'Blabby · Local',backgroundColor:'#14161b',
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,session:localSession}});
  const area=screen.getPrimaryDisplay().workArea;
  overlay=new BrowserWindow({width:112,height:40,x:area.x+Math.round((area.width-112)/2),y:area.y+area.height-40-16,
    show:false,frame:false,resizable:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,
    backgroundColor:'#14161b',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,session:localSession}});
  overlay.loadFile(path.join(__dirname,'overlay.html'));
  overlay.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  overlay.webContents.on('will-navigate',event=>event.preventDefault());
  win.on('closed',()=>{if(overlay&&!overlay.isDestroyed())overlay.close();});
  tray=new Tray(await app.getFileIcon(process.execPath));
  tray.setToolTip('Blabby local · Ctrl + Espace pour dicter');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Ouvrir Blabby',click:()=>{win.show();win.focus();}},
    {label:'Quitter Blabby',click:()=>app.quit()}
  ]));
  tray.on('double-click',()=>{win.show();win.focus();});
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
  win.setMenuBarVisibility(false);
  win.once('ready-to-show',()=>win.show());
  win.webContents.on('console-message',(event,level,message)=>{fs.appendFileSync(path.join(app.getPath('userData'),'renderer.log'),String(event.message ?? message ?? level)+'\n');});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.loadFile(path.join(__dirname,'index.html'));
  ipcMain.handle('local-status',()=>({ready,busy,shortcutAvailable,...modelStatus(),message:ready?'Modèle prêt · fonctionnement local':'Chargement du modèle…'}));
  ipcMain.handle('local-model',async(_,key)=>{
    if(!ready||busy||recording||shortcutPending||insertionInProgress)throw new Error('Attendez la fin de la dictée ou du chargement.');
    if(!modelConfig.models[key]||!fs.existsSync(path.join(modelConfig.models[key],'model.bin')))throw new Error('Modèle non installé');
    busy=true;status('Chargement de '+modelLabels[key]+'…');
    return new Promise((resolve,reject)=>{
      const id=++seq;
      const timer=setTimeout(()=>{if(active?.id===id){active=null;busy=false;ready=false;worker.kill();reject(new Error('Chargement interrompu après 5 minutes'));}},300000);
      active={id,resolve,reject,timer,modelSwitch:true};
      worker.stdin.write(JSON.stringify({id,action:'model',model:key})+'\n',error=>{if(error&&active?.id===id){clearTimeout(timer);active=null;busy=false;status(error.message);reject(error);}});
    });
  });
  ipcMain.on('local-recording-state',(_,value)=>{
    recording=Boolean(value.recording);shortcutPending=false;
    if(recording)bubble('Enregistrement · Ctrl + Espace pour arrêter');
    if(!recording){if(value.failed)externalTarget=null;bubble('',false);}
  });
  ipcMain.on('local-audio-level',(event,value)=>{
    if(event.sender!==win.webContents || !recording || !Number.isFinite(value))return;
    if(overlay&&!overlay.isDestroyed())overlay.webContents.send('local-audio-level',Math.max(0,Math.min(1,value)));
  });
  ipcMain.handle('local-transcribe',async(_,buffer,lang,insert)=>{
    const target=insert?externalTarget:null;externalTarget=null;
    insertionInProgress=true;
    let inserted=false;
    try{
      const result=await transcribe(buffer,lang);
      if(target && result.text){
        try{await native('type',target,result.text);result.inserted=true;inserted=true;}
        catch(error){result.insertionError=error.message;}
      }
      return result;
    }
    finally{
      insertionInProgress=false;
      bubble('',false);
      if(!inserted && win&&!win.isDestroyed()){
        if(win.isMinimized())win.restore();
        win.showInactive();
      }
    }
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
app.on('before-quit',()=>{quitting=true;clearTimeout(bubbleTimer);globalShortcut.unregisterAll();worker?.kill();tray?.destroy();});



