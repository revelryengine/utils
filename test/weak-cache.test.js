import { describe, it, beforeEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert                } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertFalse           } from 'https://deno.land/std@0.208.0/assert/assert_false.ts';
import { assertEquals          } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertStrictEquals    } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';
import { assertNotStrictEquals } from 'https://deno.land/std@0.208.0/assert/assert_not_strict_equals.ts';
import { assertSpyCalls, spy   } from 'https://deno.land/std@0.208.0/testing/mock.ts';

import { WeakCache } from '../lib/weak-cache.js';

/**
 * @import { Spy } from 'https://deno.land/std@0.208.0/testing/mock.ts'
 */

describe('WeakCache', () => {
    /** @type {WeakCache<{ foo: string }>} */
    let cache;

    /** @type {WeakKey} */
    let keyA;
    /** @type {WeakKey} */
    let keyB;

    /** @type {{ foo?: string }} */
    let fooA;
    /** @type {{ foo?: string }} */
    let fooB;
    /** @type {{ foo?: string }} */
    let fooC;
    /** @type {{ foo?: string }} */
    let fooD;

    /** @type {Spy} */
    let spyA;
    /** @type {Spy} */
    let spyB;
    /** @type {Spy} */
    let spyC;
    /** @type {Spy} */
    let spyD;

    beforeEach(() => {
        keyA = {};
        keyB = {};

        cache = new WeakCache();

        spyA = spy(() => ({ foo: 'a' }));
        spyB = spy(() => ({ foo: 'b' }));
        spyC = spy(() => ({ foo: 'ab' }));
        spyD = spy(() => ({ foo: 'ba' }));

        fooA = cache.ensure(keyA, spyA);
        fooB = cache.ensure(keyB, spyB);
        fooC = cache.ensure(keyA, keyB, spyC);
        fooD = cache.ensure(keyB, keyA, spyD);
    });

    describe('ensure', () => {
        it('should call the callback when the key is not in the cache', () => {
            assertSpyCalls(spyA, 1);
            assertSpyCalls(spyB, 1);
            assertSpyCalls(spyC, 1);
            assertSpyCalls(spyD, 1);
        });

        it('should return the object for the given key', () => {
            assertEquals(fooA, { foo: 'a' });
            assertEquals(fooB, { foo: 'b' });
        });

        it('should return an object for the given key sequence', () => {
            assertEquals(fooC, { foo: 'ab' });
            assertEquals(fooD, { foo: 'ba' });
        });

        it('should not call the callback when the key is already in the cache', () => {
            cache.ensure(keyA, spyA);
            cache.ensure(keyB, spyB);
            cache.ensure(keyA, keyB, spyC);
            cache.ensure(keyB, keyA, spyD);

            assertSpyCalls(spyA, 1);
            assertSpyCalls(spyB, 1);
            assertSpyCalls(spyC, 1);
            assertSpyCalls(spyD, 1);
        });

        it('should return the same object for the given key each time', () => {
            assertStrictEquals(fooA, cache.ensure(keyA, spyA));
            assertStrictEquals(fooB, cache.ensure(keyB, spyB));
        });

        it('should return the same object for the given key sequence each time', () => {
            assertStrictEquals(fooC, cache.ensure(keyA, keyB, spyC));
            assertStrictEquals(fooD, cache.ensure(keyB, keyA, spyD));
        });
    });

    describe('get', () => {
        it('should return the object for the given key', () => {
            assertStrictEquals(fooA, cache.get(keyA));
            assertStrictEquals(fooB, cache.get(keyB));
            assertStrictEquals(fooC, cache.get(keyA, keyB));
            assertStrictEquals(fooD, cache.get(keyB, keyA));
        });

        it('should return undefined if key does not exist', () => {
            assertEquals(cache.get({}), undefined);
            assertEquals(cache.get({}, {}), undefined);
            assertEquals(cache.get(keyA, {}), undefined);
            assertEquals(cache.get({}, keyA), undefined);
        });
    });

    describe('has', () => {
        it('should return true for the given key', () => {
            assert(cache.has(keyA));
            assert(cache.has(keyB));
            assert(cache.has(keyA, keyB));
            assert(cache.has(keyB, keyA));
        });

        it('should return false if key does not exist', () => {
            assertFalse(cache.has({}));
            assertFalse(cache.has({}, {}));
            assertFalse(cache.has(keyA, {}));
            assertFalse(cache.has({}, keyA));
        });
    });

    describe('delete', () => {
        it('should delete the object for the given key', () => {
            cache.delete(keyA);
            cache.delete(keyB);
            assertNotStrictEquals(fooA, cache.get(keyA));
            assertNotStrictEquals(fooB, cache.get(keyB));
        });

        it('should delete the object for the given key sequence', () => {
            cache.delete(keyA, keyB);
            cache.delete(keyB, keyA);
            assertNotStrictEquals(fooC, cache.get(keyA, keyB));
            assertNotStrictEquals(fooD, cache.get(keyB, keyA));
        });

        it('should return false if key does not exist', () => {
            assertFalse(cache.delete({}))
            assertFalse(cache.delete({}, {}));
            assertFalse(cache.delete(keyA, {}));
        });
    });


    describe('set', () => {
        /** @type {WeakKey} */
        let keyC;

        /** @type {{ foo: string }} */
        let fooC;

        beforeEach(() => {
            keyC = {};
            fooC = { foo: 'c' };
        });
        it('should set the cache object for the given key', () => {
            cache.set(keyA, fooC);
            cache.set(keyB, fooC);
            cache.set(keyA, keyB, fooC);
            cache.set(keyB, keyA, fooC);
            assertStrictEquals(cache.get(keyA), fooC);
            assertStrictEquals(cache.get(keyB), fooC);
            assertStrictEquals(cache.get(keyA, keyB), fooC);
            assertStrictEquals(cache.get(keyB, keyA), fooC);
        });

        it('should create a new cache object if it does not exist', () => {
            cache.set(keyC, fooC);
            cache.set(keyA, keyC, fooC);

            assertStrictEquals(cache.get(keyC), fooC);
            assertStrictEquals(cache.get(keyA, keyC), fooC);
        });

        it('should return the object value provided', () => {
            assertStrictEquals(cache.set(keyC, fooC), fooC);
            assertStrictEquals(cache.set(keyA, keyC, fooC), fooC);
        })
    });
});
