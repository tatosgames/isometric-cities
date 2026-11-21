import * as T from 'three';

// Numeric selections were written by the first viewer, in this fixed order.
const legacyIds=['santa-ana','casa-de-colon','mercado-de-vegueta','teatro-perez-galdos','gabinete-literario','san-telmo'];

export function createPlacesUI(features, altitude, onSelect){
  const card=document.querySelector('article');
  const nav=document.querySelector('nav');
  const toggle=document.getElementById('index-toggle');
  const closeButton=document.getElementById('close');
  const places=new Map();
  const projected=new T.Vector3();
  let selected=null,returnTo=toggle;
  function menu(open){
    nav.classList.toggle('open',open);
    toggle.setAttribute('aria-expanded',String(open));
  }
  function select(id){
    const place=places.get(id);
    selected=place?id:null;
    card.hidden=!place;
    if(place)card.querySelector('h3').textContent=place.name;
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
    document.getElementById('places').append(btn);document.getElementById('pins').append(pin);
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
    point:id=>places.get(id)?.point,
    close:()=>select(null),
    restore:id=>select(typeof id==='number'?legacyIds[id]:id),
    project(camera){
      for(const {point,pin} of places.values()){
        projected.copy(point).project(camera);
        pin.style.left=(projected.x+1)*50+'%';pin.style.top=(1-projected.y)*50+'%';
        pin.hidden=Math.abs(projected.x)>1||Math.abs(projected.y)>1;
      }
    }
  };
}
