// WebShot IndexedDB Storage
// High-capacity local storage for large multi-chunk full-page screenshots

const DB_NAME = 'WebShotDB';
const DB_VERSION = 1;
const STORE_NAME = 'captures';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const WebShotStorage = {
  async saveCapture(captureData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(captureData);
      request.onsuccess = () => resolve(captureData.id);
      request.onerror = () => reject(request.error);
    });
  },

  async getCapture(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteCapture(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async cleanupOld(maxItems = 10) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAllKeys();
      request.onsuccess = () => {
        const keys = request.result;
        if (keys.length > maxItems) {
          const deleteCount = keys.length - maxItems;
          for (let i = 0; i < deleteCount; i++) {
            store.delete(keys[i]);
          }
        }
      };
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
  }
};

// Export for module/worker environments or global window
if (typeof self !== 'undefined') {
  self.WebShotStorage = WebShotStorage;
}
if (typeof window !== 'undefined') {
  window.WebShotStorage = WebShotStorage;
}
