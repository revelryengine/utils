import { describe, it, expect, beforeEach, sinon } from 'bdd';

import { LRUCache } from '../lib/lru-cache.js';

describe('LRUCache', () => {
    /** @type {LRUCache<number>} */
    let cache;

    /** @type {{ get: sinon.SinonSpy; put: sinon.SinonSpy; delete: sinon.SinonSpy }} */
    let persist;

    beforeEach(() => {
        const getSpy = sinon.spy(async () => {});
        const putSpy = sinon.spy(async () => {});
        const deleteSpy = sinon.spy(async () => {});

        persist = { get: getSpy, put: putSpy, delete: deleteSpy };
        cache = new LRUCache({ capacity: 2, persist });
    });

    it('returns null for missing keys without touching persistence', () => {
        expect(cache.get('missing')).to.equal(null);
        expect(persist.get).to.have.callCount(0);
    });

    it('initialises from provided entries', () => {
        const entriesCache = new LRUCache({
            capacity: 3,
            entries: [['a', 1], ['b', 2]],
        });

        expect(entriesCache.get('a')).to.equal(1);
        expect(entriesCache.get('b')).to.equal(2);
        expect(entriesCache.getLeastRecent()[0]).to.equal('a');
        expect(entriesCache.getMostRecent()[0]).to.equal('b');
    });

    it('updates recency ordering on get', () => {
        cache.put('a', 1);
        cache.put('b', 2);

        expect(cache.getLeastRecent()[0]).to.equal('a');

        expect(cache.get('a')).to.equal(1);
        expect(persist.get).to.have.callCount(1);
        expect(cache.getLeastRecent()[0]).to.equal('b');
        expect(cache.getMostRecent()[0]).to.equal('a');
    });

    it('evicts the least recent item when capacity is reached', () => {
        cache.put('a', 1);
        cache.put('b', 2);
        expect(persist.delete).to.have.callCount(0);

        cache.put('c', 3);

        expect(cache.has('a')).to.be.false;
        expect(cache.get('a')).to.equal(null);
        expect(persist.delete).to.have.callCount(1);
        expect(persist.put).to.have.callCount(3);
        expect(persist.delete).to.have.been.calledWith('a');
        expect(cache.getMostRecent()[0]).to.equal('c');
        expect(cache.getLeastRecent()[0]).to.equal('b');
    });

    it('deletes existing keys and mirrors to persistence', () => {
        cache.put('a', 1);
        cache.delete('a');

        expect(cache.has('a')).to.be.false;
        expect(persist.delete).to.have.callCount(1);
        expect(persist.delete).to.have.been.calledWith('a');
    });

    it('allows overwriting existing keys without increasing size', () => {
        cache.put('a', 1);
        cache.put('b', 2);
        cache.put('a', 42);

        expect(cache.get('a')).to.equal(42);
        expect(cache.getMostRecent()[0]).to.equal('a');
        expect([...cache.cache.keys()]).to.deep.equal(['b', 'a']);
        expect(persist.put).to.have.callCount(3);
    });
});
