/**
 * @typedef {WeakMap<WeakKey, WeakCollection>} WeakCollection
 */

/**
 * A WeakCache is similar to a WeakMap with added convenience.
 *
 * Calling ensure will create a new empty object for the given keys IF it does not already exist.
 *
 * This allows short-circuit logic to added new items to the cache.
 *
 * @example
 * ```js
 * const cache = new WeakCache();
 *
 * const key = {}; //any WeakKey
 *
 * const obj = cache.ensure(key, () => ({
 *  foo: someLongProcess() //this only runs if the cache is not already set
 * }));
 * ```
 *
 * A WeakCache accepts many keys which allows you to create caches for a sequence of keys.
 *
 * @example
 * ```js
 * const cache = new WeakCache();
 *
 * const keyA = {};
 * const keyB = {};
 *
 * const obj = cache.ensure(keyA, keyB, () => ({}));
 * ```
 *
 *
 * For additional convenience the set method returns the value provided which allows allows for an alternative pattern. This does not allow for short-circuit logic so should be used with this in mind.
 * @example
 * ```js
 * const cache = new WeakCache();
 *
 * const keyA = {};
 * const keyB = {};
 *
 * const obj = cache.set(keyA, keyB, { foo: 'bar' });
 *
 * assert(obj.foo === 'bar');
 * ```
 *
 * @template T
 */
export class WeakCache {
    /**  @type {WeakCollection} */
    #collection = new WeakMap();

    /** @type {WeakMap<WeakCollection, T>} */
    #cache = new WeakMap();

    /**
     * Creates a cache object for the given keys if it does not already exist
     * @param {[WeakKey, ...WeakKey[], (keys: WeakKey[]) => T]} keysAndCallback
     */
    ensure(...keysAndCallback) {
        const callback =  /** @type {(keys: WeakKey[]) => T} */(keysAndCallback.pop());

        let collection = this.#collection;
        for(const key of keysAndCallback) {
            collection = /** @type {WeakCollection} */(collection.get(key) ?? collection.set(key, new WeakMap()).get(key));
        }
        return /** @type {T} */(this.#cache.get(collection) ?? this.#cache.set(collection, callback(keysAndCallback)).get(collection));
    }

    /**
     * Retrieves the cached value for the given keys
     * @param {[WeakKey, ...WeakKey[]]} keys
     */
    get(...keys) {
        /** @type {WeakCollection | undefined} */
        let collection = this.#collection;
        for(const key of keys) {
            collection = /** @type {WeakCollection | undefined} */(collection.get(key));
            if(!collection) return;
        }
        return this.#cache.get(collection);
    }

    /**
     * Deletes the cached value for the given keys
     * @param {[WeakKey, ...WeakKey[]]} keys
     */
    delete(...keys) {
        const last = /** @type {WeakKey} */(keys.pop());

        /** @type {WeakCollection | undefined} */
        let collection = this.#collection;
        for(const key of keys) {
            collection = /** @type {WeakCollection | undefined} */(collection.get(key));
            if(!collection) return false;
        }
        const key = collection.get(last);
        if(!key) return false;

        collection.delete(last);
        return this.#cache.delete(key);
    }

    /**
     * Checks if a cache object exists for the given keys
     * @param {[WeakKey, ...WeakKey[]]} keys
     */
    has(...keys) {
        /** @type {WeakCollection | undefined} */
        let collection = this.#collection;
        for(const key of keys) {
            collection = /** @type {WeakCollection | undefined} */(collection.get(key));
            if(!collection) return false;
        }
        return this.#cache.has(collection);
    }

    /**
     * Sets a cache object for the given keys
     * @param {[WeakKey, ...WeakKey[], T]} keysAndValue
     */
    set(...keysAndValue) {
        const value = /** @type {T} */(keysAndValue.pop());

        let collection = this.#collection;
        for(const key of /** @type {WeakKey[]} */(keysAndValue)) {
            collection = /** @type {WeakCollection} */(collection.get(key) ?? collection.set(key, new WeakMap()).get(key));
        }

        this.#cache.set(collection, value);
        return value;
    }
}
