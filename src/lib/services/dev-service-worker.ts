type ServiceWorkerManager = Pick<ServiceWorkerContainer, 'getRegistrations'>;

/**
 * Entfernt alte PWA-Service-Worker aus der Entwicklungsumgebung.
 * Der aktuelle Tab wird nicht automatisch neu geladen, da ein abgemeldeter
 * Worker beim laufenden Client noch sichtbar sein kann.
 */
export async function unregisterDevelopmentServiceWorkers(
  serviceWorker: ServiceWorkerManager
): Promise<void> {
  const registrations = await serviceWorker.getRegistrations();
  await Promise.all(registrations.map(registration => registration.unregister()));
}
