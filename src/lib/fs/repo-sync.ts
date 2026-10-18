import type { Database } from 'sql.js';
import type { RepoFs } from './repo-fs';
import { getAllAssets, mirrorAssetFile } from '../db';

/**
 * Syncronisiert alle `.asset`-Dateien aus dem FS in die SQLite-DB.
 * Löscht Assets, die im FS nicht mehr existieren.
 */
export async function syncAssetsToDb(db: Database, fs: RepoFs): Promise<void> {
  const files = await fs.readdir('assets');
  const assetIdsInFs = new Set<string>();

  for (const file of files) {
    if (!file.endsWith('.asset')) continue;

    const raw = await fs.readFile(`assets/${file}`, 'text');
    const content = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    // Parse to get ID before mirroring
    const idMatch = content.match(/^id:\s*(.+)/m);
    if (!idMatch) continue;
    assetIdsInFs.add(idMatch[1].trim());

    mirrorAssetFile(db, file, content);
  }

  // Assets löschen, die im FS nicht mehr existieren
  const existing = getAllAssets(db);
  for (const asset of existing) {
    if (!assetIdsInFs.has(asset.id)) {
      db.run('DELETE FROM asset_fields WHERE asset_id = ?', [asset.id]);
      db.run('DELETE FROM assets WHERE id = ?', [asset.id]);
    }
  }
}

