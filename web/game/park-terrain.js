import * as THREE from "three";
import { PARK_CHUNK_SIZE, PARK_GRID_STEPS, parkHeight } from "../../shared/world/park-layout.js";

export const PARK_VIEW_DISTANCE = 12000;
export const PARK_FOG_DENSITY = 0.00065;
export const PARK_TERRAIN_RINGS = [
  { inner: 448, outer: 896, step: 16, edgeStep: PARK_CHUNK_SIZE / PARK_GRID_STEPS },
  { inner: 896, outer: 1792, step: 64, edgeStep: 16 },
  { inner: 1792, outer: 3584, step: 256, edgeStep: 64 },
  { inner: 3584, outer: 7168, step: 512, edgeStep: 256 },
  { inner: 7168, outer: 14336, step: 1024, edgeStep: 512 },
  { inner: 14336, outer: 28672, step: 2048, edgeStep: 1024 },
];

// Near and distant terrain share their heights, normals, colour and world UVs.
export function appendTerrainVertex(buffers, x, z) {
  buffers.positions.push(x, parkHeight(x, z), z);
  const nx = parkHeight(x - 0.5, z) - parkHeight(x + 0.5, z);
  const nz = parkHeight(x, z - 0.5) - parkHeight(x, z + 0.5);
  const length = Math.hypot(nx, 1, nz);
  buffers.normals.push(nx / length, 1 / length, nz / length);
  const tone = 0.92 + Math.sin(x * 0.07 + z * 0.03) * 0.05 + Math.cos(z * 0.05) * 0.035;
  buffers.colors.push(tone * 0.28, tone * 0.4, tone * 0.18);
  buffers.uv.push(x / 4, z / 4);
}

export function makeParkDistantTerrain(cx, cz) {
  const buffers = { positions: [], normals: [], colors: [], uv: [] }, indices = [];
  const centerX = (cx + 0.5) * PARK_CHUNK_SIZE, centerZ = (cz + 0.5) * PARK_CHUNK_SIZE;
  const vertex = (x, z) => {
    const index = buffers.positions.length / 3;
    appendTerrainVertex(buffers, x + centerX, z + centerZ);
    return index;
  };
  for (const { inner, outer, step, edgeStep } of PARK_TERRAIN_RINGS) {
    for (let z = -outer; z < outer; z += step) for (let x = -outer; x < outer; x += step) {
      if (x >= -inner && x < inner && z >= -inner && z < inner) continue;
      // Subdivide the inner edge to exactly match the finer neighbouring mesh.
      // This is real shared-edge geometry, without overlapping skirts or planes.
      const corners = [[x, z], [x, z + step], [x + step, z + step], [x + step, z]];
      const polygon = [];
      for (let edge = 0; edge < 4; edge++) {
        const a = corners[edge], b = corners[(edge + 1) % 4];
        const onInnerX = a[0] === b[0] && Math.abs(a[0]) === inner
          && Math.min(a[1], b[1]) >= -inner && Math.max(a[1], b[1]) <= inner;
        const onInnerZ = a[1] === b[1] && Math.abs(a[1]) === inner
          && Math.min(a[0], b[0]) >= -inner && Math.max(a[0], b[0]) <= inner;
        const count = onInnerX || onInnerZ ? step / edgeStep : 1;
        for (let i = 0; i < count; i++)
          polygon.push(vertex(a[0] + (b[0] - a[0]) * i / count, a[1] + (b[1] - a[1]) * i / count));
      }
      if (polygon.length === 4) indices.push(polygon[0], polygon[1], polygon[3], polygon[3], polygon[1], polygon[2]);
      else {
        const middle = vertex(x + step / 2, z + step / 2);
        for (let i = 0; i < polygon.length; i++) indices.push(middle, polygon[i], polygon[(i + 1) % polygon.length]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uv, 2));
  geometry.setIndex(indices);
  return geometry;
}
