import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, type Dirent } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/** One emitted output file whose content participates in the build hash. */
export interface BuildEntry {
  /** Path of the file relative to the build output root, using forward slashes. */
  readonly path: string;
  readonly contents: string | Uint8Array;
}

/** Length of the content-derived build hash, in hex characters. */
export const BUILD_HASH_LENGTH = 12;

/**
 * Derives the build hash from the content of every output file. It is stable
 * for identical builds and changes whenever any shipped byte changes, so the
 * service worker's cache name changes with the build.
 */
export function deriveBuildHash(entries: readonly BuildEntry[]): string {
  const hash = createHash('sha256');
  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(entry.path);
    hash.update('\u0000');
    hash.update(entry.contents);
    hash.update('\u0000');
  }
  return hash.digest('hex').slice(0, BUILD_HASH_LENGTH);
}

/** Everything the precache manifest is derived from. */
export interface PrecacheSources {
  /** Emitted bundle files, relative to the output root. */
  readonly bundleFiles: readonly string[];
  /** Files copied verbatim from the public directory, relative to the output root. */
  readonly publicFiles: readonly string[];
  /** The emitted service-worker file, which must never precache itself. */
  readonly serviceWorkerFile: string;
}

/** The shell document, always precached so offline navigations can fall back to it. */
export const SHELL_DOCUMENT = 'index.html';

/**
 * Builds the precache manifest the service worker installs. Paths are relative
 * (`./`) so the worker — which lives at the deployment root and therefore under
 * any subpath — resolves them against its own URL.
 */
export function collectPrecacheUrls(sources: PrecacheSources): string[] {
  const files = new Set<string>([SHELL_DOCUMENT]);
  for (const file of [...sources.bundleFiles, ...sources.publicFiles]) {
    if (file === '' || file === sources.serviceWorkerFile || file.endsWith('.map')) {
      continue;
    }
    // Public paths are normalised to forward slashes by the plugin; normalise
    // again here so Windows checkouts cannot leak backslashes into the manifest.
    files.add(file.replaceAll('\\', '/'));
  }
  return [...files].sort().map((file) => `./${file}`);
}

/** Placeholder the template must carry where the content-derived hash is injected. */
export const BUILD_HASH_PLACEHOLDER = '__BUILD_HASH__';

/** Placeholder the template must carry where the precache manifest is injected. */
export const PRECACHE_PLACEHOLDER = '__PRECACHE_URLS__';

/** The values the build plugin injects into the service worker template. */
export interface ServiceWorkerInjection {
  /** Content-derived hash that becomes the cache name, e.g. `abc123def456`. */
  readonly buildHash: string;
  /** Paths cached during install, relative to the worker (`./...`). */
  readonly precacheUrls: readonly string[];
}

/**
 * Fills the service worker template with the build hash and precache manifest.
 *
 * A missing placeholder, an empty manifest, or a malformed hash throws, which
 * fails the Vite build: shipping a worker that cannot cache the shell or whose
 * cache name is not tied to the build would break the offline guarantee.
 */
export function injectServiceWorker(
  template: string,
  injection: ServiceWorkerInjection,
): string {
  const { buildHash, precacheUrls } = injection;

  if (!template.includes(BUILD_HASH_PLACEHOLDER)) {
    throw new Error(
      `Service worker template is missing the ${BUILD_HASH_PLACEHOLDER} injection placeholder.`,
    );
  }
  if (!template.includes(PRECACHE_PLACEHOLDER)) {
    throw new Error(
      `Service worker template is missing the ${PRECACHE_PLACEHOLDER} injection placeholder.`,
    );
  }
  if (!/^[0-9a-f]{8,64}$/.test(buildHash)) {
    throw new Error(`Refusing to inject a malformed build hash: ${JSON.stringify(buildHash)}.`);
  }
  if (precacheUrls.length === 0) {
    throw new Error('Refusing to build a service worker with an empty precache manifest.');
  }

  const source = template
    .replaceAll(BUILD_HASH_PLACEHOLDER, JSON.stringify(buildHash))
    .replaceAll(PRECACHE_PLACEHOLDER, JSON.stringify(precacheUrls));

  if (source.includes(BUILD_HASH_PLACEHOLDER) || source.includes(PRECACHE_PLACEHOLDER)) {
    throw new Error('Service worker injection left an unresolved placeholder in the output.');
  }
  return source;
}

/** One file copied verbatim from the public directory into the build output. */
export interface PublicFile {
  /** Path relative to the output root, using forward slashes. */
  readonly path: string;
  readonly contents: Uint8Array;
}

function readDirectory(directory: string, prefix: string, files: PublicFile[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      readDirectory(join(directory, entry.name), path, files);
    } else if (entry.isFile()) {
      files.push({ path, contents: readFileSync(join(directory, entry.name)) });
    }
  }
}

/** Enumerates the public directory recursively, in a stable order. */
export function collectPublicFiles(publicDir: string): PublicFile[] {
  const files: PublicFile[] = [];
  if (publicDir !== '') {
    readDirectory(publicDir, '', files);
  }
  return files;
}

/** The subset of a Rollup output chunk or asset the plugin reads. */
interface BundleOutput {
  readonly type: 'chunk' | 'asset';
  readonly code?: string;
  readonly source?: string | Uint8Array;
}

function outputContents(output: BundleOutput): string | Uint8Array {
  return output.type === 'chunk' ? (output.code ?? '') : (output.source ?? '');
}

/** Template the build reads the service worker source from, relative to the root. */
export const DEFAULT_TEMPLATE_PATH = 'src/sw/service-worker.js';

/** Where the built service worker is written, relative to the output directory. */
export const DEFAULT_SERVICE_WORKER_FILE = 'sw.js';

export interface ServiceWorkerPluginOptions {
  /** Service worker source template, relative to the Vite root. */
  readonly templatePath?: string;
  /** Output file name, relative to the build output directory. */
  readonly fileName?: string;
}

/**
 * Vite build plugin that injects the precache manifest and content-derived
 * build hash into the hand-written service worker.
 *
 * It runs when the bundle is written, so the hashed asset names are final. If
 * the template is missing a placeholder, a malformed hash or empty manifest is
 * passed, or the output file cannot be written, the hook throws and the whole
 * build fails — an injected worker is the offline guarantee, not an option.
 */
export function serviceWorkerPlugin(options: ServiceWorkerPluginOptions = {}): Plugin {
  const templatePath = options.templatePath ?? DEFAULT_TEMPLATE_PATH;
  const fileName = options.fileName ?? DEFAULT_SERVICE_WORKER_FILE;
  let config: ResolvedConfig | undefined;

  return {
    name: 'qr-wallet-service-worker',
    apply: 'build',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    writeBundle(_outputOptions, bundle) {
      if (config === undefined) {
        throw new Error('The service worker plugin ran before Vite resolved its config.');
      }
      const publicFiles = collectPublicFiles(config.publicDir);
      const bundleFiles = Object.entries(bundle)
        .filter(([name]) => name !== fileName)
        .map(([name, output]) => ({ path: name, contents: outputContents(output) }));

      const buildHash = deriveBuildHash([...bundleFiles, ...publicFiles]);
      const precacheUrls = collectPrecacheUrls({
        bundleFiles: bundleFiles.map((file) => file.path),
        publicFiles: publicFiles.map((file) => file.path),
        serviceWorkerFile: fileName,
      });
      const template = readFileSync(resolve(config.root, templatePath), 'utf8');
      const source = injectServiceWorker(template, { buildHash, precacheUrls });
      writeFileSync(join(resolve(config.root, config.build.outDir), fileName), source);
    },
  };
}
