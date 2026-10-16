// Project the saved guide itself, including obstacle detours and the closing leg.
// No map-specific drawing or exported image is required.
export function routeDiagram(route, width = 320, height = 160, padding = 18) {
  const gates = route?.gates ?? [];
  if (!gates.length) return null;
  const source = route.guide?.length ? route.guide.flat() : [...gates.map(g => g.p), gates[0].p];
  const points = source.filter((p, i) => !i || p.some((v, axis) => v !== source[i - 1][axis]));
  const bounds = axis => [Math.min(...points.map(p => p[axis])), Math.max(...points.map(p => p[axis]))];
  const x = bounds(0), z = bounds(2);
  const sideView = Math.max(x[1] - x[0], z[1] - z[0]) < .001;
  const vertical = sideView ? bounds(1) : z;
  const scale = Math.min((width - padding * 2) / Math.max(x[1] - x[0], .001),
    (height - padding * 2) / Math.max(vertical[1] - vertical[0], .001));
  const project = p => [width / 2 + (p[0] - (x[0] + x[1]) / 2) * scale,
    height / 2 + (p[sideView ? 1 : 2] - (vertical[0] + vertical[1]) / 2) * scale * (sideView ? -1 : 1)];
  const line = points.map(project), markers = gates.map(g => project(g.p));
  // An arrow near the start shows direction, without cluttering every bend.
  const lengths = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
  let remaining = Math.min(24, lengths.reduce((a, b) => a + b, 0) * .08), arrow = null;
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > 0 && remaining <= lengths[i]) {
      const a = line[i], b = line[i + 1], fraction = remaining / lengths[i];
      arrow = {p: a.map((v, axis) => v + (b[axis] - v) * fraction), angle: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI};
      break;
    }
    remaining -= lengths[i];
  }
  return {line, gates: markers, arrow, sideView};
}
