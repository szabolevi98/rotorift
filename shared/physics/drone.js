import { actualRate, defaultRates } from "./rates.js";
import { rotate, inverse, array, vector, clamp, length } from "./math.js";
import { motorThrustLimit, throttleToThrust } from "./propulsion.js";
import { FlightEffects } from "./flight-effects.js";
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
  constructor(RAPIER, world, config, spawn, { updateSceneQueries = true, simulation } = {}) {
    this.world = world;
    this.config = config;
    this.updateSceneQueries = updateSceneQueries;
    this.rates = defaultRates();
    this.mode = "acro";
    this.armed = false;
    this.motorThrust = [0, 0, 0, 0];
    this.previousBodyRates = [0, 0, 0];
    this.angularAcceleration = [0, 0, 0];
    this.effects = new FlightEffects(config, simulation);
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
    this.propColliders = config.motors.map(m => collider(
        RAPIER.ColliderDesc.cylinder(
          0.004,
          config.propDiameterM * 0.48,
        ).setTranslation(...m.positionM),
      ));
    this.reset(spawn);
  }
  reset(position) {
    this.armed = false;
    this.motorThrust.fill(0);
    this.previousBodyRates.fill(0);
    this.angularAcceleration.fill(0);
    this.effects.reset();
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
    this.effects.update(dt, this.armed, this.motorThrust, array(b.linvel()), q);
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
    const derivativeBlend = 1 - Math.exp(-dt / c.controller.derivativeFilterSeconds);
    const torques = desired.map((v, i) => {
      this.angularAcceleration[i] += ((w[i] - this.previousBodyRates[i]) / dt - this.angularAcceleration[i]) * derivativeBlend;
      this.previousBodyRates[i] = w[i];
      // Damping measured rate changes avoids the motor-lag overshoot of a
      // proportional-only controller. Stick changes still command full rates.
      return c.inertiaKgM2[i] * (c.controller.rateGain[i] * (v - w[i]) - c.controller.rateDamping[i] * this.angularAcceleration[i]);
    });
    const max = motorThrustLimit(c) * this.effects.powerFactor,
      base = throttleToThrust(Math.min(input.throttle, this.effects.throttleLimit), c) * this.effects.powerFactor;
    const demand = [4 * base, torques[0], torques[2], torques[1]],
      idle = max * 0.012;
    // Preserve attitude authority when collective throttle reaches a motor limit.
    const targets = mixThrust(this.mixer, demand, max);
    let totalThrust = 0;
    const motorTorque = [0, 0, 0];
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
      const thrust = this.motorThrust[i] * this.effects.motorEfficiency(i);
      totalThrust += thrust;
      // Compute r × F about the centre of mass in local coordinates. Using
      // world-space motor points loses precision to Rapier's float32 values
      // far from the origin, causing tinywhoop rate jitter at high throttle.
      // Sum before handing off to Rapier so balanced motors cancel precisely.
      motorTorque[0] -= (r[2] - c.centerOfMassM[2]) * thrust;
      motorTorque[1] += thrust * m.direction * c.motor.yawTorquePerNewtonM;
      motorTorque[2] += (r[0] - c.centerOfMassM[0]) * thrust;
    }
    b.addForce(vector(rotate([0, totalThrust, 0], q)), true);
    b.addTorque(vector(rotate(motorTorque, q)), true);
    const velocity = array(b.linvel()), wind = this.effects.wind(array(b.translation())),
      airVelocity = velocity.map((v, i) => v - wind[i]),
      drag = c.linearDrag + c.quadraticDrag * length(airVelocity);
    b.addForce(vector(airVelocity.map((v) => -v * drag)), true);
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
    if (this.updateSceneQueries) this.world.step();
    else {
      // Rapier 0.14 World.step() also rebuilds the scene-query BVH. Flight
      // uses no raycasts: rebuilding thousands of static shapes at 240 Hz
      // costs much more than the actual rigid-body/contact/CCD simulation.
      // Run the same public physics pipeline; query users retain World.step.
      const world = this.world;
      world.physicsPipeline.step(world.gravity, world.integrationParameters,
        world.islands, world.broadPhase, world.narrowPhase, world.bodies,
        world.colliders, world.impulseJoints, world.multibodyJoints, world.ccdSolver);
    }
    if (this.armed && this.effects.options.propDamage) {
      for (const [index, prop] of this.propColliders.entries()) {
        this.world.contactPairsWith(prop, other => {
          if (other.parent()?.handle === b.handle) return;
          this.world.contactPair(prop, other, manifold => {
            const n = manifold.normal(), normal = [n.x, n.y, n.z];
            const otherVelocity = other.parent()?.linvel() ?? { x: 0, y: 0, z: 0 };
            const angular = rotate(w, q), offset = rotate(c.motors[index].positionM, q);
            const rotational = [angular[1] * offset[2] - angular[2] * offset[1], angular[2] * offset[0] - angular[0] * offset[2], angular[0] * offset[1] - angular[1] * offset[0]];
            const relative = velocity.map((v, i) => v + rotational[i] - [otherVelocity.x, otherVelocity.y, otherVelocity.z][i]);
            let impulse = 0;
            for (let i = 0; i < manifold.numContacts(); i++) impulse += manifold.contactImpulse(i);
            if (impulse > c.massKg * 0.01)
              this.effects.impact(index, Math.max(Math.abs(relative.reduce((sum, v, i) => sum + v * normal[i], 0)), impulse / c.massKg));
          });
        });
      }
    }
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
