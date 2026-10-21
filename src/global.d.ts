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
