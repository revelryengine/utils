import { describe, it, beforeEach, afterEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assertEquals          } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertStrictEquals    } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';
import { assertNotStrictEquals } from 'https://deno.land/std@0.208.0/assert/assert_not_strict_equals.ts';
import { assertMatch           } from 'https://deno.land/std@0.208.0/assert/assert_match.ts';
import { assertSpyCalls, spy   } from 'https://deno.land/std@0.208.0/testing/mock.ts';

import { CacheHelper } from '../lib/cache-helper.js';

/**
 * @returns {{ calls: string[], request(name: string, callback: () => Promise<unknown>): Promise<unknown> }}
 */
const createLockStub = () => {
    const calls = [];
    return {
        calls,
        async request(name, callback) {
            calls.push(name);
            return await callback();
        }
    };
};

class FakeCache {
    constructor() {
        /** @type {Map<string, Response>} */
        this.store = new Map();
        /** @type {Map<string, Request>} */
        this.requests = new Map();
        /** @type {{ request: Request, response: Response }[]} */
        this.putCalls = [];
        /** @type {string[]} */
        this.deleteCalls = [];
    }

    /**
     * @param {Request|string|URL} input
     */
    keyFor(input) {
        if (input instanceof Request) {
            return input.url;
        }
        if (input instanceof URL) {
            return input.toString();
        }
        if (typeof input === 'string') {
            return input;
        }
        if (input && typeof input === 'object' && 'url' in input && typeof input.url === 'string') {
            return input.url;
        }
        throw new TypeError('Unsupported cache key');
    }

    /**
     * @param {Request|string|URL} request
     * @param {Response} response
     */
    seed(request, response) {
        const key = this.keyFor(request);
        this.store.set(key, response);
        this.requests.set(key, request instanceof Request ? request : new Request(this.keyFor(request)));
    }

    /**
     * @param {Request} request
     */
    async match(request) {
        return this.store.get(this.keyFor(request));
    }

    /**
     * @param {Request} request
     * @param {Response} response
     */
    async put(request, response) {
        const key = this.keyFor(request);
        this.store.set(key, response);
        this.requests.set(key, request);
        this.putCalls.push({ request, response });
    }

    /**
     * @param {Request} request
     */
    async delete(request) {
        const key = this.keyFor(request);
        const existed = this.store.delete(key);
        this.requests.delete(key);
        this.deleteCalls.push(key);
        return existed;
    }

    async keys() {
        return Array.from(this.requests.values());
    }
}

class FakeCacheStorage {
    /**
     * @param {string[]} [initial]
     */
    constructor(initial = []) {
        /** @type {Map<string, FakeCache>} */
        this.caches = new Map();
        /** @type {string[]} */
        this.deleted = [];
        for (const name of initial) {
            this.caches.set(name, new FakeCache());
        }
    }

    /**
     * @param {string} name
     */
    async open(name) {
        let cache = this.caches.get(name);
        if (!cache) {
            cache = new FakeCache();
            this.caches.set(name, cache);
        }
        return cache;
    }

    async keys() {
        return Array.from(this.caches.keys());
    }

    /**
     * @param {string} name
     */
    async delete(name) {
        this.deleted.push(name);
        return this.caches.delete(name);
    }

    /**
     * @param {string} name
     */
    get(name) {
        return this.caches.get(name);
    }

    /**
     * @param {string} name
     */
    has(name) {
        return this.caches.has(name);
    }
}

