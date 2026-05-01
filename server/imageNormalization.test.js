import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  decodePngToRgba,
  inspectPngBuffer,
  normalizePngTransparencyToWhite,
} from "./imageNormalization.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function encodeRgbaPng(width, height, pixels) {
  const rowBytes = width * 4;
  const raw = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (rowBytes + 1)] = 0;
    pixels.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeTransparentProductPng() {
  const pixels = Buffer.alloc(3 * 3 * 4, 0);
  const center = (1 * 3 + 1) * 4;
  pixels[center] = 220;
  pixels[center + 1] = 20;
  pixels[center + 2] = 10;
  pixels[center + 3] = 255;
  return encodeRgbaPng(3, 3, pixels);
}

describe("image normalization", () => {
  it("flattens transparent PNG inputs onto pure #FFFFFF with no alpha channel", () => {
    const input = makeTransparentProductPng();
    const normalized = normalizePngTransparencyToWhite(input, { canvasSize: 12, padding: 2 });
    const meta = inspectPngBuffer(normalized.buffer);
    const decoded = decodePngToRgba(normalized.buffer);

    expect(normalized.changed).toBe(true);
    expect(normalized.log.before.transparent).toBe(true);
    expect(normalized.log.after.background).toBe("#FFFFFF");
    expect(meta.colorType).toBe(2);
    expect(meta.hasAlphaChannel).toBe(false);
    expect(meta.transparent).toBe(false);

    for (let index = 3; index < decoded.rgba.length; index += 4) {
      expect(decoded.rgba[index]).toBe(255);
    }

    const topLeft = decoded.rgba.subarray(0, 4);
    const bottomRight = decoded.rgba.subarray(decoded.rgba.length - 4, decoded.rgba.length);
    expect([...topLeft]).toEqual([255, 255, 255, 255]);
    expect([...bottomRight]).toEqual([255, 255, 255, 255]);
  });

  it("is deterministic for batch imports and repeated normalization", () => {
    const input = makeTransparentProductPng();
    const first = normalizePngTransparencyToWhite(input, { canvasSize: 12, padding: 2 });
    const second = normalizePngTransparencyToWhite(input, { canvasSize: 12, padding: 2 });

    expect(first.buffer.equals(second.buffer)).toBe(true);
    expect(first.log.after).toEqual(second.log.after);
  });
});
