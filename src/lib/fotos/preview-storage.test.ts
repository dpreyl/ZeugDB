import { describe, expect, it } from 'vitest';
import { canDownloadPreviews } from './preview-storage';

describe('canDownloadPreviews', () => {
  it('allows previews only when quota can hold them plus a safety reserve', () => {
    expect(canDownloadPreviews(
      { usage: 10_000_000, quota: 100_000_000 },
      5_000_000
    )).toBe(true);
    expect(canDownloadPreviews(
      { usage: 10_000_000, quota: 25_000_000 },
      5_000_000
    )).toBe(false);
  });

  it('skips downloads when storage estimates are unavailable or invalid', () => {
    expect(canDownloadPreviews(null, 1)).toBe(false);
    expect(canDownloadPreviews({ usage: 100, quota: 50 }, 1)).toBe(false);
    expect(canDownloadPreviews({ usage: 10, quota: 100 }, -1)).toBe(false);
  });

  it('allows an empty download plan without requiring free space', () => {
    expect(canDownloadPreviews({ usage: 100, quota: 100 }, 0)).toBe(true);
  });
});
