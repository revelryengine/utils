/**
 * JSDoc types lack a non-null assertion.
 * https://github.com/Microsoft/TypeScript/issues/23405#issuecomment-873331031
 *
 * @template T
 * @param {T} value
 */
export function NonNull(value) {
    // Use `==` to check for both null and undefined
    if (value == null) throw new Error(`Unexpected null or undefined.`);
    return value;
}
