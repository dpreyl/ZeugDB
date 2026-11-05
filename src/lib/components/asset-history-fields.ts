const ASSET_METADATA = new Set(['id', 'type', 'location', 'erstellt', 'geaendert', 'blocks']);

export function getAssetHistoryFields(asset: unknown): string[] {
  if (!isRecord(asset)) return [];
  const fields = new Set(
    Object.keys(asset).filter(key => !ASSET_METADATA.has(key) && typeof asset[key] === 'string')
  );
  const blocks = asset.blocks;
  if (isRecord(blocks)) {
    for (const [blockName, instances] of Object.entries(blocks)) {
      if (!isRecord(instances)) continue;
      for (const [index, values] of Object.entries(instances)) {
        if (!isRecord(values)) continue;
        for (const field of Object.keys(values)) {
          fields.add(`${blockName}[${index}].${field}`);
        }
      }
    }
  }
  return [...fields].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
