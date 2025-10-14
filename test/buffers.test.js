import { describe, it } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert             } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertEquals       } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertStrictEquals } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';

import { pad3ChannelFormat, flipY } from '../lib/buffers.js';

describe('pad3ChannelFormat', () => {
    it('should pad 3 channel data to 4 channels without altering pixel order', () => {
        const data = new Uint8Array([
            1, 2, 3,
            4, 5, 6,
        ]);

        const padded = pad3ChannelFormat({ data, TypedArray: Uint8Array });

        assertStrictEquals(padded.length, 8);
        assertEquals([...padded], [1, 2, 3, 0, 4, 5, 6, 0]);
    });

    it('should support different typed array constructors preserving values', () => {
        const data = new Float32Array([
            1, 2, 3,
            4, 5, 6,
        ]);

        const padded = pad3ChannelFormat({ data, TypedArray: Float32Array });

        assertStrictEquals(padded.length, 8);
        assertEquals(padded.slice(0, 4), new Float32Array([1, 2, 3, 0]));
        assertEquals(padded.slice(4), new Float32Array([4, 5, 6, 0]));
    });
});

describe('flipY', () => {
    it('should flip rows within each image layer', () => {
    const bytesPerRow = 4;
    const rowsPerImage = 2;

        const buffer = new Uint8Array([
            // layer 0 row 0
            1, 2, 3, 4,
            // layer 0 row 1
            5, 6, 7, 8,
            // layer 1 row 0
            9, 10, 11, 12,
            // layer 1 row 1
            13, 14, 15, 16,
        ]).buffer;

        const flipped = flipY(buffer, bytesPerRow, rowsPerImage);
        const result = new Uint8Array(flipped);

        assertEquals([...result], [
            5, 6, 7, 8,
            1, 2, 3, 4,
            13, 14, 15, 16,
            9, 10, 11, 12,
        ]);
    });

    it('should return a new buffer even when rowsPerImage is zero', () => {
        const buffer = new Uint8Array([]).buffer;

        const flipped = flipY(buffer, 1, 1);

        assertStrictEquals(flipped.byteLength, 0);
        assert(flipped !== buffer);
    });
});
