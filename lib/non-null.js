/**
 * JSDoc types lack a non-null assertion.
 * https://github.com/Microsoft/TypeScript/issues/23405#issuecomment-873331031
 *
 * @template T
 * @param {T} value
 * @param {string} [message]
 */
export function NonNull(value, message = 'Unexpected null or undefined.') {
    // Use `==` to check for both null and undefined
    if (value == null) throw new Error(message);
    return value;
}
