/** A file a download action writes: its filename and its exact contents. */
export interface DownloadFile {
  readonly filename: string;
  readonly contents: string;
}

/**
 * Releases a temporary object URL after the current task.
 *
 * Revoking synchronously after `link.click()` can cancel the download in
 * Firefox and Safari before the browser has read the Blob, so the URL is kept
 * alive for one tick and then released. The default release is
 * `URL.revokeObjectURL`; tests pass their own so the deferral is observable in
 * Node without a DOM.
 */
export function scheduleObjectUrlRevoke(
  url: string,
  revoke: (url: string) => void = (value) => {
    URL.revokeObjectURL(value);
  },
): void {
  setTimeout(() => {
    revoke(url);
  }, 0);
}

/**
 * Downloads a Blob under a filename through a temporary object URL and link.
 *
 * This is the app's only object-URL download path, so Share's SVG download, the
 * Backup export, and the corrupt-state copy all release their URL the same way.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  scheduleObjectUrlRevoke(url);
}

/** Downloads a text file with the given media type. */
export function downloadTextFile(file: DownloadFile, mediaType: string): void {
  downloadBlob(new Blob([file.contents], { type: mediaType }), file.filename);
}
