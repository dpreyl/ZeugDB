import { beforeEach, describe, expect, it } from 'vitest';
import { getComponentsStore, resetComponentsStore } from './components.store.svelte';

describe('ComponentsStore', () => {
  beforeEach(resetComponentsStore);

  it('fügt Komponenten hinzu, findet und überschreibt sie anhand ihrer ID', () => {
    const store = getComponentsStore();
    store.add({ id: 'port', name: 'Port', fields: [] });

    expect(store.findById('port')?.name).toBe('Port');
    store.add({ id: 'port', name: 'Anschluss', fields: [] });
    expect(store.all).toHaveLength(1);
    expect(store.findById('port')?.name).toBe('Anschluss');
  });

  it('ersetzt und leert die Komponentenliste', () => {
    const store = getComponentsStore();
    store.add({ id: 'port', name: 'Port', fields: [] });
    store.setAll([{ id: 'lampe', name: 'Lampe', fields: [] }]);
    expect(store.all.map(component => component.id)).toEqual(['lampe']);
    expect(store.remove('lampe')).toBe(true);
    store.clear();
    expect(store.all).toEqual([]);
  });
});
