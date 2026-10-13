const MAGIC = 0x31435252; // RRC1, little endian
export function encodeCollisionData(mapId, records) {
  let payloadSize = 0;
  const header = { format: 1, mapId, records: records.map(record => {
    if (record.kind !== "mesh") return record;
    const { vertices, indices, ...metadata } = record;
    const entry = { ...metadata, offset: payloadSize, vertices: vertices.length, indices: indices.length };
    payloadSize += vertices.byteLength + indices.byteLength; return entry;
  }) };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const start = (8 + json.length + 3) & ~3;
  const bytes = new Uint8Array(start + payloadSize), view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true); view.setUint32(4, json.length, true); bytes.set(json, 8);
  let offset = start;
  for (const record of records) if (record.kind === "mesh") {
    for (const array of [record.vertices, record.indices]) {
      bytes.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), offset); offset += array.byteLength;
    }
  }
  return bytes;
}

export function decodeCollisionData(buffer, mapId) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12 || buffer.byteLength > 64 * 1024 * 1024) throw Error("Invalid collision data size");
  const view = new DataView(buffer), length = view.getUint32(4, true);
  if (view.getUint32(0, true) !== MAGIC || length < 2 || length > buffer.byteLength - 8) throw Error("Invalid collision data header");
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, length)));
  if (header.format !== 1 || header.mapId !== mapId || !Array.isArray(header.records) || header.records.length > 20000) throw Error("Invalid collision identity");
  const start = (8 + length + 3) & ~3;
  const vector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  return header.records.map(record => {
    if (!vector(record.min) || !vector(record.max) || record.min.some((v,i) => v > record.max[i]) ||
        !Number.isFinite(record.friction) || record.friction < 0) throw Error("Invalid collision bounds");
    if (record.kind === "mesh") {
      if (![record.offset,record.vertices,record.indices].every(v=>Number.isSafeInteger(v)&&v>=0) || record.offset % 4 ||
          !record.vertices || record.vertices % 3 || !record.indices || record.indices % 3 ||
          start + record.offset + 4*(record.vertices+record.indices)>buffer.byteLength) throw Error("Invalid collision mesh");
      const vertices = new Float32Array(buffer, start + record.offset, record.vertices);
      const indices = new Uint32Array(buffer, start + record.offset + 4*record.vertices, record.indices);
      if (!vertices.every(Number.isFinite) || !indices.every(i=>i<vertices.length/3)) throw Error("Invalid collision triangles");
      return { ...record, vertices, indices };
    }
    if (!["cuboid","ball","cylinder","cone"].includes(record.kind) || !vector(record.p) ||
        !Array.isArray(record.q) || record.q.length !== 4 || !record.q.every(Number.isFinite) ||
        (record.kind === "cuboid" ? !vector(record.halfExtents) || !record.halfExtents.every(v=>v>0) :
          !Number.isFinite(record.radius) || record.radius <= 0 || (record.kind !== "ball" && !(record.halfHeight > 0)))) throw Error("Invalid collision primitive");
    return record;
  });
}
