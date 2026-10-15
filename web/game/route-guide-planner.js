import {planRaceGuide} from '../../shared/race/guide.js';

export function makeGuideClearance(world,RAPIER,radius=.4){
  const ball=new RAPIER.Ball(radius),rotation={x:0,y:0,z:0,w:1};
  return (a,b)=>!world.castShape({x:a[0],y:a[1],z:a[2]},rotation,
    {x:b[0]-a[0],y:b[1]-a[1],z:b[2]-a[2]},ball,0,1,true);
}

export function generateRaceGuide(world,RAPIER,map,gates){
  const enabled=new Map();world.colliders.forEach(c=>{enabled.set(c.handle,c.isEnabled());c.setEnabled(true);});
  world.step();
  try{return planRaceGuide(gates,makeGuideClearance(world,RAPIER,map.kind==='playground'?.18:.45),
    {step:map.kind==='playground'?.8:2,boundary:map.size/2});}
  finally{world.colliders.forEach(c=>c.setEnabled(enabled.get(c.handle)));world.step();}
}
