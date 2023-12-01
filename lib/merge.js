/**
 * Like Object.assign but deep
 *
 * Returns the target object.
 *
 * @template {object} T
 * @template U
 * @overload
 * @param {T} target The target object to copy to.
 * @param {U} source1 The source object from which to copy properties.
 * @return {T & U}
 *
 * @template {object} T
 * @template U
 * @template V
 * @overload
 * @param {T} target The target object to copy to.
 * @param {U} source1 The first source object from which to copy properties.
 * @param {V} source2 The second source object from which to copy properties.
 * @return {T & U & V}
 *
 * @template {object} T
 * @template U
 * @template V
 * @template W
 * @overload
 * @param {T} target The target object to copy to.
 * @param {U} source1 The first source object from which to copy properties.
 * @param {V} source2 The second source object from which to copy properties.
 * @param {W} source3 The third source object from which to copy properties.
 * @return {T & U & V & W}
 *
 * @param {{[key: string]: any}} target The target object to copy to.
 * @param {...any} sources The source object from which to copy properties.
 */
export function merge(target, ...sources) {
    for(const source of sources) {
        if(source) {
            for (const [key, val] of Object.entries(source)) {
                if (val !== null && typeof val === 'object') {
                    if (target[key] === undefined) {
                        target[key] = new val.__proto__.constructor();
                    }
                    merge(target[key], val);
                } else {
                    target[key] = val;
                }
            }
        }
    }
    return target;
}
