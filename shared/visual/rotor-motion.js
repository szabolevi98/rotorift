// Render a readable shutter-speed representation instead of sampling real RPM
// at the display refresh rate (which can make a fast rotor look stopped or
// reverse). Physics keeps its independent full-speed phase for blade strikes.
export class RotorMotion {
  constructor() { this.reset(); }
  reset() { this.phase = [0,0,0,0]; this.speed = [0,0,0,0]; this.fraction = [0,0,0,0]; }
  update(dt, thrust, maximum, motors, running) {
    for (let i=0;i<4;i++) {
      const fraction = running && maximum>0 ? Math.sqrt(Math.max(0,Math.min(1,thrust[i]/maximum))) : 0;
      this.fraction[i] = fraction;
      this.speed[i] = fraction * 22 * motors[i].direction;
      this.phase[i] = (this.phase[i] + Math.min(dt,.1) * this.speed[i]) % (Math.PI*2);
    }
  }
}
