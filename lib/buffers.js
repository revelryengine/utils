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
 * )} TypedArrayConstructor
 */

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
 * )} TypedArray
 */

/**
 * Pads a 3 channel format to 4 channel format
 * @param {{data: ArrayBufferView, TypedArray: TypedArrayConstructor }} options
 */
export function pad3ChannelFormat({ data, TypedArray }) {
    const texels = (data.byteLength / (3 * TypedArray.BYTES_PER_ELEMENT));
    const buffer = new ArrayBuffer(data.byteLength + (texels * TypedArray.BYTES_PER_ELEMENT));
    const padded = new TypedArray(buffer);

    for(let i = 0; i < texels; i++) {
        padded.set(new TypedArray(data.buffer, data.byteOffset + i * 3 * TypedArray.BYTES_PER_ELEMENT, 3), i * 4);
    }

    return padded;
}


/**
 * Flips the y coordinate in a texture buffer
 * @param {ArrayBuffer} buffer
 * @param {number} bytesPerRow
 * @param {number} rowsPerImage
 */
export function flipY(buffer, bytesPerRow, rowsPerImage) {
    const result = new Uint8Array(buffer.byteLength);
    const layers = buffer.byteLength / bytesPerRow / rowsPerImage;

    const lastRow = rowsPerImage - 1;
    for(let z = 0; z < layers; z++) {
        const layerOffset = z * bytesPerRow * rowsPerImage;

        for(let y = 0; y < rowsPerImage; y++) {
            const srcOffset = layerOffset + bytesPerRow * (lastRow - y);
            const dstOffset = layerOffset + bytesPerRow * y;

            result.set(new Uint8Array(buffer, srcOffset, bytesPerRow), dstOffset);
        }
    }

    return result.buffer;
}
