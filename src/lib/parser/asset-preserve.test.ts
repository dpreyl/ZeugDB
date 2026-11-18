import { describe, expect, it } from 'vitest';
import { preserveAssetFileContent } from './asset-preserve';

describe('preserveAssetFileContent', () => {
  it('preserves the original file byte-for-byte when field values are unchanged', () => {
    const original = '# inspection history\r\ntype: ladder\r\nid: asset-1\r\ninspection[1].date: 2025-06-20\r\n';
    const desired = 'id: asset-1\ntype: ladder\ninspection[1].date: 2025-06-20\n';

    expect(preserveAssetFileContent(original, desired)).toBe(original);
  });

  it('updates only changed fields and retains comments, order, and line endings', () => {
    const original = '# inspection history\n type: ladder\nid: asset-1\ninspection[1].date: 2025-06-20\n';
    const desired = 'id: asset-1\ntype: ladder\ninspection[1].date: 2026-06-20\ninspection[1].result: passed\n';

    expect(preserveAssetFileContent(original, desired)).toBe(
      '# inspection history\n type: ladder\nid: asset-1\ninspection[1].date: 2026-06-20\ninspection[1].result: passed\n'
    );
  });

  it('removes block fields omitted from the desired asset while retaining empty direct fields', () => {
    const original = 'id: asset-1\noptional:\ninspection[1].date: 2025-06-20\n';
    const desired = 'id: asset-1\noptional: \n';

    expect(preserveAssetFileContent(original, desired)).toBe('id: asset-1\noptional:\n');
  });
});
