export type DirectField = { kind: 'direct'; key: string; value: string };
export type BlockField = {
  kind: 'block';
  blockName: string;
  index: number;
  field: string;
  value: string;
};

export type ParsedField = DirectField | BlockField;

export type ParsedAsset = {
  direct: Record<string, string>;
  blocks: Record<string, Record<string, Record<string, string>>>;
};

export type FieldType = {
  nr: number;
  name: string;
  art: string;
  optionen: string | null;
  pflicht: boolean;
  sensitiv: boolean;
};

export type BlockDef = {
  compId: string;
  min: number;
  max: number;
  fixedFields?: Record<string, string>;
};

export type TypeDefinition = {
  id: string;
  name?: string;
  extends?: string;
  kategorie?: string;
  icon?: string;
  fields: FieldType[];
  blocks: BlockDef[];
};

export type ComponentDefinition = {
  id: string;
  name: string;
  fields: FieldType[];
};

export type LocationArt = 'punkt' | 'raum' | 'leitung';

export type Coord = { lat: number; lon: number };

export type Location = {
  id?: string;
  name?: string;
  eltern?: string;
  art?: LocationArt;
  lat?: number;
  lon?: number;
  polygon?: Coord[];
  route?: Coord[];
};

