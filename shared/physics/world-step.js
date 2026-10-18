export function stepPhysicsWorld(world, dt, updateSceneQueries = true) {
  world.timestep = dt;
  if (updateSceneQueries) {
    world.step();
    return;
  }
  // Flight needs contacts/CCD, but no 240 Hz rebuild of the scene-query BVH.
  world.physicsPipeline.step(
    world.gravity,
    world.integrationParameters,
    world.islands,
    world.broadPhase,
    world.narrowPhase,
    world.bodies,
    world.colliders,
    world.impulseJoints,
    world.multibodyJoints,
    world.ccdSolver,
  );
}
