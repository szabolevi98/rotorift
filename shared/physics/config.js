export function validateAirplane(c) {
  const positive=v=>Number.isFinite(v)&&v>0,vec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
  if(c?.kind!=='fixedWing'||!/^rift-[a-z0-9]+$/.test(c.id)||!Number.isInteger(c.version)||c.version<1)throw Error('Invalid airplane identity');
  for(const key of ['massKg','wingspanM','lengthM','propDiameterM','maxSpeedMps'])if(!positive(c[key]))throw Error('Invalid airplane '+key);
  for(const key of ['centerOfMassM','visualOffsetM','cameraOffsetM','inertiaKgM2','bodyHalfExtentsM'])if(!vec(c[key]))throw Error('Invalid airplane '+key);
  if(!c.inertiaKgM2.every(positive)||!c.bodyHalfExtentsM.every(positive))throw Error('Invalid airplane mass geometry');
  for(const [section,keys]of [['aero',['areaM2','chordM','liftSlope','stallAngleRad','dragZero','inducedDrag','pitchStability']],['motor',['maxThrustN','thrustExponent','riseSeconds','fallSeconds','pitchSpeedMps']],['battery',['cells','nominalVoltage','capacityMah','fullCellVoltage']],['controls',['travel','servoSeconds']],['launch',['speedMps','altitudeM']]])for(const key of keys)if(!positive(c[section]?.[key]))throw Error('Invalid airplane '+section+'.'+key);
  if(c.controls.travel>1||!Number.isFinite(c.controls.expo)||c.controls.expo<0||c.controls.expo>1||!Number.isFinite(c.aero.liftZero)||!Number.isFinite(c.aero.pitchTrim)||!Number.isInteger(c.battery.cells))throw Error('Invalid airplane tuning');
  if(c.motors?.length!==1||!vec(c.motors[0].positionM)||![1,-1].includes(c.motors[0].direction))throw Error('Invalid airplane propulsion');
  if(!positive(c.friction)||!Number.isFinite(c.restitution)||c.restitution<0||c.restitution>1)throw Error('Invalid airplane contact');
  for(const key of ['idleCurrentA','maxCurrentA','resistanceOhm','reserveFraction'])if(!positive(c.simulation?.battery?.[key]))throw Error('Invalid airplane battery');
  return c;
}
export function validateDrone(c) {
  const positive = (v) => Number.isFinite(v) && v > 0;
  if (
    !c ||
    !/^rift-[a-z0-9]+$/.test(c.id) ||
    !Number.isInteger(c.version) ||
    c.version < 1
  )
    throw Error("Invalid drone identity");
  for (const k of ["massKg", "motorDiagonalM", "propDiameterM", "maxSpeedMps"])
    if (!positive(c[k])) throw Error("Invalid " + k);
  for (const k of ["inertiaKgM2", "bodyHalfExtentsM"])
    if (!Array.isArray(c[k]) || c[k].length !== 3 || !c[k].every(positive))
      throw Error("Invalid " + k);
  for (const k of ["centerOfMassM", "visualOffsetM", "cameraOffsetM"])
    if (
      !Array.isArray(c[k]) ||
      c[k].length !== 3 ||
      !c[k].every(Number.isFinite)
    )
      throw Error("Invalid " + k);
  if (
    !c.motor ||
    !["maxThrustN", "thrustExponent", "riseSeconds", "fallSeconds", "yawTorquePerNewtonM"].every(
      (k) => positive(c.motor[k]),
    ) || c.motor.thrustExponent < 0.5 || c.motor.thrustExponent > 3
  )
    throw Error("Invalid motor");
  if (
    !Array.isArray(c.motors) ||
    c.motors.length !== 4 ||
    c.motors.some(
      (m) =>
        !Array.isArray(m.positionM) ||
        m.positionM.length !== 3 ||
        !m.positionM.every(Number.isFinite) ||
        ![1, -1].includes(m.direction),
    )
  )
    throw Error("Invalid motor geometry");
  if (
    !c.controller ||
    !Array.isArray(c.controller.rateGain) ||
    c.controller.rateGain.length !== 3 ||
    !c.controller.rateGain.every(positive) ||
    !Array.isArray(c.controller.rateDamping) ||
    c.controller.rateDamping.length !== 3 ||
    !c.controller.rateDamping.every((v) => Number.isFinite(v) && v >= 0) ||
    !positive(c.controller.derivativeFilterSeconds) ||
    !positive(c.controller.angleLimitDeg) ||
    !positive(c.controller.levelGain)
  )
    throw Error("Invalid controller");
  if (
    !Number.isInteger(c.battery.cells) ||
    c.battery.cells < 1 ||
    !positive(c.battery.nominalVoltage) ||
    !positive(c.battery.capacityMah) ||
    !Number.isFinite(c.battery.fullCellVoltage) || c.battery.fullCellVoltage < 4.1 || c.battery.fullCellVoltage > 4.4
  )
    throw Error("Invalid battery");
  for (const k of ["linearDrag", "quadraticDrag", "angularDrag"])
    if (!Number.isFinite(c[k]) || c[k] < 0) throw Error("Invalid drag");
  if (!c.simulation?.battery || !["idleCurrentA", "maxCurrentA", "resistanceOhm"].every(k => positive(c.simulation.battery[k])) ||
      !positive(c.simulation.propwashStrength) || c.simulation.propwashStrength > 0.5)
    throw Error("Invalid simulation tuning");
  const prop=c.simulation.propeller;
  if(!prop || !["bendSpeedMps","chipSpeedMps","breakSpeedMps","maxTipSpeedMps"].every(k=>positive(prop[k])) ||
    !(prop.bendSpeedMps<prop.chipSpeedMps && prop.chipSpeedMps<prop.breakSpeedMps))throw Error("Invalid propeller tuning");
  if(prop.guard && (!["innerRadiusFactor","outerRadiusFactor","halfHeightM"].every(k=>positive(prop.guard[k])) ||
    prop.guard.innerRadiusFactor<=1 || prop.guard.outerRadiusFactor<=prop.guard.innerRadiusFactor || !Number.isFinite(prop.guard.offsetYM)))throw Error("Invalid propeller guard");
  const battery = c.simulation.battery;
  if (!Number.isFinite(battery.linearCurrentFraction) || battery.linearCurrentFraction < 0 || battery.linearCurrentFraction > 1 ||
      !positive(battery.polarizationOhm) || !positive(battery.recoverySeconds) ||
      !Number.isFinite(battery.reserveFraction) || battery.reserveFraction < 0.02 || battery.reserveFraction > 0.2)
    throw Error("Invalid battery simulation tuning");
  if (
    !Number.isFinite(c.restitution) ||
    c.restitution < 0 ||
    c.restitution > 1 ||
    !positive(c.friction)
  )
    throw Error("Invalid contact");
  return c;
}

