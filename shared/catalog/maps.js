// Persistent IDs predate the English presentation codes. Keep them stable for
// rooms, saved routes, collision assets, records and browser preferences.
const legacy = {
  liget: { code: 'grove', order: 0, droneClass: 'standard' },
  betonudvar: { code: 'construction-yard', order: 1, droneClass: 'standard' },
  jatszoter: { code: 'playground', order: 2, droneClass: 'micro' },
  skyline: { code: 'skyline', order: 3, droneClass: 'standard' },
  apex: { code: 'apex-circuit', order: 4, droneClass: 'standard' },
};
export function mapPresentation(value) {
  const map = typeof value === 'string' ? { id: value } : value;
  const defaults = legacy[map.id];
  const code = map.code ?? defaults?.code ?? map.id;
  return { code, nameKey: 'map.' + code,
    audienceKey: 'map.audience.' + (map.droneClass ?? defaults?.droneClass ?? 'standard') };
}
export const compareMaps = (a, b) =>
  (legacy[a.id]?.order ?? 100) - (legacy[b.id]?.order ?? 100) || a.id.localeCompare(b.id);
