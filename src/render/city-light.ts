import { HemisphereLight, DirectionalLight, Vector3 } from 'three';

export function cityFillLight(){
  return new HemisphereLight(0xf1f4ff,0x9b9dac,1.15);
}

export const sunOffset=new Vector3(-550,690,-370);

export function citySun(x=0,z=0){
  const sun=new DirectionalLight(0xfff6ea,2.12);
  sun.target.position.set(x,0,z);
  sun.position.copy(sun.target.position).add(sunOffset);
  sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,far:2200});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.bias=-.00035;
  sun.shadow.normalBias=.4;
  return sun;
}
