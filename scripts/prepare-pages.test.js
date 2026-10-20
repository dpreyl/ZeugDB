import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { preparePagesDirectory } from './prepare-pages.js';

let temporaryDirectory;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

describe('preparePagesDirectory', () => {
  it('adds a route fallback and disables Jekyll processing', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'zeugdb-pages-'));
    await writeFile(join(temporaryDirectory, 'index.html'), '<main>App</main>');

    await preparePagesDirectory(temporaryDirectory);

    expect(await readFile(join(temporaryDirectory, '404.html'), 'utf8'))
      .toBe('<main>App</main>');
    expect(await readFile(join(temporaryDirectory, '.nojekyll'), 'utf8')).toBe('');
  });

  it('fails clearly when the static build has no index page', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'zeugdb-pages-'));

    await expect(preparePagesDirectory(temporaryDirectory))
      .rejects.toThrow(/index\.html/);
  });
});
