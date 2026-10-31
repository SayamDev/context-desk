const steps = [
  {label:'THE PREP',title:'Start with your base.',description:'Begin with clean, comfortable skin. Apply your chosen base lightly and blend from the centre outward.',tip:'Aim for an even, light layer.'},
  {label:'THE SHAPE',title:'Bring out your eyes.',description:'Add your preferred shadow or liner in small passes. Pause to check balance before adding more.',tip:'Build slowly, then soften the edges.'},
  {label:'THE COLOUR',title:'Add a little colour.',description:'Sweep blush where you like it, using a light hand. Blend the edges so the colour feels part of the look.',tip:'Start subtle; you can always add more.'},
  {label:'THE FINISH',title:'Make it yours.',description:'Finish with lips and any last touches. Step back from the mirror and decide what feels right to you.',tip:'Your preference is the final call.'}
];
const $ = id => document.getElementById(id);
let current = 0, stream, facingMode = 'user';
function render() {
  const step = steps[current];
  $('stepTitle').textContent = step.title; $('stepDescription').textContent = step.description;
  $('stepCount').textContent = `STEP ${current + 1} OF ${steps.length}`;
  $('stepList').innerHTML = steps.map((item,i) => `<button class="step-chip ${i === current ? 'active' : ''}" data-step="${i}" aria-current="${i === current ? 'step' : 'false'}"><span>0${i+1}</span>${item.label}</button>`).join('');
  document.querySelectorAll('[data-step]').forEach(button => button.onclick = () => {current = Number(button.dataset.step); render();});
  $('backButton').disabled = current === 0; $('nextButton').textContent = current === steps.length - 1 ? 'Start again ↺' : 'Next step →';
  $('result').hidden = true;
}
async function startCamera() {
  try {
    stream?.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode, width:{ideal:1280},height:{ideal:720}},audio:false});
    $('video').srcObject = stream; $('placeholder').hidden = true; $('cameraState').textContent = 'CAMERA ON';
    $('cameraButton').textContent = 'Turn off camera'; $('flipButton').hidden = false; $('askButton').disabled = false;
  } catch { $('result').hidden = false; $('result').textContent = 'Camera access is unavailable. Check your browser permission and try again.'; }
}
function stopCamera() {stream?.getTracks().forEach(track => track.stop()); stream = null; $('video').srcObject = null; $('placeholder').hidden = false; $('cameraState').textContent = 'CAMERA OFF'; $('cameraButton').textContent = 'Turn on camera'; $('flipButton').hidden = true; $('askButton').disabled = true;}
$('cameraButton').onclick = () => stream ? stopCamera() : startCamera();
$('flipButton').onclick = () => {facingMode = facingMode === 'user' ? 'environment' : 'user'; startCamera();};
$('backButton').onclick = () => {current--; render();};
$('nextButton').onclick = () => {current = (current + 1) % steps.length; render();};
$('askButton').onclick = async () => {
  if (!stream) return;
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = Math.round(640 * $('video').videoHeight / $('video').videoWidth) || 480;
  canvas.getContext('2d').drawImage($('video'),0,0,canvas.width,canvas.height);
  const button = $('askButton'), result = $('result'); button.disabled = true; button.textContent = 'Looking at this step…'; result.hidden = false; result.textContent = 'Getting guidance from Muse Spark…';
  try { const response = await fetch('/api/guide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:canvas.toDataURL('image/jpeg',0.72),step:steps[current].title,question:$('question').value})}); const data = await response.json(); result.textContent = data.guidance || data.error || 'Please try again.'; }
  catch { result.textContent = 'Could not reach the guide. Please try again.'; }
  finally { button.disabled = false; button.innerHTML = 'Check this step <span>↗</span>'; }
};
window.addEventListener('pagehide',stopCamera);
render();
