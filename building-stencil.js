import { AlwaysStencilFunc, ReplaceStencilOp } from 'three';

// The nearest opaque fragment owns bit 0. Transparent effects leave it alone.
export const BUILDING_BIT=1;
export function surfaceStencil(building=false){
  return {
    stencilWrite:true,stencilWriteMask:BUILDING_BIT,stencilFunc:AlwaysStencilFunc,
    stencilRef:building?BUILDING_BIT:0,stencilZPass:ReplaceStencilOp
  };
}
