import {DronePhysics} from './drone.js';
import {FixedWingPhysics} from './fixed-wing.js';
export const isFixedWing = config=>config?.kind==='fixedWing';
export const aircraftModes = config=>isFixedWing(config)?['manual']:['acro','angle','horizon'];
export const aircraftCapabilities = config=>isFixedWing(config)
  ? {racing:false,multiplayer:false,propDamage:false,propwash:false,turtle:false}
  : {racing:true,multiplayer:true,propDamage:true,propwash:true,turtle:true};
export function createAircraftPhysics(RAPIER,world,config,spawn,options){return new (isFixedWing(config)?FixedWingPhysics:DronePhysics)(RAPIER,world,config,spawn,options);}
