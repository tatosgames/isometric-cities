// Each entry owns its assets and UI. A full-page navigation releases the previous WebGL context.
const tests = [
  {id:'strade', title:'Strade · Mercado de Vegueta',
    description:'Confronta la resa attuale, la texture a 4 px/m e la carreggiata geometrica lungo lo stesso percorso.',
    start:async()=>{const {roadLab}=await import('./road-lab.ts');await roadLab();}}
];
const chosen=new URLSearchParams(location.search).get('test');
const selected=tests.find(t=>t.id===chosen);
if(selected){
  document.getElementById('catalog')!.hidden=true;
  document.querySelector('main')!.hidden=false;
  for(const id of ['back','panel'])document.getElementById(id)!.hidden=false;
  document.getElementById('title')!.textContent=selected.title;
  const status=document.getElementById('status')!;
  status.textContent='Caricamento del campione…';
  selected.start().catch(error=>{status.textContent=String(error);});
}else{
  const list=document.getElementById('tests')!;
  for(const test of tests){
    const li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');
    a.href='?test='+encodeURIComponent(test.id);a.textContent=test.title;p.textContent=test.description;
    li.append(a,p);list.append(li);
  }
}
