import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAssetStore } from '$lib/stores/assets.store.svelte';

export const load: PageLoad = async ({ params }) => {
  const store = getAssetStore();
  const asset = store.findFull(params.id);
  if (!asset) {
    throw error(404, 'Asset nicht gefunden');
  }
  return asset;
};