describe('CacheHelper', () => {
    /** @type {{ calls: string[], request(name: string, callback: () => Promise<unknown>): Promise<unknown> }} */
    let locks;
    /** @type {any} */
    let originalLocks;
    /** @type {typeof fetch | undefined} */
    let originalFetch;

    beforeEach(() => {
        const nav = /** @type {any} */ (globalThis.navigator ??= {});
        locks = createLockStub();
        originalLocks = nav.locks;
        nav.locks = locks;
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        const nav = /** @type {any} */ (globalThis.navigator);
        if (originalLocks === undefined) {
            delete nav.locks;
        } else {
            nav.locks = originalLocks;
        }
        globalThis.fetch = originalFetch;
    });

    describe('create', () => {
        it('should return helper without deleting other caches when cleanup is false', async () => {
            const provider = new FakeCacheStorage(['assets-0']);
            const helper = await CacheHelper.create({ name: 'assets', version: '1', provider });

            assertEquals(helper.name, 'assets-1');
            assertStrictEquals(helper.cache, provider.get('assets-1'));
            assertEquals(provider.deleted, []);
        });

        it('should clean up caches that share the same base name when cleanup is true', async () => {
            const provider = new FakeCacheStorage(['assets-0', 'assets-1', 'other-1']);
            const helper = await CacheHelper.create({ name: 'assets', version: '2', cleanup: true, provider });

            assertEquals(helper.name, 'assets-2');
            assertStrictEquals(helper.cache, provider.get('assets-2'));
            assertEquals(provider.deleted, ['assets-0', 'assets-1']);
            assertEquals(provider.has('other-1'), true);
        });
    });

    describe('list', () => {
        it('should return cache entry urls', async () => {
            const cache = new FakeCache();
            const helper = new CacheHelper('list-1', cache, async () => new Response('unused'));
            const first = new Request('https://example.com/a');
            const second = new Request('https://example.com/b');
            cache.seed(first, new Response('a'));
            cache.seed(second, new Response('b'));

            assertEquals(await helper.list(), [first.url, second.url]);
        });
    });

    describe('fetch', () => {
        it('should return cached response when entry is fresh', async () => {
            const cache = new FakeCache();
            const fetcher = spy(async () => new Response('network'));
            const helper = new CacheHelper('cache-fresh', cache, fetcher);
            const request = new Request('https://example.com/fresh');
            const cachedResponse = new Response('cached');
            cache.seed(request, cachedResponse);

            const originalIsFresh = CacheHelper.isFresh;
            CacheHelper.isFresh = async () => true;

            try {
                const result = await helper.fetch(request);
                assertStrictEquals(result, cachedResponse);
            } finally {
                CacheHelper.isFresh = originalIsFresh;
            }

            assertSpyCalls(fetcher, 0);
            assertEquals(locks.calls, [`CacheManager:${helper.name}:${request.url}`]);
            assertEquals(cache.putCalls.length, 0);
        });

        it('should fetche and stores new response when cache entry is stale', async () => {
            const cache = new FakeCache();
            const request = new Request('https://example.com/stale');
            const cachedResponse = new Response('old', {
                headers: { 'Last-Modified': new Date('2024-01-01T00:00:00Z').toUTCString() }
            });
            cache.seed(request, cachedResponse);

            const networkResponse = new Response('new', {
                headers: { 'Last-Modified': new Date('2024-01-02T00:00:00Z').toUTCString() }
            });
            const fetcher = spy(async () => networkResponse);
            const helper = new CacheHelper('cache-stale', cache, fetcher);

            const originalIsFresh = CacheHelper.isFresh;
            CacheHelper.isFresh = async () => false;

            try {
                const result = await helper.fetch(request);
                assertStrictEquals(result, networkResponse);
            } finally {
                CacheHelper.isFresh = originalIsFresh;
            }

            assertSpyCalls(fetcher, 1);
            assertEquals(cache.putCalls.length, 1);
            assertStrictEquals(cache.putCalls[0].request, request);
            assertNotStrictEquals(cache.putCalls[0].response, networkResponse);
            const stored = await cache.match(request);
            assertNotStrictEquals(stored, networkResponse);
            assertEquals(stored?.headers.get('Last-Modified'), networkResponse.headers.get('Last-Modified'));
            assertEquals(locks.calls, [`CacheManager:${helper.name}:${request.url}`]);
        });

        it('should create requests from string resources and stores response', async () => {
            const provider = new FakeCacheStorage();
            const fetcher = spy(async (req) => {
                assertEquals(req.url, 'https://example.com/string');
                assertEquals(req.method, 'GET');
                assertEquals(req.headers.get('x-test'), '1');
                return new Response('payload');
            });
            const helper = await CacheHelper.create({ name: 'assets', version: '42', provider, fetcher });

            const result = await helper.fetch('https://example.com/string', {
                headers: { 'x-test': '1' }
            });

            assertSpyCalls(fetcher, 1);
            const cache = helper.cache;
            assertEquals(cache.putCalls.length, 1);
            assertEquals(cache.putCalls[0].request.url, 'https://example.com/string');
            assertEquals(cache.putCalls[0].request.headers.get('x-test'), '1');
            assertNotStrictEquals(cache.putCalls[0].response, result);
            const stored = await cache.match(new Request('https://example.com/string'));
            assertNotStrictEquals(stored, result);
            assertEquals(locks.calls, [`CacheManager:${helper.name}:https://example.com/string`]);
        });

        it('should skip cache.put when fetch returns cached instance', async () => {
            const cache = new FakeCache();
            const request = new Request('https://example.com/same');
            const cachedResponse = new Response('value');
            cache.seed(request, cachedResponse);
            const fetcher = spy(async () => cachedResponse);
            const helper = new CacheHelper('cache-same', cache, fetcher);

            const originalIsFresh = CacheHelper.isFresh;
            CacheHelper.isFresh = async () => false;

            try {
                const result = await helper.fetch(request);
                assertStrictEquals(result, cachedResponse);
            } finally {
                CacheHelper.isFresh = originalIsFresh;
            }

            assertSpyCalls(fetcher, 1);
            assertEquals(cache.putCalls.length, 0);
            assertEquals(locks.calls, [`CacheManager:${helper.name}:${request.url}`]);
        });
    });

    describe('prune', () => {
        it('should delete cache entries that match the predicate', async () => {
            const cache = new FakeCache();
            const helper = new CacheHelper('prune', cache, async () => new Response('unused'));
            const keep = new Request('https://example.com/keep');
            const drop = new Request('https://example.com/drop');
            cache.seed(keep, new Response('keep'));
            cache.seed(drop, new Response('drop'));

            await helper.prune((req) => req.url.endsWith('/drop'));

            assertEquals(cache.deleteCalls, [drop.url]);
            assertEquals(await helper.list(), [keep.url]);
        });

        it('should not delete entries when predicate returns false', async () => {
            const cache = new FakeCache();
            const helper = new CacheHelper('prune-none', cache, async () => new Response('unused'));
            const request = new Request('https://example.com/item');
            cache.seed(request, new Response('item'));

            await helper.prune(() => false);

            assertEquals(cache.deleteCalls, []);
            assertEquals(await helper.list(), [request.url]);
        });
    });

    describe('isFresh', () => {
        it('should return true when network last-modified is older', async () => {
            const request = new Request('https://example.com/fresh-check');
            const cached = new Response(null, {
                headers: { 'Last-Modified': new Date('2024-01-02T00:00:00Z').toUTCString() }
            });

            globalThis.fetch = async (input, init) => {
                assertStrictEquals(input, request);
                assertEquals(init?.method, 'HEAD');
                return new Response(null, {
                    headers: { 'Last-Modified': new Date('2024-01-01T00:00:00Z').toUTCString() }
                });
            };

            assertEquals(await CacheHelper.isFresh(request, cached), true);
        });

        it('should return false when network last-modified is newer', async () => {
            const request = new Request('https://example.com/stale-check');
            const cached = new Response(null, {
                headers: { 'Last-Modified': new Date('2024-01-01T00:00:00Z').toUTCString() }
            });

            globalThis.fetch = async (input, init) => {
                assertStrictEquals(input, request);
                assertEquals(init?.method, 'HEAD');
                return new Response(null, {
                    headers: { 'Last-Modified': new Date('2024-01-03T00:00:00Z').toUTCString() }
                });
            };

            assertEquals(await CacheHelper.isFresh(request, cached), false);
        });

        it('should treat missing last-modified headers as fresh', async () => {
            const request = new Request('https://example.com/missing');
            const cached = new Response(null);

            globalThis.fetch = async (input, init) => {
                assertStrictEquals(input, request);
                assertEquals(init?.method, 'HEAD');
                return new Response(null);
            };

            assertEquals(await CacheHelper.isFresh(request, cached), true);
        });
    });

    describe('lastModifiedNow', () => {
        it('should return formatted string in GMT', () => {
            const formatted = CacheHelper.lastModifiedNow();
            assertEquals(typeof formatted, 'string');
            assertMatch(formatted, /GMT/);
        });
    });
});
