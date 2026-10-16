import { describe, it, expect } from 'vitest';
import { SCHEMA_SQL, FTS_SQL } from './schema';

describe('SCHEMA_SQL', () => {
  it('enthält alle Tabellen', () => {
    const expected = ['assets', 'asset_fields', 'asset_types', 'type_fields', 'components', 'type_blocks', 'locations', 'relationships'];
    for (const table of expected) {
      expect(SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('enthält keine FTS-Table (die ist in FTS_SQL)', () => {
    expect(SCHEMA_SQL).not.toContain('fts5');
  });

  it('enthält Indizes für assets', () => {
    expect(SCHEMA_SQL).toContain('idx_assets_type');
    expect(SCHEMA_SQL).toContain('idx_assets_location');
  });

  it('enthält Fremdschlüssel von asset_fields zu assets', () => {
    expect(SCHEMA_SQL).toContain('FOREIGN KEY (asset_id) REFERENCES assets(id)');
  });

  it('enthält type_blocks-Tabelle', () => {
    expect(SCHEMA_SQL).toContain('FOREIGN KEY (type_id) REFERENCES asset_types(id)');
    expect(SCHEMA_SQL).toContain('FOREIGN KEY (comp_id) REFERENCES components(id)');
  });
});

describe('FTS_SQL', () => {
  it('enthält FTS-Virtual-Table', () => {
    expect(FTS_SQL).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS asset_fields_fts USING fts5');
  });
});

