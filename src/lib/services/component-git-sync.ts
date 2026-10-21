import type { GitRepo } from '../git/repo';
import { parseComponent } from '../parser/comp.parser';
import { serializeComponent } from '../parser/comp.writer';
import type { ComponentDefinition } from '../parser/types';

export type ComponentSyncChanges = {
  changedFiles: string[];
  deletedFiles: string[];
};

export async function loadComponentsFromGit(repo: GitRepo): Promise<ComponentDefinition[]> {
  let files: string[];
  try {
    files = await repo.readdir('components');
  } catch {
    return [];
  }

  const components: ComponentDefinition[] = [];
  for (const file of files) {
    if (!file.endsWith('.comp')) continue;
    const id = decodeURIComponent(file.slice(0, -'.comp'.length));
    components.push(parseComponent(id, await repo.readFile(`components/${file}`)));
  }
  return components;
}

export async function syncComponentsToGit(
  repo: GitRepo,
  components: ComponentDefinition[]
): Promise<ComponentSyncChanges> {
  const changedFiles: string[] = [];
  const currentPaths = new Set<string>();

  for (const component of components) {
    const path = `components/${encodeURIComponent(component.id)}.comp`;
    currentPaths.add(path);
    const content = serializeComponent(component);
    if (await readFileOrNull(repo, path) !== content) {
      await repo.writeFile(path, content);
      changedFiles.push(path);
    }
  }

  const deletedFiles: string[] = [];
  try {
    for (const file of await repo.readdir('components')) {
      if (!file.endsWith('.comp')) continue;
      const path = `components/${file}`;
      if (!currentPaths.has(path)) deletedFiles.push(path);
    }
  } catch {
    // The directory is absent until the first component is defined.
  }

  return { changedFiles, deletedFiles };
}

async function readFileOrNull(repo: GitRepo, path: string): Promise<string | null> {
  try {
    return await repo.readFile(path);
  } catch {
    return null;
  }
}
