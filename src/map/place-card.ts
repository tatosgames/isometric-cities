import type { Barrio, Place } from '../data/types.ts';
import { isBarrios, loadData } from '../data/load.ts';
import { barrioAt } from '../drive/drive-location.ts';
import { required } from '../required.ts';
import { element } from './dom.ts';

type Details = Place['properties'];

// One curve for the whole card: fast out of the gate, long settle.
const EASE='cubic-bezier(.16,1,.3,1)';
// Side panel on wide screens and on a phone held sideways; a sheet from the bottom everywhere else.
const SIDE='(min-width:700px) and (min-height:481px), (max-height:480px) and (min-width:560px)';

/**
 * The place card. A place with a `card` in the catalogue opens as a panel (photo, district, name, text, link);
 * one without keeps the small name pill. On a phone the panel is a sheet that folds back to the pill when
 * dragged down or when the map is moved, and unfolds on a tap.
 */
export function createPlaceCard(){
  const card=required(document.querySelector<HTMLElement>('article'),'place card');
  const part=<E extends HTMLElement>(selector: string)=>required(card.querySelector<E>(selector),selector);
  const figure=part('.card-photo'),image=part<HTMLImageElement>('.card-photo img'),credit=part<HTMLAnchorElement>('.card-photo a');
  const meta=part('.card-meta'),number=part('.card-meta b'),district=part('.card-meta span');
  const heading=part('h3'),text=part('.card-text'),link=part<HTMLAnchorElement>('.card-link'),site=part('.card-link small');
  const closeButton=element('close'),side=matchMedia(SIDE);
  let shown: Details | null=null,folded=false,leaving: Animation | null=null,running: Animation[]=[];
  let barrios: Barrio[] | null=null,asked=false;

  function play(target: Element,frames: Keyframe[],duration: number,delay=0){
    const animation=target.animate(frames,{duration,delay,easing:EASE,fill:'backwards'});
    running.push(animation);
    return animation;
  }
  function settle(){
    leaving?.cancel();leaving=null;
    for(const animation of running)animation.cancel();
    running=[];
    card.style.removeProperty('transform');
  }
  const rise=(distance: string)=>[{opacity:0,transform:'translateY('+distance+')'},{opacity:1,transform:'none'}];

  function nameDistrict(place: Details){
    if(barrios){district.textContent=barrioAt(barrios,...place.xy);return;}
    district.textContent='';
    if(asked)return;
    asked=true;
    void loadData('barrios.json',isBarrios).then(value=>{
      barrios=value;
      if(shown)district.textContent=barrioAt(value,...shown.xy);
    }).catch(()=>{asked=false;});
  }
  function fill(place: Details,order: string){
    // Each word sits in its own mask so the name can rise line by line; the text content stays the plain name.
    heading.replaceChildren(...place.name.split(' ').flatMap((word,i)=>{
      const mask=document.createElement('span'),inner=document.createElement('span');
      mask.className='w';inner.textContent=word;mask.append(inner);
      return i?[' ',mask]:[mask];
    }));
    number.textContent=order;
    const details=place.card;
    if(!details)return;
    nameDistrict(place);
    text.textContent=details.text;
    link.href=details.link;
    site.textContent=new URL(details.link).hostname.replace(/^www\./,'');
    figure.hidden=!details.photo;
    if(details.photo){
      const {file,author,license,source}=details.photo;
      credit.textContent=author+' · '+license;credit.href=source;
      image.alt=place.name;
      image.src='./photos/'+file;
      // The curtain lifts only once the picture can be drawn, over the resting tone of the frame.
      image.style.visibility='hidden';
      image.decode().then(()=>{
        if(shown!==place)return;
        image.style.removeProperty('visibility');
        play(image,[{clipPath:'inset(0 0 100% 0)',transform:'scale(1.16)'},{clipPath:'inset(0 0 0 0)',transform:'none'}],1200);
      }).catch(()=>{if(shown===place)figure.hidden=true;});
    }
  }
  function enterContent(){
    play(meta,rise('8px'),600,120);
    [...heading.querySelectorAll('.w>span')].forEach((word,i)=>play(word,[{transform:'translateY(112%)'},{transform:'none'}],850,190+i*55));
    play(text,rise('12px'),750,380);
    play(link,[{clipPath:'inset(0 100% 0 0)',opacity:0},{clipPath:'inset(0 0 0 0)',opacity:1}],800,500);
  }
  function enterPanel(){
    play(card,side.matches
      ? [{opacity:0,transform:'translateX(-22px)'},{opacity:1,transform:'none'}]
      : [{transform:'translateY(100%)'},{transform:'none'}],side.matches?560:640);
  }
  function present(panel: boolean,arrive: boolean){
    card.dataset.kind=panel?'card':'pill';
    card.toggleAttribute('data-folded',!panel && !!shown?.card);
    card.hidden=false;
    if(panel){
      if(arrive)enterPanel();
      enterContent();
    }else if(arrive)play(card,rise('10px'),420);
  }

  function show(place: Details,order: string){
    const wasPanel=!card.hidden && !leaving && card.dataset.kind==='card';
    settle();
    shown=place;folded=false;
    fill(place,order);
    present(!!place.card,!(wasPanel && place.card));
  }
  function close(){
    if(card.hidden || leaving)return;
    for(const animation of running)animation.cancel();
    running=[];
    shown=null;
    const out=card.animate(side.matches || card.dataset.kind==='pill'
      ? [{opacity:1},{opacity:0,transform:'translateY(8px)'}]
      : [{transform:'none'},{transform:'translateY(100%)'}],{duration:220,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    leaving=out;
    out.finished.then(()=>{
      if(leaving!==out)return;
      card.hidden=true;out.cancel();leaving=null;
    },()=>{});
  }
  // Sheet only: fold to the name pill so the map is free, and unfold on a tap.
  function fold(){
    if(!shown?.card || folded || side.matches || card.hidden || leaving)return;
    settle();folded=true;
    present(false,true);
  }
  function unfold(){
    if(!shown?.card || !folded)return;
    settle();folded=false;
    present(true,true);
  }
  card.addEventListener('click',event=>{
    if(folded && !(event.target instanceof Element && event.target.closest('#close')))unfold();
  });
  card.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();closeButton.click();}
  });
  // Dragging the photo down folds the sheet; a short drag springs back.
  let grab: {id: number;y: number} | null=null;
  figure.addEventListener('pointerdown',event=>{
    if(side.matches || folded || (event.target instanceof Element && event.target.closest('a')))return;
    grab={id:event.pointerId,y:event.clientY};
    figure.setPointerCapture(event.pointerId);
  });
  figure.addEventListener('pointermove',event=>{
    if(grab?.id!==event.pointerId)return;
    card.style.transform='translateY('+Math.max(0,event.clientY-grab.y)+'px)';
  });
  function release(event: PointerEvent){
    if(grab?.id!==event.pointerId)return;
    const pulled=Math.max(0,event.clientY-grab.y);
    grab=null;
    if(pulled>70){fold();return;}
    card.style.removeProperty('transform');
    if(pulled)play(card,[{transform:'translateY('+pulled+'px)'},{transform:'none'}],420);
  }
  figure.addEventListener('pointerup',release);
  figure.addEventListener('pointercancel',release);
  side.addEventListener('change',()=>{if(folded)unfold();});

  return {
    show,close,fold,
    /**
     * Where the place should sit on screen, in pixels from the centre of the map: the middle of what the open
     * panel leaves free. Read after `show`, before any transform moves the panel.
     */
    frame(){
      if(card.hidden || card.dataset.kind!=='card')return {x:0,y:0};
      const map=required(card.offsetParent,'map');
      if(side.matches)return {x:(card.offsetLeft+card.offsetWidth)/2,y:0};
      // Keep clear of the buttons along the top edge.
      const top=64,free=Math.max(top+56,card.offsetTop);
      return {x:0,y:(top+free)/2-map.clientHeight/2};
    }
  };
}
