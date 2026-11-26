export function makeFlightControls(host:HTMLElement,onExit:()=>void){
  const keys=new Set<string>();
  const stick=document.createElement('span'),thumb=document.createElement('i');
  stick.className='flight-stick';stick.setAttribute('aria-hidden','true');stick.append(thumb);
  const arrows=new Set(['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s']);
  let pointer:number|undefined,anchorX=0,anchorY=0,roll=0,pitch=0;
  function releasePointer(){
    roll=pitch=0;
    const id=pointer;pointer=undefined;
    if(id!==undefined && host.hasPointerCapture(id))host.releasePointerCapture(id);
    stick.remove();
  }
  function release(){releasePointer();keys.clear();}
  function key(e:KeyboardEvent){
    const k=e.key.toLowerCase();
    if(e.type==='keyup'){
      keys.delete(k);
      return;
    }
    if(e.altKey || e.metaKey || e.ctrlKey)return;
    if(k==='escape'){onExit();return;}
    if(!arrows.has(k) || e.target instanceof HTMLInputElement)return;
    keys.add(k);
    e.preventDefault();
  }
  function down(e:PointerEvent){
    if(pointer!==undefined || e.button!==0)return;
    pointer=e.pointerId;anchorX=e.clientX;anchorY=e.clientY;
    const rect=host.getBoundingClientRect();
    stick.style.left=(anchorX-rect.left)+'px';stick.style.top=(anchorY-rect.top)+'px';
    thumb.style.transform='';host.append(stick);host.setPointerCapture(pointer);e.preventDefault();
  }
  function move(e:PointerEvent){
    if(e.pointerId!==pointer)return;
    const dx=e.clientX-anchorX,dy=anchorY-e.clientY,range=Math.max(48,Math.hypot(dx,dy));
    roll=dx/range;pitch=dy/range;
    thumb.style.transform='translate('+roll*22+'px,'+-pitch*22+'px)';
  }
  function up(e:PointerEvent){if(e.pointerId===pointer)releasePointer();}
  function toggle(on:boolean){
    const method=on?'addEventListener':'removeEventListener';
    window[method]('keydown',key as EventListener);window[method]('keyup',key as EventListener);
    window[method]('blur',release);
    host[method]('pointerdown',down as EventListener);host[method]('pointermove',move as EventListener);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])host[method](name,up as EventListener);
    release();
  }
  const axis=(a:string,b:string)=>Number(keys.has(a)||keys.has(b));
  return {toggle,release,get roll(){return roll || axis('d','arrowright')-axis('a','arrowleft');},
    get pitch(){return pitch || axis('w','arrowup')-axis('s','arrowdown');}};
}
