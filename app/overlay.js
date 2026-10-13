const bars=[...document.querySelectorAll('#wave i')];
let recording=false;
localBlabby.onStatus(value=>{document.getElementById('message').textContent=value.message;recording=Boolean(value.recording);document.body.classList.toggle('recording',recording);if(!recording)bars.forEach(bar=>bar.style.height='4px');});
localBlabby.onAudioLevel(level=>{if(!recording)return;bars.forEach((bar,index)=>{bar.style.height=`${4+level*23*(0.45+0.55*Math.sin((index+1)*0.85)**2)}px`;});});
