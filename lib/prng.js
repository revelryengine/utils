/**
 * A simple pseudo-random number generator (PRNG) using a linear congruential generator (LCG) algorithm.
 *
 * The generator produces a sequence of pseudo-random numbers based on an initial seed value.
 * It provides methods to generate the next integer in the sequence and to generate a floating-point number in the range [0, 1).
 *
 * Example usage:
 * ```js
 * const prng = new PRNG(12345); // Initialize with a seed
 * console.log(prng.next());      // Get the next pseudo-random integer
 * console.log(prng.nextFloat()); // Get a pseudo-random float in [0, 1)
 * ```
 *
 * @see https://en.wikipedia.org/wiki/Linear_congruential_generator
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
