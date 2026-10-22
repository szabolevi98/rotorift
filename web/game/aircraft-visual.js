import { isFixedWing } from "../../shared/aircraft/capabilities.js";
import {
  validAirplaneAnimation,
  stoppedAirplaneAnimation,
} from "../../shared/aircraft/animation.js";
import { PropellerVisual } from "../../shared/visual/propeller-damage.js";
import { FpvPropellers } from "../../shared/visual/fpv-propellers.js";
import {
  RotorMotion,
  RemoteRotorMotion,
} from "../../shared/visual/rotor-motion.js";
import { animateFixedWingModel } from "../../shared/visual/airplane-model-utils.js";
import {
  AirplanePropellerExposure,
  AirplanePropellerVisual,
  AIRPLANE_VISUAL_ROTOR_SPEED,
} from "../../shared/visual/airplane-propeller.js";

class QuadVisual {
  constructor(model, config, { remote = false } = {}) {
    this.model = model;
    this.config = config;
    this.damage = new PropellerVisual(model, config);
    if (!remote) this.exposure = new FpvPropellers(model, config, this.damage);
    this.motion = new RemoteRotorMotion(model, config);
  }
  bindPhysics(physics) {
    for (const prop of this.motion.props)
      physics.effects.propellers.phase[prop.userData.motorIndex] =
        prop.userData.phaseOffset;
  }
  update(dt, physics) {
    this.damage.update(physics.effects.propellers.blades);
    this.motion.update(
      dt,
      physics.motorThrust,
      this.config.motor.maxThrustN,
      this.config.motors,
      // Armed idle and airmode mixing can drive motors at zero stick throttle.
      physics.armed,
      physics.turtleMode,
    );
    for (const prop of this.motion.props)
      prop.rotation.y = this.motion.phase[prop.userData.motorIndex];
  }
  updateRemote(dt, player) {
    this.damage.update(player.propellers);
    this.motion.updatePlayer(dt, player);
  }
  prepareView(view, physics) {
    this.exposure?.update(
      view,
      [],
      physics.armed ? this.motion.fraction : [0, 0, 0, 0],
    );
  }
  networkState(physics, interrupted) {
    return {
      propellers: physics.effects.propellers.blades,
      rotorSpeeds:
        physics.armed && !interrupted ? this.motion.fraction : [0, 0, 0, 0],
      turtleMode: physics.turtleMode,
    };
  }
  reset(physics) {
    this.motion.reset();
    if (physics) this.damage.update(physics.effects.propellers.blades);
  }
  dispose() {
    this.exposure?.dispose();
    this.damage.dispose();
  }
  get motorSpeeds() {
    return this.motion.fraction;
  }
}

class AirplaneVisual {
  constructor(model, config) {
    this.model = model;
    this.config = config;
    this.damage = new AirplanePropellerVisual(model, config.propDiameterM / 2);
    this.motion = new RotorMotion(1, AIRPLANE_VISUAL_ROTOR_SPEED);
    this.exposure = new AirplanePropellerExposure(
      model,
      config.propDiameterM / 2,
    );
  }
  bindPhysics() {}
  update(dt, physics, input) {
    this.damage.update(physics.effects?.propeller.blades);
    this.motion.update(
      dt,
      physics.motorThrust,
      this.config.motor.maxThrustN,
      this.config.motors,
      physics.armed && input.throttle > 0,
    );
    animateFixedWingModel(this.model, physics.surfaces, this.motion.phase[0]);
    this.exposure.update(this.motion.fraction[0]);
  }
  updateRemote(dt, player) {
    if (this.resetId !== player.resetId) {
      this.reset();
      this.resetId = player.resetId;
    }
    this.damage.update(player.animation?.propeller);
    const state =
      player.connected !== false &&
      !player.finished &&
      validAirplaneAnimation(player.animation)
        ? player.animation
        : stoppedAirplaneAnimation();
    this.motion.update(dt, [state.engine ** 2], 1, this.config.motors, true);
    animateFixedWingModel(this.model, state.surfaces, this.motion.phase[0]);
    this.exposure.update(this.motion.fraction[0]);
  }
  prepareView() {}
  networkState(physics, interrupted) {
    return {
      animation: {
        kind: "fixedWing",
        ...(physics.effects?.options.propDamage
          ? { propeller: [...physics.effects.propeller.blades] }
          : {}),
        engine: physics.armed && !interrupted ? this.motion.fraction[0] : 0,
        surfaces: { ...physics.surfaces },
      },
    };
  }
  reset(physics) {
    this.damage.update(physics?.effects?.propeller.blades);
    this.motion.reset();
    this.exposure.update(0);
  }
  dispose() {
    this.exposure.dispose();
    this.damage.dispose();
  }
  get motorSpeeds() {
    return this.motion.fraction;
  }
}
export function createAircraftVisual(model, config, options) {
  return new (isFixedWing(config) ? AirplaneVisual : QuadVisual)(
    model,
    config,
    options,
  );
}
