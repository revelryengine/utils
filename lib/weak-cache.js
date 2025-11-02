/**
 * WeakCache utility module for caching values with weakly held keys.
 * @module
 */

/**
 * A WeakCache is similar to a WeakMap with added convenience.
 *
 * Calling ensure will create a new empty object for the given keys only IF it does not already exist.
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
 * @template T - The type of the cached values.
 */
export class WeakCache {
    /**
     * @typedef {WeakMap<WeakKey, WeakCollection>} WeakCollection
     */

    /**  @type {WeakCollection} */
    #collection = new WeakMap();

    /** @type {WeakMap<WeakCollection, T>} */
    #cache = new WeakMap();

    /**
     * Creates a cache object for the given keys only and calls the callback to create the object IF it does not already exist.
     * @param {[WeakKey, ...WeakKey[], () => T]} keysAndCallback - The keys to cache and a callback to create the cache object.
     */
    ensure(...keysAndCallback) {
        const callback =  /** @type {() => T} */(keysAndCallback.pop());

        let collection = this.#collection;
        for (const key of keysAndCallback) {
            collection = /** @type {WeakCollection} */(collection.get(key) ?? collection.set(key, new WeakMap()).get(key));
        }
        return /** @type {T} */(this.#cache.get(collection) ?? this.#cache.set(collection, callback()).get(collection));
    }

    /**
     * Retrieves the cached value for the given keys
     * @param {[WeakKey, ...WeakKey[]]} keys - The keys to retrieve the cached value for
     */
    get(...keys) {
        /** @type {WeakCollection | undefined} */
        let collection = this.#collection;
        for (const key of keys) {
            collection = /** @type {WeakCollection | undefined} */(collection.get(key));
            if (!collection) return;
        }
        return this.#cache.get(collection);
    }

    /**
     * Deletes the cached value for the given keys
     * @param {[WeakKey, ...WeakKey[]]} keys - The keys to delete the cached value for
     */
    delete(...keys) {
        const last = /** @type {WeakKey} */(keys.pop());

        /** @type {WeakCollection | undefined} */
        let collection = this.#collection;
        for (const key of keys) {
            collection = /** @type {WeakCollection | undefined} */(collection.get(key));
            if (!collection) return false;
        }
        const key = collection.get(last);
        if (!key) return false;

        collection.delete(last);
        return this.#cache.delete(key);
    }

    /**
     * Checks if a cache object exists for the given keys
     * @param {[WeakKey, ...WeakKey[]]} keys - The keys to check for existence
     */
    has(...keys) {
        /** @type {WeakCollection | undefined} */
        let collection = this.#collection;
        for (const key of keys) {
            collection = /** @type {WeakCollection | undefined} */(collection.get(key));
            if (!collection) return false;
        }
        return this.#cache.has(collection);
    }

    /**
     * Sets a cache object for the given keys.
     * @param {[WeakKey, ...WeakKey[], T]} keysAndValue - The keys to set the cache for and the value to cache
     */
    set(...keysAndValue) {
        const value = /** @type {T} */(keysAndValue.pop());

        let collection = this.#collection;
        for (const key of /** @type {WeakKey[]} */(keysAndValue)) {
            collection = /** @type {WeakCollection} */(collection.get(key) ?? collection.set(key, new WeakMap()).get(key));
        }

        this.#cache.set(collection, value);
        return value;
    }
}
