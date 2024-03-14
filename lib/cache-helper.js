/**
 * @typedef {(request: Request) => Promise<Response>} Fetcher
 */

export class CacheHelper {
    #name;
    get name () { return this.#name; }

    #cache;
    get cache () { return this.#cache; }

    #fetcher;

    /**
     * @param {string} name
     * @param {Cache} cache
     * @param {Fetcher} [fetcher] - Override the default fetch API.
     */
    constructor(name, cache, fetcher = globalThis.fetch) {
        this.#name  = name;
        this.#cache = cache;
        this.#fetcher = fetcher;
    }

    /**
     * Returns a list of all the entries in the cache.
     */
    async list() {
        return (await this.#cache.keys()).map(request => request.url);
    }

    /**
     * Fetches a resource if not already cached.
     *
     * @param {URL|Request|string} resource
     * @param {RequestInit} [init]
     */
    async fetch(resource, init) {
        const request = resource instanceof Request ? resource : new Request(resource, init);

        return navigator.locks.request(`CacheManager:${this.name}:${request.url.toString()}`, async () => {
            const cached   = await this.cache.match(request);

            if(cached) {
                if(await CacheHelper.isFresh(request, cached)) {
                    return cached;
                }
            }

            const response = await this.#fetcher(request);
            if(response != cached) {
                await this.cache.put(request, response.clone());
            }
            return response;
        });
    }

    /**
     * Opens the specified cache and returns a CacheManager instance.
     * If cleanup is true, all other caches with the same name are deleted.
     *
     * @param {{
     *  name:     string,
     *  version:  string,
     *  cleanup?: boolean,
     *  fetcher?: Fetcher,
     * }} options
     */
    static async create({ name, version, cleanup, fetcher }) {
        const fullname = `${name}-${version}`;
        const cache = await caches.open(fullname);

        if(cleanup) {
            for(const key of await caches.keys()) {
                if(key.startsWith(name) && key !== fullname) {
                    await caches.delete(key);
                }
            }
        }

        return new CacheHelper(fullname, cache, fetcher);
    }

    /**
     * Prunes the cache based on a predecate.
     *
     * @param {(request: Request) => boolean} predecate
     */
    async prune(predecate) {
        for(const req of await this.cache.keys()) {
            if(predecate(req)) {
                await this.cache.delete(req);
            }
        }
    }

    /**
     * Checks a cached response against a network HEAD request to see if it is fresh.
     *
     * @param {Request} request
     * @param {Response} cached
     */
    static async isFresh(request, cached) {
        const network = await fetch(request, { method: 'HEAD' }).then(res => new Date(res.headers.get('Last-Modified') ?? 0).getTime());
        const local   = new Date(cached.headers.get('Last-Modified') ?? 0).getTime();
        return network <= local;

    }

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

    static lastModifiedNow() {
        return this.lastModifiedFormatter.format(Date.now());
    }
}
