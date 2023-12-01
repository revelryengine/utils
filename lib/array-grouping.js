/**
 * Shim for https://github.com/tc39/proposal-array-grouping
 * @template T
 * @param {Iterable<T>} array
 * @param {(item: T, i?: number) => (string|number)} callback
 * @return {{[key: string|number]: T[]}}
 */
export function groupBy(array, callback) {
    const obj = Object.create(null);

    let i = 0;
    for(const item of array) {
        const key = callback(item, i++);
        obj[key] ??= [];
        obj[key].push(item);
    }
    return obj;
}
