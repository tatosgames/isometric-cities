/** Weighted shortest paths. Each predecessor points one hop back to source. */
export function routesFrom(nodes,source){
  const dist=new Float64Array(nodes.length).fill(Infinity);
  const prev=new Int32Array(nodes.length).fill(-1);
  dist[source]=0;
  const queue=[[0,source]];
  function push(entry){
    let i=queue.length;
    queue.push(entry);
    while(i>0){
      const parent=(i-1)>>1;
      if(queue[parent][0]<=entry[0])break;
      queue[i]=queue[parent];i=parent;
    }
    queue[i]=entry;
  }
  function pop(){
    const top=queue[0],last=queue.pop();
    if(!queue.length)return top;
    let i=0;
    while(2*i+1<queue.length){
      let child=2*i+1;
      if(child+1<queue.length && queue[child+1][0]<queue[child][0])child++;
      if(queue[child][0]>=last[0])break;
      queue[i]=queue[child];i=child;
    }
    queue[i]=last;
    return top;
  }
  while(queue.length){
    const [d,n]=pop();
    if(d>dist[n])continue;
    for(const [next,w] of nodes[n].links){
      const cost=d+w;
      if(cost>=dist[next])continue;
      dist[next]=cost;prev[next]=n;push([cost,next]);
    }
  }
  return {source,dist,prev};
}

export function indexRoadNodes(nodes){
  const size=80,cells=new Map(),valid=[];
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  nodes.forEach((n,i)=>{
    if(!n.ok)return;
    const x=Math.floor(n.x/size),y=Math.floor(n.y/size),key=x+','+y;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    if(!cells.has(key))cells.set(key,[]);
    cells.get(key).push(i);valid.push(i);
  });
  function nearest(x,y){
    const cx=Math.floor(x/size),cy=Math.floor(y/size);
    let best=-1,dist=Infinity;
    function scan(i,j){
      for(const id of cells.get(i+','+j)??[]){
        const n=nodes[id],d=(n.x-x)**2+(n.y-y)**2;
        if(d<dist||(d===dist&&id<best)){dist=d;best=id;}
      }
    }
    const limit=Math.max(cx-minX,maxX-cx,cy-minY,maxY-cy);
    for(let r=0;r<=limit;r++){
      for(let i=cx-r;i<=cx+r;i++){
        scan(i,cy-r);if(r)scan(i,cy+r);
      }
      for(let j=cy-r+1;j<cy+r;j++){scan(cx-r,j);scan(cx+r,j);}
      const edge=Math.min(x-(cx-r)*size,(cx+r+1)*size-x,y-(cy-r)*size,(cy+r+1)*size-y);
      if(dist<edge*edge)break;
    }
    return best;
  }
  return {nearest,valid};
}
