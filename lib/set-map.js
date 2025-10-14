/**
 * A SetMap is a Map of Sets.  It provides a convenient way to ensure that a Map contains a
 * Set for each key as items are added.
 *
 * @template K
 * @template T
 * @extends {Map<K,Set<T>>}
 */
export class SetMap extends Map {
    /**
     * Ensures that a Set exists at the specified key and adds an item to the Set.
     *
     * @param {K} key
     * @param {T} item
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
     *
     * @param {K} key
     * @param {T} [item]
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
     * @param {K} key
     */
    count(key) {
        return this.get(key)?.size ?? 0;
    }
}
