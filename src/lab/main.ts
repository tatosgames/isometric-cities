import {required} from '../required.ts';
import {bindLabPanel,copyLabLink,labNavigation,labs,roadScenarios} from './lab-shell.ts';

const el=(id:string)=>required(document.getElementById(id),id);
const query=new URLSearchParams(location.search),legacy=query.get('test');
const roads=query.get('lab')==='strade' || roadScenarios.some(scenario=>scenario.legacy===legacy);
const demolition=query.get('lab')==='demolizione';
const flood=query.get('lab')==='inondazione';
el('lab-navigation').append(labNavigation(roads?'strade':demolition?'demolizione':flood?'inondazione':undefined));

if(demolition || flood){
  el('title').textContent=labs[flood?4:3].title;
  el('catalog').hidden=true;
  required(document.querySelector('main'),'lab view').hidden=false;
  const actions=el('road-actions');
  // The scenario selector belongs to the road lab.
  el('scenario').hidden=required(actions.querySelector('label'),'scenario label').hidden=true;
  el('lab-navigation').append(actions);
  actions.hidden=false;
  bindLabPanel(el('panel'),el('settings'));
  const status=el('status');
  status.textContent='Loading the city…';
  (flood?import('./flood-lab.ts').then(({floodLab})=>floodLab()):import('./demolition-lab.ts').then(({demolitionLab})=>demolitionLab()))
    .then(currentParams=>{
      actions.append(copyLabLink(()=>{const url=new URL(location.href);url.search=currentParams().toString();return url;}));
    })
    .catch(error=>{status.textContent=String(error);});
}else if(roads){
  const requested=query.get('scenario');
  const scenario=roadScenarios.find(entry=>entry.id===requested || (!requested && entry.legacy===legacy))??roadScenarios[0];
  const select=required(document.querySelector<HTMLSelectElement>('#scenario'),'road scenario');
  for(const {id,title} of roadScenarios)select.add(new Option(title,id,id===scenario.id,id===scenario.id));
  const roadUrl=(id:string,params=new URLSearchParams(location.search))=>{
    const destination=new URL(location.href);
    params.delete('test');
    params.set('lab','strade');
    params.set('scenario',id);
    destination.search=params.toString();
    return destination;
  };
  select.onchange=()=>{location.href=roadUrl(select.value,new URLSearchParams()).href;};
  el('title').textContent=labs[2].title;
  el('catalog').hidden=true;
  required(document.querySelector('main'),'road lab').hidden=false;
  const actions=el('road-actions');
  el('lab-navigation').append(actions);
  actions.hidden=false;
  bindLabPanel(el('panel'),el('settings'));
  const status=el('status');
  status.textContent='Loading the sample…';
  const start=scenario.id==='mercado'
    ? import('./road-lab.ts').then(({roadLab})=>roadLab())
    : import('./sector-road-lab.ts').then(({sectorRoadLab})=>sectorRoadLab(scenario.id));
  start.then(currentParams=>{actions.append(copyLabLink(()=>roadUrl(scenario.id,currentParams())));})
    .catch(error=>{status.textContent=String(error);});
}else{
  const list=el('tests');
  for(const lab of labs){
    const li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');
    a.href=lab.href;a.textContent=lab.title;p.textContent=lab.description;
    li.append(a,p);list.append(li);
  }
}
