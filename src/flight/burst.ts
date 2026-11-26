import * as T from 'three';

// The fireball lasts a beat. Smoke rises and the wing fragments fall independently.
export function makeBurst(){
  const root=new T.Group(),stone=new T.IcosahedronGeometry(1,0);
  const parts=Array.from({length:18},(_,i)=>{
    const smoke=i>=7 && i<13,metal=i>=13;
    const material=new T.MeshBasicMaterial({color:metal?'#824639':smoke?'#68625e':i%2?'#ff781e':'#ffce57',
      transparent:!metal,depthWrite:metal});
    const mesh=new T.Mesh(stone,material);root.add(mesh);
    const angle=i*2.4,r=metal?8:smoke?2:5;
    return {mesh,smoke,metal,dx:r*Math.cos(angle),dz:r*Math.sin(angle),dy:2+i%6};
  });
  function update(t:number){
    for(const [i,p] of parts.entries()){
      const {mesh,smoke,metal}=p;
      const life=metal?1.25:smoke?1.6:.48;
      mesh.visible=t<life;
      if(!mesh.visible)continue;
      const f=t/life;
      // Metal carries forward in the local flight direction, losing speed after separation.
      const carry=metal?4*-Math.expm1(-4*t):0;
      mesh.position.set(p.dx*t+carry,p.dy*t-(metal?8*t*t:0),p.dz*t);
      mesh.rotation.set(t*(2+i%3),i+t,0);
      if(metal)mesh.scale.set(.65,.12,.3);
      else mesh.scale.setScalar(smoke?.5+f*2:.6+2*Math.sin(f*Math.PI));
      mesh.material.opacity=1-f;
    }
  }
  return {root,update};
}
