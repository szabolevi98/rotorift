const variants = new WeakMap(), originals = new WeakMap();

export function isBatteryLabel(object) {
  if (!/^(Label_|Battery_label_print|Rotorift_own_label)/.test(object.name)) return false;
  for (let parent = object.parent; parent; parent = parent.parent)
    if (/battery/i.test(parent.name)) return true;
  return false;
}

// The orange ink is baked into the accepted label textures. Replace only its
// hue, retaining print, background and antialiased edges against dark lettering.
export function recolorBatteryLabelPixels(pixels, hex) {
  const value = parseInt(hex.replace("#", ""), 16), color = [value >> 16, (value >> 8) & 255, value & 255];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (r < 45 || g < 15 || r < g * 1.8 || g < b * 1.2 || g > 155 || b > 115) continue;
    const ink = Math.min(1, r / 237);
    pixels[i] = Math.round(color[0] * ink);
    pixels[i + 1] = Math.round(color[1] * ink);
    pixels[i + 2] = Math.round(color[2] * ink);
  }
}

export function colorBatteryLabel(material, hex) {
  if (!material.map || typeof document === "undefined") return;
  const source = originals.get(material.map) ?? material.map;
  let colors = variants.get(source);
  if (!colors) { colors = new Map(); variants.set(source, colors); }
  if (!colors.has(hex)) {
    const image = source.image, canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    recolorBatteryLabelPixels(pixels.data, hex); ctx.putImageData(pixels, 0, 0);
    const texture = source.clone();
    // Texture.clone shares its Source: replacing image on that clone alone would
    // overwrite the pristine texture and recolor other pilots' labels as well.
    texture.source = new source.source.constructor(canvas);
    texture.needsUpdate = true;
    originals.set(texture, source); colors.set(hex, texture);
  }
  material.map = colors.get(hex);
}

export function applyBatteryLabelColor(root, hex) {
  root.traverse(object => {
    if (isBatteryLabel(object)) for (const material of Array.isArray(object.material) ? object.material : [object.material])
      if (material) colorBatteryLabel(material, hex);
  });
}
