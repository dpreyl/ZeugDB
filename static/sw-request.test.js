import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from './sw-request.js';

describe('service worker request scope', () => {
  it('handles requests from its own origin', () => {
    expect(isSameOriginRequest(
      'https://dpreyl.github.io/ZeugDB/_app/entry.js',
      'https://dpreyl.github.io'
    )).toBe(true);
  });

  it('does not handle requests to a separately hosted Git server', () => {
    expect(isSameOriginRequest(
      'http://localhost:8929/admin/ZeugDB/info/refs?service=git-upload-pack',
      'https://dpreyl.github.io'
    )).toBe(false);
  });

  it('does not handle malformed request URLs', () => {
    expect(isSameOriginRequest('http://[invalid', 'https://dpreyl.github.io')).toBe(false);
  });
});
