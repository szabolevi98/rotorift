import { isBatteryLabel, colorBatteryLabel } from "./battery-labels.js";

export const DRONE_COLORS = Object.freeze({
  coral: "#ff6648", yellow: "#ffd000", teal: "#3e938c", violet: "#8573a8",
  blue: "#3986ff", lime: "#75cf35", pink: "#ed5aa6", white: "#e7edf3",
});
export const validDroneColor = value => typeof value === "string" && Object.hasOwn(DRONE_COLORS, value);
export const normalizeDroneColor = value => validDroneColor(value) ? value : "coral";

const anchors = {
  VTX_bolted_TPU_tray: "base", TPU_print_layer_groove: "detail",
  Duct_thin_wall: "base", Low_profile_protective_ring: "base", Molded_ring_lower_seam: "detail",
};
export function tagDroneColorMaterials(root) {
  // Accepted GLBs share these materials across the TPU parts. Tag by semantic
  // mesh names before batching, so connectors, wiring, lenses and PCB stay intact.
  root.traverse(object => {
    const role = anchors[object.name] ?? (isBatteryLabel(object) ? "label" : null);
    if (!role || !object.material) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.userData.droneColorRole = role;
  });
}
export function applyDroneColor(root, value) {
  const color = DRONE_COLORS[normalizeDroneColor(value)], seen = new Set();
  root?.traverse(object => {
    if (!object.material) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (seen.has(material) || !material.userData.droneColorRole) continue;
      seen.add(material);
      if (material.userData.droneColorRole === "label") { colorBatteryLabel(material, color); continue; }
      material.color.set(color);
      if (material.userData.droneColorRole === "detail") material.color.multiplyScalar(0.55);
    }
  });
}
