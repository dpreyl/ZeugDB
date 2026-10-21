import { describe, expect, it } from 'vitest';
import { Buffer as BrowserBuffer } from 'buffer';
import { installBufferPolyfill } from './buffer-polyfill';

describe('installBufferPolyfill', () => {
  it('provides Buffer when the browser global is missing', () => {
    const browserGlobal: { Buffer?: typeof Buffer } = {};

    installBufferPolyfill(browserGlobal);

    expect(browserGlobal.Buffer).toBe(BrowserBuffer);
  });

  it('preserves an existing Buffer implementation', () => {
    const existingBuffer = class ExistingBuffer {};
    const browserGlobal: { Buffer?: typeof Buffer } = {
      Buffer: existingBuffer as unknown as typeof Buffer
    };

    installBufferPolyfill(browserGlobal);

    expect(browserGlobal.Buffer).toBe(existingBuffer);
  });
});
