import './lab-shell.css';

export const labs = [
  {id:'qualita',title:'Rendering, effects & quality',href:'./index.html?lab=qualita',
    description:'Compare looks and rendering quality on the live map.'},
  {id:'guida',title:'Driving & flight',href:'./index.html?lab=guida&area=pilot',
    description:'Tune, replay and measure driving or flying from Vegueta.'},
  {id:'strade',title:'Map, LOD & roads',href:'./lab.html?lab=strade',
    description:'Compare road surfaces and widths, sector boundaries and detail transitions.'}
] as const;

export const roadScenarios = [
  {id:'mercado',title:'Mercado de Vegueta · Road surfaces',legacy:'strade'},
  {id:'larghezze',title:'Carriageway widths',legacy:'larghezze'},
  {id:'settori',title:'Calle San Nicolás · Sector boundaries',legacy:'settori'},
  {id:'lod',title:'Detail transitions',legacy:'lod'}
] as const;

export function labNavigation(current?:typeof labs[number]['id']|'editor'){
  const nav=document.createElement('div');
  nav.className='lab-nav';
  nav.setAttribute('role','navigation');
  nav.setAttribute('aria-label','Labs');
  const links=[
    ...(current?[{id:'catalog',title:'Labs',href:'./lab.html'},...labs]:[]),
    // editor.html is deprecated: still built and reachable by URL, no longer linked from the labs.
    {id:'game',title:'Game',href:'./'}
  ];
  for(const {id,title,href} of links){
    const link=document.createElement('a');
    link.href=href;link.textContent=title;
    if(id===current)link.setAttribute('aria-current','page');
    nav.append(link);
  }
  return nav;
}

export function bindLabPanel(button:HTMLElement,panel:HTMLElement){
  button.setAttribute('aria-expanded',String(!panel.hidden));
  button.addEventListener('click',()=>{
    panel.hidden=!panel.hidden;
    button.setAttribute('aria-expanded',String(!panel.hidden));
  });
}

export function copyLabLink(url:()=>URL){
  const button=document.createElement('button');
  button.type='button';button.textContent='Copy link';
  button.addEventListener('click',async()=>{
    const share=url().href;
    try{
      await navigator.clipboard.writeText(share);
      button.textContent='Link copied';
      setTimeout(()=>{button.textContent='Copy link';},1400);
    }catch{window.prompt('Copy this link',share);}
  });
  return button;
}

export function runtimeLab(current:'qualita'|'guida',url:()=>URL){
  const root=document.createElement('section'),bar=document.createElement('div');
  const panel=document.createElement('div'),toggle=document.createElement('button');
  root.className='lab-runtime';bar.className='lab-actions';
  panel.className='lab-runtime-panel';panel.id='lab-controls';
  const narrow=matchMedia('(max-width: 720px)').matches;
  panel.hidden=narrow;
  toggle.type='button';toggle.textContent='Controls';toggle.setAttribute('aria-controls',panel.id);
  bindLabPanel(toggle,panel);
  const nav=labNavigation(current);
  if(narrow){
    const menu=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=labs.find(lab=>lab.id===current)!.title;
    menu.append(summary,nav);root.append(menu);
  }else root.append(nav);
  bar.append(toggle,copyLabLink(url));root.append(bar,panel);
  return {root,panel};
}
