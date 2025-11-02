import { describe, it, expect, beforeEach } from 'bdd';

import { PRNG } from '../lib/prng.js';

describe('PRNG', () => {
    /** @type {PRNG} */
    let prng;

    beforeEach(() => {
        prng = new PRNG(1);
    });

    it('produces a deterministic sequence for the same seed', () => {
        expect(prng.next()).to.equal(16807);
        expect(prng.next()).to.equal(282475249);
        expect(prng.next()).to.equal(1622650073);
    });

    it('keeps generated floats within [0, 1)', () => {
        const value = prng.nextFloat();
        expect(value >= 0 && value < 1).to.equal(true);
        expect(Math.abs(value - ((16807 - 1) / 2147483646))).to.be.lessThan(1e-12);
    });

    it('normalises non-positive seeds to a valid state', () => {
        const zeroSeed = new PRNG(0);
        const normalizedSeed = new PRNG(2147483646);

        expect(zeroSeed.next()).to.equal(normalizedSeed.next());
    });

    it('generates identical sequences for identical seeds', () => {
        const other = new PRNG(1);

        for (let i = 0; i < 5; i += 1) {
            expect(prng.next()).to.equal(other.next());
        }
    });

    it('generates different sequences for different seeds', () => {
        const other = new PRNG(2);

        expect(prng.next()).to.equal(16807);
        expect(other.next()).to.equal(33614);
        expect(prng.next() !== other.next()).to.equal(true);
    });
});
