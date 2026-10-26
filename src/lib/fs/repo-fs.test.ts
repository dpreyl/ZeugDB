import { describe, it, expect, beforeEach } from 'vitest';
import { createMockFs } from './repo-fs';

describe('createMockFs', () => {
  let fs: ReturnType<typeof createMockFs>;

  beforeEach(() => {
    fs = createMockFs();
  });

  it('liest geschriebene Dateien', async () => {
    await fs.writeFile('assets/a1.asset', 'id: a1\ntype: projektor\nhersteller: Sony');
    const content = await fs.readFile('assets/a1.asset');
    expect(content).toBe('id: a1\ntype: projektor\nhersteller: Sony');
  });

  it('listet Verzeichnis-Inhalte', async () => {
    await fs.writeFile('assets/a1.asset', 'id: a1');
    await fs.writeFile('assets/a2.asset', 'id: a2');
    await fs.writeFile('types/projektor.type', 'name: Projektor');

    const assets = await fs.readdir('assets');
    expect(assets).toContain('a1.asset');
    expect(assets).toContain('a2.asset');

    const types = await fs.readdir('types');
    expect(types).toContain('projektor.type');
  });

  it('wirft bei nicht-existenter Datei', async () => {
    await expect(fs.readFile('missing.asset')).rejects.toThrow();
  });

  it('erkennt leeres Verzeichnis', async () => {
    const empty = await fs.readdir('leer');
    expect(empty).toEqual([]);
  });

  it('löscht Dateien', async () => {
    await fs.writeFile('tmp/test.asset', 'id: tmp');
    expect(await fs.readdir('tmp')).toContain('test.asset');
    await fs.unlink('tmp/test.asset');
    expect(await fs.readdir('tmp')).toEqual([]);
  });
});

