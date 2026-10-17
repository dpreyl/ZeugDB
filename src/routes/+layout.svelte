<script lang="ts">
  import '../app.css';
  import { initializeStore } from '$lib/services/init';

  initializeStore();

  // Service Worker für Offline-Nutzung registrieren
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('SW-Registrierung fehlgeschlagen:', err);
      });
    });
  }
</script>

<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-900">ZeugDB</h1>
      <nav class="flex gap-4 text-sm">
        <a href="/" class="text-gray-600 hover:text-gray-900">Assets</a>
        <a href="/types" class="text-gray-600 hover:text-gray-900">Typen</a>
        <a href="/locations" class="text-gray-600 hover:text-gray-900">Standorte</a>
        <a href="/settings" class="text-gray-600 hover:text-gray-900">Einstellungen</a>
      </nav>
    </div>
  </header>
  <main class="max-w-6xl mx-auto px-4 py-6">
    <slot />
  </main>
</div>
