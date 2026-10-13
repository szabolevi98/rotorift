import RAPIER from "@dimforge/rapier3d-compat";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { loadCatalog } from "../server/catalog.js";
import { DronePhysics, PHYSICS_DT } from "../shared/physics/drone.js";
import { hoverThrottle, motorThrustLimit } from "../shared/physics/propulsion.js";
import { actualRate } from "../shared/physics/rates.js";
import { rotate, inverse } from "../shared/physics/math.js";

const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const axisIndex = { pitch: 0, yaw: 1, roll: 2 };

// Run the actual game controller and Rapier pipeline, with no visual renderer,
// velocity clamp, external attitude corrections or automatic altitude hold.
function experiment(config, callback, dt = PHYSICS_DT, spawn = [0, 1000, 0]) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  try {
    const drone = new DronePhysics(RAPIER, world, config, spawn, { updateSceneQueries: false });
    drone.armed = true;
    return callback(drone, dt);
  } finally { world.free(); }
}
function advance(drone, seconds, input, dt) {
  for (let i = 0; i < Math.round(seconds / dt); i++) drone.step(input, dt);
}

export function measureRotation(config, axis, stick = 1, throttle = hoverThrottle(config), dt = PHYSICS_DT, spawn) {
  return experiment(config, (drone) => {
    const input = { ...neutral, throttle };
    advance(drone, 0.5, input, dt);
    const target = Math.abs(actualRate(stick, drone.rates[axis]));
    const bodyRates = () => rotate(drone.pose.w, inverse(drone.pose.q)).map(v => -v * 180 / Math.PI);
    let t90 = null, turn = null, angle = 0, peak = 0, rate = 0, crossPeak = 0;
    for (let i = 0; i < Math.round(1.5 / dt); i++) {
      drone.step({ ...input, [axis]: stick }, dt);
      const rates = bodyRates();
      rate = rates[axisIndex[axis]] * Math.sign(stick);
      crossPeak = Math.max(crossPeak, ...rates.filter((_, j) => j !== axisIndex[axis]).map(Math.abs));
      peak = Math.max(peak, rate); angle += rate * dt;
      if (t90 === null && rate >= target * 0.9) t90 = (i + 1) * dt;
      if (turn === null && angle >= 360) turn = (i + 1) * dt;
    }
    const steady = rate;
    let brake = null, rebound = 0, residual = 0;
    for (let i = 0; i < Math.round(0.5 / dt); i++) {
      drone.step(input, dt);
      rate = bodyRates()[axisIndex[axis]] * Math.sign(stick);
      if (brake === null && Math.abs(rate) < 10) brake = (i + 1) * dt;
      rebound += Math.max(0, -rate) * dt;
      if (i >= Math.round(0.3 / dt)) residual = Math.max(residual, Math.abs(rate));
    }
    return { axis, stick, throttle, targetDegS: target, steadyDegS: steady, peakDegS: peak,
      response90S: t90, fullTurnS: turn, brakeS: brake, reboundDeg: rebound, residualDegS: residual, crossPeakDegS: crossPeak };
  }, dt, spawn);
}

export function measureCruise(config, dt = PHYSICS_DT) {
  return experiment(config, (drone) => {
    // An offset centre of mass requires unequal motor thrust. Measure the
    // available balanced collective, rather than assuming all four motors
    // can be at their individual maximum simultaneously.
    advance(drone, 1, { ...neutral, throttle: 1 }, dt);
    const balancedThrust = drone.motorThrust.reduce((sum, force) => sum + force, 0);
    const tilt = Math.acos(config.massKg * 9.81 / balancedThrust);
    drone.body.setRotation({ x: Math.sin(tilt / 2), y: 0, z: 0, w: Math.cos(tilt / 2) }, true);
    drone.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    drone.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    let to50 = null, to100 = null, at15 = null;
    for (let i = 0; i < Math.round(30 / dt); i++) {
      drone.step({ ...neutral, throttle: 1 }, dt);
      const horizontal = Math.hypot(drone.pose.v[0], drone.pose.v[2]) * 3.6;
      if (to50 === null && horizontal >= 50) to50 = (i + 1) * dt;
      if (to100 === null && horizontal >= 100) to100 = (i + 1) * dt;
      if (i === Math.round(15 / dt) - 1) at15 = horizontal;
    }
    return { tiltDeg: tilt * 180 / Math.PI, horizontalKmh: Math.hypot(drone.pose.v[0], drone.pose.v[2]) * 3.6,
      verticalMps: drone.pose.v[1], to50S: to50, to100S: to100, settleDeltaKmh: Math.abs(Math.hypot(drone.pose.v[0], drone.pose.v[2]) * 3.6 - at15) };
  }, dt);
}

