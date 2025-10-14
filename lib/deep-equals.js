const isObject = (/** @type {any} */ o) => o != null && typeof o === 'object';

/**
 * Compares two plain objects for deep equality.
 * This does not handle circular references or compare complex objects like Date, Map, Set, etc.
 *
 * @param {any} a
 * @param {any} b
 */
export function deepEquals(a, b){
    if(a == b) return true;

    if (isObject(a) && isObject(b)) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]); // switch to Set.union when available

        for (const key of keys) {
            if(!deepEquals(a[key], b[key])) return false;
        }
        return true;
    }

    return false;
};
