import {DEFAULT_SIMULATION,simulationKey} from '../simulation/options.js';
export function raceCategoryKey(map,drone,mode,options=DEFAULT_SIMULATION){
  const key=[map.id,map.routeId,map.routeVersion,drone.id,drone.configHash,mode].join(':');
  return simulationKey(options)===simulationKey(DEFAULT_SIMULATION)?key:key+':'+simulationKey(options);
}
