/**
 * Regenerates the checked-in app icons from the canonical artwork.
 *
 * The artwork is `docs/design/images/QR-Wallet-Icon-transparent.png`: an
 * obsidian-and-champagne plaque whose rounded corners are transparent. This
 * script uses ImageMagick to write the four install sizes into `public/icons/`:
 * the manifest's 192 and 512 `any` icons, its 512 maskable icon, and the iOS
 * 180 apple-touch icon.
 *
 * The `any` icons keep the artwork's alpha — its rounded corners are the design.
 * The apple-touch icon is flattened onto the manifest's `#070709` ground, because
 * Chrome's apple-touch-icon guidance requires a non-transparent background and
 * iOS is the one platform that cannot be corrected at runtime. The maskable icon
 * is flattened onto the same ground with the artwork at 80% of the canvas, so the
 * gold hairline border survives Android's safe-zone mask.
 *
 * ImageMagick is a development tool, not a dependency: the PNGs are checked in
 * and the test suite reads them directly, so neither the build nor the tests
 * need `magick`. Same ImageMagick version => identical bytes, so running
 * `npm run icons` again leaves the working tree clean.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTWORK = fileURLToPath(
  new URL('../docs/design/images/QR-Wallet-Icon-transparent.png', import.meta.url),
);
const ICONS_DIRECTORY = fileURLToPath(new URL('../public/icons/', import.meta.url));

/** The manifest's `theme_color` and `background_color`, and the maskable ground. */
const GROUND = '#070709';

/** How much of the maskable canvas the artwork including its margin fills. */
const MASKABLE_ARTWORK_FRACTION = 0.8;

const ICONS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180, ground: true },
  {
    file: 'icon-maskable-512.png',
    size: 512,
    ground: true,
    artworkFraction: MASKABLE_ARTWORK_FRACTION,
  },
];

if (!existsSync(ARTWORK)) {
  console.error(`The icon artwork is missing: ${ARTWORK}`);
  process.exit(1);
}

const magick = spawnSync('magick', ['-version'], { encoding: 'utf8' });
if (magick.error !== undefined || magick.status !== 0) {
  console.error(
    'ImageMagick is required to regenerate the icons but `magick` could not be run.\n' +
      'Install it (for example `sudo pacman -S imagemagick`) and run `npm run icons` again.\n' +
      'The checked-in PNGs are the shipped artifact; this script is a development tool.',
  );
  process.exit(1);
}

mkdirSync(ICONS_DIRECTORY, { recursive: true });

/** The ImageMagick arguments that write one icon. */
function iconArguments(icon) {
  const output = join(ICONS_DIRECTORY, icon.file);
  if (icon.ground !== true) {
    return [ARTWORK, '-resize', `${icon.size}x${icon.size}`, '-strip', `PNG32:${output}`];
  }
  const artworkSize = Math.round(icon.size * (icon.artworkFraction ?? 1));
  return [
    ARTWORK,
    '-resize',
    `${artworkSize}x${artworkSize}`,
    '-background',
    GROUND,
    '-gravity',
    'center',
    '-extent',
    `${icon.size}x${icon.size}`,
    '-flatten',
    '-strip',
    `PNG32:${output}`,
  ];
}

for (const icon of ICONS) {
  const args = iconArguments(icon);
  const result = spawnSync('magick', args, { encoding: 'utf8' });
  if (result.error !== undefined || result.status !== 0) {
    console.error(`Failed to write ${icon.file}: ${result.stderr || result.error}`);
    process.exit(1);
  }
  const bytes = statSync(join(ICONS_DIRECTORY, icon.file)).size;
  console.log(`${icon.file}  ${icon.size}x${icon.size}  ${bytes} bytes`);
}
