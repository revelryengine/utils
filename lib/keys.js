
/**
 * Convenience function to get the keys of an object as an array and preserve the literal values.
 *
 * @template {object} T
 * @param {T} obj
 */
export function keys(obj) {
    return /** @type {Array<keyof T>} */(Object.keys(obj));
}
