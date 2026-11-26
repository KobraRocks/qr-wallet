/**
 * Measures the shipped artifact against two budgets.
 *
 * 1. JavaScript + CSS, gzipped, stay under 30 KB.
 * 2. JavaScript + CSS + vendored fonts, with fonts counted raw (woff2 is
 *    already Brotli-compressed, so gzipping them saves nothing), stay under
 *    64 KB. Fonts are reported separately so a growing font cannot hide inside
 *    the larger ceiling.
 *
 * Run `npm run build` first, then `npm run check:budget`. The service worker is
 * reported separately: it is shipped, but it is not part of the app bundle.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const CODE_BUDGET_BYTES = 30 * 1024;
const SHELL_BUDGET_BYTES = 64 * 1024;

const assetsDirectory = join(process.cwd(), 'dist', 'assets');

const assetFiles = readdirSync(assetsDirectory).sort();
const codeFiles = assetFiles.filter((file) => file.endsWith('.js') || file.endsWith('.css'));
const fontFiles = assetFiles.filter((file) => file.endsWith('.woff2'));

if (codeFiles.length === 0) {
  throw new Error(`No JavaScript or CSS found in ${assetsDirectory}; run \`npm run build\` first.`);
}

let codeGzip = 0;
for (const file of codeFiles) {
  const contents = readFileSync(join(assetsDirectory, file));
  const gzipped = gzipSync(contents).length;
  codeGzip += gzipped;
  console.log(`${file}  ${contents.length} B  ${gzipped} B gzip`);
}

let fontBytes = 0;
for (const file of fontFiles) {
  const contents = readFileSync(join(assetsDirectory, file));
  fontBytes += contents.length;
  console.log(`${file}  ${contents.length} B  (not gzipped)`);
}

const shellBytes = codeGzip + fontBytes;
console.log(
  `JS+CSS  ${codeGzip} B gzip (${(codeGzip / 1024).toFixed(2)} KB) of ${CODE_BUDGET_BYTES} B budget`,
);
console.log(
  `JS+CSS+fonts  ${shellBytes} B (${(shellBytes / 1024).toFixed(2)} KB) of ${SHELL_BUDGET_BYTES} B budget`,
);

let failed = false;
if (codeGzip > CODE_BUDGET_BYTES) {
  console.error(
    `JavaScript and CSS are ${codeGzip - CODE_BUDGET_BYTES} B over the ${CODE_BUDGET_BYTES / 1024} KB gzipped budget.`,
  );
  failed = true;
}
if (shellBytes > SHELL_BUDGET_BYTES) {
  console.error(
    `The shell is ${shellBytes - SHELL_BUDGET_BYTES} B over the ${SHELL_BUDGET_BYTES / 1024} KB combined budget.`,
  );
  failed = true;
}

if (failed) {
  process.exitCode = 1;
}
