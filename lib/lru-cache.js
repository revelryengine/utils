/**
 * LRU Cache utility.
 * @module
 */

/**
 * @typedef {object} PersistHandler - Interface for persistence operations.
 * @property {(key: string) => void} get - Retrieves a value by key.
 * @property {(key: string, value: unknown) => void} put - Stores a value by key.
 * @property {(key: string) => void} delete - Deletes a value by key.
 */
/**
 * A simple Least Recently Used (LRU) cache implementation with optional persistence support.
 *
 * When the cache reaches its capacity, the least recently used item is evicted.
 * If a `PersistHandler` is provided, cache operations will be mirrored to the persistence layer.
 *
 * Example usage:
 * ```js
 * const cache = new LRUCache({ capacity: 3 });
 * cache.put('a', 1);
 * cache.put('b', 2);
 * cache.put('c', 3);
 * console.log(cache.get('a')); // 1
 * cache.put('d', 4); // Evicts 'b'
 * console.log(cache.has('b')); // false
 * ```
 *
 * @template [T=unknown] - The type of values stored in the cache.
 */
export class LRUCache {
    #persist;

    /**
     * Creates an instance of LRUCache.
     * @param {object} options - Configuration options for the cache.
     * @param {number} options.capacity - The maximum number of items the cache can hold.
     * @param {Array<[string, T]>} [options.entries] - Initial entries to populate the cache.
     * @param {PersistHandler} [options.persist] - Optional persistence handler for cache operations.
     */
    constructor({ capacity, entries, persist }) {
        /**
         * The internal cache storage.
         * @type {Map<string, T>}
         */
        this.cache = new Map();

        /**
         * The maximum number of items the cache can hold.
         * @type {number}
         */
        this.capacity = capacity;

        this.#persist = persist;

        if (entries) {
            for (const [key, value] of entries) {
                this.cache.set(key, value);
            }
        }
    }

    /**
     * Retrieves a value from the cache.
     * @param {string} key - The key of the value to retrieve.
     */
    get(key) {
        if (!this.cache.has(key)) return null;

        const val = /** @type {T} */(this.cache.get(key));

        this.cache.delete(key);
        this.cache.set(key, val);

        this.#persist?.get(key);

        return val;
    }

    /**
     * Adds or updates a value in the cache.
     * @param {string} key - The key of the value to add or update.
     * @param {T} value - The value to add or update.
     */
    put(key, value) {
        this.cache.delete(key);

        if (this.cache.size === this.capacity) {
            const first = /** @type {string} */(this.cache.keys().next().value);
            this.cache.delete(first);
            this.#persist?.delete(first);
            this.cache.set(key, value);
        } else {
            this.cache.set(key, value);
        }

        this.#persist?.put(key, value);
    }

    /**
     * Removes a value from the cache.
     * @param {string} key - The key of the value to remove.
     */
    delete(key) {
        this.cache.delete(key);
        this.#persist?.delete(key);
    }

    /**
     * Checks if a key exists in the cache.
     * @param {string} key - The key to check.
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Gets the least recently used (LRU) key in the cache.
     */
    getLeastRecent() {
        return Array.from(this.cache)[0];
    }

    /**
     * Gets the most recently used (MRU) key in the cache.
     */
    getMostRecent() {
        return Array.from(this.cache)[this.cache.size - 1];
    }

    // deno-coverage-ignore-start - Not yet supported in Deno: https://github.com/denoland/deno/issues/1699
    /**
     * Creates an `LRUCache` instance backed by IndexedDB for persistence.
     *
     * The cache will store its entries in an object store named 'cache' within the specified database.
     * Each entry will have a key, value, and an 'accessed' timestamp to track usage for LRU eviction.
     * When an entry is accessed or added, its 'accessed' timestamp is updated.
     *
     * When the cache is loaded, it retrieves all existing entries from IndexedDB to populate the cache in memory.
     *
     * @example
     * ```js
     * const cache = await LRUCache.fromIndexedDB(100, 'my-cache-db');
     * await cache.put('key1', { data: 'value1' });
     * const value = await cache.get('key1');
     * console.log(value); // { data: 'value1' }
     * ```
     * @param {number} capacity - The maximum number of items the cache can hold.
     * @param {string} name - The name of the IndexedDB database to use for persistence.
     * @param {number} [version] - The version of the IndexedDB database.
     */
    static async fromIndexedDB(capacity, name, version = 1) {
        const { db, entries } = await new Promise((resolve) => {
            const db = indexedDB.open(name, version);

            db.onupgradeneeded = () => {
                const store = db.result.createObjectStore('cache', { keyPath: 'key' });
                store.createIndex('accessed', 'accessed', { unique:false });
            };

            // db.onerror = () => reject(`Failed to open IndexedDB: ${name}`);

            db.onsuccess = () => {
                const tx      = db.result.transaction('cache', 'readonly');
                const store   = tx.objectStore('cache');
                const index   = store.index('accessed');
                const request = index.openCursor();

                const entries = /** @type {[string, unknown][]} */([]);

                // request.onerror   = () => reject('Failed to get entries from cache');
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (cursor) {
                        entries.push([cursor.value.key, cursor.value.value]);
                        cursor.continue();
                    } else {
                        resolve({ db: db.result, entries });
                    }
                };
            };
        });

        return new LRUCache({
            capacity,
            entries,
            persist: {
                get: (key) => {
                    const tx    = db.transaction('cache', 'readwrite');
                    const store = tx.objectStore('cache');

                    const request = store.get(key)

                    request.onsuccess = () => {
                        const record = request.result;
                        if (record) {
                            store.put({ ...record, accessed: Date.now() });
                        }
                    };
                },
                put: (key, value) => {
                    const tx    = db.transaction('cache', 'readwrite');
                    const store = tx.objectStore('cache');

                    store.put({ key, value, accessed: Date.now() });
                },
                delete: (key) => {
                    const tx      = db.transaction('cache', 'readwrite');
                    const store   = tx.objectStore('cache');

                    store.delete(key);
                }
            }
        });
    }
    // deno-coverage-ignore-stop
}
