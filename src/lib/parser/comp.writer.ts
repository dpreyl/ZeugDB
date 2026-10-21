import type { ComponentDefinition } from './types';

export function serializeComponent(component: ComponentDefinition): string {
  const lines = [`name: ${component.name || component.id}`];
  for (const field of component.fields) {
    const parts = [field.name, field.art];
    if (field.optionen) parts.push(field.optionen.replaceAll(',', '|'));
    parts.push(field.pflicht ? 'pflicht' : 'optional');
    if (field.sensitiv) parts.push('sensitiv');
    lines.push(`feld: ${parts.join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}
