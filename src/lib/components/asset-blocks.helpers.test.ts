import { describe, expect, it } from 'vitest';
import { compatibleAssets, createBlockValues, resolveAssetTypeBlocks } from './asset-blocks.helpers';
import type { ComponentDefinition, FieldType, TypeDefinition } from '$lib/parser/types';

const field: FieldType = {
  nr: 0,
  name: 'kabel',
  art: 'asset_ref',
  optionen: 'kabel',
  pflicht: false,
  sensitiv: false
};

describe('asset-blocks.helpers', () => {
  it('vererbt Blöcke und überschreibt gleichnamige Definitionen', () => {
    const types: TypeDefinition[] = [
      { id: 'basis', fields: [], blocks: [{ compId: 'port', min: 1, max: 8 }] },
      {
        id: 'projektor',
        extends: 'basis',
        fields: [],
        blocks: [{ compId: 'port', min: 2, max: 4 }, { compId: 'lampe', min: 0, max: 2 }]
      }
    ];

    expect(resolveAssetTypeBlocks('projektor', types)).toEqual([
      { compId: 'port', min: 2, max: 4 },
      { compId: 'lampe', min: 0, max: 2 }
    ]);
  });

  it('setzt erforderliche Mindestinstanzen auf und erhält gespeicherte Blockwerte', () => {
    const definitions = [{ compId: 'port', min: 2, max: 4 }];
    const values = createBlockValues(definitions, { port: { '0': { name: 'HDMI' } } });

    expect(values).toEqual({
      port: {
        '0': { name: 'HDMI' },
        '1': {}
      }
    });
  });

  it('setzt typfeste Komponentenwerte für jede erforderliche Instanz und überschreibt Assetwerte', () => {
    const values = createBlockValues([{
      compId: 'port',
      min: 2,
      max: 2,
      fixedFields: { anschlusstyp: 'HDMI' }
    }], {
      port: {
        '0': { anschlusstyp: 'SDI', bezeichnung: 'A' }
      }
    });

    expect(values.port).toEqual({
      '0': { anschlusstyp: 'HDMI', bezeichnung: 'A' },
      '1': { anschlusstyp: 'HDMI' }
    });
  });

  it('zeigt Asset-Referenzen nur für erlaubte Typen und deren Untertypen', () => {
    const components: ComponentDefinition[] = [{
      id: 'port',
      name: 'Port',
      fields: [field]
    }];
    const types: TypeDefinition[] = [
      { id: 'kabel', fields: [], blocks: [] },
      { id: 'hdmi-kabel', extends: 'kabel', fields: [], blocks: [] },
      { id: 'usb-kabel', fields: [], blocks: [] }
    ];
    const assets = [
      { id: 'h1', type: 'hdmi-kabel', label: 'HDMI 1' },
      { id: 'u1', type: 'usb-kabel', label: 'USB 1' },
      { id: 'k1', type: 'kabel', label: 'Kabel 1' }
    ];

    expect(compatibleAssets(field, assets, types)).toEqual([assets[0], assets[2]]);
  });

  it('erlaubt alle Asset-Typen, wenn keine Einschränkung definiert ist', () => {
    const unrestricted = { ...field, optionen: null };
    const assets = [
      { id: 'a', type: 'a', label: 'A' },
      { id: 'b', type: 'b', label: 'B' }
    ];

    expect(compatibleAssets(unrestricted, assets, [])).toEqual(assets);
  });

  it('schließt das aktuelle Asset aus und ignoriert unbekannte Blocktypen', () => {
    expect(resolveAssetTypeBlocks('missing', [])).toEqual([]);
    expect(compatibleAssets(field, [{ id: 'self', type: 'hdmi-kabel', label: 'Self' }], [], 'self')).toEqual([]);
  });
});
