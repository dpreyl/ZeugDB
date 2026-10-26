import { describe, expect, it } from 'vitest';
import { createFormDraftFiles, type DraftFileRecord } from './form-draft-files';

function memoryAdapter() {
  const records = new Map<string, DraftFileRecord>();
  return {
    records,
    put: async (record: DraftFileRecord) => { records.set(record.key, record); },
    getAll: async () => [...records.values()],
    delete: async (key: string) => { records.delete(key); }
  };
}

describe('form draft files', () => {
  it('restores captured image files under their field names', async () => {
    const adapter = memoryAdapter();
    const drafts = createFormDraftFiles(adapter);
    const file = new File(['camera image'], 'kamera.jpg', {
      type: 'image/jpeg',
      lastModified: 123
    });

    await drafts.save('asset:new', 'Typenschild', file);
    const restored = await drafts.load('asset:new');

    expect(restored.Typenschild).toBeInstanceOf(File);
    expect(restored.Typenschild.name).toBe('kamera.jpg');
    expect(restored.Typenschild.type).toBe('image/jpeg');
    expect(await restored.Typenschild.text()).toBe('camera image');
  });

  it('keeps drafts isolated and deletes one field or all files for a form', async () => {
    const adapter = memoryAdapter();
    const drafts = createFormDraftFiles(adapter);
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    await drafts.save('asset:new', 'Front', file);
    await drafts.save('asset:new', 'Rear', file);
    await drafts.save('asset:edit:1', 'Front', file);

    await drafts.clear('asset:new', 'Front');
    expect(Object.keys(await drafts.load('asset:new'))).toEqual(['Rear']);
    expect(Object.keys(await drafts.load('asset:edit:1'))).toEqual(['Front']);

    await drafts.clear('asset:new');
    expect(await drafts.load('asset:new')).toEqual({});
  });
});
