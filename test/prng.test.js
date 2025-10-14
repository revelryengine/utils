import { describe, it, beforeEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert       } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';

import { PRNG } from '../lib/prng.js';

describe('PRNG', () => {
    /** @type {PRNG} */
    let prng;

    beforeEach(() => {
        prng = new PRNG(1);
    });

    it('should produce a deterministic sequence for the same seed', () => {
        assertEquals(prng.next(), 16807);
        assertEquals(prng.next(), 282475249);
        assertEquals(prng.next(), 1622650073);
    });

    it('should keep generated floats within [0, 1)', () => {
        const value = prng.nextFloat();
        assert(value >= 0 && value < 1);
        assert(Math.abs(value - ((16807 - 1) / 2147483646)) < 1e-12);
    });

    it('should normalise non-positive seeds to a valid state', () => {
        const zeroSeed = new PRNG(0);
        const normalizedSeed = new PRNG(2147483646);

        assertEquals(zeroSeed.next(), normalizedSeed.next());
    });

    it('should generate identical sequences for identical seeds', () => {
        const other = new PRNG(1);

        for (let i = 0; i < 5; i += 1) {
            assertEquals(prng.next(), other.next());
        }
    });

    it('should generate different sequences for different seeds', () => {
        const other = new PRNG(2);

        assertEquals(prng.next(), 16807);
        assertEquals(other.next(), 33614);
        assert(prng.next() !== other.next());
    });
});
