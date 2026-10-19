import { freshAirplanePropeller } from "../aircraft/propeller.js";
import { propellerTuning, propellerCollisionRadius } from "./propellers.js";
import { array, rotate, cross, dot } from "./math.js";

export class AirplanePropellerDamage {
  constructor(config) {
    this.config = config;
    this.tuning = propellerTuning(config);
    this.reset();
  }
  reset() {
    this.blades = freshAirplanePropeller();
    this.phase = this.config.id === "rift-a40" ? 0 : Math.PI / 2;
    this.lastImpact = -Infinity;
  }
  advance(dt, thrust) {
    const speed = Math.sqrt(Math.max(0, thrust / this.config.motor.maxThrustN));
    this.phase =
      (this.phase +
        ((dt * this.config.motors[0].direction * this.tuning.maxTipSpeedMps) /
          (this.config.propDiameterM / 2)) *
          speed) %
      (2 * Math.PI);
  }
  impact(speed, time, angle = 0, rotating = true) {
    if (!Number.isFinite(speed) || speed <= 0 || time - this.lastImpact < 0.055)
      return;
    const t = this.tuning,
      factor = rotating ? 1 : 1.6;
    const stage =
      speed >= t.breakSpeedMps * factor
        ? 3
        : speed >= t.chipSpeedMps * factor
          ? 2
          : speed >= t.bendSpeedMps * factor
            ? 1
            : 0;
    if (!stage) return;
    const order = [0, 1].sort(
      (a, b) =>
        Math.cos(angle - this.phase - b * Math.PI) -
        Math.cos(angle - this.phase - a * Math.PI),
    );
    const blade = order.find((index) => this.blades[index] < 3);
    if (blade === undefined) return;
    this.lastImpact = time;
    this.blades[blade] = Math.max(this.blades[blade], stage);
    if (speed >= t.breakSpeedMps * factor * 1.8) this.blades.fill(3);
  }
  get imbalance() {
    const weights = [0, 0.12, 0.55, 1];
    return Math.abs(weights[this.blades[0]] - weights[this.blades[1]]);
  }
  efficiency(time) {
    const lift = [1, 0.84, 0.45, 0];
    return (
      ((lift[this.blades[0]] + lift[this.blades[1]]) / 2) *
      (1 - this.imbalance * 0.1 * (0.5 + 0.5 * Math.sin(time * 137)))
    );
  }
}

export function addAirplanePropellerCollider(RAPIER, world, body, config) {
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.0015, config.propDiameterM * 0.48)
      .setTranslation(...config.motors[0].positionM)
      .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
      .setDensity(0)
      .setFriction(0.2)
      .setRestitution(0.02),
    body,
  );
  return collider;
}

// Local contacts use the actual tractor/pusher disc, including angular velocity
// and the incoming speed retained across a CCD stop. Disabled options add no contacts.
export class AirplanePropellerContact {
  constructor(RAPIER, world, body, config, effects) {
    Object.assign(this, { RAPIER, world, body, config, effects });
    this.collider = addAirplanePropellerCollider(RAPIER, world, body, config);
    this.prepare();
    this.previousVelocity = [0, 0, 0];
  }
  prepare() {
    this.collider.setEnabled(this.effects.options.propDamage);
    const radius = propellerCollisionRadius(
      this.config,
      this.effects.propeller.blades,
    );
    if (radius !== this.radius) {
      this.collider.setShape(new this.RAPIER.Cylinder(0.0015, radius));
      this.radius = radius;
    }
  }
  update(velocity, angularVelocity, rotation, thrust) {
    if (this.effects.options.propDamage)
      this.world.contactPairsWith(this.collider, (other) => {
        if (other.parent()?.handle === this.body.handle) return;
        this.world.contactPair(this.collider, other, (manifold, flipped) => {
          if (!manifold.numContacts()) return;
          const p = flipped
            ? manifold.localContactPoint2(0)
            : manifold.localContactPoint1(0);
          if (!p) return;
          // Collider-local Y is the body Z axis after its quarter-turn.
          const point = [p.x, -p.z, p.y],
            motor = this.config.motors[0].positionM;
          const offset = rotate(
            point.map((v, i) => v + motor[i] - this.config.centerOfMassM[i]),
            rotation,
          );
          const spin = cross(angularVelocity, offset);
          const otherV = other.parent()?.linvel() ?? { x: 0, y: 0, z: 0 };
          const otherVelocity = array(otherV),
            normal = array(manifold.normal());
          const relative = velocity.map(
            (v, i) => v + spin[i] - otherVelocity[i],
          );
          const previous = this.previousVelocity.map(
            (v, i) => v + spin[i] - otherVelocity[i],
          );
          let impulse = 0;
          for (let i = 0; i < manifold.numContacts(); i++)
            impulse += manifold.contactImpulse(i);
          const fraction = Math.sqrt(
            Math.max(0, thrust / this.config.motor.maxThrustN),
          );
          const r = Math.hypot(point[0], point[1]);
          const tangent = rotate([-point[1], point[0], 0], rotation);
          const cutting =
            r > this.config.propDiameterM * 0.15
              ? (Math.abs(dot(tangent, normal)) / r) *
                this.effects.propeller.tuning.maxTipSpeedMps *
                fraction *
                0.035
              : 0;
          const speed = Math.max(
            Math.abs(dot(relative, normal)),
            Math.abs(dot(previous, normal)),
            impulse / this.config.massKg,
            cutting,
          );
          if (
            impulse > this.config.massKg * 0.01 ||
            (manifold.contactDist(0) <= 0.0005 &&
              speed > this.effects.propeller.tuning.bendSpeedMps)
          )
            this.effects.propeller.impact(
              speed,
              this.effects.time,
              Math.atan2(point[1], point[0]),
              fraction > 0.05,
            );
        });
      });
    this.previousVelocity = [...velocity];
  }
}
