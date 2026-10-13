export const RADIO_GUIDE_AXES = ["centres", "throttle", "yaw", "pitch", "roll"];

export function radioGuideTarget(axis, elapsedMs, range = null, now = 0, setup = false) {
  const pose = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
  const mode = range ? "range" : RADIO_GUIDE_AXES.includes(axis) ? axis : "centres";
  const angle = (range ? now - (range.start ?? range.end - 6000) : elapsedMs) * Math.PI / 1000;
  const wave = Math.sin(angle);
  const oneDirection = (1 - Math.cos(elapsedMs * Math.PI / 1200)) / 2;
  if (mode === "range") {
    pose.throttle = (wave + 1) / 2;
    pose.yaw = Math.cos(angle);
    pose.pitch = wave;
    pose.roll = Math.cos(angle);
  } else if (mode === "throttle") pose.throttle = setup ? oneDirection : (wave + 1) / 2;
  else if (mode !== "centres") pose[mode] = setup ? oneDirection : wave;
  return { mode, pose, seconds: range ? Math.max(0, Math.ceil((range.end - now) / 1000)) : null };
}

export function radioStickPositions(pose) {
  const clamp = value => Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  return [[clamp(pose.yaw), clamp(pose.throttle * 2 - 1)], [clamp(pose.roll), clamp(pose.pitch)]];
}
