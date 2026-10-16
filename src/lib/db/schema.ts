/**
 * Kern-Schema (ohne FTS5 — läuft auch in Node/sql.js).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  location TEXT REFERENCES locations(id),
  erstellt TEXT,
  geaendert TEXT
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
CREATE INDEX IF NOT EXISTS idx_assets_geaendert ON assets(geaendert);

CREATE TABLE IF NOT EXISTS asset_fields (
  asset_id TEXT NOT NULL,
  path TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (asset_id, path),
  FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE INDEX IF NOT EXISTS idx_af_path ON asset_fields(path);
CREATE INDEX IF NOT EXISTS idx_af_value ON asset_fields(value);

CREATE TABLE IF NOT EXISTS asset_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  extends TEXT REFERENCES asset_types(id),
  kategorie TEXT,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS type_fields (
  type_id TEXT NOT NULL,
  nr INTEGER NOT NULL,
  name TEXT NOT NULL,
  art TEXT NOT NULL,
  optionen TEXT,
  pflicht INTEGER DEFAULT 0,
  sensitiv INTEGER DEFAULT 0,
  PRIMARY KEY (type_id, nr),
  FOREIGN KEY (type_id) REFERENCES asset_types(id)
);

CREATE TABLE IF NOT EXISTS components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS type_blocks (
  type_id TEXT NOT NULL,
  comp_id TEXT NOT NULL,
  min INTEGER DEFAULT 0,
  max INTEGER DEFAULT 1,
  PRIMARY KEY (type_id, comp_id),
  FOREIGN KEY (type_id) REFERENCES asset_types(id),
  FOREIGN KEY (comp_id) REFERENCES components(id)
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  eltern TEXT REFERENCES locations(id),
  lat REAL,
  lon REAL
);

CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kabel_id TEXT NOT NULL,
  kabelende_nr INTEGER NOT NULL,
  gerat_id TEXT NOT NULL,
  gerat_port TEXT NOT NULL,
  FOREIGN KEY (kabel_id) REFERENCES assets(id),
  FOREIGN KEY (gerat_id) REFERENCES assets(id)
);

CREATE INDEX IF NOT EXISTS idx_rel_kabel ON relationships(kabel_id);
CREATE INDEX IF NOT EXISTS idx_rel_gerat ON relationships(gerat_id);
`;

/**
 * FTS5-Volltextsuche (nur im Browser mit op-sqlite verfügbar).
 */
export const FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS asset_fields_fts USING fts5 (
  asset_id, path, value
);
`;

