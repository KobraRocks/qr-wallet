import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/** One decoded 8-bit RGBA raster, rows top to bottom. */
interface RgbaImage {
  readonly width: number;
  readonly height: number;
  /** `width * height * 4` bytes, red/green/blue/alpha per pixel. */
  readonly data: Uint8Array;
}

/** The four install icons: the three manifest sizes plus the iOS touch icon. */
const ICONS = [
  { file: 'icon-192.png', size: 192, purpose: 'any' },
  { file: 'icon-512.png', size: 512, purpose: 'any' },
  { file: 'icon-maskable-512.png', size: 512, purpose: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, purpose: 'apple-touch' },
] as const;

/** The manifest's theme and background colour, and the ground of the flattened icons. */
const ICON_BACKGROUND = [7, 7, 9] as const;

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function byteAt(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined) {
    throw new Error(`Unexpected end of PNG data at byte ${index}.`);
  }
  return value;
}

function paeth(left: number, up: number, upLeft: number): number {
  const prediction = left + up - upLeft;
  const toLeft = Math.abs(prediction - left);
  const toUp = Math.abs(prediction - up);
  const toUpLeft = Math.abs(prediction - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left;
  }
  return toUp <= toUpLeft ? up : upLeft;
}

/**
 * Decodes the checked-in icons without ImageMagick: this test only reads the
 * committed artifact, so it runs anywhere the test suite runs.
 *
 * It understands what the generator writes (8-bit RGBA, non-interlaced) and all
 * five PNG scanline filters, so a different ImageMagick version can re-encode
 * the same pixels and still pass.
 */
function decodePng(png: Uint8Array): RgbaImage {
  expect([...png.subarray(0, 8)]).toEqual([...PNG_SIGNATURE]);

  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (offset < png.length) {
    const view = new DataView(png.buffer, png.byteOffset + offset, 8);
    const length = view.getUint32(0);
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      const header = new DataView(data.buffer, data.byteOffset, data.length);
      width = header.getUint32(0);
      height = header.getUint32(4);
      expect(byteAt(data, 8)).toBe(8); // bit depth
      expect(byteAt(data, 9)).toBe(6); // colour type: truecolour with alpha
      expect(byteAt(data, 12)).toBe(0); // interlace: none
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += 12 + length;
  }

  const compressed = new Uint8Array(idat.reduce((total, part) => total + part.length, 0));
  let compressedOffset = 0;
  for (const part of idat) {
    compressed.set(part, compressedOffset);
    compressedOffset += part.length;
  }
  const raw = inflateSync(compressed);

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const pixels = new Uint8Array(height * stride);
  let rawOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = byteAt(raw, rawOffset);
    rawOffset += 1;
    const rowStart = row * stride;
    const previousStart = rowStart - stride;
    for (let column = 0; column < stride; column += 1) {
      const value = byteAt(raw, rawOffset);
      rawOffset += 1;
      const left = column >= bytesPerPixel ? byteAt(pixels, rowStart + column - bytesPerPixel) : 0;
      const up = row > 0 ? byteAt(pixels, previousStart + column) : 0;
      const upLeft =
        row > 0 && column >= bytesPerPixel
          ? byteAt(pixels, previousStart + column - bytesPerPixel)
          : 0;
      let reconstructed: number;
      switch (filter) {
        case 0:
          reconstructed = value;
          break;
        case 1:
          reconstructed = value + left;
          break;
        case 2:
          reconstructed = value + up;
          break;
        case 3:
          reconstructed = value + ((left + up) >> 1);
          break;
        case 4:
          reconstructed = value + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`Unsupported PNG filter type ${filter}.`);
      }
      pixels[rowStart + column] = reconstructed & 0xff;
    }
  }

  return { width, height, data: pixels };
}

function readIcon(file: string): RgbaImage {
  return decodePng(readFileSync(fileURLToPath(new URL(`../public/icons/${file}`, import.meta.url))));
}

function pixelAt(image: RgbaImage, x: number, y: number): readonly [number, number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [
    byteAt(image.data, offset),
    byteAt(image.data, offset + 1),
    byteAt(image.data, offset + 2),
    byteAt(image.data, offset + 3),
  ];
}

function transparentPixelCount(image: RgbaImage): number {
  let count = 0;
  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] !== 255) {
      count += 1;
    }
  }
  return count;
}

