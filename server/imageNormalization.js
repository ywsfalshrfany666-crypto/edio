import { deflateSync, inflateSync } from "node:zlib";

export const PRODUCT_IMAGE_NORMALIZATION_POLICY = {
  background: "#FFFFFF",
  canvasSize: 1500,
  padding: 120,
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WHITE_RGB = { r: 255, g: 255, b: 255 };

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export function normalizePngTransparencyToWhite(buffer, options = {}) {
  const decoded = decodePng(buffer);
  const before = buildPngMetadata(decoded);
  const shouldNormalize = decoded.hasAlphaChannel || decoded.hasTransparency;
  if (!shouldNormalize) {
    return {
      changed: false,
      buffer,
      before,
      after: before,
      log: {
        action: "png_alpha_flatten_skipped",
        reason: "no_alpha_or_transparency",
        before,
        after: before,
      },
    };
  }

  const canvasSize = Math.max(16, Number(options.canvasSize || PRODUCT_IMAGE_NORMALIZATION_POLICY.canvasSize));
  const padding = Math.max(0, Math.min(Math.floor(canvasSize / 3), Number(options.padding ?? PRODUCT_IMAGE_NORMALIZATION_POLICY.padding)));
  const contentBox = findVisibleContentBox(decoded.rgba, decoded.width, decoded.height);
  const maxContentSize = Math.max(1, canvasSize - padding * 2);
  const scale = Math.min(maxContentSize / Math.max(1, contentBox.width), maxContentSize / Math.max(1, contentBox.height));
  const targetWidth = Math.max(1, Math.round(contentBox.width * scale));
  const targetHeight = Math.max(1, Math.round(contentBox.height * scale));
  const offsetX = Math.floor((canvasSize - targetWidth) / 2);
  const offsetY = Math.floor((canvasSize - targetHeight) / 2);
  const outputRgb = Buffer.alloc(canvasSize * canvasSize * 3, 255);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sampleX = contentBox.x + (x + 0.5) / scale - 0.5;
      const sampleY = contentBox.y + (y + 0.5) / scale - 0.5;
      const pixel = samplePremultipliedRgba(decoded.rgba, decoded.width, decoded.height, sampleX, sampleY);
      const alpha = pixel.a / 255;
      const outR = Math.round(pixel.r * alpha + WHITE_RGB.r * (1 - alpha));
      const outG = Math.round(pixel.g * alpha + WHITE_RGB.g * (1 - alpha));
      const outB = Math.round(pixel.b * alpha + WHITE_RGB.b * (1 - alpha));
      const targetIndex = ((offsetY + y) * canvasSize + offsetX + x) * 3;
      outputRgb[targetIndex] = clampByte(outR);
      outputRgb[targetIndex + 1] = clampByte(outG);
      outputRgb[targetIndex + 2] = clampByte(outB);
    }
  }

  const outputBuffer = encodeRgbPng(outputRgb, canvasSize, canvasSize);
  const after = {
    width: canvasSize,
    height: canvasSize,
    format: "png",
    colorType: 2,
    bitDepth: 8,
    transparent: false,
    hasAlphaChannel: false,
    background: PRODUCT_IMAGE_NORMALIZATION_POLICY.background,
    alphaRemoved: true,
    objectFit: "contain",
    contentBox,
    outputContentBox: {
      x: offsetX,
      y: offsetY,
      width: targetWidth,
      height: targetHeight,
    },
  };

  return {
    changed: true,
    buffer: outputBuffer,
    before,
    after,
    log: {
      action: "png_alpha_flattened_to_white",
      background: PRODUCT_IMAGE_NORMALIZATION_POLICY.background,
      deterministic: true,
      shadow: false,
      gradient: false,
      before,
      after,
    },
  };
}

export function inspectPngBuffer(buffer) {
  return buildPngMetadata(decodePng(buffer));
}

export function decodePngToRgba(buffer) {
  const decoded = decodePng(buffer);
  return {
    width: decoded.width,
    height: decoded.height,
    rgba: decoded.rgba,
    metadata: buildPngMetadata(decoded),
  };
}

