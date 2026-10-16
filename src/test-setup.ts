import { vi } from 'vitest';

// Mock browser APIs für jsdom-Umgebung
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Crypto API Mock (wird in jsdom nicht vollständig unterstützt)
if (!globalThis.crypto) {
  vi.stubGlobal('crypto', {
    getRandomValues: (buf: Uint8Array) => crypto.getRandomValues(buf)
  });
}
