const PI      = Math.PI;
const TWO_PI  = 2 * Math.PI;
const EPSILON = 0.000001;
const GL      = WebGL2RenderingContext;

/** @typedef {GL['FLOAT']|GL['BYTE']|GL['UNSIGNED_BYTE']|GL['SHORT']|GL['UNSIGNED_SHORT']} NormalizerType */
/** @typedef {(v: number) => number} Normalizer */

/**
 * Normalizers to convert from Normalized Fixed-Point to Floating-Point
 * @see https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations
 * @see https://registry.khronos.org/vulkan/specs/1.0/html/vkspec.html#fundamentals-fixedfpconv
 * @see https://learn.microsoft.com/en-us/windows/win32/direct3d10/d3d10-graphics-programming-guide-resources-data-conversion?redirectedfrom=MSDN#integer_conversion
 */
export const normalizers = {
    [GL.FLOAT]          : /** @type {Normalizer} */v => v,
    [GL.BYTE]           : /** @type {Normalizer} */v => Math.max(v / 127.0, -1.0),
    [GL.UNSIGNED_BYTE]  : /** @type {Normalizer} */v => v / 255.0,
    [GL.SHORT]          : /** @type {Normalizer} */v => Math.max(v / 32767.0, -1.0),
    [GL.UNSIGNED_SHORT] : /** @type {Normalizer} */v => v / 65535.0,
};

/**
 * Converts a 16 bit float to 32 bit float
 *
 * Original code from toji - https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
 * @param {*} h
 */
export function float16(h) {
    const s = (h & 0x8000) >> 15;
    const e = (h & 0x7C00) >> 10;
    const f = h & 0x03FF;

    if(e == 0) {
        return (s?-1:1) * Math.pow(2,-14) * (f/Math.pow(2, 10));
    } else if (e == 0x1F) {
        return f?NaN:((s?-1:1)*Infinity);
    }

    return (s?-1:1) * Math.pow(2, e-15) * (1+(f/Math.pow(2, 10)));
}

/**
 * Rounds up to the nearest specified increment
 * @see https://www.w3.org/TR/WGSL/#roundup
 * @param {number} k
 * @param {number} n
 * @returns {number}
 */
export function roundUp(k, n) {
    return Math.ceil(n / k) * k;
}

/**
 * Returns the nearest power of 2 rounding up
 * @param {number} v
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
 * @param {number} n
 * @param {number} m
 * @see https://web.archive.org/web/20090717035140if_/javascript.about.com/od/problemsolving/a/modulobug.htm
 */
export function mod(n, m) {
    return ((n % m) + m) % m;
}


/**
 * Less than or equal-ish using defined epsilon
 * @param {number} a
 * @param {number} b
 * @param {number} epsilon
 */
export function lte(a, b, epsilon = EPSILON){
    return a < b || Math.abs(a - b) < epsilon;
}


/**
 * Normalizes an angle to be between 0 and 2 PI
 * @param {number} a
 */
export function normalizeAngle(a){
    return (a + TWO_PI) % TWO_PI;
}

/**
 * Converts an angle from radians to degrees
 * @param {number} r
 */
export function rad2Deg(r) {
    return r * 180 / Math.PI;
}

/**
 * Converts an anble from degrees to radians
 * @param {number} d
 */
export function deg2Rad(d) {
    return d * Math.PI / 180;
}

/**
 * Compares two angles in radians and returns the difference
 * @param {number} a
 * @param {number} b
 */
export function angleDiff(a, b){
    const diff = mod(a - b + PI, TWO_PI) - PI;
    return diff < -PI ? diff + TWO_PI : diff;
}

/**
 * Compares two angles in degrees and returns the difference
 * @param {number} a
 * @param {number} b
 * @param {boolean} clockwise
 */
export function angleDiffDeg(a, b, clockwise) {
    const diff = mod(a - b + 180, 360) - 180;

    if(clockwise) {
        return diff < -180 ? diff + 360 : diff;
    } else {
        return diff > 180 ? diff - 360 : diff;
    }

}

/**
 * Compares an angle in radians to two other angles to determine if it lies between the two angles
 * @param {number} n
 * @param {number} a
 * @param {number} b
 */
export function angleIsBetween(n, a, b){
    n = normalizeAngle(n);
    a = normalizeAngle(a);
    b = normalizeAngle(b);

    if(lte(a, b))
        return lte(a, n) && lte(n, b);
    return lte(a, n) || lte(n, b);
}

/**
 * Takes two 2d vectors and returns the angle between them including the sign
 * @param {[number, number]|vec2} a
 * @param {[number, number]|vec2} b
 */
export function signedAngle([x1, y1], [x2, y2]){
    return Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2);
}

