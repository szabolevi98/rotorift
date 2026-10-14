// Shared footprints keep rendered surfaces and analytic collision slabs aligned.
export const GARDEN_WALK=[];
for(const [x,z,start]of [[19,-18,-Math.PI/2],[19,18,0],[-19,18,Math.PI/2],[-19,-18,Math.PI]])for(let i=0;i<=8;i++){
  const a=start+i*Math.PI/16;GARDEN_WALK.push([x+Math.cos(a)*4,z+Math.sin(a)*4]);
}
GARDEN_WALK.push(GARDEN_WALK[0]);
export const WALK_SPURS=[[[0,22],[0,31.5]],[[-23,7],[-8.5,7]],[[8.5,7],[23,7]]];
export const PLAYGROUND_SAFETY_SURFACES=[[0,-3,17,16,'rubber'],[-15,-7,10,10,'coral'],[14,-7,7,12,'blue'],[9,13,6,5,'rubber']];
export const PLAYGROUND_RAISED_FOOTPRINTS=[
  ...PLAYGROUND_SAFETY_SURFACES.map(s=>s.slice(0,4)),
  [-30,0,3,63],[30,0,3,63],[0,-30,57,3],[0,30,57,3],[0,37,3,10],
  [-15,14,6.5,5.2],[6,28,3,5.4],
];
