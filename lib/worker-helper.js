import { NonNull } from './non-null.js';

/** This URL must match the import found in `../deps/es-module-shims.js` */
const esModuleShimsURL = import.meta.resolve('https://cdn.jsdelivr.net/npm/es-module-shims@1.8.3/dist/es-module-shims.wasm.js');
const importmapContent = /** @type {globalThis & { importmapContent: string }} */(globalThis).importmapContent ?? globalThis.document?.querySelector('script[type="importmap"]')?.textContent ?? '{}';

/** @type {Promise<string>} */
let esModuleShimsPromise;

export class WorkerHelper {
    /** @type {Promise<any>|undefined} */
    #initPromise;

    /** @type {Worker|SharedWorker|null} */
    #worker = null;
    get worker () { return NonNull(this.#worker, `${this.constructor.name} not initialized`)};

    get #target() {
        return (this.worker instanceof SharedWorker ? this.worker.port: this.worker);
    }

    /**
     * @param {URL|string} uri - a string representing the URL of the module script the worker will execute.
     */
    constructor(uri) {
        this.uri = uri.toString();
    }

    async createWorkerBlob() {
        const blob = URL.createObjectURL(new Blob([`
            ${await WorkerHelper.getModulePreamble(this.uri)}
        `], { type: 'application/javascript' }));

        return blob;
    }
    /**
     * @return {Promise<Worker|SharedWorker>}
     */
    async createWorker() {
        return new Worker(await this.createWorkerBlob());
    }

    async init() {
        this.#initPromise ??= (async () => {
            this.#worker = await this.createWorker();

            //create fetch proxy handler
            const requestChannel = new BroadcastChannel(`WorkerFetchProxy:${this.uri}`);
            requestChannel.onmessage = (e) => {

                const { id, uri, options } = e.data;
                // console.log(uri, options);

                const responseChannel = new BroadcastChannel(`WorkerFetchProxy:${this.uri}:${uri}`);
                const abortCtl        = new AbortController();

                responseChannel.onmessage = () => abortCtl.abort();

                navigator.locks.request(`WorkerFetchProxy:${this.uri}:${uri}`, { signal: abortCtl.signal }, (lock) => {
                    if(lock) {
                        return new Promise((resolve) => {
                            fetch(uri, options).then(async (res) => {
                                const body     = await res.arrayBuffer();
                                const headers  = Object.fromEntries(res.headers.entries());
                                const response = { status: res.status, statusText: res.statusText, headers, body };

                                this.#target.postMessage({ type: 'file', id, response });
                            }).catch(e => {
                                console.warn('fetch error', e);
                                this.#target.postMessage({ type: 'file', id, response: { status: 0, statusText: e } });
                            }).finally(() => {
                                responseChannel.postMessage(null);
                                resolve(null);
                            });
                        })
                    }
                }).catch(() => {});
            }
        })();
        return this.#initPromise;
    }

    /**
     * @param {string} uri
     */
    static async getModulePreamble(uri) {
        esModuleShimsPromise ??= fetch(esModuleShimsURL).then((res) => res.text());

        const esModuleShimsContent = await esModuleShimsPromise;

        return `
            const fetchChannel = new BroadcastChannel('WorkerFetchProxy:${uri}');
            const fetchQueue   = new Map();

            let fetchId = 0;
            class ResponseWrapper extends Response {
                #url;
                get url() { return this.#url; }
                constructor(body, init) {
                    super(body, init);
                    this.#url = init.url;
                }
            }

            const _fetch = globalThis.fetch;

            globalThis.fetch = async (uri, options) => {
                try {
                    return await _fetch(uri, options);
                } catch (e) {
                    console.warn(e);

                    const id = fetchId++;

                    // console.log('fetch', uri, id, options);

                    return new Promise((resolve, reject) => {
                        fetchQueue.set(id, ({ status, statusText, headers, body }) => {
                            fetchQueue.delete(fetchId);
                            if(status) {
                                return resolve(new ResponseWrapper(body, { status, statusText, headers, url: uri }));
                            } else {
                                reject(new Error('Failed to fetch'));
                            }
                        });
                        fetchChannel.postMessage({ id, uri: uri.toString(), options });
                    });
                }
            }

            globalThis.Worker ??= class {
                constructor() {
                    throw new Error('Worker not supported in this context');
                }
            }

            globalThis.SharedWorker ??= class {
                constructor() {
                    throw new Error('SharedWorker not supported in this context');
                }
            }

            globalThis.importmapContent = \`${importmapContent}\`;
            ${esModuleShimsContent};
            importShim.addImportMap(JSON.parse(importmapContent));

            let modulePromise;

            self.onmessage = async (message) => {
                const { data: { type }, ports: [port] } = message;

                modulePromise ??= importShim('${uri}').catch(e => {
                    console.warn(e);
                    port.postMessage({ type: 'error', ok: false, error: e })
                });

                // console.log('message', type);

                if(type === 'method') {
                    const { method, args = [] } = message.data;
                    const module = await modulePromise;

                    try {
                        const { result, transfer } = await module[method]?.(...args);
                        port.postMessage({ ok: true, result }, transfer);
                    } catch(e) {
                        port.postMessage({ ok: false, error: e });
                    }
                } else if(type === 'file') {
                    const { id, response } = message.data;

                    // console.log('message', type, id);

                    fetchQueue.get(id)?.(response);
                }
            }
        `
    }

    /**
     *
     * @param {{
    *  method:    string,
    *  args?:     any[],
    *  transfer?: Iterable<Transferable>,
    *  signal?:   AbortSignal
    * }} method
    */
    async callMethod({ method, args, transfer }) {
        let response;
        try {
            response = await WorkerHelper.asyncPostMessage(this.#target, { type: 'method', method, args }, transfer);
        } catch(e) {
            console.warn('Failed to call method', e);
            throw new Error('Failed to call method');
        }

        if(response.data?.ok) {
            return response.data.result;
        } else {
            console.warn('Error in shared worker', response.data?.error);
            throw response.data.error;
        }
    }

    /**
     * Extends a postMessage call with MessageChannel and returns a promise that resolves when the MessagePort responds on the worker side.
     *
     * @param {MessagePort|Worker} target
     * @param {any} message
     * @param {Iterable<Transferable>} [transfer]
     */
    static asyncPostMessage(target, message, transfer) {
        const channel = new MessageChannel();

        target.postMessage(message, transfer ? [...transfer, channel.port2] : [channel.port2]);

        return new Promise((resolve, reject) => {
            channel.port1.onmessage = (e) => resolve(e);
            channel.port1.onmessageerror = (e) => reject(e);
        });
    }
}

