import type { RepoFs } from '../fs/repo-fs';
import { FotoService } from '../fotos/foto.service';
import { LfsClient, type LfsConfig } from '../fotos/lfs';

/**
 * Reaktiver Store für Foto-Operationen.
 * Wird lazily mit einem RepoFs initialisiert.
 */
export class FotoStore {
  private service: FotoService | null = null;
  private lfs: LfsClient | null = null;
  public fehle = true;

  /**
   * Initialisiert den Store mit einem Dateisystem.
   * Muss vor uploadFoto/listFotos aufgerufen werden.
   */
  async init(fs: RepoFs): Promise<void> {
    this.service = new FotoService(fs);
    this.fehle = false;
  }

  /**
   * Aktiviert Git LFS für Fotos. Nach dem Aufruf werden Uploads als
   * LFS-Pointer ins Git-Repo geschrieben und die Binary-Daten zum
   * LFS-Server hochgeladen.
   */
  async initLfs(config: LfsConfig): Promise<void> {
    this.lfs = new LfsClient();
    this.lfs.configure(config);
    this.service?.setLfsClient(this.lfs);
  }

  /**
   * Lädt ein Foto für ein Asset hoch.
   */
  async uploadFoto(assetId: string, data: Uint8Array, mimeType: string): Promise<string> {
    if (!this.service) throw new Error('FotoStore nicht initialisiert');
    return this.service.uploadFoto(assetId, data, mimeType);
  }

  /**
   * Liest ein Foto und gibt die Binary-Daten mit MIME-Typ zurück.
   */
  async ladeFoto(pfad: string): Promise<{ data: Uint8Array; mimeType: string }> {
    if (!this.service) throw new Error('FotoStore nicht initialisiert');
    return this.service.ladeFoto(pfad);
  }

  /**
   * Listet alle Fotos eines Assets.
   */
  async listFotos(assetId: string): Promise<string[]> {
    if (!this.service) throw new Error('FotoStore nicht initialisiert');
    return this.service.listFotos(assetId);
  }

  /**
   * Löscht ein Foto.
   */
  async loescheFoto(pfad: string): Promise<void> {
    if (!this.service) throw new Error('FotoStore nicht initialisiert');
    return this.service.loescheFoto(pfad);
  }

  /**
   * Lädt alle lokal gestagten LFS-Binaries zum Remote-Server hoch.
   * Wird vor dem Git-Push aufgerufen, damit die Pointer gültig sind.
   * Bereits hochgeladene Binaries werden übersprungen.
   */
  async flushPendingLfs(): Promise<void> {
    if (!this.lfs) return;
    return this.lfs.flushPending();
  }

  /**
   * Gibt true zurück, wenn ausstehende LFS-Uploads vorhanden sind.
   */
  async hasPendingLfs(): Promise<boolean> {
    return this.lfs?.hasPending() ?? false;
  }
}

let _store: FotoStore | null = null;

/**
 * Gibt die Singleton-FotoStore-Instanz zurück.
 */
export function getFotoStore(): FotoStore {
  if (!_store) {
    _store = new FotoStore();
  }
  return _store;
}

/**
 * Reset für Tests.
 */
export function resetFotoStore(): void {
  _store = null;
}
