import type { Location } from './types';

/**
 * Parst eine `.location`-Datei.
 */
export function parseLocation(text: string): Location {
  const loc: Location = {};

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case 'id': loc.id = value; break;
      case 'name': loc.name = value; break;
      case 'eltern': loc.eltern = value || undefined; break;
      case 'lat': loc.lat = value ? parseFloat(value) : undefined; break;
      case 'lon': loc.lon = value ? parseFloat(value) : undefined; break;
    }
  }

  return loc;
}

