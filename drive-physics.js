import * as T from 'three';

export function makeDrivePhysics(tune){
  function steerBody(b,steer,brake,max,dt,agility=1){
    const speed=Math.hypot(b.vx,b.vy);
    b.h+=steer*tune.turn*agility*Math.min(1,.35+speed/8)*dt;
    const fx=Math.cos(b.h),fy=Math.sin(b.h);
    let forward=b.vx*fx+b.vy*fy,side=-b.vx*fy+b.vy*fx;
    forward=brake?Math.max(0,forward-tune.brake*dt):forward>max?Math.max(max,forward-tune.brake*dt):Math.min(max,forward+tune.accel*dt);
    b.wayHold-=dt;b.dive+=((brake?1:0)-b.dive)*Math.min(1,dt*8);
    b.hold=steer?Math.min(1,b.hold+dt*2.2):Math.max(0,b.hold-dt*6);
    b.steer+=(steer-b.steer)*Math.min(1,dt*9);
    side*=Math.exp(-(brake?tune.brakeGrip:T.MathUtils.lerp(tune.grip,tune.driftGrip,b.hold))*dt);
    forward*=1-tune.driftDrag*Math.abs(side)*dt;
    b.slip=Math.abs(side);b.side=side;
    b.vx=fx*forward-fy*side;b.vy=fy*forward+fx*side;
    b.x+=b.vx*dt;b.y+=b.vy*dt;
  }
  function push(b,px,py,r){
    let nx=b.x-px,ny=b.y-py;const d=Math.hypot(nx,ny);
    if(d>=r || d<1e-5)return 0;
    nx/=d;ny/=d;b.x=px+nx*r;b.y=py+ny*r;
    // Glance off: a nose pointing into the obstacle swings towards the wall line, so cars keep rolling.
    const fx=Math.cos(b.h),fy=Math.sin(b.h),into=fx*nx+fy*ny;
    if(into<0){
      const cross=fx*ny-fy*nx;
      if(b.wayHold<=0)b.way=Math.abs(cross)>.08?-Math.sign(cross):(b.steer<0?-1:1);
      b.wayHold=.5;const way=b.way;
      b.h+=way*Math.min(tune.deflect/120,Math.acos(Math.max(-1,into))-Math.PI/2+.02);
    }
    const vn=b.vx*nx+b.vy*ny;
    if(vn>=0)return 0;
    b.vx-=(1+tune.bounce)*vn*nx;b.vy-=(1+tune.bounce)*vn*ny;
    return -vn;
  }
  function wallContact(b,segment,r){
    const [ax,ay,bx,by]=segment,dx=bx-ax,dy=by-ay;
    const t=T.MathUtils.clamp(((b.x-ax)*dx+(b.y-ay)*dy)/(dx*dx+dy*dy),0,1);
    return push(b,ax+dx*t,ay+dy*t,r);
  }
  function treeContact(b,tree,r){
    return push(b,tree[0],tree[1],r+tune.treeRadius);
  }
  function collide(b,world){
    const hit=world.visitObstacles(b,tune.radius,wallContact,treeContact);
    if(hit){const k=1-tune.wallLoss*Math.min(1,hit/8);b.vx*=k;b.vy*=k;}
    return hit;
  }

  // Returns the closing speed, or -1 when the two cars do not touch.
  function bump(a,b){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),reach=tune.radius*2;
    if(d>=reach || d<1e-5)return -1;
    const nx=dx/d,ny=dy/d,overlap=(reach-d)/2;
    a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
    const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(closing<=0)return 0;
    a.vx-=closing*nx*.6;a.vy-=closing*ny*.6;b.vx+=closing*nx*.6;b.vy+=closing*ny*.6;
    return closing;
  }
  return {steerBody,collide,bump};
}
