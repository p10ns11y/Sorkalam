/**
 * Tamil VU glossary cache (IndexedDB). Shared by service worker and popup.
 * Same extension origin — one database for both contexts.
 */
const GlossaryCacheConfig = {
  dbName: 'sorkalam-glossary-cache',
  dbVersion: 1,
  storeName: 'tamilvu',
  /** Glossary terms change slowly; refresh weekly. */
  ttlMs: 7 * 24 * 60 * 60 * 1000,
  maxEntries: 250,
};

/** @typedef {Object} TamilVuCacheRecord
 * @property {string} cacheKey
 * @property {string} [glossaryPageHtml]
 * @property {{ columns: string[], rows: Record<string, string>[] }} [glossaryTable]
 * @property {{ translationText: string, subjectArea: string, row: Record<string, string> }[]} [glossaryEntries]
 * @property {number} cachedAt
 * @property {number} expiresAt
 */

let dbOpenPromise = null;

function openGlossaryCacheDb() {
  if (!dbOpenPromise) {
    dbOpenPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(
        GlossaryCacheConfig.dbName,
        GlossaryCacheConfig.dbVersion
      );
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(GlossaryCacheConfig.storeName)) {
          const store = db.createObjectStore(GlossaryCacheConfig.storeName, {
            keyPath: 'cacheKey',
          });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbOpenPromise;
}

function buildTamilVuCacheKey(searchWord, glossarySearchColumn) {
  const normalizedWord = String(searchWord).trim().toLowerCase();
  return `tamilvu:${glossarySearchColumn}:${normalizedWord}`;
}

function isExpired(record) {
  return !record || typeof record.expiresAt !== 'number' || record.expiresAt <= Date.now();
}

/**
 * @param {string} cacheKey
 * @returns {Promise<TamilVuCacheRecord|null>}
 */
async function getTamilVu(cacheKey) {
  const db = await openGlossaryCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(GlossaryCacheConfig.storeName, 'readonly');
    const request = transaction.objectStore(GlossaryCacheConfig.storeName).get(cacheKey);
    request.onsuccess = () => {
      const record = request.result;
      resolve(isExpired(record) ? null : record);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Merge into an existing record (or create). Refreshes cachedAt / expiresAt.
 * @param {Partial<TamilVuCacheRecord> & { cacheKey: string }} patch
 */
async function setTamilVu(patch) {
  const existing = (await getTamilVu(patch.cacheKey)) || {};
  const now = Date.now();
  /** @type {TamilVuCacheRecord} */
  const record = {
    ...existing,
    ...patch,
    cacheKey: patch.cacheKey,
    cachedAt: now,
    expiresAt: now + GlossaryCacheConfig.ttlMs,
  };

  const db = await openGlossaryCacheDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(GlossaryCacheConfig.storeName, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(GlossaryCacheConfig.storeName).put(record);
  });

  await pruneTamilVuCache();
  return record;
}

async function deleteTamilVu(cacheKey) {
  const db = await openGlossaryCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(GlossaryCacheConfig.storeName, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(GlossaryCacheConfig.storeName).delete(cacheKey);
  });
}

/** Remove expired rows; cap total size by dropping oldest. */
async function pruneTamilVuCache() {
  const db = await openGlossaryCacheDb();
  const now = Date.now();

  /** @type {TamilVuCacheRecord[]} */
  const allRecords = await new Promise((resolve, reject) => {
    const transaction = db.transaction(GlossaryCacheConfig.storeName, 'readonly');
    const request = transaction.objectStore(GlossaryCacheConfig.storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  const expiredKeys = allRecords
    .filter((record) => isExpired(record))
    .map((record) => record.cacheKey);

  const validRecords = allRecords
    .filter((record) => !isExpired(record))
    .sort((a, b) => a.cachedAt - b.cachedAt);

  const overflowKeys =
    validRecords.length > GlossaryCacheConfig.maxEntries
      ? validRecords
          .slice(0, validRecords.length - GlossaryCacheConfig.maxEntries)
          .map((record) => record.cacheKey)
      : [];

  const keysToDelete = [...new Set([...expiredKeys, ...overflowKeys])];
  if (!keysToDelete.length) return;

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(GlossaryCacheConfig.storeName, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    const store = transaction.objectStore(GlossaryCacheConfig.storeName);
    for (const cacheKey of keysToDelete) {
      store.delete(cacheKey);
    }
  });
}

const GlossaryCache = {
  buildTamilVuCacheKey,
  getTamilVu,
  setTamilVu,
  deleteTamilVu,
  pruneTamilVuCache,
};

if (typeof globalThis !== 'undefined') {
  globalThis.GlossaryCache = GlossaryCache;
}

// Service worker: load via importScripts('glossary-cache.js')
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlossaryCache;
}
