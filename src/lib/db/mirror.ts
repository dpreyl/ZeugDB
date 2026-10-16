import type { Database } from 'sql.js';
import { parseAsset } from '../parser/asset.parser';
import { upsertAsset, upsertAssetFields, deleteAsset } from './db';
import type { AssetInput } from './db';

/**
 * Spiegelt eine geparste Asset-Datei in die SQLite-Datenbank.
 * Existiert das Asset bereits, wird es aktualisiert (Felder werden ersetzt).
 */
export function mirrorAssetFile(db: Database, _filename: string, text: string): void {
  const { direct, blocks } = parseAsset(text);

  // Asset-Metadaten einfügen
  const asset: AssetInput = {
    id: direct.id,
    type: direct.type,
    location: direct.location || null,
    erstellt: direct.erstellt || null,
    geaendert: direct.geaendert || null
  };
  upsertAsset(db, asset);

  // Alle alten Felder löschen
  db.run('DELETE FROM asset_fields WHERE asset_id = ?', [asset.id]);

  // Direkte Felder (außer Metadaten)
  const metaKeys = new Set(['id', 'type', 'location', 'erstellt', 'geaendert']);
  const fieldEntries: [string, string][] = [];
  for (const [key, value] of Object.entries(direct)) {
    if (!metaKeys.has(key)) {
      fieldEntries.push([key, value]);
    }
  }

  // Block-Felder
  for (const [_blockName, instances] of Object.entries(blocks)) {
    for (const [instKey, fields] of Object.entries(instances)) {
      for (const [field, value] of Object.entries(fields)) {
        fieldEntries.push([`${_blockName}[${instKey}].${field}`, value]);
      }
    }
  }

  if (fieldEntries.length > 0) {
    upsertAssetFields(db, asset.id, Object.fromEntries(fieldEntries));
  }
}

