import type { Altitude, Place } from '../data/types.ts';
import { element } from './dom.ts';
import { required } from '../required.ts';
import * as T from 'three';

interface PlaceControl {name: string; point: T.Vector3; pin: HTMLButtonElement; btn: HTMLButtonElement}


// Numeric selections were written by the first viewer, in this fixed order.
const legacyIds=['santa-ana','casa-de-colon','mercado-de-vegueta','teatro-perez-galdos','gabinete-literario','san-telmo'];

export function createPlacesUI(features: Place[], altitude: Altitude, onSelect: (id: string,point: T.Vector3) => boolean){
  const card=required(document.querySelector('article'),'place card');
  const heading=required(card.querySelector('h3'),'place heading');
  const nav=required(document.querySelector('nav'),'places navigation');
  const licences=required(nav.querySelector('details'),'data licences');
  const toggle=element('index-toggle');
  const closeButton=element('close');
  const places=new Map<string,PlaceControl>();
  const projected=new T.Vector3();
  let selected: string | null=null,returnTo=toggle;
  function menu(open: boolean){
    if(open)licences.open=false;
    nav.classList.toggle('open',open);
    toggle.setAttribute('aria-expanded',String(open));
  }
  function select(id: string | null){
    const place=id===null?undefined:places.get(id);
    selected=place?id:null;
    card.hidden=!place;
    if(place)heading.textContent=place.name;
    for(const [key,{btn,pin}] of places){
      btn.setAttribute('aria-pressed',String(key===selected));
      pin.setAttribute('aria-pressed',String(key===selected));
    }
  }
  toggle.onclick=()=>menu(!nav.classList.contains('open'));
  closeButton.onclick=()=>{select(null);returnTo.focus();};
  for(const [index,{properties:p}] of features.entries()){
    const btn=document.createElement('button'),pin=document.createElement('button');
    const number=String(index+1).padStart(2,'0');
    const label=document.createElement('b');
    label.textContent=number;
    btn.append(label,p.name);pin.textContent=number;pin.className='pin';
    btn.dataset.placeId=pin.dataset.placeId=p.id;
    pin.setAttribute('aria-label',p.name);
    element('places').append(btn);element('pins').append(pin);
    const [x,y]=p.xy,point=new T.Vector3(x,altitude(x,y)+p.markerHeight,-y);
    places.set(p.id,{name:p.name,point,pin,btn});
    for(const button of [btn,pin])button.onclick=()=>{
      if(!onSelect(p.id,point))return;
      returnTo=button===pin?pin:toggle;menu(false);select(p.id);closeButton.focus({preventScroll:true});
    };
  }
  select(null);
  return {
    get selected(){return selected;},
    point:(id: string | null | undefined)=>id==null?undefined:places.get(id)?.point,
    close:()=>select(null),
    restore:(id: string | number | null | undefined)=>select((typeof id==='number'?legacyIds[id]:id)??null),
    project(camera: T.Camera){
      for(const {point,pin} of places.values()){
        projected.copy(point).project(camera);
        pin.style.left=(projected.x+1)*50+'%';pin.style.top=(1-projected.y)*50+'%';
        pin.hidden=Math.abs(projected.x)>1||Math.abs(projected.y)>1;
      }
    }
  };
}
