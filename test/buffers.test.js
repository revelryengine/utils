import { describe, it, expect } from 'bdd';
import { pad3ChannelFormat, flipY } from '../lib/buffers.js';

describe('buffers', () => {
    describe('pad3ChannelFormat', () => {
        it('pads 3 channel data to 4 channels without altering pixel order', () => {
            const data = new Uint8Array([
                1, 2, 3,
                4, 5, 6,
            ]);

            const padded = pad3ChannelFormat({ data, TypedArray: Uint8Array });
            expect(padded).to.have.lengthOf(8);
            expect(Array.from(padded)).to.deep.equal([1, 2, 3, 0, 4, 5, 6, 0]);
        });

        it('supports different typed array constructors preserving values', () => {
            const data = new Float32Array([
                1, 2, 3,
                4, 5, 6,
            ]);

            const padded = pad3ChannelFormat({ data, TypedArray: Float32Array });

            expect(padded).to.have.lengthOf(8);
            expect(padded.slice(0, 4)).to.deep.equal(new Float32Array([1, 2, 3, 0]));
            expect(padded.slice(4)).to.deep.equal(new Float32Array([4, 5, 6, 0]));
        });
    });
});

describe('flipY', () => {
    it('flips rows within each image layer', () => {
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

        expect([...result]).to.deep.equal([
            5, 6, 7, 8,
            1, 2, 3, 4,
            13, 14, 15, 16,
            9, 10, 11, 12,
        ]);
    });

    it('returns a new buffer even when rowsPerImage is zero', () => {
        const buffer = new Uint8Array([]).buffer;

        const flipped = flipY(buffer, 1, 1);

        expect(flipped.byteLength).to.equal(0);
        expect(flipped).to.not.equal(buffer);
    });
});

