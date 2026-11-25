import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
  readonly purpose?: string;
}

interface WebAppManifest {
  readonly name: string;
  readonly short_name: string;
  readonly start_url: string;
  readonly scope: string;
  readonly display: string;
  readonly orientation: string;
  readonly theme_color: string;
  readonly background_color: string;
  readonly icons: readonly ManifestIcon[];
}

function readManifest(): WebAppManifest {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL('../public/manifest.webmanifest', import.meta.url)), 'utf8'),
  ) as WebAppManifest;
}

/** Reads the width and height straight out of a PNG's IHDR chunk. */
function pngSize(relativePath: string): { width: number; height: number } {
  const png = readFileSync(fileURLToPath(new URL(`../public/${relativePath}`, import.meta.url)));
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('web app manifest', () => {
  it('declares the installable, relative, portrait app shell', () => {
    const manifest = readManifest();

    expect(manifest.name).toBe('QR Wallet');
    expect(manifest.short_name).toBe('QR Wallet');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('lists a 192, a 512, and a maskable 512 PNG icon that all exist at their declared size', () => {
    const manifest = readManifest();
    const regular = manifest.icons.filter((icon) => icon.purpose !== 'maskable');
    const maskable = manifest.icons.find((icon) => icon.purpose === 'maskable');

    expect(regular.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512']);
    expect(maskable?.sizes).toBe('512x512');

    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      const declared = icon.sizes.split('x').map(Number);
      expect(pngSize(icon.src.replace(/^\.\//, ''))).toEqual({
        width: declared[0],
        height: declared[1],
      });
    }
  });
});
