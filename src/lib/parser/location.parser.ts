import type { Coord, Location, LocationArt } from './types';

type BlockKind = 'polygon' | 'route';
const DIRECT_FIELDS = new Set(['id', 'name', 'eltern', 'art', 'lat', 'lon']);
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCoord(point: Coord): boolean {
  return point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180;
}

function parsePair(line: string): Coord | null {
  const separator = line.indexOf(':');
  if (separator < 0) return null;
  const lat = parseNumber(line.slice(0, separator));
  const lon = parseNumber(line.slice(separator + 1));
  if (lat === null || lon === null) return null;
  const point = { lat, lon };
  return isCoord(point) ? point : null;
}

function setDirectField(location: Location, key: string, value: string): void {
  switch (key) {
    case 'id': location.id = value; break;
    case 'name': location.name = value; break;
    case 'eltern': location.eltern = value || undefined; break;
    case 'art':
      if (value === 'punkt' || value === 'raum' || value === 'leitung') {
        location.art = value as LocationArt;
      }
      break;
    case 'lat': {
      const lat = parseNumber(value);
      location.lat = lat !== null && lat >= -90 && lat <= 90 ? lat : undefined;
      break;
    }
    case 'lon': {
      const lon = parseNumber(value);
      location.lon = lon !== null && lon >= -180 && lon <= 180 ? lon : undefined;
      break;
    }
  }
}

/**
 * Parses a `.location` file. Supports legacy `[polygon]` indexed blocks and
 * compact `---polygon---` blocks containing `lat:lon` pairs.
 */
export function parseLocation(text: string): Location {
  const location: Location = {};
  let activeBlock: BlockKind | null = null;
  let blockStyle: 'indexed' | 'pairs' | null = null;
  const indexedPoints = new Map<number, Partial<Coord>>();

  const appendIndexedPoints = () => {
    const target = activeBlock === 'polygon' ? location.polygon : location.route;
    if (!target) return;
    for (const index of [...indexedPoints.keys()].sort((a, b) => a - b)) {
      const point = indexedPoints.get(index);
      if (point?.lat !== undefined && point.lon !== undefined && isCoord(point as Coord)) {
        target.push({ lat: point.lat, lon: point.lon });
      }
    }
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const bracketOpen = line.match(/^\[(polygon|route)\]$/);
    const dashedHeader = line.match(/^---(.*?)---$/);
    if (bracketOpen || dashedHeader) {
      if (blockStyle === 'indexed') appendIndexedPoints();
      const name = bracketOpen?.[1] ?? dashedHeader?.[1];
      activeBlock = name === 'polygon' || name === 'route' ? name : null;
      blockStyle = bracketOpen ? 'indexed' : activeBlock ? 'pairs' : null;
      indexedPoints.clear();
      if (activeBlock === 'polygon') location.polygon = [];
      if (activeBlock === 'route') location.route = [];
      continue;
    }

    const bracketClose = line.match(/^\[\/(polygon|route)\]$/);
    if (bracketClose?.[1] === activeBlock) {
      if (blockStyle === 'indexed') appendIndexedPoints();
      activeBlock = null;
      blockStyle = null;
      indexedPoints.clear();
      continue;
    }

    if (activeBlock && blockStyle === 'indexed') {
      const indexedMatch = line.match(/^(\d+):(lat|lon):\s*(.+)$/);
      if (indexedMatch) {
        const index = Number(indexedMatch[1]);
        const value = parseNumber(indexedMatch[3]);
        if (value !== null) {
          const point = indexedPoints.get(index) ?? {};
          point[indexedMatch[2] as 'lat' | 'lon'] = value;
          indexedPoints.set(index, point);
        }
        continue;
      }
    }

    if (activeBlock && blockStyle === 'pairs') {
      const point = parsePair(line);
      if (point) {
        if (activeBlock === 'polygon') (location.polygon ??= []).push(point);
        else (location.route ??= []).push(point);
        continue;
      }
      const directKey = line.slice(0, line.indexOf(':')).trim();
      if (!DIRECT_FIELDS.has(directKey)) continue;
      activeBlock = null;
      blockStyle = null;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex < 0) continue;
    const key = line.slice(0, colonIndex).trim();
    if (DIRECT_FIELDS.has(key)) {
      setDirectField(location, key, line.slice(colonIndex + 1).trim());
    }
  }

  if (blockStyle === 'indexed') appendIndexedPoints();
  return location;
}
