// What holds the memory at one view: node scripts/heap-profile.mjs [x,y,zoom] [dist] [query] [depth]
// x and y are local metres; zoom 1.59 is the place view and 0.352 the widest view of the 390 px phone.
// Use an unminified build to read the owners by name: npx vite build --minify false --outDir .cache/dist-profile
import {launchBrowser,serveMap} from './qa-browser.mjs';
const [place='-80,-560,1.59',dir='dist',query='',depth='2']=process.argv.slice(2);
const {server}=await serveMap({env:null,outDir:dir});
const browser=await launchBrowser();
const mb=n=>+(n/1048576).toFixed(1);
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.addInitScript(([x,y,zoom])=>sessionStorage.setItem('map-view:'+location.pathname+location.search,JSON.stringify({target:[x,0,-y],zoom,turn:0})),place.split(',').map(Number));
  await page.goto(server.resolvedUrls.local[0]+query);await page.waitForSelector('#scene[data-view]');
  await page.waitForFunction(()=>{const e=document.querySelector('#scene');if(e.dataset.moving!=='false')return false;const s=JSON.parse(e.dataset.sectors);return !s.pending&&!s.fading;},null,{timeout:120000});
  await page.waitForTimeout(4000);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const usage=await cdp.send('Runtime.getHeapUsage');
  const s=await page.evaluate(()=>JSON.parse(document.querySelector('#scene').dataset.sectors));
  console.log({view:place,heapMB:mb(usage.usedSize),backingStoreMB:mb(usage.backingStorageSize||0),detailMB:mb(s.bytes),zonesMB:mb(s.zoneBytes),zones:s.zones.length,sectors:s.loaded});

  // The worker is a separate heap: the page's snapshot does not include it.
  try{
    const sessions=[];cdp.on('Target.attachedToTarget',e=>sessions.push(e));
    await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:false});
    await page.waitForTimeout(300);
    for(const {sessionId,targetInfo} of sessions){
      const answer=new Promise(done=>{const on=e=>{if(e.sessionId!==sessionId)return;const m=JSON.parse(e.message);if(m.id===2){cdp.off('Target.receivedMessageFromTarget',on);done(m.result);}};cdp.on('Target.receivedMessageFromTarget',on);});
      await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:1,method:'HeapProfiler.collectGarbage'})});
      await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:2,method:'Runtime.getHeapUsage'})});
      const h=await answer;console.log({worker:targetInfo.type,heapMB:mb(h.usedSize),backingStoreMB:mb(h.backingStorageSize||0)});
    }
  }catch(error){console.log('worker heap not read:',error.message);}

  const chunks=[];cdp.on('HeapProfiler.addHeapSnapshotChunk',e=>chunks.push(e.chunk));
  await cdp.send('HeapProfiler.takeHeapSnapshot',{reportProgress:false});
  const snap=JSON.parse(chunks.join(''));chunks.length=0;
  const {node_fields:nf,edge_fields:ef,node_types,edge_types}=snap.snapshot.meta,N=nf.length,E=ef.length;
  const nodes=snap.nodes,edges=snap.edges,strings=snap.strings,count=nodes.length/N;
  const nType=nf.indexOf('type'),nName=nf.indexOf('name'),nSelf=nf.indexOf('self_size'),nEdges=nf.indexOf('edge_count');
  const eType=ef.indexOf('type'),eName=ef.indexOf('name_or_index'),eTo=ef.indexOf('to_node');
  const types=node_types[0],etypes=edge_types[0];

  // 1. What kind of thing the bytes are.
  const kinds=new Map;let total=0;
  for(let i=0;i<count;i++){
    const type=types[nodes[i*N+nType]],name=strings[nodes[i*N+nName]],size=nodes[i*N+nSelf];total+=size;
    const key=type==='native'||type==='array'||type==='hidden'||type==='code'?type+' '+name.slice(0,40):type==='object'?'object '+name.slice(0,30):type;
    kinds.set(key,(kinds.get(key)||0)+size);
  }
  console.log('\nBy kind (MB), total',mb(total));
  for(const [k,v] of [...kinds].sort((a,b)=>b[1]-a[1]).slice(0,18))console.log(String(mb(v)).padStart(7),k);

  // 2. Who holds them: each node goes to the first named variables on its shortest path from the root.
  const first=new Uint32Array(count+1);for(let i=0,e=0;i<count;i++){first[i]=e;e+=nodes[i*N+nEdges];first[i+1]=e;}
  const parent=new Int32Array(count).fill(-1),via=new Int32Array(count).fill(-1),queue=new Uint32Array(count);let head=0,tail=0;
  parent[0]=0;queue[tail++]=0;
  while(head<tail){
    const n=queue[head++];
    for(let e=first[n];e<first[n+1];e++){
      const type=etypes[edges[e*E+eType]];if(type==='weak'||type==='shortcut')continue;
      const to=edges[e*E+eTo]/N;if(parent[to]!==-1)continue;
      parent[to]=n;via[to]=e;queue[tail++]=to;
    }
  }
  const label=new Array(count),names=new Uint8Array(count),want=+depth;
  const owners=new Map;
  for(let q=0;q<tail;q++){
    const n=queue[q];
    if(n===0){label[n]='';continue;}
    const p=parent[n],e=via[n],type=etypes[edges[e*E+eType]];
    let own=label[p],had=names[p];
    // Variables of a scope and named properties tell the owner; array slots and internals do not.
    if(had<want&&(type==='context'||(type==='property'&&had>0))){
      const name=strings[edges[e*E+eName]];
      if(!/^(__proto__|prototype|constructor|this|<symbol)/.test(name)){own+=(own?'.':'')+name;had++;}
    }
    label[n]=own;names[n]=had;
    owners.set(own,(owners.get(own)||0)+nodes[n*N+nSelf]);
  }
  console.log('\nBy owner (MB), depth',want);
  for(const [k,v] of [...owners].sort((a,b)=>b[1]-a[1]).slice(0,45))console.log(String(mb(v)).padStart(7),k||'(browser, engine and unnamed)');
}finally{await browser.close();await server.close();}
