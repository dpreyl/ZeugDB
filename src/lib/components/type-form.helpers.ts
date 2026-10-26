import type { BlockDef, FieldType, TypeDefinition } from '$lib/parser/types';

export type TypeFieldDraft = {
  name: string;
  art: string;
  optionen: string[];
  pflicht: boolean;
  sensitiv: boolean;
};

export type TypeFormDraft = {
  id: string | null;
  name: string;
  extendsId: string;
  kategorie: string;
  icon: string;
  fields: TypeFieldDraft[];
  blocks: BlockDef[];
};

export type TypeFormResult = {
  type?: TypeDefinition;
  errors: string[];
};

export function createTypeDraft(type: TypeDefinition | null): TypeFormDraft {
  return {
    id: type?.id ?? null,
    name: type?.name ?? '',
    extendsId: type?.extends ?? '',
    kategorie: type?.kategorie ?? '',
    icon: type?.icon ?? '',
    fields: type?.fields
      .filter(field => {
        const name = field.name.trim().toLocaleLowerCase();
        return name !== 'type' && name !== 'bezeichnung';
      })
      .map(field => ({
        name: field.name,
        art: field.art,
        optionen: field.optionen
          ? field.optionen.split(field.optionen.includes('|') ? '|' : ',').map(option => option.trim()).filter(Boolean)
          : [],
        pflicht: field.pflicht,
        sensitiv: field.sensitiv
      })) ?? [],
    blocks: type?.blocks.map(block => ({
      ...block,
      ...(block.fixedFields && { fixedFields: { ...block.fixedFields } })
    })) ?? []
  };
}

export function previewTypeId(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildTypeDefinition(
  draft: TypeFormDraft,
  existingTypes: TypeDefinition[]
): TypeFormResult {
  const name = draft.name.trim();
  const id = draft.id ?? previewTypeId(name);
  const errors: string[] = [];

  if (!name) errors.push('Bitte gib einen Typnamen ein.');
  if (!id) errors.push('Aus dem Typnamen kann keine gültige ID gebildet werden.');
  if (existingTypes.some(type => type.id === id && type.id !== draft.id)) {
    errors.push('Es gibt bereits einen Typ mit dieser ID.');
  }
  if (draft.extendsId === id && draft.extendsId) {
    errors.push('Ein Typ kann nicht von sich selbst erben.');
  }

  const normalizedNames = draft.fields.map(field => field.name.trim().toLocaleLowerCase());
  if (normalizedNames.some(fieldName => !fieldName)) {
    errors.push('Bitte gib für jedes Feld einen Namen ein.');
  }
  if (new Set(normalizedNames.filter(Boolean)).size !== normalizedNames.filter(Boolean).length) {
    errors.push('Feldnamen müssen eindeutig sein.');
  }
  if (normalizedNames.includes('type')) {
    errors.push('„type“ ist reserviert; der Asset-Typ wird beim Anlegen ausgewählt.');
  }
  if (normalizedNames.includes('bezeichnung')) {
    errors.push('„bezeichnung“ ist reserviert; die Asset-Bezeichnung ist ein festes Asset-Feld.');
  }

  for (const field of draft.fields) {
    if (field.art !== 'dropdown' && field.art !== 'auswahl') continue;
    const options = field.optionen.map(option => option.trim());
    if (options.length === 0) {
      errors.push('Für eine Auswahlliste ist mindestens ein Auswahlwert erforderlich.');
      break;
    }
    if (options.some(option => !option) || new Set(options).size !== options.length) {
      errors.push('Auswahlwerte müssen eindeutig und dürfen nicht leer sein.');
      break;
    }
  }

  const blockIds = draft.blocks.map(block => block.compId.trim().toLocaleLowerCase());
  if (blockIds.some(blockId => !blockId)) {
    errors.push('Bitte wähle für jeden Baustein eine Komponente aus.');
  }
  if (new Set(blockIds.filter(Boolean)).size !== blockIds.filter(Boolean).length) {
    errors.push('Baustein-IDs müssen eindeutig sein.');
  }
  if (draft.blocks.some(block =>
    !Number.isInteger(block.min) || !Number.isInteger(block.max) || block.min < 0 || block.max < 0
  )) {
    errors.push('Die Anzahl der Bausteine muss eine ganze, positive Zahl sein.');
  }
  if (draft.blocks.some(block => block.max < block.min)) {
    errors.push('Der Maximalwert eines Bausteins muss mindestens dem Minimalwert entsprechen.');
  }

  if (errors.length > 0) return { errors };

  const fields: FieldType[] = draft.fields.map((field, nr) => ({
    nr,
    name: field.name.trim(),
    art: field.art,
    optionen: field.art === 'dropdown' || field.art === 'auswahl' || field.art === 'asset_ref'
      ? field.optionen.map(option => option.trim()).join('|')
      : null,
    pflicht: field.pflicht,
    sensitiv: field.sensitiv
  }));
  const blocks: BlockDef[] = draft.blocks.map(block => ({
    compId: block.compId.trim(),
    min: block.min,
    max: block.max,
    ...(Object.keys(block.fixedFields ?? {}).length > 0 && { fixedFields: { ...block.fixedFields } })
  }));

  return {
    errors: [],
    type: {
      id,
      name,
      ...(draft.extendsId && { extends: draft.extendsId }),
      ...(draft.kategorie.trim() && { kategorie: draft.kategorie.trim() }),
      ...(draft.icon.trim() && { icon: draft.icon.trim() }),
      fields,
      blocks
    }
  };
}
