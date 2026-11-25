/**
 * Writes the checked-in app icons into `public/icons/`.
 *
 * Run with `npm run icons` after changing `scripts/icon.ts`. The script uses a
 * hand-rolled PNG encoder over `node:zlib`, so no rasterizer is added to the
 * project. Its deterministic output is guarded by `scripts/icon.test.ts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_SPECS, renderIcon } from './icon.ts';
import { encodePng } from './png.ts';

const iconsDirectory = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(iconsDirectory, { recursive: true });

for (const spec of ICON_SPECS) {
  const png = encodePng(renderIcon(spec.size, spec.variant));
  writeFileSync(join(iconsDirectory, spec.file), png);
  console.log(`${spec.file}  ${spec.size}x${spec.size}  ${png.length} bytes`);
}
