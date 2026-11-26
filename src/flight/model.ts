import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const cream='#f4e9c7',red='#bc4134',rubber='#303530',glazing='#647e83';

/** The longitudinal axis is +X, with 7 m of fuselage and a 10.7 m braced high wing. */
export function makePiper(){
  const root=new T.Group(),wings=new T.Group(),propeller=new T.Group();
  const material=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.76});
  const pieces:T.BufferGeometry[]=[];
  function part(geometry:T.BufferGeometry,colour:string,x=0,y=0,z=0){
    const g=geometry.index?geometry.toNonIndexed():geometry;
    g.translate(x,y,z);g.deleteAttribute('uv');g.computeVertexNormals();
    const tint=new T.Color(colour),count=g.getAttribute('position').count;
    const colours=new Float32Array(count*3);
    for(let i=0;i<count;i++)tint.toArray(colours,i*3);
    g.setAttribute('color',new T.BufferAttribute(colours,3));pieces.push(g);
  }
  function assemble(group:T.Group){
    const geometry=mergeGeometries(pieces);pieces.length=0;
    group.add(new T.Mesh(geometry,material));
  }
  function rod(a:T.Vector3,b:T.Vector3,r:number){
    const direction=b.clone().sub(a),centre=a.clone().lerp(b,.5);
    const g=new T.CylinderGeometry(r,r,direction.length(),6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));
    part(g,rubber,centre.x,centre.y,centre.z);
  }
  function oval(x:number,y:number,z:number,sx:number,sy:number,sz:number,colour:string){
    part(new T.SphereGeometry(1,16,8).scale(sx,sy,sz),colour,x,y,z);
  }
  // The flat-sided cabin tapers into the rear fuselage.
  const sections=[[-3.4,.14,.16,.19],[-1.1,.46,.39,.02],[.9,.59,.5,0],[2.55,.46,.40,.02],[2.95,.33,.30,.05]];
  const vertices:number[]=[];
  const point=(section:number[],angle:number)=>[section[0],section[3]+section[2]*Math.sin(angle),section[1]*Math.cos(angle)];
  for(let k=1;k<sections.length;k++)for(let j=0;j<12;j++){
    const a=j*Math.PI/6,b=(j+1)*Math.PI/6;
    const p=point(sections[k-1],a),q=point(sections[k],a),r=point(sections[k],b),s=point(sections[k-1],b);
    vertices.push(...p,...q,...r,...p,...r,...s);
  }
  const skin=new T.BufferGeometry();skin.setAttribute('position',new T.Float32BufferAttribute(vertices,3));part(skin,cream);
  oval(2.74,.04,0,.48,.4,.46,red);
  oval(.26,.43,0,1.09,.59,.55,glazing);
  oval(-2.78,.24,0,.73,.09,1.65,cream);
  oval(-2.9,.68,0,.54,.67,.09,red);
  for(const side of [-1,1]){
    oval(.2,.0,.50*side,1.65,.08,.06,red);
    rod(new T.Vector3(-.3,.12,.50*side),new T.Vector3(-.48,.9,.42*side),.045);
    rod(new T.Vector3(1.05,.18,.47*side),new T.Vector3(.65,.91,.41*side),.04);
    part(new T.CylinderGeometry(.31,.31,.18,12).rotateX(Math.PI/2),rubber,.66,-.78,side*.88);
    for(const ax of [-.42,1.08])rod(new T.Vector3(ax,-.2,side*.32),new T.Vector3(.66,-.78,side*.88),.05);
  }
  part(new T.CylinderGeometry(.16,.16,.12,10).rotateX(Math.PI/2),rubber,-2.88,-.25);
  assemble(root);
  part(new T.BoxGeometry(1.52,.14,9.3),cream,0,.96);
  for(const side of [-1,1]){
    oval(0,.96,side*4.64,.76,.07,.71,cream);
    part(new T.BoxGeometry(1.53,.148,.26),red,0,.96,side*4.27);
    part(new T.BoxGeometry(1.53,.148,.12),red,0,.96,side*3.88);
    for(const ax of [-.52,.58])rod(new T.Vector3(.09,-.21,side*.44),new T.Vector3(ax,.89,side*3.15),.04);
  }
  assemble(wings);root.add(wings);
  oval(0,0,0,.24,.18,.18,red);
  oval(0,0,0,.07,1.04,.11,rubber);
  assemble(propeller);propeller.position.set(3.18,.04,0);root.add(propeller);
  return {root,wings,propeller};
}
