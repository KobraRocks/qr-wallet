/**
 * Measures the shipped JavaScript and CSS against the 30 KB gzipped budget.
 *
 * Run `npm run build` first, then `npm run check:budget`. The service worker is
 * reported separately: it is shipped, but it is not part of the app bundle.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 30 * 1024;
const assetsDirectory = join(process.cwd(), 'dist', 'assets');

const bundleFiles = readdirSync(assetsDirectory)
  .filter((file) => file.endsWith('.js') || file.endsWith('.css'))
  .sort();

if (bundleFiles.length === 0) {
  throw new Error(`No JavaScript or CSS found in ${assetsDirectory}; run \`npm run build\` first.`);
}

let totalGzip = 0;
for (const file of bundleFiles) {
  const contents = readFileSync(join(assetsDirectory, file));
  const gzipped = gzipSync(contents).length;
  totalGzip += gzipped;
  console.log(`${file}  ${contents.length} B  ${gzipped} B gzip`);
}

const requestMeetsBudget = totalGzip <= BUDGET_BYTES;
console.log(
  `total JS+CSS  ${totalGzip} B gzip (${(totalGzip / 1024).toFixed(2)} KB) of ${BUDGET_BYTES} B budget`,
);

if (!requestMeetsBudget) {
  console.error(`Over the ${(BUDGET_BYTES / 1024).toFixed(0)} KB gzipped budget.`);
  process.exitCode = 1;
}
