// Scenery extends several kilometres beyond each playable map. Keep every
// camera consumer on the same far plane so the terrain silhouette is not cut
// across its long triangles as the camera moves.
export const MAP_VIEW_DISTANCES = Object.freeze({
  park: 12000,
  construction: 12000,
  playground: 12000,
  city: 12000,
  circuit: 12000,
  harbor: 18000,
  gym: 180,
});

export function mapViewDistance(map) {
  return MAP_VIEW_DISTANCES[typeof map === 'string' ? map : map?.kind] ?? 12000;
}
