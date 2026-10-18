import { PHYSICS_DT } from "./time-step.js";
import { stepPhysicsWorld } from "./world-step.js";
import { AirplaneEffects } from "./fixed-wing-effects.js";
import { addFixedWingColliders } from "./fixed-wing-colliders.js";
import { array, vector, rotate, inverse, clamp } from "./math.js";
import { aerodynamicLoads } from "./aerodynamics.js";

export class FixedWingPhysics {
  constructor(
    RAPIER,
    world,
    config,
    spawn,
    { updateSceneQueries = true, simulation, launchPose } = {},
  ) {
    this.launchPose = launchPose ?? {
      q: { x: 0, y: 0, z: 0, w: 1 },
      v: [0, 0, -config.launch.speedMps],
    };
    this.world = world;
    this.config = config;
    this.updateSceneQueries = updateSceneQueries;
    this.mode = "manual";
    this.effects = new AirplaneEffects(config, simulation);
    this.motorThrust = [0];
    this.surfaces = { pitch: 0, roll: 0, yaw: 0 };
    this.controlProfile = { ...config.controls };
    this.loads = { force: [0, 0, 0], torque: [0, 0, 0] };
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setCanSleep(false)
        .setCcdEnabled(true)
        .setAdditionalMassProperties(
          config.massKg,
          vector(config.centerOfMassM),
          vector(config.inertiaKgM2),
          { x: 0, y: 0, z: 0, w: 1 },
        ),
    );
    Object.assign(
      this,
      addFixedWingColliders(RAPIER, world, this.body, config),
    );
    this.reset(spawn);
  }
  reset(position, pose = this.launchPose) {
    this.armed = false;
    this.crashed = false;
    this.motorThrust[0] = 0;
    this.effects.reset();
    for (const key of Object.keys(this.surfaces)) this.surfaces[key] = 0;
    this.body.setTranslation(vector(position), true);
    this.body.setRotation(pose.q, true);
    this.body.setLinvel(vector(pose.v), true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true);
    this.body.resetTorques(true);
    this.airspeed = Math.hypot(...pose.v);
    this.stall = 0;
    this.grounded = false;
  }
  step(input, dt = PHYSICS_DT) {
    const b = this.body,
      c = this.config,
      q = b.rotation(),
      v = array(b.linvel()),
      w = rotate(array(b.angvel()), inverse(q)),
      wind = this.effects.wind(array(b.translation()));
    const local = rotate(
        v.map((value, i) => value - wind[i]),
        inverse(q),
      ),
      controls = this.controlProfile;
    for (const axis of ["pitch", "roll", "yaw"]) {
      const stick = clamp(input[axis] ?? 0, -1, 1),
        target =
          (stick * (1 - controls.expo) + stick ** 3 * controls.expo) *
          controls.travel;
      this.surfaces[axis] +=
        (target - this.surfaces[axis]) *
        (1 - Math.exp(-dt / controls.servoSeconds));
    }
    this.effects.update(dt, this.armed, clamp(input.throttle ?? 0, 0, 1));
    const demand = this.armed
      ? c.motor.maxThrustN *
        Math.min(input.throttle ?? 0, this.effects.throttleLimit) **
          c.motor.thrustExponent *
        this.effects.powerFactor
      : 0;
    this.motorThrust[0] +=
      (demand - this.motorThrust[0]) *
      (1 -
        Math.exp(
          -dt /
            (demand > this.motorThrust[0]
              ? c.motor.riseSeconds
              : c.motor.fallSeconds),
        ));
    const loads = aerodynamicLoads(c, local, w, this.surfaces, this.loads);
    loads.force[2] -=
      this.motorThrust[0] *
      clamp(1 - Math.max(0, -local[2]) / c.motor.pitchSpeedMps, 0, 1);
    if (this.grounded) {
      // Rolling contact: resist sideways sliding and allow nose-wheel steering.
      // This acts only while actual gear contacts exist, never in airborne flight.
      const groundVelocity = rotate(v, inverse(q));
      loads.force[0] -= groundVelocity[0] * c.massKg * 7;
      loads.force[2] -=
        groundVelocity[2] * c.massKg * (this.armed ? 0.06 : 0.35);
      loads.torque[1] -=
        this.surfaces.yaw * Math.max(0, -groundVelocity[2]) * 0.1;
    }
    b.resetForces(true);
    b.resetTorques(true);
    b.addForce(vector(rotate(loads.force, q)), true);
    b.addTorque(vector(rotate(loads.torque, q)), true);
    const oldSpeed = Math.hypot(...v);
    stepPhysicsWorld(this.world, dt, this.updateSceneQueries);
    this.grounded = false;
    for (const gear of this.gearColliders)
      this.world.contactPairsWith(gear, (other) =>
        this.world.contactPair(gear, other, (manifold) => {
          if (manifold.numContacts() && manifold.contactDist(0) < 0.012)
            this.grounded = true;
        }),
      );
    this.airspeed = loads.airspeed;
    this.stall = loads.stall;
    if (
      oldSpeed > 7 &&
      Math.hypot(
        b.linvel().x - v[0],
        b.linvel().y - v[1],
        b.linvel().z - v[2],
      ) > 6
    ) {
      this.crashed = true;
      this.armed = false;
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
