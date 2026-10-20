import type { Location } from './types';

/**
 * Serialisiert einen Location-Objekt in das `.location`-Dateiformat.
 */
export function serializeLocation(loc: Location): string {
  const lines: string[] = [];

  if (loc.id) lines.push(`id: ${loc.id}`);
  if (loc.name) lines.push(`name: ${loc.name}`);
  if (loc.eltern) lines.push(`eltern: ${loc.eltern}`);
  if (loc.art) lines.push(`art: ${loc.art}`);

  // Einfache Punkt-Koordinaten
  if (loc.lat !== undefined) lines.push(`lat: ${loc.lat}`);
  if (loc.lon !== undefined) lines.push(`lon: ${loc.lon}`);

  // Polygon-Block
  if (loc.polygon && loc.polygon.length > 0) {
    lines.push('[polygon]');
    for (let i = 0; i < loc.polygon.length; i++) {
      const p = loc.polygon[i];
      lines.push(`  ${i}:lat: ${p.lat}`);
      lines.push(`  ${i}:lon: ${p.lon}`);
    }
    lines.push('[/polygon]');
  }

  // Route-Block
  if (loc.route && loc.route.length > 0) {
    lines.push('[route]');
    for (let i = 0; i < loc.route.length; i++) {
      const p = loc.route[i];
      lines.push(`  ${i}:lat: ${p.lat}`);
      lines.push(`  ${i}:lon: ${p.lon}`);
    }
    lines.push('[/route]');
  }

  return lines.join('\n');
}
