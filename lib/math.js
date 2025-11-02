/**
 * @import { Vec2Like } from '../deps/gl-matrix.js';
 */

/**
 * Math utility functions and constants
 * @module
 */

const PI      = Math.PI;
const TWO_PI  = 2 * Math.PI;
const EPSILON = 0.000001;

/**
 * @typedef {(v: number) => number} Normalizer - A function that normalizes a number
 */

/**
 * Normalizer types corresponding to WebGL data types
 */
export const NORMALIZER_TYPES = /** @type {const} */({
    /** WebGL2RenderingContext.FLOAT */
    FLOAT          : 0x1406,
    /** WebGL2RenderingContext.BYTE */
    BYTE           : 0x1400,
    /** WebGL2RenderingContext.UNSIGNED_BYTE */
    UNSIGNED_BYTE  : 0x1401,
    /** WebGL2RenderingContext.SHORT */
    SHORT          : 0x1402,
    /** WebGL2RenderingContext.UNSIGNED_SHORT */
    UNSIGNED_SHORT : 0x1403,
})

/**
 * Normalizers to convert from Normalized Fixed-Point to Floating-Point
 * @see https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations
 * @see https://registry.khronos.org/vulkan/specs/1.0/html/vkspec.html#fundamentals-fixedfpconv
 * @see https://learn.microsoft.com/en-us/windows/win32/direct3d10/d3d10-graphics-programming-guide-resources-data-conversion?redirectedfrom=MSDN#integer_conversion
 */
export const normalizers = /** @type {const} */({
    /** WebGL2RenderingContext.FLOAT normalizer */
    [NORMALIZER_TYPES.FLOAT]          : /** @type {Normalizer} */v => v,
    /** WebGL2RenderingContext.BYTE normalizer*/
    [NORMALIZER_TYPES.BYTE]           : /** @type {Normalizer} */v => Math.max(v / 127.0, -1.0),
    /** WebGL2RenderingContext.UNSIGNED_BYTE normalizer*/
    [NORMALIZER_TYPES.UNSIGNED_BYTE]  : /** @type {Normalizer} */v => v / 255.0,
    /** WebGL2RenderingContext.SHORT normalizer*/
    [NORMALIZER_TYPES.SHORT]          : /** @type {Normalizer} */v => Math.max(v / 32767.0, -1.0),
    /** WebGL2RenderingContext.UNSIGNED_SHORT normalizer*/
    [NORMALIZER_TYPES.UNSIGNED_SHORT] : /** @type {Normalizer} */v => v / 65535.0,
});

/**
 * Converts a 16 bit float to 32 bit float
 *
 * Original code from toji - https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
 * @param {number} h - The 16 bit float value
 */
export function float16(h) {
    const s = (h & 0x8000) >> 15;
    const e = (h & 0x7C00) >> 10;
    const f = h & 0x03FF;

    if (e == 0) {
        return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
    } else if (e == 0x1F) {
        return f ? NaN : ((s ? -1 : 1) * Infinity);
    }

    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + (f / Math.pow(2, 10)));
}

/**
 * Rounds up to the nearest specified increment
 * @see https://www.w3.org/TR/WGSL/#roundup
 * @param {number} k - The increment to round up to
 * @param {number} n - The number to round up
 * @returns {number}
 */
export function roundUp(k, n) {
    return Math.ceil(n / k) * k;
}

/**
 * Returns the nearest power of 2 rounding up
 * @param {number} v - The value to round up
 */
export function nearestUpperPowerOf2(v) {
    let x = v - 1;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    x += 1;
    return x;
}

/**
 * Modulus with support for negative numbers
 * @param {number} n - The dividend
 * @param {number} m - The divisor
 * @see https://web.archive.org/web/20090717035140if_/javascript.about.com/od/problemsolving/a/modulobug.htm
 */
export function mod(n, m) {
    return ((n % m) + m) % m;
}


/**
 * Less than or equal-ish using defined epsilon
 * @param {number} a - The first number
 * @param {number} b - The second number
 * @param {number} epsilon - The epsilon value
 */
export function lte(a, b, epsilon = EPSILON){
    return a < b || Math.abs(a - b) < epsilon;
}


/**
 * Normalizes an angle to be between 0 and 2 PI
 * @param {number} a - The angle in radians
 */
export function normalizeAngle(a){
    return (a + TWO_PI) % TWO_PI;
}

/**
 * Converts an angle from radians to degrees
 * @param {number} r - The angle in radians
 */
export function rad2Deg(r) {
    return r * 180 / Math.PI;
}

/**
 * Converts an angle from degrees to radians
 * @param {number} d - The angle in degrees
 */
export function deg2Rad(d) {
    return d * Math.PI / 180;
}

/**
 * Compares two angles in radians and returns the difference
 * @param {number} a - The first angle
 * @param {number} b - The second angle
 */
export function angleDiff(a, b){
    return mod(a - b + PI, TWO_PI) - PI;
}

/**
 * Compares two angles in degrees and returns the difference
 * @param {number} a - The first angle
 * @param {number} b - The second angle
 */
export function angleDiffDeg(a, b) {
    return mod(a - b + 180, 360) - 180;
}

/**
 * Compares an angle in radians to two other angles to determine if it lies between the two angles
 * @param {number} n - The angle to check
 * @param {number} a - The first angle
 * @param {number} b - The second angle
 */
export function angleIsBetween(n, a, b){
    n = normalizeAngle(n);
    a = normalizeAngle(a);
    b = normalizeAngle(b);

    if (lte(a, b))
        return lte(a, n) && lte(n, b);
    return lte(a, n) || lte(n, b);
}

/**
 * Takes two 2d vectors and returns the angle between them including the sign
 * @param {Vec2Like} a - The first vector
 * @param {Vec2Like} b - The second vector
 */
export function signedAngle([x1, y1], [x2, y2]){
    return Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2);
}

/**
 * Clamps a number between a minimum and maximum value
 * @param {number} number - The number to clamp
 * @param {number} min - The minimum value
 * @param {number} max - The maximum value
 */
export function clamp(number, min, max) {
    return Math.max(min, Math.min(number, max));
}
