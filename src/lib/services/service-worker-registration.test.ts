import { describe, expect, it, vi } from 'vitest';
import { registerProductionServiceWorker } from './service-worker-registration';

describe('registerProductionServiceWorker', () => {
  it('registriert den Service Worker im Produktions-Basispfad', async () => {
    const serviceWorker = {
      register: vi.fn().mockResolvedValue({} as ServiceWorkerRegistration)
    };

    await registerProductionServiceWorker(false, serviceWorker, '/zeugdb');

    expect(serviceWorker.register).toHaveBeenCalledWith('/zeugdb/service-worker.js', {
      type: 'module'
    });
  });

  it('registriert weder im Entwicklungsmodus noch mit doppeltem Root-Slash', async () => {
    const serviceWorker = {
      register: vi.fn().mockResolvedValue({} as ServiceWorkerRegistration)
    };

    await registerProductionServiceWorker(true, serviceWorker, '/');
    expect(serviceWorker.register).not.toHaveBeenCalled();

    await registerProductionServiceWorker(false, serviceWorker, '');
    expect(serviceWorker.register).toHaveBeenCalledWith('/service-worker.js', {
      type: 'module'
    });
  });
});
