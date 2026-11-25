// Each entry owns its assets and UI. A full-page navigation releases the previous WebGL context.
const tests = [
  {id:'lod',title:'Transizioni di dettaglio',
    description:'Confronta soglie di zoom, asfalto e retino per edifici e alberi su Calle San Nicolás.',
    start:async()=>{const {sectorRoadLab}=await import('./sector-road-lab.ts');await sectorRoadLab();}},
  {id:'larghezze',title:'Larghezza delle carreggiate',
    description:'Confronta tre sezioni misurate con la stessa auto e la stessa camera.',
    start:async()=>{const {sectorRoadLab}=await import('./sector-road-lab.ts');await sectorRoadLab();}},
  {id:'settori',title:'Calle San Nicolás · attraversamento settori',
    description:'Confronta il passaggio tra panoramica e carreggiata sulla curva in pendenza.',
    start:async()=>{const {sectorRoadLab}=await import('./sector-road-lab.ts');await sectorRoadLab();}},
  {id:'strade', title:'Strade · Mercado de Vegueta',
    description:'Confronta la resa attuale, la texture a 4 px/m e la carreggiata geometrica lungo lo stesso percorso.',
    start:async()=>{const {roadLab}=await import('./road-lab.ts');await roadLab();}},
  {id:'guida',title:'Guida · taratura',href:'./index.html?lab=guida&area=pilot',
    description:'Guida nel pilota di Vegueta cambiando dal vivo i parametri di giocatore, pattuglie, auto e camera, con e senza polizia.'}
];
const chosen=new URLSearchParams(location.search).get('test');
const selected=tests.find(t=>t.id===chosen && t.start);
if(selected){
  document.getElementById('catalog')!.hidden=true;
  document.querySelector('main')!.hidden=false;
  for(const id of ['back','panel'])document.getElementById(id)!.hidden=false;
  document.getElementById('title')!.textContent=selected.title;
  const status=document.getElementById('status')!;
  status.textContent='Caricamento del campione…';
  selected.start?.().catch(error=>{status.textContent=String(error);});
}else{
  const list=document.getElementById('tests')!;
  for(const test of tests){
    const li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');
    a.href=test.href??'?test='+encodeURIComponent(test.id);a.textContent=test.title;p.textContent=test.description;
    li.append(a,p);list.append(li);
  }
}
