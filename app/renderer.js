window.addEventListener('error',event=>console.error('Local renderer:',event.message));
const $=id=>document.getElementById(id);let ready=false,busy=false,recording=false,starting=false,autoInsert=false,recorder,stream,chunks=[];
let meterContext,meterTimer;
function stopMeter(){clearInterval(meterTimer);meterTimer=null;if(meterContext){meterContext.close().catch(()=>{});meterContext=null;}}
async function startMeter(){
  try{
    meterContext=new AudioContext();await meterContext.resume();
    const source=meterContext.createMediaStreamSource(stream),analyser=meterContext.createAnalyser();
    analyser.fftSize=256;source.connect(analyser);
    const samples=new Uint8Array(analyser.fftSize);
    meterTimer=setInterval(()=>{analyser.getByteTimeDomainData(samples);let sum=0;for(const sample of samples)sum+=((sample-128)/128)**2;localBlabby.audioLevel(Math.min(1,Math.sqrt(sum/samples.length)*5));},60);
  }catch(error){stopMeter();console.warn('Visualiseur indisponible',error.message);}
}
function refresh(){ $('model').disabled=!ready||busy||recording||starting; $('record').disabled=!recording&&(!ready||busy);$('import').disabled=!ready||busy||recording;$('language').disabled=busy||recording;$('microphone').disabled=busy||recording; }
function update(s){if(s.models&&s.models.length){ $('model').replaceChildren(...s.models.map(item=>{const option=new Option(item.label,item.id);option.disabled=!item.available;return option;}));$('model').value=s.model;$('modelLabel').textContent=$('model').selectedOptions[0]?.textContent||s.model;}ready=s.ready;busy=s.busy;$('status').textContent=recording?'Enregistrement… Ctrl + Espace pour arrêter':s.message;if(s.shortcutAvailable===false)$('error').textContent='Ctrl + Espace est déjà utilisé. Fermez l’application qui utilise ce raccourci puis relancez Blabby.';refresh();}
localBlabby.onStatus(update);localBlabby.status().then(update).catch(e=>$('error').textContent=e.message);
localBlabby.onTestResult(result=>{$('text').value=result.text;$('details').textContent=`Test local · ${result.duration.toFixed(1)} s audio · ${result.elapsed.toFixed(1)} s calcul`;
  const entry=document.createElement('div');entry.className='entry';entry.textContent=result.text;$('history').prepend(entry);});
async function run(buffer,name='Dictée',insert=false){
  $('error').textContent='';busy=true;refresh();
  try{const result=await localBlabby.transcribe(buffer,$('language').value||null,insert);
    $('text').value=result.text;$('details').textContent=`${name} · ${result.duration.toFixed(1)} s audio · ${result.elapsed.toFixed(1)} s calcul · ${result.language}`;
    if(result.text){const entry=document.createElement('div');entry.className='entry';entry.textContent=result.text;$('history').prepend(entry);}
    else $('error').textContent='Aucune parole reconnue. Vérifiez le microphone ou essayez une phrase plus longue.';
    if(result.insertionError)$('error').textContent=result.insertionError;
    if(result.inserted)$('details').textContent+=' · collé dans votre application';
  }catch(e){$('error').textContent=e.message;}finally{busy=false;refresh();}
}
async function devices(){const selected=$('microphone').value;const list=await navigator.mediaDevices.enumerateDevices();$('microphone').replaceChildren(new Option('Microphone par défaut',''));for(const d of list.filter(d=>d.kind==='audioinput'))$('microphone').add(new Option(d.label||'Microphone',d.deviceId));$('microphone').value=selected;}
async function toggle(options={}){if(recording){if(recorder.state==='recording')recorder.stop();return;}if(!ready||busy||starting){localBlabby.recordingState({recording,failed:!recording});return;}
  starting=true;autoInsert=Boolean(options.external);
  try{$('error').textContent='';const device=$('microphone').value;stream=await navigator.mediaDevices.getUserMedia({audio:device?{deviceId:{exact:device}}:true});await devices();
    const mime=['audio/webm;codecs=opus','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=async()=>{recording=false;stopMeter();localBlabby.recordingState({recording:false});stream.getTracks().forEach(t=>t.stop());$('record').textContent='Commencer la dictée';$('record').classList.remove('recording');const blob=new Blob(chunks,{type:recorder.mimeType});busy=true;refresh();await run(await blob.arrayBuffer(),'Dictée',autoInsert);};
    recorder.start();recording=true;localBlabby.recordingState({recording:true});$('status').textContent='Enregistrement… Ctrl + Espace pour arrêter';$('record').textContent='Arrêter et transcrire';$('record').classList.add('recording');refresh();
    await startMeter();
  }catch(e){stream?.getTracks().forEach(t=>t.stop());localBlabby.recordingState({recording:false,failed:true});$('error').textContent='Microphone : '+e.message;}finally{starting=false;}
}
$('record').onclick=toggle;localBlabby.onToggle(toggle);
$('import').onclick=async()=>{console.log('Local import requested');try{const audio=await localBlabby.importAudio();if(audio)await run(audio.buffer,audio.name);}catch(e){$('error').textContent=e.message;}};
$('copy').onclick=async()=>{await localBlabby.copy($('text').value);$('copy').textContent='Copié';setTimeout(()=>$('copy').textContent='Copier le texte',1500);};
devices().catch(()=>{});
console.log('Local controls ready');

$('model').onchange=async()=>{const key=$('model').value;busy=true;refresh();$('error').textContent='';try{await localBlabby.selectModel(key);}catch(error){$('error').textContent=error.message;}finally{update(await localBlabby.status());}};


