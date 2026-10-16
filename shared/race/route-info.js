export const ROUTE_LANGUAGES = ['en', 'hu', 'de', 'fr', 'es'];

export function validateRouteDetails(details) {
  if (details === undefined) return;
  if (!details || !['easy', 'medium', 'hard'].includes(details.difficulty) ||
      !Array.isArray(details.recommendedDrones) || !details.recommendedDrones.length || details.recommendedDrones.length > 20 ||
      details.recommendedDrones.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) ||
      ROUTE_LANGUAGES.some(lang => typeof details.description?.[lang] !== 'string' || !details.description[lang].trim() || details.description[lang].length > 600))
    throw Error('Race details need a difficulty, recommended drones and a short description in all five languages.');
  return {difficulty: details.difficulty, recommendedDrones: [...new Set(details.recommendedDrones)],
    description: Object.fromEntries(ROUTE_LANGUAGES.map(lang => [lang, details.description[lang].trim()]))};
}

// Guides include the closing leg and detours around scenery. Older/custom routes
// without guides use a clearly marked straight-line estimate between gate centres.
export function routeMetrics(route) {
  const gates = route?.gates ?? [];
  const legs = route?.guide ?? gates.map((gate, i) => [gate.p, gates[(i + 1) % gates.length].p]);
  const lengthM = legs.reduce((total, leg) => total + leg.slice(1).reduce((sum, p, i) =>
    sum + Math.hypot(...p.map((value, axis) => value - leg[i][axis])), 0), 0);
  return {lengthM, gateCount: gates.length, estimated: !route?.guide};
}
