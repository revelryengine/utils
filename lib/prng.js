/**
 * Modified from https://gist.github.com/blixt/f17b47c62508be59987b
 */
export class PRNG {
    #seed;

    /**
     * @param {number} seed
     */
    constructor(seed) {
        this.#seed = seed % 2147483647;
        if (this.#seed <= 0) this.#seed += 2147483646;
    }

    /**
     * Returns a pseudo-random value between 1 and 2^32 - 2.
     */
    next () {
        return this.#seed = this.#seed * 16807 % 2147483647;
    }

    /**
     * Returns a pseudo-random floating point number in range [0, 1).
     */
    nextFloat() {
        // We know that result of next() will be 1 to 2147483646 (inclusive).
        return (this.next() - 1) / 2147483646;
    }
}
