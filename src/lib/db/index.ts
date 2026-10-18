export { initDb, upsertAsset, upsertAssetFields, getAssetById, getAllAssets, getAssetFields, getAllAssetsWithFields, deleteAsset } from './db';
export type { AssetRow, AssetInput } from './db';
export type { Database } from 'sql.js';
export { SCHEMA_SQL, FTS_SQL } from './schema';
export { mirrorAssetFile } from './mirror';

