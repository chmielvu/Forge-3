import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ForgeDB extends DBSchema {
  'game-state': {
    key: string;
    value: any;
  };
  'graph-state': {
    key: string;
    value: any;
  };
  'media-cache': {
    key: string;
    value: {
      id: string;
      type: 'image' | 'audio';
      data: string;
      timestamp: number;
    };
    indexes: { 'by-type': string; 'by-timestamp': number };
  };
}

// @google/genai: Implement the Storage interface for zustand's persist middleware compatibility
// FIX: Removed "implements Storage" as IndexedDB operations are asynchronous and do not conform to the synchronous Web Storage API.
// Zustand's persist middleware supports custom async storage objects without this explicit interface.
class ForgeStorageManager {
  private db: IDBPDatabase<ForgeDB> | null = null;
  private dbPromise: Promise<IDBPDatabase<ForgeDB>> | null = null;

  async init() {
    if (this.dbPromise) return this.dbPromise; // Return existing promise if already initializing
    
    this.dbPromise = openDB<ForgeDB>('forge-loom-db', 1, {
      upgrade(db: IDBPDatabase<ForgeDB>) {
        if (!db.objectStoreNames.contains('game-state')) {
          db.createObjectStore('game-state');
        }
        if (!db.objectStoreNames.contains('graph-state')) {
          db.createObjectStore('graph-state');
        }
        if (!db.objectStoreNames.contains('media-cache')) {
          const mediaStore = db.createObjectStore('media-cache', { keyPath: 'id' });
          mediaStore.createIndex('by-type', 'type');
          mediaStore.createIndex('by-timestamp', 'timestamp');
        }
      }
    });

    try {
      this.db = await this.dbPromise;
      return this.db;
    } catch (error) {
      console.error("[ForgeStorageManager] Failed to open IndexedDB:", error);
      this.db = null; // Ensure db is null on failure
      this.dbPromise = null; // Reset promise to allow re-init on next call
      throw error; // Re-throw to propagate the error
    }
  }
  
  // Helper to ensure DB is initialized before operations
  private async getDb(): Promise<IDBPDatabase<ForgeDB> | null> {
    if (!this.db) {
      try {
        await this.init(); // Attempt to initialize if not already
      } catch (e) {
        return null; // Initialization failed
      }
    }
    return this.db;
  }

  // --- Methods implementing the Web Storage API interface (for zustand's persist middleware) ---

  // @google/genai: Implements Storage.getItem for zustand's persist middleware
  async getItem(key: string): Promise<string | null> {
    const db = await this.getDb();
    if (!db) return JSON.stringify({}); // FIX: Return empty JSON on DB error
    try {
      const data = await db.get('game-state', key);
      return data ? JSON.stringify(data) : JSON.stringify({}); // FIX: Return empty JSON if no data, or on parse error
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to get item ${key}:`, error);
      return JSON.stringify({}); // FIX: Return empty JSON string to prevent rehydration failure
    }
  }
  
  // @google/genai: Implements Storage.setItem for zustand's persist middleware
  async setItem(key: string, value: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      const data = JSON.parse(value);
      await db.put('game-state', data, key);
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to set item ${key}:`, error);
    }
  }
  
  // @google/genai: Implements Storage.removeItem for zustand's persist middleware
  async removeItem(key: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.delete('game-state', key);
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to remove item ${key}:`, error);
    }
  }

  // --- Custom methods for game-state and graph-state specific to this application ---
  // These are *not* part of the standard `Storage` interface but are used by gameStore.ts directly.

  async saveGameState(key: string, data: any) {
    // This calls the `setItem` method which handles the 'game-state' object store
    await this.setItem(key, JSON.stringify(data));
  }
  
  async loadGameState(key: string): Promise<any | null> {
    // This calls the `getItem` method, then parses the JSON
    const data = await this.getItem(key);
    return data ? JSON.parse(data) : null;
  }
  
  async saveGraphState(key: string, graphData: any) {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.put('graph-state', graphData, key);
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to save graph state ${key}:`, error);
    }
  }
  
  async loadGraphState(key: string): Promise<any | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      return await db.get('graph-state', key);
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to load graph state ${key}:`, error);
      return null;
    }
  }

  // --- Properties and methods required by the Storage interface but not typically used for IndexedDB ---

  // @google/genai: Implements Storage.length (stubbed as it's not practical for IndexedDB)
  get length(): number {
    console.warn("Storage.length not actively maintained for IndexedDB custom storage.");
    return 0; // Not a useful metric for IDB
  }

  // @google/genai: Implements Storage.key(index) (stubbed)
  key(index: number): string | null {
    console.warn("Storage.key(index) not actively maintained for IndexedDB custom storage.");
    return null; // Not practical for IDB
  }
  
  // @google/genai: Implements Storage.clear() (stubbed to prevent accidental full wipe)
  clear(): void {
    console.warn("Storage.clear() is not implemented to prevent accidental full wipe. Use specific removeItem for game-state, and clear other object stores explicitly.");
    // To clear all data in 'game-state', one would need to iterate and delete.
    // To clear other stores, explicitly call `db.clear('store-name')`.
  }
}

// @google/genai: Export a single instance of the storage manager
export const forgeStorage = new ForgeStorageManager();

// @google/genai: Export a factory function that returns the forgeStorage instance for zustand's createJSONStorage
// FIX: The returned object should conform to Zustand's PersistStorage, which allows async methods.
// By omitting 'length', 'key', and 'clear', it implicitly satisfies the requirements for an async storage object.
export const createIndexedDBStorage = (): {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
} => forgeStorage;