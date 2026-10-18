import { validateMap } from "../physics/config.js";
import { validateRouteDetails } from './route-info.js';

export const validRouteId = id => typeof id === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(id);

export function validateGuide(guide,gates,map){
  if(guide===undefined)return;
  let count=0;
  if(!Array.isArray(guide)||guide.length!==gates.length)throw Error('The guide needs one path per gate pair.');
  for(let i=0;i<guide.length;i++){
    const leg=guide[i];
    if(!Array.isArray(leg)||leg.length<2||leg.length>128)throw Error('Invalid guide path.');
    count+=leg.length;
    for(const p of leg)if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||Math.abs(p[0])>map.size/2||Math.abs(p[2])>map.size/2||p[1]<-20||p[1]>200)throw Error('Guide points must be inside the map.');
    for(const [p,g]of [[leg[0],gates[i]],[leg.at(-1),gates[(i+1)%gates.length]]])if(p.some((v,j)=>Math.abs(v-g.p[j])>.002))throw Error('Guide endpoints must match their gates.');
  }
  if(count>2048)throw Error('Too many guide points.');
}

export function validateRoute(route, map) {
  if (!route || !validRouteId(route.id) || typeof route.name !== "string" || !route.name.trim() || route.name.length > 80 ||
      !Number.isInteger(route.version) || route.version < 1 || !Array.isArray(route.gates) || route.gates.length < 2 || route.gates.length > 128)
    throw Error("A race needs an ID, a name, a positive version and 2–128 gates.");
  validateMap({ ...map, spawn: route.spawn ?? map.spawn, routeId: route.id, routeVersion: route.version, gates: route.gates, racingEnabled: true });
  for (const gate of route.gates)
    if (Math.abs(gate.p[0]) > map.size / 2 || Math.abs(gate.p[2]) > map.size / 2 || gate.p[1] < -20 || gate.p[1] > 200 || gate.width > 30 || gate.height > 30)
      throw Error("Gates must be inside the map, with dimensions up to 30 metres.");
  const spawn = route.spawn ?? map.spawn;
  const details = validateRouteDetails(route.details);
  if(route.aircraftKinds!==undefined&&(!Array.isArray(route.aircraftKinds)||!route.aircraftKinds.length||route.aircraftKinds.some(kind=>!['quadrotor','fixedWing'].includes(kind))))throw Error('Invalid route aircraft compatibility.');
  validateGuide(route.guide,route.gates,map);
  if (Math.abs(spawn[0]) > map.size / 2 || Math.abs(spawn[2]) > map.size / 2 || spawn[1] < -20 || spawn[1] > 200)
    throw Error("The start position must be inside the map.");
  return {
    id: route.id, name: route.name.trim(), version: route.version, spawn: [...spawn],
    gates: route.gates.map(g => ({ p: [...g.p], n: [...g.n], width: g.width, height: g.height })),
    ...(route.guide?{guide:structuredClone(route.guide)}:{}),
    ...(details ? {details} : {}),
    ...(route.aircraftKinds?{aircraftKinds:[...new Set(route.aircraftKinds)]}:{}),
  };
}

export function resolveRoute(map, id = map?.routeId) {
  if (!map) return null;
  if (!map.routes?.length) return !id || id === map.routeId ? map : null;
  const route = map.routes.find(r => r.id === id);
  if (!route) return null;
  return { ...map, baseSpawn: map.baseSpawn ?? map.spawn, routeId: route.id, routeVersion: route.version, routeName: route.name,
    spawn: [...route.spawn], gates: route.gates, guide:route.guide, aircraftKinds:route.aircraftKinds, racingEnabled: true };
}
