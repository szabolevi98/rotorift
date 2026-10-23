// Render a readable shutter-speed representation instead of sampling real RPM
// at the display refresh rate (which can make a fast rotor look stopped or
// reverse). Physics keeps its independent full-speed phase for blade strikes.
export const STOPPED_ROTORS = Object.freeze([0,0,0,0]);
export const validRotorSpeeds = value => Array.isArray(value) && value.length===4 &&
  value.every(v=>Number.isFinite(v)&&v>=0&&v<=1);

export class RotorMotion {
  constructor(count=4, maxAngularSpeed=22, speedExponent=1) { this.count=count;this.maxAngularSpeed=maxAngularSpeed;this.speedExponent=speedExponent;this.reset(); }
  reset() { this.phase = Array(this.count).fill(0); this.speed = Array(this.count).fill(0); this.fraction = Array(this.count).fill(0); }
  update(dt, thrust, maximum, motors, running, reverse=false) {
    for (let i=0;i<this.count;i++) {
      const fraction = running && maximum>0 ? Math.sqrt(Math.max(0,Math.min(1,Math.abs(thrust[i])/maximum))) : 0;
      this.fraction[i] = fraction;
      this.speed[i] = fraction ** this.speedExponent * this.maxAngularSpeed * motors[i].direction * (reverse?-1:1);
      this.phase[i] = (this.phase[i] + Math.min(dt,.1) * this.speed[i]) % (Math.PI*2);
    }
  }
}

export class RemoteRotorMotion extends RotorMotion {
  constructor(model, config) {
    // Make small attitude corrections readable without increasing full-speed
    // motion into display-rate aliasing. Audio/network retain the motor fraction.
    super(4,22,.5); this.config=config; this.props=[];
    model.traverse(object=>{if(object.userData.propeller)this.props.push(object);});
  }
  updatePlayer(dt, player) {
    if(this.resetId!==player.resetId) { this.reset(); this.resetId=player.resetId; }
    const speeds=player.connected!==false && !player.finished && validRotorSpeeds(player.rotorSpeeds) ? player.rotorSpeeds : STOPPED_ROTORS;
    this.update(dt,speeds.map(v=>v*v),1,this.config.motors,true,player.turtleMode===true);
    for(const prop of this.props)prop.rotation.y=this.phase[prop.userData.motorIndex];
  }
}