export class WorkerHelperPool {
    /** @type {Promise<this>|undefined} */
    #initPromise;

    /** @type {{ tasks: number, worker: WorkerHelper }[]} */
    #workerPool = [];

    #count;

    /**
     * @param {URL|string} uri - a string representing the URL of the module script the worker will execute.
     * @param {number} count
     */
    constructor(uri, count) {
        this.uri    = uri;
        this.#count = count;
    }

    init() {
        this.#initPromise ??= (async () => {
            this.#workerPool = [...new Array(this.#count)].map((_,i) => {
                return { tasks: 0, worker: new WorkerHelper(this.uri) };
            });

            for(const worker of this.#workerPool) {
                await worker.worker.init();
            }

            return this;
        })();

        return this.#initPromise;
    }

    /**
     *
     * @param {{
     *  method:    string,
     *  args?:     any[],
     *  transfer?: Iterable<Transferable>,
     *  signal?:   AbortSignal
     * }} method
     */
    async callMethod({ method, args, transfer }) {
        const [target] = this.#workerPool.sort((a, b) => a.tasks - b.tasks);

        target.tasks++;

        return target.worker.callMethod({ method, args, transfer }).finally(() => target.tasks--);
    }
}


export class SharedWorkerHelper extends WorkerHelper {
    async createWorker() {
        return new SharedWorker(await this.createWorkerBlob());
    }

    async createWorkerBlob() {
        const blob = await new Promise((resolve, reject) => {
            navigator.locks.request(`SharedWorker:${this.uri}`, { ifAvailable: true }, async (lock) => {
                const channel = new BroadcastChannel(`SharedWorker:${this.uri}`);

                if(lock) {
                    const blob = URL.createObjectURL(new Blob([`
                        ${await WorkerHelper.getModulePreamble(this.uri)}
                        self.onconnect = ({ ports: [port] }) => port.onmessage = self.onmessage;
                    `], { type: 'application/javascript' }));

                    channel.onmessage = () => channel.postMessage(blob);
                    resolve(blob);
                    return new Promise(() => {});// maintain lock for the lifetime of the tab
                } else {
                    new Promise((resolve, reject) => {
                        channel.onmessage = (e) => resolve(e.data);
                        channel.postMessage(null);
                        setTimeout(() => reject('timeout'), 1000);
                    }).then((blob) => {
                        navigator.locks.request(`SharedWorker:${this.uri}`, () => {
                            channel.onmessage = () => channel.postMessage(blob);
                            return new Promise(() => {}) // maintain lock for the lifetime of this tab if the original tab is closed
                        });
                        return resolve(blob);
                    }).catch((e) => {
                        reject(`Failed to fetch blob: ${e}`);
                        //retry?
                    });
                }
            });
        });

        return blob;
    }
}

