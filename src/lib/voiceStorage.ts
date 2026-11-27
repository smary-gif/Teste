const DB_NAME = 'ct_voice_db_v1';
const STORE_NAME = 'scene_voices';

const memoryFallback = new Map<string, Blob>();

function openVoiceDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSceneVoice(sceneId: string, blob: Blob): Promise<void> {
  memoryFallback.set(sceneId, blob);
  const db = await openVoiceDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, sceneId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function deleteSceneVoice(sceneId: string): Promise<void> {
  memoryFallback.delete(sceneId);
  const db = await openVoiceDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(sceneId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadAllSceneVoices(): Promise<Record<string, Blob>> {
  const out: Record<string, Blob> = {};
  memoryFallback.forEach((blob, key) => {
    out[key] = blob;
  });

  const db = await openVoiceDb();
  if (!db) return out;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (typeof cursor.key === 'string' && cursor.value instanceof Blob) {
            out[cursor.key] = cursor.value;
            memoryFallback.set(cursor.key, cursor.value);
          }
          cursor.continue();
        } else {
          db.close();
          resolve(out);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(out);
      };
    } catch {
      db.close();
      resolve(out);
    }
  });
}
