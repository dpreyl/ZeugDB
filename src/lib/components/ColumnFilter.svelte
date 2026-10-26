<script lang="ts">
  type Props = {
    label: string;
    options: string[];
    selected: string[] | null;
    onChange: (selected: string[] | null) => void;
  };

  let { label, options, selected = null, onChange }: Props = $props();
  let open = $state(false);

  function toggle(option: string, checked: boolean) {
    const next = new Set(selected ?? options);
    if (checked) next.add(option);
    else next.delete(option);
    const values = options.filter(value => next.has(value));
    onChange(values.length === options.length ? null : values);
  }
</script>

<div class="relative inline-block">
  <button
    type="button"
    aria-label={`Filter ${label}`}
    aria-expanded={open}
    onclick={() => open = !open}
    class="ml-1 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-900"
  >▾</button>
  {#if open}
    <div role="group" aria-label={`Werte für ${label}`} class="absolute left-0 top-full z-30 mt-1 max-h-64 min-w-52 overflow-auto rounded-md border border-gray-200 bg-white p-2 text-left font-normal normal-case shadow-lg">
      <button
        type="button"
        class="mb-2 w-full rounded px-2 py-1 text-left text-xs text-blue-700 hover:bg-blue-50"
        onclick={() => onChange(null)}
      >Alle auswählen</button>
      {#if options.length === 0}
        <p class="px-2 py-1 text-xs text-gray-500">Keine Werte vorhanden</p>
      {:else}
        <fieldset class="space-y-1">
          <legend class="sr-only">{label}</legend>
          {#each options as option (option)}
            <label class="flex items-start gap-2 rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selected === null || selected.includes(option)}
                onchange={(event) => toggle(option, event.currentTarget.checked)}
                class="mt-0.5 rounded border-gray-300"
              />
              <span class="break-all">{option}</span>
            </label>
          {/each}
        </fieldset>
      {/if}
    </div>
  {/if}
</div>