function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Unsupported PNG: invalid signature");
  }

  const chunks = parsePngChunks(buffer);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  if (!ihdr || ihdr.length !== 13) throw new Error("Unsupported PNG: missing IHDR");

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compression = ihdr[10];
  const filter = ihdr[11];
  const interlace = ihdr[12];

  if (bitDepth !== 8 || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error("Unsupported PNG: only 8-bit non-interlaced PNG images are supported");
  }

  const palette = chunks.find((chunk) => chunk.type === "PLTE")?.data || null;
  const transparency = chunks.find((chunk) => chunk.type === "tRNS")?.data || null;
  const idat = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
  if (!idat.length) throw new Error("Unsupported PNG: missing IDAT");

  const bytesPerPixel = bytesPerPixelForColorType(colorType);
  const rowBytes = width * bytesPerPixel;
  const inflated = inflateSync(idat);
  const expectedMinimum = height * (rowBytes + 1);
  if (inflated.length < expectedMinimum) throw new Error("Unsupported PNG: truncated image data");

  const raw = unfilterPngScanlines(inflated, width, height, bytesPerPixel);
  const rgba = convertRawPixelsToRgba(raw, width, height, colorType, palette, transparency);
  const hasAlphaChannel = colorType === 4 || colorType === 6;
  const hasTransparency = hasAlphaChannel
    ? hasTransparentRgbaPixels(rgba)
    : Boolean(transparency && hasTransparentRgbaPixels(rgba));

  return {
    width,
    height,
    bitDepth,
    colorType,
    rgba,
    hasAlphaChannel,
    hasTransparency,
  };
}

function parsePngChunks(buffer) {
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (crcEnd > buffer.length) throw new Error("Unsupported PNG: invalid chunk length");
    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) });
    offset = crcEnd;
    if (type === "IEND") break;
  }
  return chunks;
}

function bytesPerPixelForColorType(colorType) {
  switch (colorType) {
    case 0:
    case 3:
      return 1;
    case 2:
      return 3;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new Error(`Unsupported PNG color type: ${colorType}`);
  }
}

