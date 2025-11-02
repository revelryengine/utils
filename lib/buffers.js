/**
 * Utilities for working with ArrayBuffer and TypedArray buffers.
 * @module
 */

/**
 * Pads a 3 channel format to 4 channel format
 * @example
 * ```js
 * const data   = new Uint8Array([ 1, 2, 3, 4, 5, 6 ]);
 * const padded = pad3ChannelFormat({ data, TypedArray: Uint8Array });
 *
 * console.log(padded); // Uint8Array [1, 2, 3, 0, 4, 5, 6, 0]
 * ```
 * @param {Object} options - The pad options
 * @param {ArrayBufferView} options.data - The 3 channel source data
 * @param {TypedArrayConstructor} options.TypedArray - The typed array constructor (Float32Array, Uint8Array, etc.) for the data
 * @returns {TypedArray} - The 4 channel padded data
 */
export function pad3ChannelFormat({ data, TypedArray }) {
    const texels = data.byteLength / (3 * TypedArray.BYTES_PER_ELEMENT);
    const buffer = new ArrayBuffer(data.byteLength + (texels * TypedArray.BYTES_PER_ELEMENT));
    const padded = new TypedArray(buffer);

    for (let i = 0; i < texels; i++) {
        padded.set(new TypedArray(/** @type {ArrayBuffer} */ (data.buffer), data.byteOffset + i * 3 * TypedArray.BYTES_PER_ELEMENT, 3), i * 4);
    }

    return padded;
}

/**
 * Flips the y coordinate in a texture buffer
 *
 * @example
 * ```js
 * const buffer = new Uint8Array([
 *   1,  2,  3,  4,
 *   5,  6,  7,  8,
 *   9, 10, 11, 12,
 *  13, 14, 15, 16,
 * ]).buffer;
 *
 * const flippedBuffer = flipY(buffer, 4, 2);
 * const result = new Uint8Array(flippedBuffer);
 * console.log([...result]);
 * // [
 * //    5,  6,  7,  8,
 * //    1,  2,  3,  4,
 * //   13, 14, 15, 16,
 * //    9, 10, 11, 12,
 * // ]
 * ```
 *
 * @param {ArrayBuffer} buffer - The source buffer
 * @param {number} bytesPerRow - The number of bytes per row
 * @param {number} rowsPerImage - The number of rows per image
 * @returns {ArrayBuffer} - The flipped buffer
 */
export function flipY(buffer, bytesPerRow, rowsPerImage) {
    const result = new Uint8Array(buffer.byteLength);
    const layers = buffer.byteLength / bytesPerRow / rowsPerImage;

    const lastRow = rowsPerImage - 1;
    for (let z = 0; z < layers; z++) {
        const layerOffset = z * bytesPerRow * rowsPerImage;

        for (let y = 0; y < rowsPerImage; y++) {
            const srcOffset = layerOffset + bytesPerRow * (lastRow - y);
            const dstOffset = layerOffset + bytesPerRow * y;

            result.set(new Uint8Array(buffer, srcOffset, bytesPerRow), dstOffset);
        }
    }

    return result.buffer;
}

/**
 * @typedef {(
 *    Int8Array
 *  | Uint8Array
 *  | Uint8ClampedArray
 *  | Int16Array
 *  | Uint16Array
 *  | Int32Array
 *  | Uint32Array
 *  | Float32Array
 *  | Float64Array
 * )} TypedArray - An instance of a standard [TypedArray](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray).
 */

/**
 * @typedef {(
 *    Int8ArrayConstructor
 *  | Uint8ArrayConstructor
 *  | Uint8ClampedArrayConstructor
 *  | Int16ArrayConstructor
 *  | Uint16ArrayConstructor
 *  | Int32ArrayConstructor
 *  | Uint32ArrayConstructor
 *  | Float32ArrayConstructor
 *  | Float64ArrayConstructor
 * )} TypedArrayConstructor - A reference to a standard [TypedArray](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray) constructor.
 */
