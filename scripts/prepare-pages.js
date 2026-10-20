import { copyFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function preparePagesDirectory(directory) {
  const indexPath = join(directory, 'index.html');
  const fallbackPath = join(directory, '404.html');

  await copyFile(indexPath, fallbackPath).catch(error => {
    if (error.code === 'ENOENT') {
      throw new Error(`GitHub Pages preparation requires ${indexPath}. Run the static build first.`);
    }
    throw error;
  });
  await writeFile(join(directory, '.nojekyll'), '');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const buildDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'build');
  await preparePagesDirectory(buildDirectory);
  console.log('GitHub Pages files prepared in build/ (404.html and .nojekyll).');
}
