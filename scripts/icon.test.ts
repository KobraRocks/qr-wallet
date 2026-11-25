import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ICON_BACKGROUND, ICON_FOREGROUND, ICON_SPECS, renderIcon, type RgbaColour } from './icon';
import { encodePng } from './png';
import type { RgbaImage } from './png';

interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function isColour(image: RgbaImage, x: number, y: number, colour: RgbaColour): boolean {
  const offset = (y * image.width + x) * 4;
  return (
    image.data[offset] === colour[0] &&
    image.data[offset + 1] === colour[1] &&
    image.data[offset + 2] === colour[2] &&
    image.data[offset + 3] === colour[3]
  );
}

function foregroundBounds(image: RgbaImage): Bounds {
  const bounds = {
    minX: image.width,
    maxX: -1,
    minY: image.height,
    maxY: -1,
  };
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (isColour(image, x, y, ICON_FOREGROUND)) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
    }
  }
  return bounds;
}

describe('renderIcon', () => {
  it('fills the requested square with an opaque background', () => {
    const image = renderIcon(192, 'standard');

    expect(image.width).toBe(192);
    expect(image.height).toBe(192);
    expect(image.data.length).toBe(192 * 192 * 4);
    for (let offset = 3; offset < image.data.length; offset += 4) {
      expect(image.data[offset]).toBe(255);
    }
    expect(isColour(image, 0, 0, ICON_BACKGROUND)).toBe(true);
    expect(isColour(image, 191, 191, ICON_BACKGROUND)).toBe(true);
  });

  it('draws a centred foreground glyph away from the edges', () => {
    const image = renderIcon(192, 'standard');
    const bounds = foregroundBounds(image);

    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.minX).toBe(192 - 1 - bounds.maxX);
    expect(bounds.minY).toBe(192 - 1 - bounds.maxY);
    expect(bounds.minX).toBeGreaterThan(0);
    expect(bounds.maxX).toBeLessThan(191);
  });

  it('keeps maskable content inside the central safe zone', () => {
    const image = renderIcon(512, 'maskable');
    const bounds = foregroundBounds(image);
    const safeMargin = 512 * 0.15;

    expect(bounds.minX).toBeGreaterThanOrEqual(safeMargin);
    expect(bounds.minY).toBeGreaterThanOrEqual(safeMargin);
    expect(bounds.maxX).toBeLessThanOrEqual(512 - 1 - safeMargin);
    expect(bounds.maxY).toBeLessThanOrEqual(512 - 1 - safeMargin);
  });

  it('draws the maskable glyph smaller than the standard one so a mask cannot clip it', () => {
    const standard = foregroundBounds(renderIcon(512, 'standard'));
    const maskable = foregroundBounds(renderIcon(512, 'maskable'));

    expect(maskable.maxX - maskable.minX).toBeLessThan(standard.maxX - standard.minX);
  });

  it('is deterministic so a rebuild never churns the checked-in PNGs', () => {
    expect(renderIcon(512, 'standard')).toEqual(renderIcon(512, 'standard'));
  });

  it('rejects sizes too small to draw a module', () => {
    expect(() => renderIcon(0, 'standard')).toThrow(/size/i);
    expect(() => renderIcon(10, 'standard')).toThrow(/size/i);
  });
});

describe('checked-in icons', () => {
  for (const spec of ICON_SPECS) {
    it(`commits ${spec.file} exactly as the generator renders it`, () => {
      const committed = readFileSync(
        fileURLToPath(new URL(`../public/icons/${spec.file}`, import.meta.url)),
      );
      const rendered = encodePng(renderIcon(spec.size, spec.variant));

      expect(new Uint8Array(committed)).toEqual(rendered);
    });
  }
});
