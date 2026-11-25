import { deflateSync } from 'node:zlib';

/** A plain 8-bit RGBA raster, rows top to bottom. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  /** `width * height * 4` bytes, red/green/blue/alpha per pixel. */
  readonly data: Uint8Array;
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** Standard CRC-32 table used by PNG chunks. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function writeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(concat([typeBytes, data])));
  return chunk;
}

/**
 * Encodes an RGBA raster as an 8-bit PNG using only `node:zlib`: no rasterizer
 * or image dependency is added for the three checked-in app icons.
 *
 * The output is a single IHDR, one unfiltered IDAT, and IEND. Malformed input
 * throws rather than writing a file the browser would reject.
 */
export function encodePng(image: RgbaImage): Uint8Array {
  const { width, height, data } = image;
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`PNG width must be a positive integer, received ${String(width)}.`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`PNG height must be a positive integer, received ${String(height)}.`);
  }
  if (data.length !== width * height * 4) {
    throw new Error(
      `PNG data must be width * height * 4 bytes; received ${data.length} for ${width}x${height}.`,
    );
  }

  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: truecolour with alpha
  header[10] = 0; // compression: deflate
  header[11] = 0; // filter method: adaptive
  header[12] = 0; // interlace: none

  // Every scanline starts with filter byte 0 (None); the raw RGBA bytes follow.
  const stride = width * 4;
  const raw = new Uint8Array(height * (1 + stride));
  for (let row = 0; row < height; row += 1) {
    const rawOffset = row * (1 + stride);
    raw[rawOffset] = 0;
    raw.set(data.subarray(row * stride, row * stride + stride), rawOffset + 1);
  }

  return concat([
    PNG_SIGNATURE,
    writeChunk('IHDR', header),
    writeChunk('IDAT', deflateSync(raw)),
    writeChunk('IEND', new Uint8Array()),
  ]);
}
