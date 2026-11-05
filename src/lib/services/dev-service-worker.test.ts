import { describe, expect, it, vi } from 'vitest';
import { unregisterDevelopmentServiceWorkers } from './dev-service-worker';

describe('unregisterDevelopmentServiceWorkers', () => {
  it('entfernt Registrierungen ohne die Seite automatisch neu zu laden', async () => {
    const registration = { unregister: vi.fn().mockResolvedValue(true) };
    const serviceWorker = {
      controller: {} as ServiceWorker,
      getRegistrations: vi.fn().mockResolvedValue([registration])
    };

    await unregisterDevelopmentServiceWorkers(
      serviceWorker as unknown as ServiceWorkerContainer
    );

    expect(registration.unregister).toHaveBeenCalledOnce();
  });

  it('macht nichts, wenn keine Registrierung vorhanden ist', async () => {
    const serviceWorker = {
      controller: null,
      getRegistrations: vi.fn().mockResolvedValue([])
    };

    await unregisterDevelopmentServiceWorkers(
      serviceWorker as unknown as ServiceWorkerContainer
    );

    expect(serviceWorker.getRegistrations).toHaveBeenCalledOnce();
  });
});
