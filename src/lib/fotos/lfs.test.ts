import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isLfsPointer, pointerToText, LfsClient, type PointerInfo } from './lfs';
import * as lfsDb from './lfs-db';

describe('lfs', () => {
  describe('isLfsPointer', () => {
    it('erkennt gültigen LFS-Pointer', () => {
      const pointer = new TextEncoder().encode(
        'version https://git-lfs.github.com/spec/v1\n'
        + 'oid sha256:abcdef0123456789\n'
        + 'size 1234\n'
      );
      expect(isLfsPointer(pointer)).toBe(true);
    });

    it('erkennt normalen Text als keinen Pointer', () => {
      const text = new TextEncoder().encode('Hello World');
      expect(isLfsPointer(text)).toBe(false);
    });

    it('erkennt Binary-Daten als keinen Pointer', () => {
      const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
      expect(isLfsPointer(binary)).toBe(false);
    });
  });

  describe('pointerToText', () => {
    it('formatiert PointerInfo als LFS-Pointer-Text', () => {
      const info: PointerInfo = {
        oid: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
        size: 2048
      };
      const text = pointerToText(info);
      expect(text).toContain('version https://git-lfs.github.com/spec/v1');
      expect(text).toContain('oid sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2');
      expect(text).toContain('size 2048');
    });

    it('endet mit Newline', () => {
      const info: PointerInfo = {
        oid: 'a'.repeat(64),
        size: 100
      };
      const text = pointerToText(info);
      expect(text.endsWith('\n')).toBe(true);
    });
  });

  describe('LfsClient', () => {
    let client: LfsClient;

    beforeEach(() => {
      client = new LfsClient();
    });

    describe('cache operations', () => {
      it('speichert und liest Binary aus Cache', () => {
        const data = new Uint8Array([1, 2, 3]);
        client.setCached('fotos/test/photo-0.png', data);
        expect(client.getCached('fotos/test/photo-0.png')).toEqual(data);
      });

      it('gibt undefined bei nicht gecachtem Pfad', () => {
        expect(client.getCached('fotos/test/photo-0.png')).toBeUndefined();
      });

      it('entfernt Binary aus Cache', () => {
        client.setCached('fotos/test/photo-0.png', new Uint8Array([1]));
        client.removeCached('fotos/test/photo-0.png');
        expect(client.getCached('fotos/test/photo-0.png')).toBeUndefined();
      });

      it('leert gesamten Cache', () => {
        client.setCached('fotos/test/photo-0.png', new Uint8Array([1]));
        client.setCached('fotos/test/photo-1.png', new Uint8Array([2]));
        client.clearCache();
        expect(client.getCached('fotos/test/photo-0.png')).toBeUndefined();
        expect(client.getCached('fotos/test/photo-1.png')).toBeUndefined();
      });
    });

    describe('computePointerInfo', () => {
      it('berechnet SHA-256 Hash und Größe', async () => {
        const data = new Uint8Array([0xab, 0xcd, 0xef]);
        const info = await client.computePointerInfo(data);
        expect(info.size).toBe(3);
        expect(info.oid).toMatch(/^[a-f0-9]{64}$/);
      });

      it('berechnet SHA-256 auch ohne Web Crypto API', async () => {
        vi.stubGlobal('crypto', {});
        try {
          const info = await client.computePointerInfo(new TextEncoder().encode('abc'));

          expect(info.oid).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
          expect(info.size).toBe(3);
        } finally {
          vi.unstubAllGlobals();
        }
      });

      it('gleiche Daten ergeben gleichen Hash', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const info1 = await client.computePointerInfo(data);
        const info2 = await client.computePointerInfo(data);
        expect(info1.oid).toBe(info2.oid);
      });

      it('unterschiedliche Daten ergeben unterschiedlichen Hash', async () => {
        const info1 = await client.computePointerInfo(new Uint8Array([1, 2, 3]));
        const info2 = await client.computePointerInfo(new Uint8Array([1, 2, 4]));
        expect(info1.oid).not.toBe(info2.oid);
      });
    });

    describe('configure', () => {
      it('speichert Konfiguration', () => {
        client.configure({
          repoUrl: 'https://gitea.local/user/repo',
          username: 'user',
          token: 'token123'
        });
        expect(client.getConfig()).toEqual({
          repoUrl: 'https://gitea.local/user/repo',
          username: 'user',
          token: 'token123'
        });
      });
    });

    describe('staging (offline-first mit IndexedDB)', () => {
      beforeEach(() => {
        vi.spyOn(lfsDb, 'putLfsBinary').mockResolvedValue();
        vi.spyOn(lfsDb, 'getLfsBinary').mockResolvedValue(null);
        vi.spyOn(lfsDb, 'getAllLfsBinaries').mockResolvedValue([]);
        vi.spyOn(lfsDb, 'deleteLfsBinary').mockResolvedValue();
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('stageBinary speichert Binary in IndexedDB ohne Server-Kontakt', async () => {
        const data = new Uint8Array([0xab, 0xcd, 0xef]);
        const info = await client.stageBinary(data);

        // Pointer-Info wurde lokal berechnet
        expect(info.size).toBe(3);
        expect(info.oid).toMatch(/^[a-f0-9]{64}$/);

        // putLfsBinary wurde mit OID und Daten aufgerufen
        expect(lfsDb.putLfsBinary).toHaveBeenCalledWith(info.oid, 3, data);
      });

      it('stageBinary speichert mehrere Binaries', async () => {
        await client.stageBinary(new Uint8Array([1]));
        await client.stageBinary(new Uint8Array([2]));
        expect(lfsDb.putLfsBinary).toHaveBeenCalledTimes(2);
      });

      it('hasPending gibt true wenn Einträge in IndexedDB', async () => {
        vi.spyOn(lfsDb, 'getAllLfsBinaries').mockResolvedValue([
          { oid: 'abc', size: 100, data: new Uint8Array([1]) }
        ]);
        expect(await client.hasPending()).toBe(true);
      });

      it('hasPending gibt false wenn keine Einträge', async () => {
        vi.spyOn(lfsDb, 'getAllLfsBinaries').mockResolvedValue([]);
        expect(await client.hasPending()).toBe(false);
      });

      it('liest ein bereits gestagtes Binary aus IndexedDB', async () => {
        const staged = { oid: 'abc123', size: 2, data: new Uint8Array([7, 8]) };
        vi.spyOn(lfsDb, 'getLfsBinary').mockResolvedValue(staged);

        await expect(client.readStagedBinary(staged.oid)).resolves.toEqual(staged.data);
      });

      it('flushPending wirft wenn nicht konfiguriert', async () => {
        vi.spyOn(lfsDb, 'getAllLfsBinaries').mockResolvedValue([
          { oid: 'abc', size: 1, data: new Uint8Array([1]) }
        ]);
        await expect(client.flushPending()).rejects.toThrow('nicht konfiguriert');
      });

      it('flushPending tut nichts wenn keine ausstehenden Uploads', async () => {
        client.configure({
          repoUrl: 'https://gitea.local/user/repo',
          username: 'user',
          token: 'tok'
        });
        // Sollte nicht werfen
        await client.flushPending();
      });

      it('lädt LFS-Binaries über die Batch-API und cached sie', async () => {
        const oid = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
        const data = new Uint8Array([1, 2, 3]);
        const mockFetch = vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              objects: [{
                oid,
                size: data.length,
                actions: {
                  download: {
                    href: 'https://gitea.local/download/photo',
                    header: { 'X-Download-Token': 'download-token' }
                  }
                }
              }]
            })
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            arrayBuffer: async () => data.buffer
          } as Response);
        vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch as any);
        client.configure({
          repoUrl: 'https://gitea.local/user/repo',
          username: 'user',
          token: 'token'
        });

        await expect(client.download({ oid, size: data.length }, 'fotos/a/photo-0.png'))
          .resolves.toEqual(data);

        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          'https://gitea.local/user/repo/info/lfs/objects/batch',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              operation: 'download',
              transfers: ['basic'],
              objects: [{ oid, size: data.length }]
            })
          })
        );
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          'https://gitea.local/download/photo',
          expect.objectContaining({
            method: 'GET',
            headers: { 'X-Download-Token': 'download-token' }
          })
        );
        expect(client.getCached('fotos/a/photo-0.png')).toEqual(data);
      });

      it('flushPending ruft LFS Batch-API und uploadet Binaries', async () => {
        const data = new Uint8Array([0xab, 0xcd]);
        const oid = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

        vi.spyOn(lfsDb, 'getAllLfsBinaries').mockResolvedValue([
          { oid, size: 2, data }
        ]);

        // Mock fetch für Batch-API
        const mockFetch = vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              objects: [{
                oid,
                size: 2,
                actions: [{
                  href: 'https://gitea.local/user/repo/info/lfs/objects/abcdef1234567890/2',
                  header: { 'Authorization': 'Bearer token' }
                }]
              }]
            })
          } as Response)
          // Mock fetch für Upload
          .mockResolvedValueOnce({
            ok: true
          } as Response);
        vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch as any);

        client.configure({
          repoUrl: 'https://gitea.local/user/repo',
          username: 'user',
          token: 'tok'
        });

        await client.flushPending();

        // Batch-API wurde aufgerufen
        expect(mockFetch).toHaveBeenCalledWith(
          'https://gitea.local/user/repo/info/lfs/objects/batch',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/vnd.git-lfs+json'
            })
          })
        );

        // Binary wurde hochgeladen
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Binary wurde aus IndexedDB gelöscht
        expect(lfsDb.deleteLfsBinary).toHaveBeenCalledWith(oid);

        vi.restoreAllMocks();
      });

      it('flushPending behält fehlgeschlagene Uploads in IndexedDB', async () => {
        const data = new Uint8Array([0xab]);
        const oid = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

        vi.spyOn(lfsDb, 'getAllLfsBinaries').mockResolvedValue([
          { oid, size: 1, data }
        ]);

        // Batch-API ok, aber Upload schlägt fehl
        const mockFetch = vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              objects: [{
                oid,
                size: 1,
                actions: [{ href: 'https://fail/upload' }]
              }]
            })
          } as Response)
          .mockResolvedValueOnce({
            ok: false,
            status: 500
          } as Response);
        vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch as any);

        client.configure({
          repoUrl: 'https://gitea.local/user/repo',
          username: 'user',
          token: 'tok'
        });

        await expect(client.flushPending()).rejects.toThrow('Upload ist fehlgeschlagen');

        // Fehlgeschlagener Upload wird NICHT aus IndexedDB gelöscht
        expect(lfsDb.deleteLfsBinary).not.toHaveBeenCalled();

        vi.restoreAllMocks();
      });

      it('skippt bereits vorhandene Objekte (keine Upload-Aktion)', async () => {
        const oid = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

        vi.spyOn(lfsDb, 'getAllLfsBinaries').mockResolvedValue([
          { oid, size: 100, data: new Uint8Array([1]) }
        ]);

        // Batch-API: keine actions (bereits auf Server)
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            objects: [{ oid, size: 100 }]
          })
        } as Response);

        client.configure({
          repoUrl: 'https://gitea.local/user/repo',
          username: 'user',
          token: 'tok'
        });

        await client.flushPending();

        // Da kein Upload nötig, wird das Binary aus IndexedDB entfernt
        expect(lfsDb.deleteLfsBinary).toHaveBeenCalledWith(oid);

        vi.restoreAllMocks();
      });

      it('removeCached entfernt aus Cache', () => {
        client.setCached('fotos/test/photo-0.png', new Uint8Array([1]));
        client.removeCached('fotos/test/photo-0.png');
        expect(client.getCached('fotos/test/photo-0.png')).toBeUndefined();
      });

      it('clearCache leert den Cache', () => {
        client.setCached('fotos/test/photo-0.png', new Uint8Array([1]));
        client.clearCache();
        expect(client.getCached('fotos/test/photo-0.png')).toBeUndefined();
      });
    });
  });
});