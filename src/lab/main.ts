import {required} from '../required.ts';
import {bindLabPanel,copyLabLink,labNavigation,labs,roadScenarios} from './lab-shell.ts';
import {caseParts,query as urlQuery,search,upgradeUrl} from '../url-state.ts';

const el=(id:string)=>required(document.getElementById(id),id);
upgradeUrl();
const query=urlQuery();
const roads=query.get('lab')==='roads';
const demolition=query.get('lab')==='demolition';
const flood=query.get('lab')==='flood';
el('lab-navigation').append(labNavigation(roads?'roads':demolition?'demolition':flood?'flood':undefined));

if(demolition || flood){
  el('title').textContent=labs.find(lab=>lab.id===(flood?'flood':'demolition'))!.title;
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
      actions.append(copyLabLink(()=>{const url=new URL(location.href);url.search=search(currentParams());return url;}));
    })
    .catch(error=>{status.textContent=String(error);});
}else if(roads){
  const requested=caseParts(query)[0];
  const scenario=roadScenarios.find(entry=>entry.id===requested)??roadScenarios[0];
  const select=required(document.querySelector<HTMLSelectElement>('#scenario'),'road scenario');
  for(const {id,title} of roadScenarios)select.add(new Option(title,id,id===scenario.id,id===scenario.id));
  const roadUrl=(id:string,params=new URLSearchParams(location.search))=>{
    const destination=new URL(location.href);
    params.set('lab','roads');
    // A case that already names this scenario keeps its sample (`widths.principale`).
    if(caseParts(params)[0]!==id)params.set('case',id);
    destination.search=search(params);
    return destination;
  };
  select.onchange=()=>{location.href=roadUrl(select.value,new URLSearchParams()).href;};
  el('title').textContent=labs.find(lab=>lab.id==='roads')!.title;
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
