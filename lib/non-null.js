/**
 * Asserts that a value is non-null and non-undefined.
 * @module
 */

/**
 * JSDoc types lack a non-null assertion.
 * https://github.com/Microsoft/TypeScript/issues/23405#issuecomment-873331031
 *
 * @template T - Type of value to assert as non-null
 * @param {T} value - The value to assert as non-null
 * @param {string} [message] - Optional error message if the value is null or undefined
 */
export function NonNull(value, message = 'Unexpected null or undefined.') {
    // Use `==` to check for both null and undefined
    if (value == null) throw new Error(message);
    return value;
}
