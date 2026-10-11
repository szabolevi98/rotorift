import { actualRate, defaultRates } from "./rates.js";
import { rotate, inverse, array, vector, clamp, length } from "./math.js";
export const PHYSICS_DT = 1 / 240;
function mixThrust(mixer, demand, max) {
  const idle = max * 0.012;
  const limits = (authority) => {
    const values = mixer.map(
      (row) =>
        row[0] * demand[0] +
        row
          .slice(1)
          .reduce((sum, v, j) => sum + v * demand[j + 1] * authority, 0),
    );
    return {
      values,
      low: Math.max(...values.map((v, i) => (idle - v) / mixer[i][0])),
      high: Math.min(...values.map((v, i) => (max - v) / mixer[i][0])),
    };
  };
  let result = limits(1);
  if (result.low > result.high) {
    let low = 0,
      high = 1;
    for (let i = 0; i < 16; i++) {
      const mid = (low + high) / 2,
        r = limits(mid);
      if (r.low <= r.high) low = mid;
      else high = mid;
    }
    result = limits(low);
  }
  const collective = clamp(0, result.low, result.high);
  return result.values.map((v, i) =>
    clamp(v + collective * mixer[i][0], idle, max),
  );
}
function invertMixer(rows) {
  const a = rows.map((r, i) => [
    ...r,
    ...rows.map((_, j) => (i === j ? 1 : 0)),
  ]);
  for (let i = 0; i < 4; i++) {
    const pivot = a.reduce(
      (p, r, j) => (j >= i && Math.abs(r[i]) > Math.abs(a[p][i]) ? j : p),
      i,
    );
    [a[i], a[pivot]] = [a[pivot], a[i]];
    if (Math.abs(a[i][i]) < 1e-10) throw Error("Invalid motor layout");
    const scale = a[i][i];
    a[i] = a[i].map((v) => v / scale);
    for (let j = 0; j < 4; j++)
      if (j !== i) {
        const factor = a[j][i];
        a[j] = a[j].map((v, k) => v - factor * a[i][k]);
      }
  }
  return a.map((r) => r.slice(4));
}
export class DronePhysics {
  constructor(RAPIER, world, config, spawn) {
    this.world = world;
    this.config = config;
    this.rates = defaultRates();
    this.mode = "acro";
    this.armed = false;
    this.motorThrust = [0, 0, 0, 0];
    this.mixer = invertMixer([
      config.motors.map(() => 1),
      config.motors.map((m) => -(m.positionM[2] - config.centerOfMassM[2])),
      config.motors.map((m) => m.positionM[0] - config.centerOfMassM[0]),
      config.motors.map((m) => m.direction * config.motor.yawTorquePerNewtonM),
    ]);
    if (this.mixer.some((row) => row[0] <= 0))
      throw Error("Centre of mass must lie inside the motor footprint");
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...spawn)
      .setCanSleep(false)
      .setCcdEnabled(true)
      .setAdditionalMassProperties(
        config.massKg,
        vector(config.centerOfMassM),
        vector(config.inertiaKgM2),
        { x: 0, y: 0, z: 0, w: 1 },
      );
    this.body = world.createRigidBody(desc);
    const collider = (d) =>
      world.createCollider(
        d
          .setDensity(0)
          .setFriction(config.friction)
          .setRestitution(config.restitution),
        this.body,
      );
    collider(RAPIER.ColliderDesc.cuboid(...config.bodyHalfExtentsM));
    for (const m of config.motors)
      collider(
        RAPIER.ColliderDesc.cylinder(
          0.004,
          config.propDiameterM * 0.48,
        ).setTranslation(...m.positionM),
      );
    this.reset(spawn);
  }
  reset(position) {
    this.armed = false;
    this.motorThrust.fill(0);
    this.body.setTranslation(vector(position), true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true);
    this.body.resetTorques(true);
  }
  step(input, dt = PHYSICS_DT) {
    const b = this.body,
      c = this.config,
      q = b.rotation(),
      w = rotate(array(b.angvel()), inverse(q));
    b.resetForces(true);
    b.resetTorques(true);
    let desired = [
      -actualRate(input.pitch, this.rates.pitch),
      -actualRate(input.yaw, this.rates.yaw),
      -actualRate(input.roll, this.rates.roll),
    ].map((v) => (v * Math.PI) / 180);
    if (this.mode !== "acro") {
      const up = rotate([0, 1, 0], inverse(q)),
        limit = (c.controller.angleLimitDeg * Math.PI) / 180;
      const level = [
        c.controller.levelGain *
          (Math.atan2(up[2], up[1]) - input.pitch * limit),
        desired[1],
        c.controller.levelGain *
          (Math.atan2(-up[0], up[1]) - input.roll * limit),
      ];
      const blend =
        this.mode === "angle"
          ? 1
          : Math.max(
              0,
              1 - Math.max(Math.abs(input.roll), Math.abs(input.pitch)) / 0.75,
            );
      desired = desired.map((v, i) =>
        i === 1 ? v : v * (1 - blend) + level[i] * blend,
      );
    }
    const torques = desired.map(
      (v, i) => c.inertiaKgM2[i] * c.controller.rateGain[i] * (v - w[i]),
    );
    const voltageFactor =
      (c.battery.nominalVoltage / (c.battery.cells * 3.8)) ** 2;
    const max = c.motor.maxThrustN * voltageFactor,
      base = max * clamp(input.throttle, 0, 1) ** 2;
    const demand = [4 * base, torques[0], torques[2], torques[1]],
      idle = max * 0.012;
    // Preserve attitude authority when collective throttle reaches a motor limit.
    const targets = mixThrust(this.mixer, demand, max);
    for (let i = 0; i < 4; i++) {
      const m = c.motors[i],
        r = m.positionM;
      const target = this.armed ? clamp(targets[i], idle, max) : 0;
      const tau =
        target > this.motorThrust[i]
          ? c.motor.riseSeconds
          : c.motor.fallSeconds;
      this.motorThrust[i] +=
        (target - this.motorThrust[i]) * (1 - Math.exp(-dt / tau));
      const f = rotate([0, this.motorThrust[i], 0], q),
        rp = rotate(r, q),
        p = b.translation();
      b.addForceAtPoint(
        vector(f),
        { x: p.x + rp[0], y: p.y + rp[1], z: p.z + rp[2] },
        true,
      );
      b.addTorque(
        vector(
          rotate(
            [
              0,
              this.motorThrust[i] * m.direction * c.motor.yawTorquePerNewtonM,
              0,
            ],
            q,
          ),
        ),
        true,
      );
    }
    const velocity = array(b.linvel()),
      drag = c.linearDrag + c.quadraticDrag * length(velocity);
    b.addForce(vector(velocity.map((v) => -v * drag)), true);
    b.addTorque(
      vector(
        rotate(
          w.map((v) => -v * c.angularDrag),
          q,
        ),
      ),
      true,
    );
    this.world.timestep = dt;
    this.world.step();
  }
  get pose() {
    return {
      p: array(this.body.translation()),
      q: this.body.rotation(),
      v: array(this.body.linvel()),
      w: array(this.body.angvel()),
    };
  }
  dispose() {
    this.world.removeRigidBody(this.body);
  }
}
