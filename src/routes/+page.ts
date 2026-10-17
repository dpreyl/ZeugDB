import type { PageLoad } from './$types';
import { getAssetStore } from '$lib/stores/assets.store.svelte';

export const load: PageLoad = () => {
  const store = getAssetStore();
  return {
    assets: store.all.map(a => ({
      id: a.id,
      type: a.type,
      location: a.location,
      geaendert: a.geaendert?.slice(0, 10) ?? null
    }))
  };
};
