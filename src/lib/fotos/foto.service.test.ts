import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FotoService } from './foto.service';
import type { RepoFs } from '../fs/repo-fs';
import type { LfsClient } from './lfs';

describe('FotoService', () => {
  let mockFs: Map<string, Uint8Array>;
  let fs: RepoFs;
  let svc: FotoService;

  function createMockFs(): RepoFs {
    return {
      writeFile: async (path: string, data: string) => {
        mockFs.set(path, new TextEncoder().encode(data));
      },
      writeFileBinary: async (path: string, data: Uint8Array) => {
        mockFs.set(path, data);
      },
      readFile: async (path: string) => {
        const buf = mockFs.get(path);
        if (!buf) throw new Error('NOT_FOUND');
        return new TextDecoder().decode(buf);
      },
      readBinaryFile: async (path: string) => {
        const buf = mockFs.get(path);
        if (!buf) throw new Error('NOT_FOUND');
        return new Uint8Array(buf); // copy
      },
      readdir: async (dir: string) => {
        const prefix = dir.endsWith('/') ? dir : dir + '/';
        return Array.from(mockFs.keys())
          .filter(k => k.startsWith(prefix))
          .map(k => k.slice(prefix.length));
      },
      unlink: async (path: string) => { mockFs.delete(path); }
    };
  }

  beforeEach(() => {
    mockFs = new Map();
    fs = createMockFs();
    svc = new FotoService(fs);
  });

  describe('ohne LFS-Client (lokal)', () => {
    it('speichert Binary direkt als Datei', async () => {
      const img = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
      const pfad = await svc.uploadFoto('test-id', img, 'image/png');
      expect(pfad).toMatch(/^fotos\/test-id\/photo-\d+\.png$/);
      const data = mockFs.get(pfad);
      expect(data).toEqual(img);
    });

    it('generiert fortlaufende Nummer bei mehreren Uploads', async () => {
      const img = new Uint8Array([1, 2, 3]);
      const p1 = await svc.uploadFoto('dev', img, 'image/jpeg');
      const p2 = await svc.uploadFoto('dev', img, 'image/jpeg');
      expect(p1).not.toBe(p2);
      expect(p1).toContain('photo-0');
      expect(p2).toContain('photo-1');
    });

    it('ladeFoto gibt Binary zurück', async () => {
      const img = new Uint8Array([10, 20, 30]);
      const pfad = await svc.uploadFoto('x', img, 'image/png');
      const result = await svc.ladeFoto(pfad);
      expect(result.data).toEqual(img);
      expect(result.mimeType).toBe('image/png');
    });

    it('ladeFoto wirft Fehler bei unbekanntem Pfad', async () => {
      await expect(svc.ladeFoto('fotos/nicht-da.png')).rejects.toThrow();
    });

    it('listFotos gibt alle Fotos eines Assets zurück', async () => {
      const img = new Uint8Array([1]);
      await svc.uploadFoto('a1', img, 'image/png');
      await svc.uploadFoto('a1', img, 'image/jpeg');
      const liste = await svc.listFotos('a1');
      expect(liste).toHaveLength(2);
      expect(liste[0]).toContain('photo-0');
      expect(liste[1]).toContain('photo-1');
    });

    it('listFotos gibt leeres Array wenn kein Foto existiert', async () => {
      expect(await svc.listFotos('leer')).toEqual([]);
    });

    it('loescheFoto entfernt Datei', async () => {
      const img = new Uint8Array([1, 2, 3]);
      const pfad = await svc.uploadFoto('del', img, 'image/png');
      await svc.loescheFoto(pfad);
      expect(mockFs.has(pfad)).toBe(false);
    });
  });

  describe('mit LFS-Client (offline-first)', () => {
    let mockLfs: LfsClient & {
      stagedCalls: Array<{ data: Uint8Array }>;
      _flushed: boolean;
    };

    beforeEach(() => {
      mockLfs = {
        stagedCalls: [],
        _flushed: false,
        // stageBinary: lokal stagen in IndexedDB, kein Server-Kontakt
        stageBinary: vi.fn(async (data: Uint8Array) => {
          mockLfs.stagedCalls.push({ data });
          // Simuliere lokale Hash-Berechnung
          const hash = await crypto.subtle.digest('SHA-256', data as BufferSource);
          const hashArray = Array.from(new Uint8Array(hash));
          const oid = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          return { oid, size: data.length };
        }),
        flushPending: vi.fn(async () => {
          // Simuliere Upload aller ausstehenden Binaries zum LFS-Server
          mockLfs._flushed = true;
        }),
        hasPending: vi.fn(() => !mockLfs._flushed),
        upload: vi.fn(),
        download: vi.fn(),
        getCached: vi.fn((_path: string) => {
          // Nach IndexedDB-Änderung: Cache ist in-memory nur für Vorschau
          // Mock gibt das letzte gestagte Binary zurück
          const last = mockLfs.stagedCalls[mockLfs.stagedCalls.length - 1];
          return last ? last.data : undefined;
        }),
        setCached: vi.fn(),
        removeCached: vi.fn(),
        clearCache: vi.fn(),
        configure: vi.fn(),
        getConfig: vi.fn(),
        computePointerInfo: vi.fn()
      } as any;
      svc.setLfsClient(mockLfs);
    });

    it('uploadFoto schreibt LFS-Pointer statt Binary (offline-first)', async () => {
      const img = new Uint8Array(2048).fill(0xab);
      const pfad = await svc.uploadFoto('big', img, 'image/png');
      // Der Pfad enthält den Pointer-Text, nicht das Binary
      const content = await fs.readFile(pfad);
      expect(content).toContain('version https://git-lfs.github.com/spec/v1');
      expect(content).toMatch(/oid sha256:[a-f0-9]{64}/);
      expect(content).toContain('size 2048');
    });

    it('uploadFoto ruft stageBinary auf (kein sofortiger Server-Upload)', async () => {
      const img = new Uint8Array([1, 2, 3]);
      await svc.uploadFoto('test', img, 'image/png');
      // stageBinary wird aufgerufen — kein Server-Kontakt!
      expect(mockLfs.stageBinary).toHaveBeenCalledWith(img);
    });

    it('lädt einen Pointer aus dem LFS-Server, wenn das Binary nicht lokal gecacht ist', async () => {
      const img = new Uint8Array([4, 5, 6]);
      const pfad = await svc.uploadFoto('remote', img, 'image/png');
      mockLfs.getCached = vi.fn().mockReturnValue(undefined);
      mockLfs.readStagedBinary = vi.fn().mockResolvedValue(null);
      mockLfs.download = vi.fn().mockResolvedValue(img);

      await expect(svc.ladeFoto(pfad)).resolves.toEqual({
        data: img,
        mimeType: 'image/png'
      });
      expect(mockLfs.download).toHaveBeenCalledWith(
        expect.objectContaining({ size: img.length }),
        pfad
      );
    });

    it('loescheFoto ruft LfsClient.removeCached auf', async () => {
      const img = new Uint8Array(2048);
      const pfad = await svc.uploadFoto('del', img, 'image/png');
      await svc.loescheFoto(pfad);
      expect(mockLfs.removeCached).toHaveBeenCalledWith(pfad);
      expect(mockFs.has(pfad)).toBe(false);
    });
  });
});