export function validateMap(m) {
  const vec = (v) =>
    Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  if (
    !m ||
    !/^[-a-z0-9]+$/.test(m.id) ||
    !["park", "construction", "playground", "city"].includes(m.kind) ||
    !Number.isInteger(m.version) ||
    m.version < 1 ||
    !Number.isFinite(m.size) ||
    m.size < 40 ||
    !vec(m.spawn)
  )
    throw Error("Invalid map");
  if (
    typeof m.routeId !== "string" ||
    !m.routeId ||
    !Number.isInteger(m.routeVersion) ||
    m.routeVersion < 1 ||
    !Array.isArray(m.gates) ||
    (m.racingEnabled !== false && m.gates.length < 2)
  )
    throw Error("Invalid route");
  if (m.racingEnabled !== undefined && typeof m.racingEnabled !== "boolean")
    throw Error("Invalid map racing policy");
  if (m.boundary && (!Number.isFinite(m.boundary.returnAfterSeconds) || m.boundary.returnAfterSeconds <= 0))
    throw Error("Invalid map boundary policy");
  for (const g of m.gates)
    if (
      !vec(g.p) ||
      !vec(g.n) ||
      Math.abs(Math.hypot(...g.n) - 1) > 1e-5 ||
      !Number.isFinite(g.width) ||
      g.width <= 0.2 ||
      !Number.isFinite(g.height) ||
      g.height <= 0.2
    )
      throw Error("Invalid gate");
  return m;
}
