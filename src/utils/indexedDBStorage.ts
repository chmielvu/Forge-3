
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
  
  async init() {
    this.db = await openDB<ForgeDB>('forge-loom-db', 1, {
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
  }
  
  async saveGameState(key: string, data: any) {
    if (!this.db) await this.init();
    await this.db!.put('game-state', data, key);
  }
  
  async loadGameState(key: string) {
    if (!this.db) await this.init();
    return await this.db!.get('game-state', key);
  }
  
  async saveGraphState(key: string, graphData: any) {
    if (!this.db) await this.init();
    await this.db!.put('graph-state', graphData, key);
  }
  
  async loadGraphState(key: string) {
    if (!this.db) await this.init();
    return await this.db!.get('graph-state', key);
  }
  
  async cacheMedia(id: string, type: 'image' | 'audio', data: string) {
    if (!this.db) await this.init();
    await this.db!.put('media-cache', {
      id,
      type,
      data,
      timestamp: Date.now()
    });
  }
  
  async getMediaCache(id: string) {
    if (!this.db) await this.init();
    return await this.db!.get('media-cache', id);
  }
  
  async clearOldMedia(maxAge: number = 7 * 24 * 60 * 60 * 1000) {
    if (!this.db) await this.init();
    const threshold = Date.now() - maxAge;
    const tx = this.db!.transaction('media-cache', 'readwrite');
    const index = tx.store.index('by-timestamp');
    
    for await (const cursor of index.iterate()) {
      if (cursor.value.timestamp < threshold) {
        await cursor.delete();
      }
    }
  }
  
  async exportFullState() {
    if (!this.db) await this.init();
    
    const gameState = await this.db!.getAll('game-state');
    const graphState = await this.db!.getAll('graph-state');
    
    return {
      gameState,
      graphState,
      exportedAt: new Date().toISOString()
    };
  }
  
  async importFullState(data: any) {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(['game-state', 'graph-state'], 'readwrite');
    
    for (const [key, value] of Object.entries(data.gameState || {})) {
      await tx.objectStore('game-state').put(value, key);
    }
    
    for (const [key, value] of Object.entries(data.graphState || {})) {
      await tx.objectStore('graph-state').put(value, key);
    }
    
    await tx.done;
  }
}

export const forgeStorage = new ForgeStorageManager();

// Zustand middleware adapter
export const createIndexedDBStorage = () => ({
  getItem: async (name: string): Promise<string | null> => {
    const data = await forgeStorage.loadGameState(name);
    return data ? JSON.stringify(data) : null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const data = JSON.parse(value);
    await forgeStorage.saveGameState(name, data);
  },
  removeItem: async (name: string): Promise<void> => {
    // Implement if needed
  }
});
