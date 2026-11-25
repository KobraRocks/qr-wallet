import { describe, expect, it } from 'vitest';
import { scheduleObjectUrlRevoke } from './download';

describe('scheduleObjectUrlRevoke', () => {
  it('defers the revoke to a later task so the download can start', async () => {
    const revoked: string[] = [];

    scheduleObjectUrlRevoke('blob:qr-wallet', (url) => {
      revoked.push(url);
    });

    // Revoking synchronously after link.click() can cancel the download in
    // Firefox and Safari, so the object URL must outlive the click's task.
    expect(revoked).toEqual([]);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(revoked).toEqual(['blob:qr-wallet']);
  });
});
