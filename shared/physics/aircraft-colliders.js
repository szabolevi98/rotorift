export function guardTuning(config) {
  const fallback = config.category === "tinywhoop" ? {innerRadiusFactor:1.04,outerRadiusFactor:1.10,halfHeightM:.0028,offsetYM:.0013} :
    config.category === "cinewhoop" ? {innerRadiusFactor:1.04,outerRadiusFactor:1.095,halfHeightM:.0028,offsetYM:0} : null;
  return config.simulation.propeller?.guard ?? fallback;
}
export function addAircraftColliders(RAPIER, world, body, config) {
  const add = desc => world.createCollider(desc.setDensity(0).setFriction(config.friction).setRestitution(config.restitution),body);
  const bodyCollider = add(RAPIER.ColliderDesc.cuboid(...config.bodyHalfExtentsM));
  const propColliders = config.motors.map(m=>add(RAPIER.ColliderDesc.cylinder(.0015,config.propDiameterM*.48).setTranslation(...m.positionM)));
  const guard = guardTuning(config), guardColliders=[];
  // Convex arcs leave the rotor interior open. A solid cylinder would protect
  // the prop even against a pole entering from above, which is physically wrong.
  if(guard)for(const motor of config.motors)for(let arc=0;arc<12;arc++){
    const vertices=[];
    for(const angle of [arc*Math.PI/6,(arc+1)*Math.PI/6])
      for(const r of [guard.innerRadiusFactor,guard.outerRadiusFactor])
        for(const y of [-guard.halfHeightM,guard.halfHeightM])
          vertices.push(Math.cos(angle)*r*config.propDiameterM/2,y,Math.sin(angle)*r*config.propDiameterM/2);
    const desc=RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
    guardColliders.push(add(desc.setTranslation(motor.positionM[0],motor.positionM[1]+guard.offsetYM,motor.positionM[2])));
  }
  return {bodyCollider,propColliders,guardColliders};
}
