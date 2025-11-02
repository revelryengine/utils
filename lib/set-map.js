/**
 * SetMap utility module for managing a Map of Sets.
 * @module
 */

/**
 * A SetMap is a Map of Sets.  It provides a convenient way to ensure that a Map contains a
 * Set for each key as items are added.
 *
 * @template K - The type of the keys in the Map.
 * @template T - The type of the values in the Set.
 * @extends {Map<K,Set<T>>}
 */
export class SetMap extends Map {
    /**
     * Ensures that a Set exists at the specified key and adds an item to the Set.
     *
     * @param {K} key - The key of the Set to add the item to.
     * @param {T} item - The item to add to the Set.
     */
    add(key, item) {
        let s = this.get(key);
        if (!s) {
            s = new Set();
            this.set(key, s);
        }
        return s.add(item);
    }

    /**
     * Removes the specified item from the Set at the specified key and removes the Set if it is empty.
     * @override
     * @param {K} key - The key of the Set to remove the item from.
     * @param {T} [item] - The item to remove from the Set.
     * @returns {boolean} Returns true if the item was present and successfully deleted.
     */
    delete(key, item) {
        const s = this.get(key);
        if (!s) return false;

        try {
            return !!item && s.delete(item);
        } finally {
            if (!s.size) super.delete(key);
        }
    }

    /**
     * Returns the number of items in the Set at the specified key.
     * @param {K} key - The key to get the count for.
     */
    count(key) {
        return this.get(key)?.size ?? 0;
    }
}
