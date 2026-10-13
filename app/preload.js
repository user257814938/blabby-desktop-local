const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('localBlabby',{
  status:()=>ipcRenderer.invoke('local-status'),
  selectModel:key=>ipcRenderer.invoke('local-model',key),
  transcribe:(buffer,language,insert)=>ipcRenderer.invoke('local-transcribe',buffer,language,insert),
  recordingState:value=>ipcRenderer.send('local-recording-state',value),
  audioLevel:value=>ipcRenderer.send('local-audio-level',value),
  onAudioLevel:callback=>ipcRenderer.on('local-audio-level',(_,value)=>callback(value)),
  copy:text=>ipcRenderer.invoke('local-copy',text),
  importAudio:()=>ipcRenderer.invoke('local-import'),
  onStatus:callback=>{ipcRenderer.on('local-status',(_,value)=>callback(value));},
  onToggle:callback=>{ipcRenderer.on('local-toggle-recording',(_,value)=>callback(value));},
  onTestResult:callback=>{ipcRenderer.on('local-test-result',(_,value)=>callback(value));}
});
