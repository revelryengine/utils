/**
 * Cache helper for caching fetch requests using the Cache API.
 * @module
 */
import { requestLock } from './lock.js';

/**
 * @typedef {(request: Request, init?: RequestInit) => Promise<Response>} Fetcher - A function that performs a fetch request.
 */

/**
 * CacheHelper provides a simple interface for caching fetch requests using the Cache API.
 * It supports cache versioning, automatic cleanup of old caches, and cache pruning based on a predicate.
 *
 * Not supported in Deno yet: https://github.com/denoland/deno/issues/29460
 *
 * @example
 * ```js
 * // Create a cache helper for API requests
 * const apiCache = await CacheHelper.create({
 *     name: 'api-cache',
 *     version: 'v1',
 *     cleanup: true,
 * });
 *
 * // Fetch a resource with caching
 * const response = await apiCache.fetch('https://api.example.com/data');
 * const data = await response.json();
 * ```
 */
export class CacheHelper {
    #name;
    /**
     * The name of the cache helper. This is used to uniquely identify the cache.
     */
    get name () { return this.#name; }

    #cache;
    /**
     * The underlying Cache instance.
     */
    get cache () { return this.#cache; }

    #fetcher;
    /**
     * The fetcher function used to make network requests.
     */
    get fetcher () { return this.#fetcher; }

    /**
     * Creates an instance of CacheHelper.
     * @param {string} name - The name of the cache.
     * @param {Cache} cache - The Cache instance to use.
     * @param {Fetcher} [fetcher] - Override the default fetch API.
     */
    constructor(name, cache, fetcher = globalThis.fetch) {
        this.#name  = name;
        this.#cache = cache;
        this.#fetcher = fetcher;
    }

    /**
     * Fetches a resource if not already cached.
     *
     * @param {URL|Request|string} resource - The resource to fetch.
     * @param {RequestInit} [init] - The request init options.
     */
    async fetch(resource, init) {
        const request = resource instanceof Request ? resource : new Request(resource, init);

        return requestLock(`CacheManager:${this.name}:${request.url.toString()}`, async () => {
            const cached = await this.cache.match(request);

            if (cached) {
                if (await this.isFresh(request, cached)) {
                    return cached;
                } else {
                    await cached.bytes(); // Close the cached response to avoid leaks in some environments
                }
            }

            const response = await this.#fetcher(request);
            if (response != cached) {
                await this.cache.put(request, response.clone());
            }
            return response;
        });
    }

    /**
     * Checks a cached response against a network HEAD request to see if it is fresh.
     *
     * @param {Request} request - The original request.
     * @param {Response} cached - The cached response.
     */
    async isFresh(request, cached) {
        const network = await this.#fetcher(request, { method: 'HEAD' }).then(res => new Date(res.headers.get('Last-Modified') ?? Date.now()).getTime());
        const local   = new Date(cached.headers.get('Last-Modified') ?? 0).getTime();
        return network <= local;

    }

    /**
     * Returns a list of all the entries in the cache.
     */
    async list() {
        return (await this.#cache.keys()).map(request => request.url);
    }

    /**
     * Prunes the cache based on a predecate.
     *
     * @param {(request: Request) => boolean} predecate - The predecate function to determine which entries to delete.
     */
    async prune(predecate) {
        for (const req of await this.cache.keys()) {
            if (predecate(req)) {
                await this.cache.delete(req);
            }
        }
    }

    /**
     * Opens the specified cache and returns a CacheManager instance.
     * If cleanup is true, all other caches with the same name are deleted.
     * @param {object} options - Configuration options for the cache.
     * @param {string} options.name - The base name of the cache.
     * @param {string} options.version - The version of the cache.
     * @param {boolean} [options.cleanup] - Whether to clean up old caches.
     * @param {Fetcher} [options.fetcher] - The fetcher function to use.
     * @param {CacheStorage} [options.provider] - The cache storage provider.
     */
    static async create({ name, version, cleanup, fetcher = globalThis.fetch, provider = globalThis.caches }) {
        const fullname = `${name}-${version}`;
        const cache = await provider.open(fullname);

        if (cleanup) {
            for (const key of await provider.keys()) {
                if (key.startsWith(name) && key !== fullname) {
                    await provider.delete(key);
                }
            }
        }

        return new CacheHelper(fullname, cache, fetcher);
    }



    /**
     * Formatter for the last-modified header.
     */
    static lastModifiedFormatter = new Intl.DateTimeFormat('en-GB', {
        weekday:      'short',
        day:          '2-digit',
        month:        'short',
        year:         'numeric',
        hour:         '2-digit',
        minute:       '2-digit',
        second:       '2-digit',
        timeZoneName: 'shortOffset',
        timeZone:     'GMT'
    });

    /**
     * Returns the current date and time formatted for the last-modified header.
     */
    static lastModifiedNow() {
        return this.lastModifiedFormatter.format(Date.now());
    }
}
