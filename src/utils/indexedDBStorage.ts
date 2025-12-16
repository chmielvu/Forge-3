
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

  async saveGameState(key: string, data: any) {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.put('game-state', data, key);
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to save game state ${key}:`, error);
    }
  }
  
  async loadGameState(key: string) {
    const db = await this.getDb();
    if (!db) return null;
    try {
      return await db.get('game-state', key);
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to load game state ${key}:`, error);
      return null;
    }
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
  
  async loadGraphState(key: string) {
    const db = await this.getDb();
    if (!db) return null;
    try {
      return await db.get('graph-state', key);
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to load graph state ${key}:`, error);
      return null;
    }
  }
  
  async cacheMedia(id: string, type: 'image' | 'audio', data: string) {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.put('media-cache', {
        id,
        type,
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to cache media ${id}:`, error);
    }
  }
  
  async getMediaCache(id: string) {
    const db = await this.getDb();
    if (!db) return null;
    try {
      return await db.get('media-cache', id);
    } catch (error) {
      console.error(`[ForgeStorageManager] Failed to get media cache ${id}:`, error);
      return null;
    }
  }
  
  async clearOldMedia(maxAge: number = 7 * 24 * 60 * 60 * 1000) {
    const db = await this.getDb();
    if (!db) return;
    try {
      const threshold = Date.now() - maxAge;
      const tx = db.transaction('media-cache', 'readwrite');
      const index = tx.store.index('by-timestamp');
      
      for await (const cursor of index.iterate()) {
        if (cursor.value.timestamp < threshold) {
          await cursor.delete();
        }
      }
      await tx.done;
    } catch (error) {
      console.error("[ForgeStorageManager] Failed to clear old media:", error);
    }
  }
  
  async exportFullState() {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const gameState = await db.getAll('game-state');
      const graphState = await db.getAll('graph-state');
      
      return {
        gameState,
        graphState,
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("[ForgeStorageManager] Failed to export full state:", error);
      return null;
    }
  }
  
  async importFullState(data: any) {
    const db = await this.getDb();
    if (!db) return;
    try {
      const tx = db.transaction(['game-state', 'graph-state'], 'readwrite');
      
      if (data.gameState) {
        for (const [key, value] of Object.entries(data.gameState)) {
          await tx.objectStore('game-state').put(value, key);
        }
      }
      
      if (data.graphState) {
        for (const [key, value] of Object.entries(data.graphState)) {
          await tx.objectStore('graph-state').put(value, key);
        }
      }
      
      await tx.done;
    } catch (error) {
      console.error("[ForgeStorageManager] Failed to import full state:", error);
    }
  }
}

export const forgeStorage = new ForgeStorageManager();

// Zustand middleware adapter
export const createIndexedDBStorage = () => ({
  getItem: async (name: string): Promise<string | null> => {
    try {
      const data = await forgeStorage.loadGameState(name);
      return data ? JSON.stringify(data) : null;
    } catch (error) {
      console.error(`[createIndexedDBStorage] getItem failed for ${name}:`, error);
      return null; // Return null to prevent app crash
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const data = JSON.parse(value); // Ensure value is parseable
      await forgeStorage.saveGameState(name, data);
    } catch (error) {
      console.error(`[createIndexedDBStorage] setItem failed for ${name}:`, error);
      // Do not re-throw, fail gracefully
    }
  },
  removeItem: async (name: string): Promise<void> => {
    // Implement if needed
  }
});