import { describe, expect, it } from 'vitest';
import { isShareCancellation } from './card-actions';

describe('isShareCancellation', () => {
  it('treats an AbortError as the owner dismissing the share sheet', () => {
    expect(isShareCancellation(new DOMException('Share cancelled', 'AbortError'))).toBe(true);
    expect(isShareCancellation({ name: 'AbortError' })).toBe(true);
  });

  it('treats every other rejection as a hard failure that owes the owner a download', () => {
    expect(isShareCancellation(new Error('share failed'))).toBe(false);
    expect(isShareCancellation(new DOMException('Denied', 'NotAllowedError'))).toBe(false);
    expect(isShareCancellation(null)).toBe(false);
    expect(isShareCancellation(undefined)).toBe(false);
    expect(isShareCancellation('AbortError')).toBe(false);
    expect(isShareCancellation({})).toBe(false);
  });
});