export function measureRecovery(config, mode, dt = PHYSICS_DT) {
  return experiment(config, (drone) => {
    drone.mode = mode;
    const tilt = 35 * Math.PI / 180;
    drone.body.setRotation({ x: Math.sin(tilt / 2), y: 0, z: 0, w: Math.cos(tilt / 2) }, true);
    let levelAt = null, error = 0;
    for (let i = 0; i < Math.round(2 / dt); i++) {
      drone.step({ ...neutral, throttle: hoverThrottle(config) }, dt);
      error = Math.acos(Math.max(-1, Math.min(1, rotate([0, 1, 0], drone.pose.q)[1]))) * 180 / Math.PI;
      if (levelAt === null && error < 2) levelAt = (i + 1) * dt;
    }
    return { mode, levelWithin2DegS: levelAt, finalTiltDeg: error };
  }, dt);
}

export function measureCoast(config, dt = PHYSICS_DT) {
  return experiment(config, (drone) => {
    const input = { ...neutral, throttle: hoverThrottle(config) };
    advance(drone, 1, input, dt);
    drone.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    drone.body.setLinvel({ x: 50 / 3.6, y: 0, z: 0 }, true);
    let halfAt = null, distance = null;
    const start = drone.pose.p[0];
    for (let i = 0; i < Math.round(5 / dt); i++) {
      drone.step(input, dt);
      if (halfAt === null && drone.pose.v[0] * 3.6 <= 25) {
        halfAt = (i + 1) * dt; distance = drone.pose.p[0] - start;
      }
    }
    return { speedFromKmh: 50, speedToKmh: 25, halfSpeedS: halfAt, distanceM: distance };
  }, dt);
}

export function measureHover(config, dt = PHYSICS_DT) {
  return experiment(config, (drone) => {
    const throttle = hoverThrottle(config), input = { ...neutral, throttle };
    advance(drone, 1, input, dt);
    // Exclude the initial motor spool-up fall from the hover measurement.
    drone.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    const start = drone.pose.p;
    advance(drone, 10, input, dt);
    return { throttle, driftM: drone.pose.p.map((v, i) => v - start[i]), speedMps: Math.hypot(...drone.pose.v) };
  }, dt);
}

export async function measureFleet() {
  await RAPIER.init();
  const { drones } = await loadCatalog();
  return { measuredAt: new Date().toISOString(), stepHz: 1 / PHYSICS_DT,
    conditions: "Acro, default Actual Rates, calm air, nominal voltage, battery/damage/propwash disabled; direct stick commands",
    drones: drones.map(config => ({ id: config.id, configHash: config.configHash, version: config.version, massKg: config.massKg,
      thrustToWeight: 4 * motorThrustLimit(config) / (config.massKg * 9.81), hover: measureHover(config), cruise: measureCruise(config),
      recovery: ["acro", "angle", "horizon"].map(mode => measureRecovery(config, mode)), coast: measureCoast(config),
      rotation: [0.08, hoverThrottle(config), 1].flatMap(throttle => ["roll", "pitch", "yaw"].flatMap(axis => [1, -1, 0.25].map(stick => measureRotation(config, axis, stick, throttle)))) })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await measureFleet();
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + "\n");
  for (const d of report.drones) {
    const r = d.rotation.filter(r => r.stick === 1 && Math.abs(r.throttle - d.hover.throttle) < 1e-6);
    console.log(JSON.stringify({ id: d.id, hoverPercent: d.hover.throttle * 100, hoverDriftM: d.hover.driftM,
      thrustToWeight: d.thrustToWeight, cruise: d.cruise, recovery: d.recovery, coast: d.coast, rotationAtHover: r }));
  }
}
