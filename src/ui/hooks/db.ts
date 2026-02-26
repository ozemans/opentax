import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { TaxInput } from '../../engine/types';

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

export interface OpenTaxDB extends DBSchema {
  returns: {
    key: string;
    value: {
      id: string;
      label: string;
      input: TaxInput;
      updatedAt: Date;
      version: number;
    };
    indexes: {
      'by-updatedAt': Date;
    };
  };
}

const DB_NAME = 'opentax';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OpenTaxDB>> | null = null;

/**
 * Get or create the IndexedDB database instance (singleton).
 */
export async function getDB(): Promise<IDBPDatabase<OpenTaxDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OpenTaxDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('returns', { keyPath: 'id' });
        store.createIndex('by-updatedAt', 'updatedAt');
      },
    });
  }
  return dbPromise;
}
