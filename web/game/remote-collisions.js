// Remote aircraft are kinematic collision proxies in the local Rapier world.
// Pose updates come from the shared room; no models or colliders exist in ghost mode.
export class RemoteCollisions {
  constructor(RAPIER, world, config) {
    this.RAPIER = RAPIER; this.world = world; this.config = config; this.bodies = new Map();
  }
  update(players, ownId, ghost) {
    const wanted = new Map(ghost ? [] : players.filter(p => p.id !== ownId && p.p && p.q).map(p => [p.id, p]));
    for (const [id, body] of this.bodies) if (!wanted.has(id)) {
      this.world.removeRigidBody(body); this.bodies.delete(id);
    }
    for (const [id, player] of wanted) {
      let body = this.bodies.get(id);
      const q = player.q, p = { x: player.p[0], y: player.p[1], z: player.p[2] };
      if (!body) {
        body = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...player.p).setRotation(q));
        this.bodies.set(id, body);
        const add = desc => this.world.createCollider(desc.setFriction(this.config.friction).setRestitution(this.config.restitution), body);
        add(this.RAPIER.ColliderDesc.cuboid(...this.config.bodyHalfExtentsM));
        for (const motor of this.config.motors)
          add(this.RAPIER.ColliderDesc.cylinder(0.004, this.config.propDiameterM * 0.48).setTranslation(...motor.positionM));
        body.userData = { resetId: player.resetId };
      }
      if (body.userData.resetId !== player.resetId || Math.hypot(body.translation().x - p.x, body.translation().y - p.y, body.translation().z - p.z) > 3) {
        body.setTranslation(p, true); body.setRotation(q, true); body.userData.resetId = player.resetId;
      }
      body.userData.target = { p, q };
    }
  }
  step(dt) {
    const blend = 1 - Math.exp(-dt * 18);
    for (const body of this.bodies.values()) {
      const target = body.userData.target, p = body.translation(), q = body.rotation();
      const sign = q.x * target.q.x + q.y * target.q.y + q.z * target.q.z + q.w * target.q.w < 0 ? -1 : 1;
      const next = Object.fromEntries(["x", "y", "z", "w"].map(axis => [axis, q[axis] + (target.q[axis] * sign - q[axis]) * blend]));
      const norm = Math.hypot(next.x, next.y, next.z, next.w);
      for (const axis of ["x", "y", "z", "w"]) next[axis] /= norm;
      body.setNextKinematicTranslation({ x: p.x + (target.p.x - p.x) * blend, y: p.y + (target.p.y - p.y) * blend, z: p.z + (target.p.z - p.z) * blend });
      body.setNextKinematicRotation(next);
    }
  }
  dispose() { for (const body of this.bodies.values()) this.world.removeRigidBody(body); this.bodies.clear(); }
}
