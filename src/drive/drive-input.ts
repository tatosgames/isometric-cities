export function makeDriveInput(host: HTMLElement,onDrive: () => void,onExit: () => void,onCamera: () => void){
  const pointers=new Map<number,{side: number;anchor: number}>(),keys=new Set<string>();
  function read(){
    let left=keys.has('ArrowLeft')||keys.has('a'),right=keys.has('ArrowRight')||keys.has('d');
    for(const p of pointers.values()){if(p.side<0)left=true;else right=true;}
    return {steer:(left?1:0)-(right?1:0),brake:(left&&right)||keys.has(' ')||keys.has('ArrowDown')};
  }
  function release(){pointers.clear();keys.clear();}
  const hidden=()=>{if(document.hidden)release();};
  function down(e: PointerEvent){
    const box=host.getBoundingClientRect();
    pointers.set(e.pointerId,{side:e.clientX<box.left+box.width/2?-1:1,anchor:e.clientX});
    onDrive();e.preventDefault();
  }
  function move(e: PointerEvent){
    const p=pointers.get(e.pointerId);
    if(!p)return;
    // A horizontal swipe overrides the half of the screen where the finger landed.
    if(Math.abs(e.clientX-p.anchor)>24){p.side=Math.sign(e.clientX-p.anchor);p.anchor=e.clientX;}
  }
  const up=(e: PointerEvent)=>pointers.delete(e.pointerId);
  function key(e: KeyboardEvent){
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(e.type==='keyup'){keys.delete(k);return;}
    if(k==='c' && !e.ctrlKey && !e.metaKey && !e.altKey){if(!e.repeat)onCamera();e.preventDefault();return;}
    if(k==='Escape'){onExit();return;}
    if(!['ArrowLeft','ArrowRight','ArrowDown','a','d',' '].includes(k) || e.target instanceof HTMLButtonElement)return;
    keys.add(k);onDrive();e.preventDefault();
  }

  function activate(){
    release();
    host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);
    for(const type of ['pointerup','pointercancel','pointerleave'] as const)host.addEventListener(type,up);
    window.addEventListener('keydown',key);window.addEventListener('keyup',key);
    window.addEventListener('blur',release);document.addEventListener('visibilitychange',hidden);
  }
  function deactivate(){
    host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);
    for(const type of ['pointerup','pointercancel','pointerleave'] as const)host.removeEventListener(type,up);
    window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);
    window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',hidden);
    release();
  }
  return {read,activate,deactivate,release};
}
