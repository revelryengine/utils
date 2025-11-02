import { describe, it, expect, beforeEach, afterEach, sinon } from 'bdd';

import { CacheHelper } from '../lib/cache-helper.js';

describe('CacheHelper', () => {
    describe('constructor', () => {
        /** @type {Cache} */
        let cache;
        beforeEach(async () => {
            cache = await caches.open('test-cache-helper');
        });

        afterEach(async () => {
            await caches.delete('test-cache-helper');
        });

        it('creates helper with given name and cache and defaults to globalThis.fetch for fetcher', () => {
            const helper  = new CacheHelper('test-cache', cache);

            expect(helper.name).to.equal('test-cache');
            expect(helper.cache).to.equal(cache);
            expect(helper.fetcher).to.equal(globalThis.fetch);
        });
        it('accepts a custom fetcher', () => {
            const fetcher = async () => new Response('custom');
            const helper  = new CacheHelper('test-cache', cache, fetcher);

            expect(helper.fetcher).to.equal(fetcher);
        });

        describe('fetch', () => {
            it('fetches the resource and adds it to the cache', async () => {
                const fetcher = sinon.spy(async () => new Response('test'));
                const helper  = new CacheHelper('test-cache', cache, fetcher);
                const request = new Request('https://example.com/resource');

                const response = await helper.fetch(request);
                expect(response).to.be.instanceOf(Response);
                expect(await response.text()).to.equal('test');
                expect(await cache.match(request).then(res => res?.text())).to.equal('test');
            });

            it('skips fetching the resource if already cached and fresh', async () => {
                const date = new Date('2024-01-01T00:00:00Z').toUTCString();

                const initialResponse = new Response('test', {
                    headers: { 'Last-Modified': date }
                });
                await cache.put('https://example.com/resource', initialResponse);

                const fetcher = async () => new Response('test2', {
                    headers: { 'Last-Modified': date }
                });
                const helper  = new CacheHelper('test-cache', cache, fetcher);
                const request = new Request('https://example.com/resource');

                const response = await helper.fetch(request);
                expect(response).to.be.instanceOf(Response);
                expect(await response.text()).to.equal('test');
                expect(await cache.match(request).then(res => res?.text())).to.equal('test');
            });

            it ('re-fetches the resource if cached but stale', async () => {
                const date = new Date('2024-01-01T00:00:00Z').toUTCString();

                const initialResponse = new Response('test', {
                    headers: { 'Last-Modified': date }
                });
                await cache.put('https://example.com/resource', initialResponse);

                const fetcher = async () => new Response('test2', {
                    headers: { 'Last-Modified': new Date('2024-01-02T00:00:00Z').toUTCString() }
                });
                const helper  = new CacheHelper('test-cache', cache, fetcher);
                const request = new Request('https://example.com/resource');

                const response = await helper.fetch(request);
                expect(response).to.be.instanceOf(Response);
                expect(await response.text()).to.equal('test2');
            });

            it('works with string as a request', async () => {
                const fetcher = sinon.spy(async () => new Response('test-string'));
                const helper  = new CacheHelper('test-cache', cache, fetcher);
                const response = await helper.fetch('https://example.com/string-resource');

                expect(response).to.be.instanceOf(Response);
                expect(await response.text()).to.equal('test-string');
                expect(fetcher).to.have.been.calledOnce;
            });
        });

        describe('isFresh', () => {
            it('sends a head request to check last-modified date', async () => {
                const request = new Request('https://example.com/resource');
                const cached  = new Response('cached', {
                    headers: { 'Last-Modified': new Date('2024-01-01T00:00:00Z').toUTCString() }
                });

                const fetcher = sinon.spy(async () => new Response(null, {
                    headers: { 'Last-Modified': new Date('2024-01-02T00:00:00Z').toUTCString() }
                }));

                const helper = new CacheHelper('test-cache', cache, fetcher);
                const isFresh = await helper.isFresh(request, cached);
                expect(isFresh).to.be.false;
                expect(fetcher).to.have.been.calledOnceWith(request, { method: 'HEAD' });
            });

            it('defaults to stale when last-modified header is missing', async () => {
                const request = new Request('https://example.com/resource');
                const cached  = new Response('cached');
                const fetcher = sinon.spy(async () => new Response(null));

                const helper = new CacheHelper('test-cache', cache, fetcher);
                const isFresh = await helper.isFresh(request, cached);
                expect(isFresh).to.be.false;
                expect(fetcher).to.have.been.calledOnceWith(request, { method: 'HEAD' });
            });
        });

        describe('list', () => {
            it('returns cache entry urls', async () => {
                const requestA = new Request('https://example.com/a');
                const requestB = new Request('https://example.com/b');
                await cache.put(requestA, new Response('a'));
                await cache.put(requestB, new Response('b'));
                const helper = new CacheHelper('test-cache', cache);

                const entries = await helper.list();
                expect(entries).to.deep.equal([requestA.url, requestB.url]);
            });
        });

        describe('prune', () => {
            it('deletes cache entries that match the predicate', async () => {
                const requestA = new Request('https://example.com/a');
                const requestB = new Request('https://example.com/b');
                await cache.put(requestA, new Response('a'));
                await cache.put(requestB, new Response('b'));
                const helper = new CacheHelper('test-cache', cache);
                await helper.prune((req) => req.url.endsWith('/a'));

                const entries = await helper.list();
                expect(entries).to.deep.equal([requestB.url]);
            });
        });

        describe('lastModifiedNow', () => {
            it('returns formatted string in GMT', () => {
                const formatted = CacheHelper.lastModifiedNow();
                expect(formatted).to.be.a('string');
                expect(formatted).to.match(/GMT/);
            });
        });
    });

    describe('create', () => {
        /** @type {sinon.SinonStubbedInstance<CacheStorage>} */
        let cacheStub;
        /** @type {sinon.SinonSpy} */
        let cacheOpenSpy;

        beforeEach(async () => {
            cacheStub = sinon.createStubInstance(CacheStorage);
            cacheOpenSpy = sinon.spy(caches, 'open');
        });
        afterEach(async () => {
            cacheOpenSpy.restore();

            await caches.delete('assets-0');
            await caches.delete('assets-1');
            await cacheStub.delete('assets-0');
            await cacheStub.delete('assets-1');
        });

        it('opens a cache with the given name and version', async () => {
            const helper = await CacheHelper.create({ name: 'assets', version: '1' });

            expect(helper.name).to.equal('assets-1');
            expect(cacheOpenSpy).to.have.been.calledWith('assets-1');
        });

        it('defaults to globalThis.caches and globalThis.fetch', async () => {
            const helper = await CacheHelper.create({ name: 'assets', version: '1' });
            expect(helper.name).to.equal('assets-1');
            expect(helper.fetcher).to.equal(globalThis.fetch);
            expect(cacheOpenSpy).to.have.been.calledWith('assets-1');
        });

        it('accepts custom provider and fetcher', async () => {
            const fetcher = async () => new Response('custom');

            const helper = await CacheHelper.create({ name: 'assets', version: '1', provider: cacheStub, fetcher });
            expect(helper.name).to.equal('assets-1');
            expect(helper.fetcher).to.equal(fetcher);
            expect(cacheStub.open).to.have.been.calledWith('assets-1');
        });

        it('cleans up all other caches with the same base name when cleanup is true', async () => {
            const cache = await caches.open('assets-0');

            const requestA = new Request('https://example.com/a');
            const requestB = new Request('https://example.com/b');
            await cache.put(requestA, new Response('a'));
            await cache.put(requestB, new Response('b'));

            expect(await caches.keys()).to.include('assets-0');
            const _ = await CacheHelper.create({ name: 'assets', version: '1', cleanup: true });
            expect(await caches.keys()).to.not.include('assets-0');

        });
    });
});
