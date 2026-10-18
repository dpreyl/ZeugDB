// Type declarations for modules without built-in type definitions

declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: unknown[]): void;
    prepare(sql: string): Statement;
    exec(sql: string): { rows: unknown[][]; values?: unknown[][] }[];
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: unknown[]): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    run(params?: unknown[]): void;
    free(): void;
  }

  export class Database {
    constructor(data?: ArrayBufferView);
    run(sql: string, params?: unknown[]): void;
    prepare(sql: string): Statement;
    exec(sql: string): { rows: unknown[][]; values?: unknown[][] }[];
    export(): Uint8Array;
    close(): void;
  }

  const initSqlJs: (options?: { locateFile?: (path: string) => string; wasmPath?: string }) => Promise<{
    Database: typeof Database;
  }>;
  export default initSqlJs;
}

declare module 'isomorphic-git/lightningfs.js' {
  import type { FsClient } from 'isomorphic-git';
  export class LightningFS implements FsClient {
    constructor(db: IDBDatabase | string);
    init(): Promise<void>;
    mount(): Promise<void>;
    unmount(): Promise<void>;
    writeFile(path: string, data: Uint8Array | string): Promise<void>;
    readFile(path: string): Promise<Uint8Array>;
    readdir(dir: string): Promise<{ name: string; type: string }[]>;
    unlink(path: string): Promise<void>;
    mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
    rmdir(path: string): Promise<void>;
    stat(path: string): Promise<{ size: number; mtime: Date; isFile(): boolean; isDirectory(): boolean }>;
    lstat(path: string): Promise<{ size: number; mtime: Date; isFile(): boolean; isDirectory(): boolean }>;
    chmod?(path: string, mode: number): Promise<void>;
    chown?(path: string, uid: number, gid: number): Promise<void>;
  }
}
