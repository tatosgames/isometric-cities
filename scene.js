import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function makeCity(data, neutral, roofColours, roofTones) {
  const group = new T.Group();
  const buckets = new Map();
  const terrain = data.terrain;
  function altitude(x,y) {
    const col=T.MathUtils.clamp((x-terrain.origin[0])/terrain.step,0,terrain.w-1.001);
    const row=T.MathUtils.clamp((terrain.origin[1]-y)/(terrain.stepY || terrain.step),0,terrain.h-1.001);
    const i=Math.floor(row)*terrain.w+Math.floor(col);
    const v=terrain.values, u=col%1, t=row%1;
    return T.MathUtils.lerp(T.MathUtils.lerp(v[i],v[i+1],u),T.MathUtils.lerp(v[i+terrain.w],v[i+terrain.w+1],u),t);
  }
  function add(g,color,x=0,y=0,surface=0) {
    const geom=g.index?g.toNonIndexed():g;
    geom.deleteAttribute('uv');
    geom.setAttribute('surface',new T.Float32BufferAttribute(new Float32Array(geom.attributes.position.count).fill(surface),1));
    const shade=new T.Color(neutral ? '#e4dfd3' : color);
    const rgb=new Float32Array(geom.attributes.position.count*3);
    for(let i=0;i<rgb.length;i+=3) shade.toArray(rgb,i);
    geom.setAttribute('color',new T.BufferAttribute(rgb,3));
    const key=Math.floor(x/120)+','+Math.floor(y/120);
    if(!buckets.has(key)) buckets.set(key,[]);
    buckets.get(key).push(geom);
  }
  function shape(rings) {
    const paths=rings.map(r=>r.map(([x,y])=>new T.Vector2(x,y)));
    const s=new T.Shape(paths[0]); s.holes=paths.slice(1).map(p=>new T.Path(p)); return s;
  }
  function drape(g,lift) {
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++) p.setZ(i,altitude(p.getX(i),p.getY(i))+lift);
    g.computeVertexNormals(); return g.rotateX(-Math.PI/2);
  }
  // Subdivide the ground before clipping so local relief survives triangulation.
  for(const ring of data.ground) add(drape(new T.ShapeGeometry(shape([ring])),0),'#c7bcb2',ring[0][0],ring[0][1],1);
  const boundary=data.boundary;
  for(let k=1;k<boundary.length;k++){
    const [a,b]=boundary[k-1],[c,d]=boundary[k];
    const steps=Math.ceil(Math.hypot(c-a,d-b)/12);
    for(let j=0;j<steps;j++){
      const x=T.MathUtils.lerp(a,c,j/steps),y=T.MathUtils.lerp(b,d,j/steps);
      const xx=T.MathUtils.lerp(a,c,(j+1)/steps),yy=T.MathUtils.lerp(b,d,(j+1)/steps);
      const v=[x,altitude(x,y),-y,xx,altitude(xx,yy),-yy,x,-5,-y,xx,altitude(xx,yy),-yy,xx,-5,-yy,x,-5,-y];
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,'#bb9f7d',x,y);
    }
  }
  for(const s of data.surfaces){
    const pavedPark=['584041194','168978301','251673532'].includes(s.id);
    const planted=s.kind==='park' && !pavedPark;
    const paving=s.id==='30801430'?'#96948f':'#c0b9af';
    add(drape(new T.ShapeGeometry(shape(s.rings)),.55),planted?'#728157':paving,s.rings[0][0][0],s.rings[0][0][1],planted?2:1);
  }
  for(const road of data.roads){
    const walk=['steps','footway','path','pedestrian','cycleway'].includes(road.kind);
    const width=walk?2.2:['primary','secondary','trunk'].includes(road.kind)?8:4.5;
    for(let i=1;i<road.line.length;i++){
      const [x,y]=road.line[i-1],[a,b]=road.line[i],len=Math.hypot(a-x,b-y);
      if(len<0.1)continue;
      
      const g=new T.PlaneGeometry(width,len,1,Math.ceil(len/9));
      g.rotateZ(Math.atan2(b-y,a-x)-Math.PI/2).translate((x+a)/2,(y+b)/2,0);
      add(drape(g,walk?0.65:0.32),walk?'#c6bdb6':'#626575',x,y,walk?1:0);
    }
  }
  const walls=['#e4d9d6','#ebe7df','#d5a79c','#d7bd9c','#b6c8c1','#f3eee6'];
  const roofs=['#dbd4be','#b37559','#e8dfc9','#d4c8b6','#c28869'];
  function block(x,y,z,w,d,h,color) { add(new T.BoxGeometry(w,h,d).translate(x,z+h/2,-y),color,x,y); }
  for(const b of data.buildings){
    const [x,y]=b.rings[0][0], s=shape(b.rings);
    const z=altitude(x,y), h=b.cathedral?19:b.id===41119?12:b.height, top=z+h;
    const g=new T.ExtrudeGeometry(s,{depth:h+2,bevelEnabled:false}).translate(0,0,z-2).rotateX(-Math.PI/2);
    add(g,b.cathedral?'#827e80':walls[b.id%walls.length],x,y);
    const roof=new T.ShapeGeometry(s).rotateX(-Math.PI/2).translate(0,top+0.035,0);
    add(roof,roofTones[String(b.id)+(b.cathedral?'-nave':'')] ?? roofs[b.id%roofs.length],x,y,b.id===41434?3:4);
    // The incircle of the largest roof triangle keeps terrace details inside the footprint.
    const pos=roof.attributes.position,idx=roof.index;
    let radius=0,rx=0,ry=0;
    for(let i=0;i<idx.count;i+=3){
      const pts=[0,1,2].map(k=>new T.Vector2(pos.getX(idx.getX(i+k)),-pos.getZ(idx.getX(i+k))));
      const [a,c,d]=pts,wa=c.distanceTo(d),wc=d.distanceTo(a),wd=a.distanceTo(c),per=wa+wc+wd;
      const size=Math.abs((c.x-a.x)*(d.y-a.y)-(d.x-a.x)*(c.y-a.y))/per;
      if(size>radius){radius=size;rx=(wa*a.x+wc*c.x+wd*d.x)/per;ry=(wa*a.y+wc*c.y+wd*d.y)/per;}
    }
    if(!b.cathedral && b.id!==41434 && b.id!==41435 && radius>2.1 && b.id%6!==1){
      const size=Math.min(5,radius),angle=Math.atan2(b.rings[0][1][1]-y,b.rings[0][1][0]-x);
      add(new T.BoxGeometry(size,1.8,size*.72).rotateY(angle).translate(rx,top+.9,-ry),'#dcd7c9',x,y);
      add(new T.BoxGeometry(size+.25,.22,size*.72+.25).rotateY(angle).translate(rx,top+1.91,-ry),'#f3eee1',x,y);
      if(radius>3.5 && b.id%3===0) add(new T.CylinderGeometry(.65,.68,1.25,8).translate(rx+size*.65,top+.66,-ry+size*.43),'#9aaca9',x,y);
    }
    // Low parapets trace the actual perimeter and distinguish adjoining roofs.
    const r=b.rings[0];
    const windows=[],sills=[];
    const winding=Math.sign(r.slice(1).reduce((sum,p,j)=>sum+r[j][0]*p[1]-p[0]*r[j][1],0));
    for(let j=1;j<r.length;j++){
      const [a,c]=r[j-1],[e,f]=r[j],len=Math.hypot(e-a,f-c);
      if(len<1)continue;
      const ux=(e-a)/len,uy=(f-c)/len;
      const nx=uy*winding,ny=-ux*winding;
      const count=Math.floor(len/4.2);
      if(!b.cathedral && nx*-.82-ny*.68>0 && len<95){
        for(let bay=0;bay<count;bay++){
          const cx=a+(bay+.5)*(e-a)/count+nx*.07;
          const cy=c+(bay+.5)*(f-c)/count+ny*.07;
          for(let floor=3;floor<h-1.5;floor+=3.6){
            const left=[cx-ux*.74,z+floor,-cy+uy*.74];
            const right=[cx+ux*.74,z+floor,-cy-uy*.74];
            const tl=[left[0],left[1]+1.95,left[2]],tr=[right[0],right[1]+1.95,right[2]];
            windows.push(...left,...right,...tl,...tl,...right,...tr);
            const projection=(b.id%4===0 && bay%2===0)?.65:.22;
            const lipLeft=[left[0]+nx*projection,left[1],left[2]-ny*projection];
            const lipRight=[right[0]+nx*projection,right[1],right[2]-ny*projection];
            sills.push(...left,...right,...lipLeft,...lipLeft,...right,...lipRight);
            if(projection>.4){
              const railLeft=[lipLeft[0],lipLeft[1]+.62,lipLeft[2]],railRight=[lipRight[0],lipRight[1]+.62,lipRight[2]];
              sills.push(...lipLeft,...lipRight,...railLeft,...railLeft,...lipRight,...railRight);
            }
          }
        }
      }
      if(!b.cathedral && count>=2 && len<65 && nx*-.82-ny*.68>0){
        const rot=Math.atan2(f-c,e-a);
        for(let level=3;level<h-2;level+=3.6){
          add(new T.BoxGeometry(len,.16,.38).rotateY(rot).translate((a+e)/2,z+level-.12,-(c+f)/2),'#e8e1d2',x,y);
        }
      }
      add(new T.BoxGeometry(len,0.58,0.28).rotateY(Math.atan2(f-c,e-a)).translate((a+e)/2,top+0.27,-(c+f)/2),'#eee0c7',x,y);
    }
    if(windows.length){
      const panes=new T.BufferGeometry();panes.setAttribute('position',new T.Float32BufferAttribute(windows,3));panes.computeVertexNormals();add(panes,['#4e6668','#455b60','#65634e'][b.id%3],x,y);
      const trim=new T.BufferGeometry();trim.setAttribute('position',new T.Float32BufferAttribute(sills,3));trim.computeVertexNormals();add(trim,'#ede8dc',x,y);
    }
  }
  // Bell towers flank the west front; their footprints follow the OSM facade corners.
  for(const [x,y] of [[-11,-456],[7,-491]]){
    const base=altitude(x,y);
    block(x,y,base,7,7,32,'#827d7d');
    block(x,y,base+32,8,8,1,'#b4aba2');
    add(new T.CylinderGeometry(3,3.7,5,8).translate(x,base+35.5,-y),'#948d89',x,y);
    add(new T.SphereGeometry(3.2,10,6,0,Math.PI*2,0,Math.PI/2).translate(x,base+38,-y),'#746f70',x,y);
  }
  // Three recessed arches on the front facing the plaza (schematic elevation).
  const frontage=new T.Vector2(17.4,-34.5).normalize();
  for(const offset of [-7,0,7]){
    const x=-5.8+frontage.x*offset,y=-477.4+frontage.y*offset;
    const arch=new T.Shape();arch.moveTo(-2.2,0);arch.lineTo(2.2,0);arch.lineTo(2.2,6);arch.absarc(0,6,2.2,0,Math.PI,false);arch.closePath();
    add(new T.ShapeGeometry(arch).rotateY(Math.atan2(frontage.y,frontage.x)).translate(x,altitude(x,y),-y),'#635e52',x,y);
  }
  for(const [x,y] of data.trees){
    const z=altitude(x,y),seed=Math.abs(Math.round(x*3+y));
    if(seed%5===0){
      const height=7+seed%4;
      add(new T.CylinderGeometry(.28,.46,height,7).translate(x,z+height/2,-y),'#8b7756',x,y);
      const leaves=[];
      for(let k=0;k<13;k++){
        const angle=k*2.4+seed,reach=3.7+(k%3)*.7;
        const leaf=(t,side)=>[x+Math.cos(angle)*reach*t-Math.sin(angle)*side,z+height+2.5*Math.sin(t*Math.PI)-1.2*t-Math.abs(side)*.65,-y+Math.sin(angle)*reach*t+Math.cos(angle)*side];
        for(let j=0;j<9;j++){
          const t=j/10,tip=(j+1.7)/11,width=.55*Math.sin((j+1)*Math.PI/11);
          for(const sign of [-1,1])leaves.push(...leaf(t,0),...leaf(tip,width*sign),...leaf(t+.11,0));
        }
      }
      const fronds=new T.BufferGeometry();fronds.setAttribute('position',new T.Float32BufferAttribute(leaves,3));fronds.computeVertexNormals();add(fronds,'#628536',x,y,5);
      continue;
    }
    add(new T.CylinderGeometry(.28,.35,4,5).translate(x,z+2,-y),'#887451',x,y);
    const palette=[['#3d533e','#59714c','#778352'],['#324d43','#4a6a53','#68805d'],['#4f6040','#687b50','#85935d']][seed%3];
    for(let k=0;k<7;k++){
      const angle=k*2.4+seed,rad=k===0?0:2.05,sz=2.3+(seed%7)*.14;
      const crown=new T.IcosahedronGeometry(sz,1).scale(1,1.08,.86).rotateY(angle);
      crown.translate(x+Math.cos(angle)*rad,z+5.3+(k===0?1.6:Math.sin(k+seed)*.65),-y+Math.sin(angle)*rad);
      add(crown,palette[k%3],x,y,5);
    }
  }
  const mat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:1});
  if(!neutral) mat.onBeforeCompile=shader=>{
    shader.uniforms.roofColours={value:roofColours};
    shader.vertexShader='attribute float surface; varying float vKind; varying vec3 vMap;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vKind=surface; vMap=position;');
    shader.fragmentShader='uniform sampler2D roofColours; varying float vKind; varying vec3 vMap;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vMap.xz;
      float speck=fract(sin(dot(floor((p+vMap.y*.41)*5.),vec2(12.9898,78.233)))*4375.5453);
      float fade=1.-smoothstep(.13,.75,length(fwidth(p)));
      float grain=(speck-.5)*.07;
      if(vKind>4.5){
        grain+=(speck-.5)*.36+.07*sin(p.x*2.+p.y*3.);
      }else if(vKind>2.5){
        // Same metric frame as scripts/roof-colours.py. Texture origin is southwest.
        vec2 atlasUV=(vec2(p.x,-p.y)+vec2(410.,850.))/vec2(800.,1500.);
        vec3 roof=texture2D(roofColours,atlasUV).rgb;
        diffuseColor.rgb=mix(diffuseColor.rgb,roof,vKind<3.5?.64:.20);
        bool tile=roof.r>1.35*roof.b && roof.r>1.18*roof.g;
        vec2 uv=tile?vec2(p.x*1.8+p.y*.42,p.y*2.-p.x*.38):p*.85;
        uv.x+=mod(floor(uv.y),2.)*.5;
        vec2 edge=min(fract(uv),1.-fract(uv));
        float seam=1.-smoothstep(.015,.09,min(edge.x,edge.y));
        grain+=tile?.12*cos(uv.x*6.283)-.17*seam:-.14*seam;
      }else if(vKind>1.5){grain+=.1*sin(p.x*.73)*sin(p.y*.61);}
      else if(vKind>.5){
        vec2 uv=p*vec2(.85,1.65);uv.x+=mod(floor(uv.y),2.)*.5;
        vec2 edge=min(fract(uv),1.-fract(uv));
        grain-=.15*(1.-smoothstep(.01,.1,min(edge.x,edge.y)));
      }
      diffuseColor.rgb*=1.+grain*fade;
    `);
  };
  for(const bucket of buckets.values()){
    const mesh=new T.Mesh(mergeGeometries(bucket),mat);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return {group,altitude};
}



