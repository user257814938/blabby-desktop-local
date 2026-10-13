const bars=[...document.querySelectorAll('#wave i')];
let recording=false;
localBlabby.onStatus(value=>{
  recording=Boolean(value.recording);
  document.body.classList.toggle('recording',recording);
  document.body.classList.toggle('processing',Boolean(value.processing));
  document.getElementById('wave').setAttribute('aria-label',recording?'Enregistrement en cours : niveau du microphone':'Transcription en cours');
  if(!recording)bars.forEach(bar=>bar.style.height='');
});
localBlabby.onAudioLevel(level=>{if(!recording)return;bars.forEach((bar,index)=>{bar.style.height=`${4+level*23*(0.45+0.55*Math.sin((index+1)*0.85)**2)}px`;});});

