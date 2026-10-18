export function windVelocity(position, time, level) {
  const speed = { calm: 0, light: 2, medium: 5, strong: 9 }[level];
  if (!speed) return [0, 0, 0];
  const t = time,
    phase = position[0] * 0.025 + position[2] * 0.018;
  const gust =
    1 + 0.25 * Math.sin(t * 0.7 + phase) + 0.12 * Math.sin(t * 1.9 - phase);
  const direction = 0.6 + 0.12 * Math.sin(t * 0.17);
  return [
    speed * gust * Math.cos(direction),
    speed * 0.035 * Math.sin(t * 1.3 + phase),
    speed * gust * Math.sin(direction),
  ];
}
