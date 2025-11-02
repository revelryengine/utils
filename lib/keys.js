
/**
 * Utilities for working with object keys.
 * @module
 */

/**
 * Convenience function to get the keys of an object as an array and preserve the literal values in TS.
 *
 * @template {{}} T - The type of the object.
 * @param {T} obj - The object to get the keys from.
 * @returns {Array<keyof T>}
 */
export function keys(obj) {
    return /** @type {Array<keyof T>} */(Object.keys(obj));
}
