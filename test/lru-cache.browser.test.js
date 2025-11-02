import { describe, it, expect } from 'bdd';

import { LRUCache } from '../lib/lru-cache.js';

describe('LRUCache.fromIndexedDB', () => {
    it('creates a new cache and persists operations to IndexedDB', async () => {
        const dbCache = await LRUCache.fromIndexedDB(3, 'test-cache-db', 1);

        dbCache.put('key1', { data: 'value1' });
        dbCache.put('key2', { data: 'value2' });
        dbCache.put('key3', { data: 'value3' });

        expect(dbCache.get('key1')).to.deep.equal({ data: 'value1' });
        expect(dbCache.get('key2')).to.deep.equal({ data: 'value2' });
        expect(dbCache.get('key3')).to.deep.equal({ data: 'value3' });

        const dbCache2 = await LRUCache.fromIndexedDB(3, 'test-cache-db', 1);

        expect(dbCache2.get('key1')).to.deep.equal({ data: 'value1' });
        expect(dbCache2.get('key2')).to.deep.equal({ data: 'value2' });
        expect(dbCache2.get('key3')).to.deep.equal({ data: 'value3' });
    });

    it('handles eviction and persists deletions to IndexedDB', async () => {
        const dbCache = await LRUCache.fromIndexedDB(2, 'test-eviction-db', 1);

        dbCache.put('a', 100);
        dbCache.put('b', 200);
        dbCache.put('c', 300);

        expect(dbCache.get('a')).to.equal(null);
        expect(dbCache.get('b')).to.equal(200);
        expect(dbCache.get('c')).to.equal(300);

        const dbCache2 = await LRUCache.fromIndexedDB(2, 'test-eviction-db', 1);

        expect(dbCache2.get('a')).to.equal(null);
        expect(dbCache2.get('b')).to.equal(200);
        expect(dbCache2.get('c')).to.equal(300);
    });

    it('updates accessed timestamp in IndexedDB on get', async () => {
        const dbCache = await LRUCache.fromIndexedDB(2, 'test-access-db', 1);

        dbCache.put('key1', 'value1');

        dbCache.get('key1');

        const dbCache2 = await LRUCache.fromIndexedDB(2, 'test-access-db', 1);
        expect(dbCache2.get('key1')).to.equal('value1');
    });

    it('handles explicit deletions', async () => {
        const dbCache = await LRUCache.fromIndexedDB(2, 'test-delete-db', 1);

        dbCache.put('key1', 'value1');
        dbCache.put('key2', 'value2');

        dbCache.delete('key1');

        expect(dbCache.get('key1')).to.equal(null);
        expect(dbCache.get('key2')).to.equal('value2');

        const dbCache2 = await LRUCache.fromIndexedDB(2, 'test-delete-db', 1);
        expect(dbCache2.get('key1')).to.equal(null);
        expect(dbCache2.get('key2')).to.equal('value2');
    });

    it('loads entries in order of access time', async () => {
        const dbCache = await LRUCache.fromIndexedDB(3, 'test-order-db', 1);

        dbCache.put('first', 1);
        dbCache.put('second', 2);
        dbCache.put('third', 3);

        const dbCache2 = await LRUCache.fromIndexedDB(3, 'test-order-db', 1);

        expect(dbCache2.get('first')).to.equal(1);
        expect(dbCache2.get('second')).to.equal(2);
        expect(dbCache2.get('third')).to.equal(3);
    });

    it('creates object store on first use', async () => {
        const dbCache = await LRUCache.fromIndexedDB(2, 'test-new-db', 1);

        dbCache.put('initial', 'value');
        expect(dbCache.get('initial')).to.equal('value');
    });

    it('handles empty database', async () => {
        const dbCache = await LRUCache.fromIndexedDB(5, 'test-empty-db', 1);

        expect(dbCache.get('nonexistent')).to.equal(null);

        dbCache.put('new', 'data');
        expect(dbCache.get('new')).to.equal('data');
    });
});
