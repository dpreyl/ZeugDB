type ServiceWorkerManager = Pick<ServiceWorkerContainer, 'register'>;

/**
 * Registriert den App-Service-Worker nur im Produktionsmodus.
 * Der Vite-Entwicklungsserver darf nicht von einem Offline-Worker kontrolliert werden.
 */
export async function registerProductionServiceWorker(
  isDevelopment: boolean,
  serviceWorker: ServiceWorkerManager,
  base: string
): Promise<void> {
  if (isDevelopment) return;
  const prefix = base.replace(/\/+$/, '');
  await serviceWorker.register(`${prefix}/service-worker.js`, { type: 'module' });
}
