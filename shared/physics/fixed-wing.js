import {PHYSICS_DT} from './drone.js';
import {array,vector,rotate,inverse,clamp} from './math.js';
import {aerodynamicLoads} from './aerodynamics.js';
import {normalizeSimulation} from '../simulation/options.js';
import {openCircuitCellVoltage} from './battery.js';
import {FlightEffects} from './flight-effects.js';

class AirplaneEffects {
  constructor(config,options){this.config=config;this.setOptions(options);}
  setOptions(options){const previous=this.options;this.options={...normalizeSimulation(options),propDamage:false,propwash:false};if(!previous||previous.battery!==this.options.battery)this.reset();}
  reset(){this.time=0;this.usedMah=0;this.charge=1;this.powerFactor=1;this.throttleLimit=1;this.voltage=this.config.battery.cells*4.2;this.currentA=0;this.remainingSeconds=null;this.batteryState='normal';this.wash=0;this.propellers={blades:[],phase:[]};}
  wind(position){return FlightEffects.prototype.wind.call(this,position);}
  update(dt,armed,throttle){
    this.time+=dt;
    if(!this.options.battery)return;
    const b=this.config.battery,t=this.config.simulation.battery;
    this.currentA=armed?t.idleCurrentA+t.maxCurrentA*throttle**1.7:0;
    this.usedMah=Math.min(b.capacityMah,this.usedMah+this.currentA*dt/3.6);this.charge=1-this.usedMah/b.capacityMah;
    this.voltage=Math.max(b.cells*2.8,openCircuitCellVoltage(this.charge)*b.cells-this.currentA*t.resistanceOhm);
    this.batteryState=this.charge<=t.reserveFraction?'critical':this.charge<=.2?'low':'normal';
    this.throttleLimit=this.batteryState==='critical'?.45:1;
    this.powerFactor=this.charge===0?0:clamp((this.voltage/b.nominalVoltage)**2,.3,1.3);
    this.remainingSeconds=armed&&this.currentA>.1?Math.max(0,this.charge-t.reserveFraction)*b.capacityMah*3.6/this.currentA:null;
  }
  get telemetry(){return {charge:this.charge,voltage:this.voltage,cellVoltage:this.voltage/this.config.battery.cells,currentA:this.currentA,usedMah:this.usedMah,remainingSeconds:this.remainingSeconds,batteryState:this.batteryState,throttleLimit:this.throttleLimit,propellers:[],wash:0};}
}
export class FixedWingPhysics {
  constructor(RAPIER,world,config,spawn,{updateSceneQueries=true,simulation}={}){
    this.world=world;this.config=config;this.updateSceneQueries=updateSceneQueries;this.mode='manual';this.effects=new AirplaneEffects(config,simulation);
    this.motorThrust=[0];this.surfaces={pitch:0,roll:0,yaw:0};this.controlProfile={...config.controls};
    this.loads={force:[0,0,0],torque:[0,0,0]};
    this.body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true).setAdditionalMassProperties(config.massKg,vector(config.centerOfMassM),vector(config.inertiaKgM2),{x:0,y:0,z:0,w:1}));
    const add=(half,p,friction=config.friction)=>world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(...p).setDensity(0).setFriction(friction).setRestitution(config.restitution),this.body);
    this.bodyCollider=add(config.bodyHalfExtentsM,[0,0,0]);
    add([.04,.04,.08],[0,.015,-.49]);
    this.wingCollider=add([.75,.018,.112],[0,.115,-.02]);
    this.tailCollider=add([.25,.012,.075],[0,.045,.46]);
    for(const [x,z]of [[-.21,-.06],[.21,-.06],[0,-.38]])world.createCollider(RAPIER.ColliderDesc.ball(.06).setTranslation(x,-.22,z).setDensity(0).setFriction(.08).setRestitution(.05),this.body);
    this.reset(spawn);
  }
  reset(position){
    this.armed=false;this.turtleMode=false;this.crashed=false;this.motorThrust[0]=0;this.effects.reset();
    for(const key of Object.keys(this.surfaces))this.surfaces[key]=0;
    this.body.setTranslation(vector(position),true);this.body.setRotation({x:0,y:0,z:0,w:1},true);
    this.body.setLinvel({x:0,y:0,z:-this.config.launch.speedMps},true);this.body.setAngvel({x:0,y:0,z:0},true);this.body.resetForces(true);this.body.resetTorques(true);
    this.airspeed=this.config.launch.speedMps;this.stall=0;
  }
  setTurtleMode(){return false;}
  step(input,dt=PHYSICS_DT){
    const b=this.body,c=this.config,q=b.rotation(),v=array(b.linvel()),w=rotate(array(b.angvel()),inverse(q)),wind=this.effects.wind(array(b.translation()));
    const local=rotate(v.map((value,i)=>value-wind[i]),inverse(q)),controls=this.controlProfile;
    for(const axis of ['pitch','roll','yaw']){const stick=clamp(input[axis]??0,-1,1),target=(stick*(1-controls.expo)+stick**3*controls.expo)*controls.travel;this.surfaces[axis]+=(target-this.surfaces[axis])*(1-Math.exp(-dt/controls.servoSeconds));}
    this.effects.update(dt,this.armed,clamp(input.throttle??0,0,1));
    const demand=this.armed?c.motor.maxThrustN*Math.min(input.throttle??0,this.effects.throttleLimit)**c.motor.thrustExponent*this.effects.powerFactor:0;
    this.motorThrust[0]+=(demand-this.motorThrust[0])*(1-Math.exp(-dt/(demand>this.motorThrust[0]?c.motor.riseSeconds:c.motor.fallSeconds)));
    const loads=aerodynamicLoads(c,local,w,this.surfaces,this.loads);
    loads.force[2]-=this.motorThrust[0]*clamp(1-Math.max(0,-local[2])/c.motor.pitchSpeedMps,0,1);
    b.resetForces(true);b.resetTorques(true);
    b.addForce(vector(rotate(loads.force,q)),true);b.addTorque(vector(rotate(loads.torque,q)),true);
    const oldSpeed=Math.hypot(...v),world=this.world;world.timestep=dt;
    if(this.updateSceneQueries)world.step();
    else world.physicsPipeline.step(world.gravity,world.integrationParameters,world.islands,world.broadPhase,world.narrowPhase,world.bodies,world.colliders,world.impulseJoints,world.multibodyJoints,world.ccdSolver);
    this.airspeed=loads.airspeed;this.stall=loads.stall;
    if(oldSpeed>7&&Math.hypot(b.linvel().x-v[0],b.linvel().y-v[1],b.linvel().z-v[2])>6){this.crashed=true;this.armed=false;}
  }
  get pose(){return {p:array(this.body.translation()),q:this.body.rotation(),v:array(this.body.linvel()),w:array(this.body.angvel())};}
  dispose(){this.world.removeRigidBody(this.body);}
}
