import type { ComponentDefinition } from '../parser/types';

export class ComponentsStore {
  declare all: ComponentDefinition[];

  constructor() {
    this.all = $state([]);
  }

  setAll(components: ComponentDefinition[]): void {
    this.all = components;
  }

  findById(id: string): ComponentDefinition | undefined {
    return this.all.find(component => component.id === id);
  }

  add(component: ComponentDefinition): void {
    const index = this.all.findIndex(item => item.id === component.id);
    if (index < 0) this.all.push(component);
    else this.all[index] = component;
  }

  remove(id: string): boolean {
    const index = this.all.findIndex(component => component.id === id);
    if (index < 0) return false;
    this.all.splice(index, 1);
    return true;
  }

  clear(): void {
    this.all = [];
  }
}

let store: ComponentsStore | null = null;

export function getComponentsStore(): ComponentsStore {
  if (!store) store = new ComponentsStore();
  return store;
}

export function resetComponentsStore(): void {
  store = null;
}
