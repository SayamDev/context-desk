// The Context Desk loader: the brand mark's frames light up in turn (public/assets/loader.json,
// made by scripts/make-loader.mjs), played with lottie-web. Reduced motion shows one still frame.
let player=null;
function lottie(){player??=new Promise((resolve,reject)=>{if(window.lottie){resolve(window.lottie);return}const s=document.createElement('script');s.src='/vendor/lottie_light.min.js';s.onload=()=>resolve(window.lottie);s.onerror=()=>reject(Error('Loader animation unavailable.'));document.head.append(s)});return player}
export function mountLoader(container){
  if(!container||container.dataset.loader)return;container.dataset.loader='1';
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  lottie().then(l=>{const a=l.loadAnimation({container,renderer:'svg',loop:!still,autoplay:!still,path:'/assets/loader.json',rendererSettings:{preserveAspectRatio:'xMidYMid meet'}});if(still)a.addEventListener('DOMLoaded',()=>a.goToAndStop(20,true))}).catch(()=>{container.classList.add('loader-fallback')});
}
