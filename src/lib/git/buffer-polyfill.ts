import { Buffer } from 'buffer';

type BufferGlobal = { Buffer?: typeof Buffer };

/**
 * isomorphic-git uses the Node Buffer API in its browser transport.
 * Browsers do not expose that global, so install the browser-compatible package.
 */
export function installBufferPolyfill(target: BufferGlobal = globalThis): void {
  target.Buffer ??= Buffer;
}