function unfilterPngScanlines(inflated, width, height, bytesPerPixel) {
  const rowBytes = width * bytesPerPixel;
  const output = Buffer.alloc(rowBytes * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    const rowStart = y * rowBytes;
    const prevRowStart = rowStart - rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[inputOffset + x];
      const left = x >= bytesPerPixel ? output[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? output[prevRowStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? output[prevRowStart + x - bytesPerPixel] : 0;
      let value;
      if (filterType === 0) value = raw;
      else if (filterType === 1) value = raw + left;
      else if (filterType === 2) value = raw + up;
      else if (filterType === 3) value = raw + Math.floor((left + up) / 2);
      else if (filterType === 4) value = raw + paethPredictor(left, up, upLeft);
      else throw new Error(`Unsupported PNG filter: ${filterType}`);
      output[rowStart + x] = value & 0xff;
    }
    inputOffset += rowBytes;
  }
  return output;
}

function convertRawPixelsToRgba(raw, width, height, colorType, palette, transparency) {
  const rgba = Buffer.alloc(width * height * 4);
  const transparentGray = transparency && transparency.length >= 2 ? transparency.readUInt16BE(0) & 0xff : null;
  const transparentRed = transparency && transparency.length >= 6 ? transparency.readUInt16BE(0) & 0xff : null;
  const transparentGreen = transparency && transparency.length >= 6 ? transparency.readUInt16BE(2) & 0xff : null;
  const transparentBlue = transparency && transparency.length >= 6 ? transparency.readUInt16BE(4) & 0xff : null;

  for (let i = 0, pixel = 0; pixel < width * height; pixel += 1) {
    const target = pixel * 4;
    if (colorType === 0) {
      const gray = raw[i];
      i += 1;
      rgba[target] = gray;
      rgba[target + 1] = gray;
      rgba[target + 2] = gray;
      rgba[target + 3] = transparentGray !== null && gray === transparentGray ? 0 : 255;
    } else if (colorType === 2) {
      const red = raw[i];
      const green = raw[i + 1];
      const blue = raw[i + 2];
      i += 3;
      rgba[target] = red;
      rgba[target + 1] = green;
      rgba[target + 2] = blue;
      rgba[target + 3] =
        transparentRed !== null && red === transparentRed && green === transparentGreen && blue === transparentBlue
          ? 0
          : 255;
    } else if (colorType === 3) {
      if (!palette) throw new Error("Unsupported PNG: indexed image without PLTE");
      const index = raw[i];
      i += 1;
      const paletteIndex = index * 3;
      rgba[target] = palette[paletteIndex] ?? 0;
      rgba[target + 1] = palette[paletteIndex + 1] ?? 0;
      rgba[target + 2] = palette[paletteIndex + 2] ?? 0;
      rgba[target + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    } else if (colorType === 4) {
      const gray = raw[i];
      const alpha = raw[i + 1];
      i += 2;
      rgba[target] = gray;
      rgba[target + 1] = gray;
      rgba[target + 2] = gray;
      rgba[target + 3] = alpha;
    } else if (colorType === 6) {
      rgba[target] = raw[i];
      rgba[target + 1] = raw[i + 1];
      rgba[target + 2] = raw[i + 2];
      rgba[target + 3] = raw[i + 3];
      i += 4;
    }
  }

  return rgba;
}

function encodeRgbPng(rgb, width, height) {
  const rowBytes = width * 3;
  const raw = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y += 1) {
    const targetOffset = y * (rowBytes + 1);
    raw[targetOffset] = 0;
    rgb.copy(raw, targetOffset + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    writePngChunk("IHDR", createIhdr(width, height, 2)),
    writePngChunk("IDAT", deflateSync(raw, { level: 9 })),
    writePngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createIhdr(width, height, colorType) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = colorType;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function writePngChunk(type, data) {
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

function paethPredictor(left, up, upLeft) {
  const predictor = left + up - upLeft;
  const pa = Math.abs(predictor - left);
  const pb = Math.abs(predictor - up);
  const pc = Math.abs(predictor - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function hasTransparentRgbaPixels(rgba) {
  for (let index = 3; index < rgba.length; index += 4) {
    if (rgba[index] < 255) return true;
  }
  return false;
}

function findVisibleContentBox(rgba, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return { x: 0, y: 0, width, height };
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function samplePremultipliedRgba(rgba, width, height, x, y) {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const samples = [
    { x: x0, y: y0, weight: (1 - tx) * (1 - ty) },
    { x: x1, y: y0, weight: tx * (1 - ty) },
    { x: x0, y: y1, weight: (1 - tx) * ty },
    { x: x1, y: y1, weight: tx * ty },
  ];
  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const sample of samples) {
    const index = (sample.y * width + sample.x) * 4;
    const sampleAlpha = (rgba[index + 3] / 255) * sample.weight;
    alpha += sampleAlpha;
    red += rgba[index] * sampleAlpha;
    green += rgba[index + 1] * sampleAlpha;
    blue += rgba[index + 2] * sampleAlpha;
  }

  if (alpha <= 0) return { r: 255, g: 255, b: 255, a: 0 };
  return {
    r: clampByte(Math.round(red / alpha)),
    g: clampByte(Math.round(green / alpha)),
    b: clampByte(Math.round(blue / alpha)),
    a: clampByte(Math.round(alpha * 255)),
  };
}

function buildPngMetadata(decoded) {
  return {
    width: decoded.width,
    height: decoded.height,
    format: "png",
    colorType: decoded.colorType,
    bitDepth: decoded.bitDepth,
    transparent: decoded.hasTransparency,
    hasAlphaChannel: decoded.hasAlphaChannel,
  };
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Number.isFinite(value) ? value : 0));
}
