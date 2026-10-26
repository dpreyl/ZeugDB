import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FotoStore, getFotoStore, resetFotoStore } from './fotos.store.svelte';
import type { RepoFs } from '../fs/repo-fs';
import { createMockFs } from '../fs/repo-fs';

describe('FotoStore', () => {
  beforeEach(() => {
    resetFotoStore();
  });

  it('initialisiert mit null und initialisiert lazily', () => {
    const store = getFotoStore();
    expect(store).toBeDefined();
  });

  it('lädt Fotos über init() mit einem RepoFs', async () => {
    const mockFs = createMockFs();
    const store = getFotoStore();
    await store.init(mockFs);
    // Nach init sollte der Store betriebsbereit sein
    expect(store.fehle).toBe(false);
  });

  it('uploadFoto speichert Bild und gibt URL zurück', async () => {
    const mockFs = createMockFs();
    const store = getFotoStore();
    await store.init(mockFs);
    const img = new Uint8Array([1, 2, 3]);
    const url = await store.uploadFoto('test-id', img, 'image/png');
    expect(url).toMatch(/^fotos\/test-id\/photo-0\.png$/);
  });

  it('listFotos gibt Liste zurück', async () => {
    const mockFs = createMockFs();
    const store = getFotoStore();
    await store.init(mockFs);
    await store.uploadFoto('a', new Uint8Array([1]), 'image/png');
    await store.uploadFoto('a', new Uint8Array([2]), 'image/jpeg');
    const liste = await store.listFotos('a');
    expect(liste).toHaveLength(2);
  });
});