/** Smallest x/y box of pixels that differ from the #070709 ground. */
function artworkBounds(image: RgbaImage): {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
} {
  const bounds = { minX: image.width, maxX: -1, minY: image.height, maxY: -1 };
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const [red, green, blue] = pixelAt(image, x, y);
      const isGround =
        red === ICON_BACKGROUND[0] && green === ICON_BACKGROUND[1] && blue === ICON_BACKGROUND[2];
      if (!isGround) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
    }
  }
  return bounds;
}

describe('checked-in app icons', () => {
  for (const icon of ICONS) {
    it(`commits ${icon.file} as a ${icon.size}x${icon.size} RGBA PNG`, () => {
      const image = readIcon(icon.file);

      expect({ width: image.width, height: image.height }).toEqual({
        width: icon.size,
        height: icon.size,
      });
      expect(image.data.length).toBe(icon.size * icon.size * 4);
    });
  }

  it('keeps the rounded corners transparent on the any icons', () => {
    for (const icon of ICONS.filter((candidate) => candidate.purpose === 'any')) {
      const image = readIcon(icon.file);
      const last = icon.size - 1;

      for (const [x, y] of [
        [0, 0],
        [last, 0],
        [0, last],
        [last, last],
      ] as const) {
        expect(pixelAt(image, x, y)[3]).toBe(0);
      }
      expect(pixelAt(image, icon.size / 2, icon.size / 2)[3]).toBe(255);
    }
  });

  it('flattens the apple-touch icon onto an opaque #070709 ground', () => {
    const image = readIcon('apple-touch-icon.png');
    const last = 180 - 1;

    // Chrome's apple-touch-icon guidance requires a non-transparent background.
    expect(transparentPixelCount(image)).toBe(0);
    for (const [x, y] of [
      [0, 0],
      [last, 0],
      [0, last],
      [last, last],
    ] as const) {
      expect([...pixelAt(image, x, y)]).toEqual([7, 7, 9, 255]);
    }
    expect([...pixelAt(image, 90, 90)]).not.toEqual([7, 7, 9, 255]);
  });

  it('flattens the maskable icon onto an opaque #070709 square', () => {
    const image = readIcon('icon-maskable-512.png');

    expect(transparentPixelCount(image)).toBe(0);
    for (const [x, y] of [
      [0, 0],
      [511, 0],
      [0, 511],
      [511, 511],
      [0, 256],
      [511, 256],
      [256, 0],
      [256, 511],
    ] as const) {
      expect([...pixelAt(image, x, y)]).toEqual([7, 7, 9, 255]);
    }
  });

  it('draws the maskable artwork at about 80% width, centred, inside the safe margin', () => {
    const image = readIcon('icon-maskable-512.png');
    const bounds = artworkBounds(image);
    const artworkWidth = bounds.maxX - bounds.minX + 1;
    const artworkHeight = bounds.maxY - bounds.minY + 1;

    // 80% of the canvas holds the artwork including its own transparent margin,
    // so the visible plaque lands a little under that once flattened.
    expect(artworkWidth).toBeGreaterThanOrEqual(512 * 0.6);
    expect(artworkWidth).toBeLessThanOrEqual(512 * 0.8);
    expect(artworkHeight).toBeGreaterThanOrEqual(512 * 0.6);
    expect(artworkHeight).toBeLessThanOrEqual(512 * 0.8);

    // Centred: each side's margin is within a few pixels of the opposite side.
    expect(Math.abs(bounds.minX - (512 - 1 - bounds.maxX))).toBeLessThanOrEqual(8);
    expect(Math.abs(bounds.minY - (512 - 1 - bounds.maxY))).toBeLessThanOrEqual(8);
    expect(bounds.minX).toBeGreaterThan(32);
    expect(bounds.maxX).toBeLessThan(512 - 32);
  });

  it('points index.html at the 192 and 180 PNGs it declares', () => {
    const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
    const touchIcon = /<link[^>]+rel="apple-touch-icon"[^>]*>/.exec(html)?.[0] ?? '';

    expect(touchIcon).toContain('href="%BASE_URL%icons/apple-touch-icon.png"');
    expect(touchIcon).toContain('sizes="180x180"');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('sizes="192x192" href="%BASE_URL%icons/icon-192.png"');
  });
});
