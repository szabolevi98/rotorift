// The same quay footprints drive rendering, land collisions and water hazards.
export const HARBOR = {
  size: 800, shoreX: 60, quayY: 3, waterY: 0, seabedY: -12,
  spawn: [-280, 3.15, 305],
  piers: [{x:150,z:-190,width:180,depth:60},{x:150,z:80,width:180,depth:60}],
  breakwaters: [{x:180,z:-335,width:240,depth:18},{x:180,z:330,width:240,depth:18}],
  ship: {x:165,z:-55}, cranes: [{x:30,z:-90},{x:30,z:145}],
  lighthouse: {x:295,z:330}, warehouse: {x:-300,z:40,width:70,depth:110},
};
export const inHarborFootprint = (x,z,r) => Math.abs(x-r.x)<=r.width/2&&Math.abs(z-r.z)<=r.depth/2;
export const harborLandAt = (x,z) => x<=HARBOR.shoreX ||
  [...HARBOR.piers,...HARBOR.breakwaters].some(r=>inHarborFootprint(x,z,r));
export const harborWaterAt = (x,z) => !harborLandAt(x,z);
export const HARBOR_SHIP_OUTLINE = [[-17,70],[17,70],[17,-48],[14,-68],[7,-82],[0,-88],[-7,-82],[-14,-68],[-17,-48]];
export function harborShipAt(x,z) {
  x-=HARBOR.ship.x;z-=HARBOR.ship.z;let inside=false;
  for(let i=0,j=HARBOR_SHIP_OUTLINE.length-1;i<HARBOR_SHIP_OUTLINE.length;j=i++){
    const a=HARBOR_SHIP_OUTLINE[i],b=HARBOR_SHIP_OUTLINE[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export const harborSurfaceHeight = (x,z) => harborLandAt(x,z)?HARBOR.quayY:harborShipAt(x,z)?7.14:HARBOR.seabedY;
export const HARBOR_VIEW_DISTANCE = 18000;
