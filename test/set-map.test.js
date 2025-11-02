import { describe, it, expect, beforeEach } from 'bdd';

import { SetMap } from '../lib/set-map.js';

describe('SetMap', () => {
    /** @type {SetMap<any, any>} */
    let setMap;

    beforeEach(() => {
        setMap = new SetMap();

        setMap.add('foo', 'foobar');
        setMap.add('foo', 'foobat');
        setMap.add('foo', 'foobaz');
        setMap.delete('foo', 'foobar');
        setMap.add('removed', 'foobar');
        setMap.delete('removed', 'foobar');
    });

    it('creates a new Set for key', () => {
        expect(setMap.get('foo')).to.be.instanceOf(Set);
    });

    it('adds item to set', () => {
        expect(setMap.get('foo')?.has('foobat')).to.equal(true);
        expect(setMap.get('foo')?.has('foobaz')).to.equal(true);
    });

    it('removes item from set', () => {
        expect(setMap.get('foo')?.has('foobar')).to.equal(false);
    });

    it('removes empty Sets', () => {
        expect(setMap.get('removed')).to.equal(undefined);
    });

    it('returns false if deleted but key does not exist', () => {
        expect(setMap.delete('x')).to.equal(false);
    });

    describe('count', () => {
        it('returns the number of items in a given set', () => {
            expect(setMap.count('foo')).to.equal(2);
            expect(setMap.count('removed')).to.equal(0);
        });

        it('returns 0 for a non existent set', () => {
            expect(setMap.count('z')).to.equal(0);
        });
    });
});
