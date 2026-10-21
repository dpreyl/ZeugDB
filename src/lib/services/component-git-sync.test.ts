import { describe, expect, it, vi } from 'vitest';
import { loadComponentsFromGit, syncComponentsToGit } from './component-git-sync';

describe('syncComponentsToGit', () => {
  it('schreibt geänderte Komponenten und meldet entfernte Dateien', async () => {
    const repo = {
      readFile: vi.fn(async (path: string) => {
        if (path === 'components/port.comp') return 'name: Old\n';
        throw new Error('not found');
      }),
      writeFile: vi.fn(async () => {}),
      readdir: vi.fn(async () => ['old.comp', 'port.comp', 'notes.txt'])
    };

    const changes = await syncComponentsToGit(repo as never, [
      { id: 'port', name: 'Port', fields: [{ nr: 0, name: 'name', art: 'text', optionen: null, pflicht: false, sensitiv: false }] },
      { id: 'lamp', name: 'Lampe', fields: [] }
    ]);

    expect(repo.writeFile).toHaveBeenCalledWith('components/port.comp', 'name: Port\nfeld: name, text, optional\n');
    expect(repo.writeFile).toHaveBeenCalledWith('components/lamp.comp', 'name: Lampe\n');
    expect(changes.changedFiles).toEqual(['components/port.comp', 'components/lamp.comp']);
    expect(changes.deletedFiles).toEqual(['components/old.comp']);
  });
});

describe('loadComponentsFromGit', () => {
  it('liest Komponentendateien und ignoriert andere Dateien', async () => {
    const repo = {
      readdir: vi.fn(async () => ['port%20hdmi.comp', 'README.md']),
      readFile: vi.fn(async () => 'name: HDMI-Port\nfeld: name, text, pflicht\n')
    };

    await expect(loadComponentsFromGit(repo as never)).resolves.toEqual([{
      id: 'port hdmi',
      name: 'HDMI-Port',
      fields: [{
        nr: 0,
        name: 'name',
        art: 'text',
        optionen: null,
        pflicht: true,
        sensitiv: false
      }]
    }]);
    expect(repo.readFile).toHaveBeenCalledWith('components/port%20hdmi.comp');
  });

  it('liefert eine leere Liste, wenn das Verzeichnis nicht existiert', async () => {
    const repo = { readdir: vi.fn(async () => { throw new Error('missing'); }) };
    await expect(loadComponentsFromGit(repo as never)).resolves.toEqual([]);
  });
});
