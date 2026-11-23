import type { Altitude, Road } from '../data/types.ts';

const sampleDistance=6;
const deckBuffer=sampleDistance+5;

export function makeRoadGrade(altitude: Altitude,roads: Road[]){
  // The terrain grid describes the ground under a bridge. Keep the crossing and its approach neutral.
  const decks=roads.filter(road=>(road.bridge && road.bridge!=='no') || Math.abs(Number(road.layer))>0)
    .flatMap(({line})=>line.slice(1).flatMap(([bx,by],i)=>{
      const [ax,ay]=line[i],dx=bx-ax,dy=by-ay,lengthSq=dx*dx+dy*dy;
      if(!lengthSq)return [];
      return [{ax,ay,dx,dy,lengthSq,left:Math.min(ax,bx)-deckBuffer,right:Math.max(ax,bx)+deckBuffer,
        bottom:Math.min(ay,by)-deckBuffer,top:Math.max(ay,by)+deckBuffer}];
    }));

  return (x: number,y: number,dx: number,dy: number): number | undefined=>{
    for(const deck of decks){
      if(x<deck.left || x>deck.right || y<deck.bottom || y>deck.top)continue;
      const rx=x-deck.ax,ry=y-deck.ay;
      const t=Math.max(0,Math.min(1,(rx*deck.dx+ry*deck.dy)/deck.lengthSq));
      if((rx-t*deck.dx)**2+(ry-t*deck.dy)**2<=deckBuffer**2)return undefined;
    }
    const sx=dx*sampleDistance,sy=dy*sampleDistance;
    return (altitude(x+sx,y+sy)-altitude(x-sx,y-sy))/(2*sampleDistance);
  };
}
