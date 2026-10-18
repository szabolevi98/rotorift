// Shared by the visual wing and its collision proxy. Negative Z is forward.
export const TRAINER_WING_SHIFT = -0.025;

export const TRAINER_GEAR = Object.freeze([
  [-0.21, -0.22, 0.08],
  [0.21, -0.22, 0.08],
  [0, -0.22, -0.38],
]);

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
  const bodyCollider = add(config.bodyHalfExtentsM, [0, 0, 0]);
  const noseCollider = add([0.04, 0.04, 0.08], [0, 0.015, -0.49]);
  const wingCollider = add(
    [config.wingspanM / 2, 0.018, 0.112],
    [0, 0.115, -0.02 + TRAINER_WING_SHIFT],
  );
  const tailCollider = add([0.25, 0.012, 0.075], [0, 0.045, 0.46]);
  const gearColliders = TRAINER_GEAR.map((position) =>
    world.createCollider(
      RAPIER.ColliderDesc.ball(0.06)
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
    gearColliders,
  };
}
