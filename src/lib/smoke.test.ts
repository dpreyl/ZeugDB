import { describe, it, expect } from 'vitest';

describe('Smoke Test', () => {
  it('vitest läuft', () => {
    expect(true).toBe(true);
  });

  it('Mathematik funktioniert', () => {
    expect(2 + 2).toBe(4);
  });
});
