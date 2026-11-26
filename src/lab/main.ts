// Each entry owns its assets and UI. A full-page navigation releases the previous WebGL context.
const tests = [
  {id:'lod',title:'Detail transitions',
    description:'Compares zoom thresholds, asphalt and the screen pattern for buildings and trees on Calle San Nicolás.',
    start:async()=>{const {sectorRoadLab}=await import('./sector-road-lab.ts');await sectorRoadLab();}},
  {id:'larghezze',title:'Carriageway width',
    description:'Compares three measured sections with the same car and the same camera.',
    start:async()=>{const {sectorRoadLab}=await import('./sector-road-lab.ts');await sectorRoadLab();}},
  {id:'settori',title:'Calle San Nicolás · crossing sectors',
    description:'Compares the change between overview and carriageway on the sloping bend.',
    start:async()=>{const {sectorRoadLab}=await import('./sector-road-lab.ts');await sectorRoadLab();}},
  {id:'strade', title:'Roads · Mercado de Vegueta',
    description:'Compares the current rendering, the 4 px/m texture and the geometric carriageway along the same route.',
    start:async()=>{const {roadLab}=await import('./road-lab.ts');await roadLab();}},
  {id:'qualita',title:'Rendering quality',href:'./index.html?lab=qualita',
    description:'Compare Matcap, Base, Sole and Matcap + tilt, with frame times, shadows and drawing-buffer diagnostics.'},
  {id:'guida',title:'Drive · tuning',href:'./index.html?lab=guida&area=pilot',
    description:'Drive in the Vegueta pilot while changing the values of player, patrols, car and camera live, with or without police.'}
];
const chosen=new URLSearchParams(location.search).get('test');
const selected=tests.find(t=>t.id===chosen),start=selected?.start;
if(selected && start){
  document.getElementById('catalog')!.hidden=true;
  document.querySelector('main')!.hidden=false;
  for(const id of ['back','panel'])document.getElementById(id)!.hidden=false;
  document.getElementById('title')!.textContent=selected.title;
  const status=document.getElementById('status')!;
  status.textContent='Loading the sample…';
  start().catch(error=>{status.textContent=String(error);});
}else{
  const list=document.getElementById('tests')!;
  for(const test of tests){
    const li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');
    a.href=test.href??'?test='+encodeURIComponent(test.id);a.textContent=test.title;p.textContent=test.description;
    li.append(a,p);list.append(li);
  }
}
