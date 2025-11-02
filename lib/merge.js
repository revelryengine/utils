/**
 * Merges multiple objects into one.
 * @module
 */

/**
 * Like Object.assign but deep
 *
 * Returns the target object.
 *
 * @template {{ [key: string]: any }[]} T - Array of object types to merge
 * @param {T} sources The source object from which to copy properties.
 * @returns {(T[number] extends any ? (k: T[number]) => void : never) extends ((k: infer I) => void) ? I : never} - The merged object.
 */
export function merge(...sources) {
    const [target, ...rest] = sources;

    for (const source of rest) {
        if (source) {
            for (const [key, val] of Object.entries(source)) {
                if (val !== null && typeof val === 'object') {
                    if (target[key] === undefined) {
                        target[key] = Object.create(Object.getPrototypeOf(val));
                    }
                    merge(target[key], val);
                } else {
                    target[key] = val;
                }
            }
        }
    }
    return /** @type {(T[number] extends any ? (k: T[number]) => void : never) extends ((k: infer I) => void) ? I : never} */(target);
}
