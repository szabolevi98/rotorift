import { clamp, rotate } from './math.js';

// Reverse one motor pair to rock the aircraft around its ground contacts.
// Pitch/roll choose the edge; throttle and yaw never produce normal lift.
export function turtleThrust(config,input,quaternion,maximum,bodyRates=[0,0,0]){
  if(rotate([0,1,0],quaternion)[1]>.75)return [0,0,0,0];
  const roll=clamp(input.roll,-1,1),pitch=clamp(input.pitch,-1,1),amount=Math.max(Math.abs(roll),Math.abs(pitch));
  if(amount<=.12)return [0,0,0,0];
  const lateral=Math.abs(roll)>=Math.abs(pitch);
  // Limit reverse authority and ease off once rolling: light frames should rock
  // around the contact edge rather than launch into multiple somersaults.
  const speed=Math.abs(bodyRates[lateral?2:0]);
  const power=maximum*clamp(config.simulation.turtlePowerFraction??.45,.05,.6)*(amount-.12)/.88*clamp((3-speed)/1,0,1);
  return config.motors.map(m=>{
    const selected=lateral?Math.sign(m.positionM[0])*Math.sign(roll)>0:Math.sign(m.positionM[2])*Math.sign(pitch)<0;
    return selected?-power:0;
  });
}
