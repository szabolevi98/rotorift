// Discrete damage to each of three blades on each of four rotors. Thresholds
// are tunable estimates, not a material fracture solver or a health percentage.
export const BLADE_STATES = ["intact", "bent", "chipped", "broken"];
export const freshPropellers = () => Array.from({length:4}, () => [0,0,0]);
export const validPropellers = value => Array.isArray(value) && value.length === 4 &&
  value.every(blades => Array.isArray(blades) && blades.length === 3 && blades.every(v => Number.isInteger(v) && v >= 0 && v <= 3));
export function propellerState(blades) {
  if (blades.every(v => v === 3)) return "destroyed";
  return BLADE_STATES[Math.max(...blades)];
}
export function propellerCollisionRadius(config,blades) {
  const best=Math.min(...blades);
  return config.propDiameterM*(best===3?.06:best===2?.30:.48);
}
export function propellerTuning(config) {
  return { bendSpeedMps:config.simulation.propDamageThresholdMps ?? 3,
    chipSpeedMps:6, breakSpeedMps:12, maxTipSpeedMps:150,
    ...config.simulation.propeller };
}
export class PropellerDamage {
  constructor(config) { this.tuning = propellerTuning(config); this.reset(); }
  reset() { this.blades = freshPropellers(); this.lastImpact = [-Infinity,-Infinity,-Infinity,-Infinity]; this.phase = [0,0,0,0]; }
  advance(dt, commands, maximum, config) {
    if(maximum<=0)return;
    for(let i=0;i<4;i++) this.phase[i] = (this.phase[i] + dt * config.motors[i].direction *
      this.tuning.maxTipSpeedMps / (config.propDiameterM/2) * Math.sqrt(Math.max(0,commands[i]/maximum))) % (2*Math.PI);
  }
  impact(index, speed, time, contactAngle = 0, rotating = true) {
    if (!Number.isFinite(speed) || speed <= 0 || time-this.lastImpact[index] < 0.055) return;
    const tuning=this.tuning, factor=rotating?1:1.6;
    const stage=speed>=tuning.breakSpeedMps*factor?3:speed>=tuning.chipSpeedMps*factor?2:speed>=tuning.bendSpeedMps*factor?1:0;
    if (!stage) return;
    const blades=this.blades[index];
    // The blade nearest the contact point at impact takes the strike. A blade
    // already missing cannot be broken twice; a sustained hit reaches the next.
    const order=[0,1,2].sort((a,b)=>Math.cos(contactAngle-this.phase[index]-b*2*Math.PI/3)-Math.cos(contactAngle-this.phase[index]-a*2*Math.PI/3));
    const blade=order.find(i=>blades[i]<3);
    if(blade===undefined)return;
    this.lastImpact[index]=time;
    blades[blade]=Math.max(blades[blade],stage);
    // A violent rotor strike sweeps all the blades through the obstacle.
    if(speed >= tuning.breakSpeedMps*factor*1.8) blades.fill(3);
  }
  efficiency(index, time) {
    const blades=this.blades[index], lift=[1,.84,.45,0];
    const mean=blades.reduce((sum,v)=>sum+lift[v],0)/3;
    return Math.max(0,mean*(1-this.imbalance(index)*.10*(.5+.5*Math.sin(time*137+index))));
  }
  imbalance(index) {
    const weights=[0,.12,.55,1], blades=this.blades[index];
    let x=0,z=0;
    for(let i=0;i<3;i++){x+=weights[blades[i]]*Math.cos(i*2*Math.PI/3);z+=weights[blades[i]]*Math.sin(i*2*Math.PI/3);}
    return Math.hypot(x,z);
  }
}
