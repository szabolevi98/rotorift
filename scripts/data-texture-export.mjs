import { deflateSync } from "node:zlib";

// The R5's two small RGBA DataTextures need no browser or native canvas package
// during GLB export. This adapter deliberately supports raw pixel images only.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, crc]);
}
globalThis.ImageData ??= class {
  constructor(data, width, height) {
    Object.assign(this, { data, width, height });
  }
};
globalThis.OffscreenCanvas ??= class {
  constructor(width, height) {
    Object.assign(this, { width, height });
  }
  getContext() {
    return {
      putImageData: (image) => {
        this.image = image;
      },
    };
  }
  async convertToBlob({ type } = {}) {
    if (type && type !== "image/png")
      throw Error("DataTexture export supports PNG only");
    const { width, height } = this.image;
    if (width !== this.width || height !== this.height)
      throw Error("DataTexture export does not rescale pixels");
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    const rows = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++)
      Buffer.from(
        this.image.data.buffer,
        this.image.data.byteOffset + y * width * 4,
        width * 4,
      ).copy(rows, y * (width * 4 + 1) + 1);
    return new Blob(
      [
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(rows)),
        chunk("IEND", Buffer.alloc(0)),
      ],
      { type: "image/png" },
    );
  }
};
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
