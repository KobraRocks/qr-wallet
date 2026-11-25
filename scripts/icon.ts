import type { RgbaImage } from './png.ts';

/** A single RGBA colour: red, green, blue, alpha. */
export type RgbaColour = readonly [number, number, number, number];

/** The app icon background, matching the manifest's `background_color`. */
export const ICON_BACKGROUND: RgbaColour = [24, 24, 27, 255];

/** The QR glyph colour, matching the shell's light foreground. */
export const ICON_FOREGROUND: RgbaColour = [250, 250, 250, 255];

/** Standard icons keep a normal margin; maskable icons must survive an aggressive mask. */
export type IconVariant = 'standard' | 'maskable';

/** One icon the checked-in generator writes. */
export interface IconSpec {
  readonly file: string;
  readonly size: number;
  readonly variant: IconVariant;
}

/** The three manifest icons plus the iOS home-screen touch icon. */
export const ICON_SPECS: readonly IconSpec[] = [
  { file: 'icon-192.png', size: 192, variant: 'standard' },
  { file: 'icon-512.png', size: 512, variant: 'standard' },
  { file: 'icon-maskable-512.png', size: 512, variant: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, variant: 'standard' },
];

/** A 21-module QR-like glyph, so the icon reads as a scannable code. */
const MODULES = 21;

/** The three 7x7 finder squares of a QR code, at the top-left, top-right, and bottom-left. */
const FINDERS = [
  [0, 0],
  [0, MODULES - 7],
  [MODULES - 7, 0],
] as const;

/**
 * How much of the icon the glyph may occupy. Maskable icons need the glyph
 * inside the safe zone (a circle of 80% diameter, so at most ~56% of the width
 * for a square glyph); 54% leaves a small margin inside that.
 */
const CONTENT_FRACTION: Record<IconVariant, number> = {
  standard: 0.72,
  maskable: 0.54,
};

/** Whether a module belongs to a finder square (true dark, false light). */
function finderModule(row: number, col: number): boolean | undefined {
  for (const [top, left] of FINDERS) {
    const localRow = row - top;
    const localCol = col - left;
    if (localRow < 0 || localRow >= 7 || localCol < 0 || localCol >= 7) {
      continue;
    }
    const ring =
      localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6;
    const centre = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4;
    return ring || centre;
  }
  return undefined;
}

/** Deterministic fake data modules; a rebuild always produces the same pixels. */
function dataModule(row: number, col: number): boolean {
  let hash = Math.imul(row + 1, 0x9e3779b1) ^ Math.imul(col + 1, 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) % 5 < 2;
}

function moduleIsDark(row: number, col: number): boolean {
  return finderModule(row, col) ?? dataModule(row, col);
}

function paintSquare(
  image: RgbaImage,
  x: number,
  y: number,
  size: number,
  colour: RgbaColour,
): void {
  for (let row = y; row < y + size; row += 1) {
    for (let col = x; col < x + size; col += 1) {
      const offset = (row * image.width + col) * 4;
      image.data[offset] = colour[0];
      image.data[offset + 1] = colour[1];
      image.data[offset + 2] = colour[2];
      image.data[offset + 3] = colour[3];
    }
  }
}

/**
 * Renders one square icon: an opaque background with a centred QR-like glyph.
 *
 * Pure and deterministic, so `npm run icons` rewrites the checked-in PNGs to
 * identical bytes and a test can guard against stale icons.
 */
export function renderIcon(size: number, variant: IconVariant): RgbaImage {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`Icon size must be a positive integer, received ${String(size)}.`);
  }
  const scale = Math.floor((size * CONTENT_FRACTION[variant]) / MODULES);
  if (scale < 1) {
    throw new Error(`Icon size ${size} is too small to draw a ${MODULES}-module glyph.`);
  }
  const glyphSize = scale * MODULES;
  const offset = Math.floor((size - glyphSize) / 2);

  const data = new Uint8Array(size * size * 4);
  const image: RgbaImage = { width: size, height: size, data };
  paintSquare(image, 0, 0, size, ICON_BACKGROUND);

  for (let row = 0; row < MODULES; row += 1) {
    for (let col = 0; col < MODULES; col += 1) {
      if (moduleIsDark(row, col)) {
        paintSquare(
          image,
          offset + col * scale,
          offset + row * scale,
          scale,
          ICON_FOREGROUND,
        );
      }
    }
  }
  return image;
}
