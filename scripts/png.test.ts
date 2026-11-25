import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng, type RgbaImage } from './png';

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

interface PngChunk {
  readonly type: string;
  readonly data: Uint8Array;
}

/**
 * Independently decodes the PNG chunks: reads the length, type, data, and CRC
 * straight out of the bytes and checks the CRC with the platform implementation,
 * so a bug in the encoder's own chunk/CRC code cannot hide.
 */
function readChunks(png: Uint8Array): PngChunk[] {
  expect(png.slice(0, 8)).toEqual(SIGNATURE);
  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset < png.length) {
    const view = new DataView(png.buffer, png.byteOffset + offset, 4);
    const length = view.getUint32(0);
    const type = new TextDecoder().decode(png.slice(offset + 4, offset + 8));
    const data = png.slice(offset + 8, offset + 8 + length);
    const storedCrc = new DataView(png.buffer, png.byteOffset + offset + 8 + length, 4).getUint32(0);
    expect(crc32(png.slice(offset + 4, offset + 8 + length))).toBe(storedCrc);
    chunks.push({ type, data });
    offset += 12 + length;
  }
  expect(offset).toBe(png.length);
  return chunks;
}

function pixelAt(image: RgbaImage, x: number, y: number): number[] {
  const start = (y * image.width + x) * 4;
  return [...image.data.slice(start, start + 4)];
}

function solidImage(width: number, height: number, rgba: readonly number[]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data.set(rgba, index * 4);
  }
  return { width, height, data };
}

describe('encodePng', () => {
  it('writes a valid 8-bit RGBA PNG with an IHDR and an IEND', () => {
    const chunks = readChunks(encodePng(solidImage(2, 2, [24, 24, 27, 255])));

    expect(chunks.map((chunk) => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    const header = chunks[0]?.data;
    expect(header).toBeDefined();
    if (header === undefined) {
      return;
    }
    const view = new DataView(header.buffer, header.byteOffset, header.length);
    expect(view.getUint32(0)).toBe(2);
    expect(view.getUint32(4)).toBe(2);
    expect(header[8]).toBe(8); // bit depth
    expect(header[9]).toBe(6); // colour type: truecolour with alpha
    expect(header[10]).toBe(0); // deflate
    expect(header[11]).toBe(0); // adaptive filtering
    expect(header[12]).toBe(0); // no interlace
  });

  it('stores unfiltered RGBA rows so pixels decode back exactly', () => {
    const image: RgbaImage = {
      width: 2,
      height: 2,
      data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
    };

    const chunks = readChunks(encodePng(image));
    const idat = chunks.find((chunk) => chunk.type === 'IDAT');
    expect(idat).toBeDefined();
    if (idat === undefined) {
      return;
    }
    const raw = inflateSync(idat.data);
    expect(raw.length).toBe(image.height * (1 + image.width * 4));
    expect([...raw.slice(0, 9)]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(raw[9]).toBe(0); // second row filter byte
    expect([...raw.slice(10)]).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it('rejects an empty image instead of writing a corrupt PNG', () => {
    expect(() => encodePng({ width: 0, height: 2, data: new Uint8Array() })).toThrow(/width/i);
    expect(() =>
      encodePng({ width: 2, height: 0, data: new Uint8Array() }),
    ).toThrow(/height/i);
    expect(() =>
      encodePng({ width: 2, height: 2, data: new Uint8Array(3) }),
    ).toThrow(/data/i);
  });

  it('encodes the bottom row last so pixelAt round-trips through the file', () => {
    const image = solidImage(1, 1, [250, 250, 250, 255]);
    expect(pixelAt(image, 0, 0)).toEqual([250, 250, 250, 255]);
  });
});
