import { aircraftAirframe } from "../aircraft/airframe.js";
export { TRAINER_GEAR, TRAINER_WING_SHIFT } from "../aircraft/airframe.js";

export function addFixedWingColliders(RAPIER, world, body, config) {
  const add = (half, position) =>
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(...half)
        .setTranslation(...position)
        .setDensity(0)
        .setFriction(config.friction)
        .setRestitution(config.restitution),
      body,
    );
  const frame = aircraftAirframe(config);
  const bodyCollider = add(config.bodyHalfExtentsM, [0, 0, 0]);
  const noseCollider = add(frame.nose.half, frame.nose.p);
  const wingCollider = add(frame.wing.half, frame.wing.p);
  const tailCollider = add(frame.tail.half, frame.tail.p);
  const extraColliders = (frame.extra ?? []).map((part) =>
    add(part.half, part.p),
  );
  const gearColliders = frame.gear.map((position) =>
    world.createCollider(
      RAPIER.ColliderDesc.ball(frame.wheelRadius)
        .setTranslation(...position)
        .setDensity(0)
        .setFriction(0.08)
        .setRestitution(0.05),
      body,
    ),
  );
  return {
    bodyCollider,
    noseCollider,
    wingCollider,
    tailCollider,
    extraColliders,
    gearColliders,
  };
}
