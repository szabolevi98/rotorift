export const CITY_SIZE = 600;
export const CITY_STREETS = [-180, -60, 60, 180];
export const CITY_BLOCK_CENTERS = [-240, -120, 0, 120, 240];
export const CITY_PLAZA = { x: 0, z: 120 };
export const CITY_GARAGE = { x: -120, z: 120, floorHeight: 5.5, levels: 5 };
export const CITY_SKYWALK = { x: 0, z: 0, y: 48, width: 14.4, depth: 6 };
export const CITY_HERO = { x: 0, z: -120, height: 217 };
export const CITY_BUILDINGS = [];
for (const [zi,z] of CITY_BLOCK_CENTERS.entries()) for (const [xi,x] of CITY_BLOCK_CENTERS.entries()) {
  if (x === 0 && [120,-120].includes(z) || x === -120 && z === 120) continue;
  for (const side of [-1,1]) {
    const center = Math.abs(x) <= 120 && Math.abs(z) <= 120;
    let height = center ? 68 + ((xi*17+zi*13+(side+1)*19)%7)*13 : 19+((xi*11+zi*7+(side+1)*5)%6)*8;
    if (x===0&&z===0) height=side<0?128:158;
    if (x===120&&z===-120) height=side<0?174:114;
    const style = center ? (xi+zi+(side+1))%2 ? 'blueTower' : 'silverTower' : (xi+zi)%2 ? 'brick' : 'limestone';
    CITY_BUILDINGS.push({id:`block-${xi}-${zi}-${side<0?'west':'east'}`,x:x+side*23,z,width:32,depth:68,height,style,
      fireEscape:!center && (xi+zi)%2===0 && side>0, tank:!center || (xi+zi)%2===0});
  }
}
export function citySurfaceHeight(x,z) {
  return CITY_BLOCK_CENTERS.some(bx=>Math.abs(x-bx)<=48) && CITY_BLOCK_CENTERS.some(bz=>Math.abs(z-bz)<=48) ? .18 : 0;
}
