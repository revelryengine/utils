import { foo } from './worker-dep.js';

export async function method() {
    return { result: foo };
}

export async function methodError() {
    throw new Error('Test error');
}

/**
 * Reverse the bytes in the provided ArrayBuffer.
 * @param {ArrayBuffer} buffer
 * @returns
 */
export async function methodTransfer(buffer) {
    const view = new Uint8Array(buffer);
    view.reverse();
    return { result: view, transfer: [view.buffer] };
}

let count = 0;
export function methodIncrement() {
    return { result: count++ };
}
