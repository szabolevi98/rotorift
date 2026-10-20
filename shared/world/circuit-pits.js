// Shared authoring layout: a tangent-continuous pit lane, not rotated slabs.
export const CIRCUIT_LAUNCH = [-175, 0.15, 201];
const entry = [[-220,150],[-195,156],[-183,180],[-145,180]];
const exit = [[145,180],[181,180],[203,138],[226.079,124.083]];
function cubic(points,t) {
  const u=1-t;
  return [0,1].map(k=>u*u*u*points[0][k]+3*u*u*t*points[1][k]+3*u*t*t*points[2][k]+t*t*t*points[3][k]);
}
export const CIRCUIT_PIT_LINE = [
  ...Array.from({length:41},(_,i)=>cubic(entry,i/40)),
  [0,180], [145,180],
  ...Array.from({length:40},(_,i)=>cubic(exit,(i+1)/40)),
];
export function pitEdge(offset) {
  return CIRCUIT_PIT_LINE.map((p,i,points)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    return [p[0]-dz/length*offset,p[1]+dx/length*offset];
  });
}
