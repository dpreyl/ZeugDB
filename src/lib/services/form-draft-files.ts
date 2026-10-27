export interface DraftFileRecord {
  key: string;
  draftKey: string;
  fieldName: string;
  name: string;
  type: string;
  lastModified: number;
  index?: number;
  data: Blob;
}

export interface DraftFileAdapter {
  put(record: DraftFileRecord): Promise<void>;
  getAll(): Promise<DraftFileRecord[]>;
  delete(key: string): Promise<void>;
}

export function createFormDraftFiles(adapter: DraftFileAdapter) {
  return {
    async save(draftKey: string, fieldName: string, file: File): Promise<void> {
      await adapter.put({
        key: `${draftKey}:${fieldName}`,
        draftKey,
        fieldName,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        data: file
      });
    },

    async saveMany(draftKey: string, fieldName: string, files: File[]): Promise<void> {
      await this.clear(draftKey, fieldName);
      await Promise.all(files.map((file, index) => adapter.put({
        key: `${draftKey}:${fieldName}:${index}`,
        draftKey,
        fieldName,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        index,
        data: file
      })));
    },

    async load(draftKey: string): Promise<Record<string, File>> {
      const records = await adapter.getAll();
      return Object.fromEntries(records
        .filter(record => record.draftKey === draftKey)
        .map(record => [
          record.fieldName,
          new File([record.data], record.name, {
            type: record.type,
            lastModified: record.lastModified
          })
        ]));
    },

    async loadMany(draftKey: string): Promise<Record<string, File[]>> {
      const records = (await adapter.getAll())
        .filter(record => record.draftKey === draftKey)
        .sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
      const files: Record<string, File[]> = {};
      for (const record of records) {
        (files[record.fieldName] ??= []).push(new File([record.data], record.name, {
          type: record.type,
          lastModified: record.lastModified
        }));
      }
      return files;
    },

    async clear(draftKey: string, fieldName?: string): Promise<void> {
      const records = await adapter.getAll();
      const matching = records.filter(record =>
        record.draftKey === draftKey && (!fieldName || record.fieldName === fieldName)
      );
      await Promise.all(matching.map(record => adapter.delete(record.key)));
    }
  };
}

const DB_NAME = 'ZeugDB.FormDrafts';
const STORE_NAME = 'files';
let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = null;
      reject(request.error);
    };
  });
  return database;
}

const indexedDbAdapter: DraftFileAdapter = {
  async put(record) {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
  },
  async getAll() {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as DraftFileRecord[]);
      request.onerror = () => reject(request.error);
    });
  },
  async delete(key) {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(key);
    await transactionDone(transaction);
  }
};

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const formDraftFiles = createFormDraftFiles(indexedDbAdapter);
