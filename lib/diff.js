const isObject      = (/** @type {any} */ o) => o != null && typeof o === 'object';
const isEmptyObject = (/** @type {any} */ o) => isObject(o) && (Object.keys(o).length === 0);

/**
 * Modified from https://github.com/mattphillips/deep-object-diff
 * We only need to find additions and changes to the object and not deletions so we can simplify a bit.
 * Empty objects are stripped and treated as no change, as are undefined values.
 * null should be used to unset a value via override.
 *
 * @template {Record<string, any>} T
 * @template {Record<string, any>} U
 * @overload
 * @param {T} a - Object to compare against
 * @param {U} b
 * @return {T & U}
 *
 * @param {any} a
 * @param {any} b
 */
export function diff(a, b) {
    if (a === b || b === undefined) return {};

    if (!isObject(a) || !isObject(b)) return b;

    const result = Object.create(null);

    for(const key of Object.keys(b)) {
        if(isEmptyObject(b[key])) continue;

        const d = diff(Object.hasOwn(a, key) ? a[key] : Object.create(null), b[key]);

        if (!isEmptyObject(d)) {
            result[key] = d;
        }
    }

    return result;
}
