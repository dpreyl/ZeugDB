<script lang="ts">
  import type { LocationFilterOption } from './asset-overview.helpers';

  type Props = {
    options: LocationFilterOption[];
    selected: string[] | null;
    onChange: (selected: string[] | null) => void;
  };

  let { options, selected = null, onChange }: Props = $props();
  let open = $state(false);

  const allValues = $derived([...new Set(options.flatMap(option => option.values))]);

  function isChecked(option: LocationFilterOption): boolean {
    const selectedValues = new Set(selected ?? allValues);
    return option.values.length > 0 && option.values.every(value => selectedValues.has(value));
  }

  function isPartiallyChecked(option: LocationFilterOption): boolean {
    if (selected === null) return false;
    const selectedValues = new Set(selected);
    const count = option.values.filter(value => selectedValues.has(value)).length;
    return count > 0 && count < option.values.length;
  }

  function toggle(option: LocationFilterOption, checked: boolean) {
    const next = new Set(selected ?? allValues);
    for (const value of option.values) {
      if (checked) next.add(value);
      else next.delete(value);
    }
    const values = allValues.filter(value => next.has(value));
    onChange(values.length === allValues.length ? null : values);
  }
</script>

<div class="relative inline-block">
  <button
    type="button"
    aria-label="Filter Standort"
    aria-expanded={open}
    onclick={() => open = !open}
    class="ml-1 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-900"
  >▾</button>
  {#if open}
    <div
      role="group"
      aria-label="Werte für Standort"
      class="absolute left-0 top-full z-30 mt-1 max-h-72 min-w-56 overflow-auto rounded-md border border-gray-200 bg-white p-2 text-left font-normal normal-case shadow-lg"
    >
      <button
        type="button"
        class="mb-2 w-full rounded px-2 py-1 text-left text-xs text-blue-700 hover:bg-blue-50"
        onclick={() => onChange(null)}
      >Alle auswählen</button>
      <button
        type="button"
        class="mb-2 w-full rounded px-2 py-1 text-left text-xs text-gray-600 hover:bg-gray-50"
        onclick={() => onChange([])}
      >Auswahl leeren</button>
      {#if options.length === 0}
        <p class="px-2 py-1 text-xs text-gray-500">Keine Standorte vorhanden</p>
      {:else}
        <fieldset class="space-y-1">
          <legend class="sr-only">Standort</legend>
          {#each options as option (option.id)}
            <label
              class="flex items-start gap-2 rounded py-1 pr-2 text-xs text-gray-700 hover:bg-gray-50"
              style={`padding-left: ${0.5 + option.depth * 0.9}rem`}
            >
              <input
                type="checkbox"
                checked={isChecked(option)}
                aria-checked={isPartiallyChecked(option) ? 'mixed' : undefined}
                onchange={(event) => toggle(option, event.currentTarget.checked)}
                class="mt-0.5 rounded border-gray-300"
              />
              <span class="break-all">{option.label}</span>
            </label>
          {/each}
        </fieldset>
      {/if}
    </div>
  {/if}
</div>
