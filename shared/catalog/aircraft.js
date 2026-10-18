export function allAircraft(catalog) {
  return [...(catalog.drones ?? []), ...(catalog.airplanes ?? [])];
}

export const findAircraft = (catalog, id) =>
  allAircraft(catalog).find((item) => item.id === id);
