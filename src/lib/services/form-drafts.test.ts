import { beforeEach, describe, expect, it } from 'vitest';
import { clearFormDraft, readFormDraft, writeFormDraft } from './form-drafts';

describe('form drafts', () => {
  beforeEach(() => localStorage.clear());

  it('restores a structured form draft after the page is recreated', () => {
    writeFormDraft('asset:new', {
      designation: 'Kamera Eingang',
      fields: { Hersteller: 'Sony' },
      location: 'raum-1'
    });

    expect(readFormDraft('asset:new')).toEqual({
      designation: 'Kamera Eingang',
      fields: { Hersteller: 'Sony' },
      location: 'raum-1'
    });
  });

  it('returns null for missing or malformed drafts', () => {
    localStorage.setItem('zeugdb:form-draft:broken', '{not json');

    expect(readFormDraft('missing')).toBeNull();
    expect(readFormDraft('broken')).toBeNull();
  });

  it('clears a draft after it is saved or discarded', () => {
    writeFormDraft('location:new', { name: 'Werkstatt' });

    clearFormDraft('location:new');

    expect(readFormDraft('location:new')).toBeNull();
  });
});
