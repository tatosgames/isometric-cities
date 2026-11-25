import type { PilotEdits } from '../data/pilot-edits.ts';
import { ringCenter } from '../data/sector-index.ts';
import type { Building, Point, Ring } from '../data/types.ts';

type Edit =
  | { kind: 'move-prop'; id: string; position: Point }
  | { kind: 'rotate-prop'; id: string; yaw: number }
  | { kind: 'move-building'; part: number; position: Point }
  | { kind: 'move-vertex'; part: number; position: Point; vertex: number };

export const roundCoordinate = (value: number) => Math.round(value*1000)/1000;
export const vertexList = (rings: Ring[]) => rings.flatMap((ring,r) => ring.slice(0,-1).map((point,i) => ({ r,i,point })));

export function draftEdit(edits: PilotEdits, edit: Edit, buildings: Building[], original: Building[]){
  if (edit.kind === 'move-prop' || edit.kind === 'rotate-prop') {
    return { ...edits, props: edits.props.map(prop => prop.id !== edit.id ? prop :
      edit.kind === 'move-prop' ? { ...prop, position: edit.position } : { ...prop, yaw: edit.yaw }) };
  }

  const {part,position} = edit;
  const building = buildings[part];
  let rings: Ring[];
  if (edit.kind === 'move-vertex') {
    const { r,i } = vertexList(building.rings)[edit.vertex];
    rings = building.rings.map((ring,index) => index === r ? ring.map((p,j) =>
      j === i || (i === 0 && j === ring.length-1) ? position : p) : ring);
  } else {
    const [x,y] = ringCenter(building.rings[0]);
    const dx = position[0]-x, dy = position[1]-y;
    rings = building.rings.map(ring => ring.map(([east,north]) => [roundCoordinate(east+dx),roundCoordinate(north+dy)]));
  }
  const footprints = edits.footprints.filter(entry => entry.part !== part);
  if (JSON.stringify(rings) !== JSON.stringify(original[part].rings)) footprints.push({ part,id: building.id,rings });
  footprints.sort((a,b) => a.part-b.part);
  return { ...edits, footprints };
}
