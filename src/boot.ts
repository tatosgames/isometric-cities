import { element as el } from './map/dom.ts';
import { required } from './required.ts';

const map=el('map');
export const startup=new AbortController();
export const booting=()=>map.dataset.boot==='loading';
export const bootEvent=(name: string)=>dispatchEvent(new Event('atlas:boot-'+name));
addEventListener('atlas:boot-failed',()=>startup.abort(),{once:true});
// While the map opens, a note ahead of the credits says which step is running and for how long: on a phone, with
// no console at hand, that is how a slow or stuck start can be told apart. The note goes once the map is open.
const credits=required(document.querySelector<HTMLElement>('#map>footer'),'credits'),bootNote=document.createElement('span');
bootNote.id='boot-step';credits.prepend(bootNote);
const bootStarted=performance.now();
let bootStep='';
const bootSeconds=()=>Math.round((performance.now()-bootStarted)/1000)+' s';
const noteStep=(text: string)=>{bootNote.textContent=text+' — ';};
export function bootPhase(step: string){
  if(!booting())return;
  bootStep=step;
  noteStep(step+' · '+bootSeconds());
  bootEvent('progress');
}
const bootClock=setInterval(()=>{if(booting()&&bootStep)noteStep(bootStep+' · '+bootSeconds());},1000);
addEventListener('atlas:boot-ready',()=>{clearInterval(bootClock);bootNote.remove();},{once:true});
let bootFault='';
addEventListener('atlas:boot-failed',()=>{
  clearInterval(bootClock);
  noteStep(bootFault||'Sin avance en: '+(bootStep||'inicio')+' · '+bootSeconds());
},{once:true});
// Lets the step just announced reach the screen before the next stretch of work holds the page.
// A hidden tab gets no frames: the timer keeps the start from waiting for one.
export const bootPaint=()=>new Promise<void>(done=>{
  const late=setTimeout(done,150);
  requestAnimationFrame(()=>{clearTimeout(late);setTimeout(done,0);});
});
let bootPercent=0;
export function bootProgress(percent: number){
  if(percent<bootPercent || startup.signal.aborted)return;
  const progress=el('boot-progress');
  if(percent===bootPercent && progress.hasAttribute('aria-valuenow'))return;
  bootPercent=percent;
  bootEvent('progress');
  progress.style.setProperty('--boot-progress',String(percent));
  progress.setAttribute('aria-valuenow',String(percent));
}
export function bootError(error: unknown){
  if(startup.signal.aborted)return;
  console.error(error);
  bootFault='Error en: '+(bootStep||'inicio')+' · '+(error instanceof Error?error.message:String(error)).slice(0,120);
  noteStep(bootFault);
  bootEvent('error');
}
