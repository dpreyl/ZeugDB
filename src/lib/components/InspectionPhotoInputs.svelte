<script lang="ts">
  import type { PhotoRole } from './asset-photo.helpers';

  export type InspectionPhotoRole = {
    role: PhotoRole;
    label: string;
    path: string;
  };

  type Props = {
    photoRoles: InspectionPhotoRole[];
    onFileSelect: (role: PhotoRole, file: File | null) => void;
  };

  let { photoRoles, onFileSelect }: Props = $props();
</script>

<div class="grid gap-3 sm:grid-cols-2">
  {#each photoRoles as { role, label, path }}
    <label class="block rounded-md border border-gray-200 p-3 text-sm font-medium text-gray-700">
      {label} <span class="font-normal text-gray-500">(optional)</span>
      <span class="mt-1 block text-xs font-normal text-gray-500">
        {path ? 'Bild vorhanden' : 'Noch kein Bild hinterlegt'}
      </span>
      {#if path}
        <span class="block truncate text-xs font-normal text-gray-500">{path.split('/').pop()}</span>
      {/if}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        capture="environment"
        aria-label="{label} aufnehmen (optional)"
        onchange={(event) => onFileSelect(role, event.currentTarget.files?.[0] ?? null)}
        class="mt-2 block w-full text-xs text-gray-500"
      />
    </label>
  {/each}
</div>
