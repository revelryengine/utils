import { describe, it, expect, beforeEach, sinon } from 'bdd';

import { WeakCache } from '../lib/weak-cache.js';

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

    /** @type {ReturnType<typeof sinon.spy>} */
    let spyA;
    /** @type {ReturnType<typeof sinon.spy>} */
    let spyB;
    /** @type {ReturnType<typeof sinon.spy>} */
    let spyC;
    /** @type {ReturnType<typeof sinon.spy>} */
    let spyD;

    beforeEach(() => {
        keyA = {};
        keyB = {};

        cache = new WeakCache();

        spyA = sinon.spy(() => ({ foo: 'a' }));
        spyB = sinon.spy(() => ({ foo: 'b' }));
        spyC = sinon.spy(() => ({ foo: 'ab' }));
        spyD = sinon.spy(() => ({ foo: 'ba' }));

        fooA = cache.ensure(keyA, spyA);
        fooB = cache.ensure(keyB, spyB);
        fooC = cache.ensure(keyA, keyB, spyC);
        fooD = cache.ensure(keyB, keyA, spyD);
    });

    describe('ensure', () => {
        it('calls the callback when the key is not in the cache', () => {
            expect(spyA).to.have.callCount(1);
            expect(spyB).to.have.callCount(1);
            expect(spyC).to.have.callCount(1);
            expect(spyD).to.have.callCount(1);
        });

        it('returns the object for the given key', () => {
            expect(fooA).to.deep.equal({ foo: 'a' });
            expect(fooB).to.deep.equal({ foo: 'b' });
        });

        it('returns an object for the given key sequence', () => {
            expect(fooC).to.deep.equal({ foo: 'ab' });
            expect(fooD).to.deep.equal({ foo: 'ba' });
        });

        it('does not call the callback when the key is already in the cache', () => {
            cache.ensure(keyA, spyA);
            cache.ensure(keyB, spyB);
            cache.ensure(keyA, keyB, spyC);
            cache.ensure(keyB, keyA, spyD);

            expect(spyA).to.have.callCount(1);
            expect(spyB).to.have.callCount(1);
            expect(spyC).to.have.callCount(1);
            expect(spyD).to.have.callCount(1);
        });

        it('returns the same object for the given key each time', () => {
            expect(cache.ensure(keyA, spyA)).to.equal(fooA);
            expect(cache.ensure(keyB, spyB)).to.equal(fooB);
        });

        it('returns the same object for the given key sequence each time', () => {
            expect(cache.ensure(keyA, keyB, spyC)).to.equal(fooC);
            expect(cache.ensure(keyB, keyA, spyD)).to.equal(fooD);
        });
    });

    describe('get', () => {
        it('returns the object for the given key', () => {
            expect(cache.get(keyA)).to.equal(fooA);
            expect(cache.get(keyB)).to.equal(fooB);
            expect(cache.get(keyA, keyB)).to.equal(fooC);
            expect(cache.get(keyB, keyA)).to.equal(fooD);
        });

        it('returns undefined if key does not exist', () => {
            expect(cache.get({})).to.equal(undefined);
            expect(cache.get({}, {})).to.equal(undefined);
            expect(cache.get(keyA, {})).to.equal(undefined);
            expect(cache.get({}, keyA)).to.equal(undefined);
        });
    });

    describe('has', () => {
        it('returns true for the given key', () => {
            expect(cache.has(keyA)).to.equal(true);
            expect(cache.has(keyB)).to.equal(true);
            expect(cache.has(keyA, keyB)).to.equal(true);
            expect(cache.has(keyB, keyA)).to.equal(true);
        });

        it('returns false if key does not exist', () => {
            expect(cache.has({})).to.equal(false);
            expect(cache.has({}, {})).to.equal(false);
            expect(cache.has(keyA, {})).to.equal(false);
            expect(cache.has({}, keyA)).to.equal(false);
        });
    });

    describe('delete', () => {
        it('deletes the object for the given key', () => {
            cache.delete(keyA);
            cache.delete(keyB);
            expect(cache.get(keyA)).to.not.equal(fooA);
            expect(cache.get(keyB)).to.not.equal(fooB);
        });

        it('deletes the object for the given key sequence', () => {
            cache.delete(keyA, keyB);
            cache.delete(keyB, keyA);
            expect(cache.get(keyA, keyB)).to.not.equal(fooC);
            expect(cache.get(keyB, keyA)).to.not.equal(fooD);
        });

        it('returns false if key does not exist', () => {
            expect(cache.delete({})).to.equal(false);
            expect(cache.delete({}, {})).to.equal(false);
            expect(cache.delete(keyA, {})).to.equal(false);
        });
    });

    describe('set', () => {
        /** @type {WeakKey} */
        let keyC;

        /** @type {{ foo: string }} */
        let fooCValue;

        beforeEach(() => {
            keyC = {};
            fooCValue = { foo: 'c' };
        });

        it('sets the cache object for the given key', () => {
            cache.set(keyA, fooCValue);
            cache.set(keyB, fooCValue);
            cache.set(keyA, keyB, fooCValue);
            cache.set(keyB, keyA, fooCValue);
            expect(cache.get(keyA)).to.equal(fooCValue);
            expect(cache.get(keyB)).to.equal(fooCValue);
            expect(cache.get(keyA, keyB)).to.equal(fooCValue);
            expect(cache.get(keyB, keyA)).to.equal(fooCValue);
        });

        it('creates a new cache object if it does not exist', () => {
            cache.set(keyC, fooCValue);
            cache.set(keyA, keyC, fooCValue);

            expect(cache.get(keyC)).to.equal(fooCValue);
            expect(cache.get(keyA, keyC)).to.equal(fooCValue);
        });

        it('returns the object value provided', () => {
            expect(cache.set(keyC, fooCValue)).to.equal(fooCValue);
            expect(cache.set(keyA, keyC, fooCValue)).to.equal(fooCValue);
        });
    });
});
