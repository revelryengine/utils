/**
 * WorkerHelper utility module for managing web workers and shared workers.
 * @module
 */
import { NonNull          } from './non-null.js';
import { importmapContent } from './importmap-content.js';
import { requestLock      } from './lock.js';

const esModuleShimsURL = import.meta.resolve('es-module-shims');
const importmap        = `${JSON.stringify(importmapContent())}`;

/** @type {Promise<string>} */
let esModuleShimsPromise;

/**
 * @typedef {object} WorkerHelperOptions - Options for the WorkerHelper.
 * @property {boolean} [shared] - If true, creates a SharedWorker instead of a Worker.
 *
 * @typedef {object} WorkerHelperPoolOptions - Options for the WorkerHelperPool constructor.
 * @property {number} count - The number of workers in the pool.
 *
 * @typedef {object} WorkerHelperState - The state of the WorkerHelper.
 * @property {Worker|SharedWorker} worker - The Worker or SharedWorker instance.
 * @property {MessageChannel} channel - The MessageChannel used for communication with the worker.
 */

/**
 * WorkerHelper is a utility class that facilitates communication between the main thread and web workers.
 * It handles worker initialization, module loading, method calling, and fetch proxying.
 *
 * A fetch proxy in this case is used to allow workers to proxy fetch requests through the script that created the worker,
 * this is important to make sure that requests work correctly in restricted origin environments such as vscode-extensions.
 *
 * Use `options.shared = true` to create a SharedWorker instead of a Worker. This is not supported in Deno.
 *
 * @example
 * ```javascript
 * const workerHelper = new WorkerHelper('path/to/worker/script.js');
 * await workerHelper.init();
 * const result = await workerHelper.callMethod({ method: 'myMethod', args: [1, 2, 3] });
 * ```
 */
export class WorkerHelper {
    /** @type {Promise<any>|null} */
    #initPromise = null;

    #abortCtl = new AbortController();

    /**
     * @type {WorkerHelperState | null}
     */
    #state = null;
    /**
     * The current state of the WorkerHelper.
     */
    get state() {
        return NonNull(this.#state, 'WorkerHelper has not been initialized. Call init() before accessing the worker state.')
    }

    /**
     * The Worker or SharedWorker instance.
     * @type {Worker|SharedWorker}
     */
    get worker () {
        return this.state.worker
    };

    get #target() {
        // deno-coverage-ignore-start - Not yet supported in Deno
        if (this.options?.shared) {
            return  /** @type {SharedWorker} */(this.worker).port;
        }
        // deno-coverage-ignore-stop
        return /** @type {Worker} */(this.worker);
    }

    /**
     * Creates an instance of WorkerHelper.
     * @param {URL|string} uri - a string representing the URL of the module script the worker will execute.
     * @param {WorkerOptions & WorkerHelperOptions} [options] - options to pass to the Worker constructor.
     */
    constructor(uri, options) {
        /**
         * Ths URI of the worker script.
         */
        this.uri = uri.toString();
        /**
         * The options for the Worker constructor.
         */
        this.options = options;

        /* c8 ignore start - Covered by Deno tests */
        if (this.options?.shared && typeof SharedWorker === 'undefined') {
            throw new Error('SharedWorker is not supported in this environment');
        }
        /* c8 ignore stop */
    }

    /**
     * Creates a blob URL for the worker script.
     */
    async #createWorkerBlobURL() {
        const preamble = await WorkerHelper.#getModulePreamble(this.uri);
        return URL.createObjectURL(new Blob([`${preamble}`], { type: 'application/javascript' }));
    }

    // deno-coverage-ignore-start - Not yet supported in Deno
    /**
     * Creates a blob URL for a SharedWorker script.
     */
    async #createSharedWorkerBlobURL() {
        return await new Promise((resolve, reject) => {
            const channel = new BroadcastChannel(`SharedWorker:${this.uri}`);

            requestLock(`SharedWorker:${this.uri}`, { ifAvailable: true }, async (lock) => {
                if (lock) {
                    const blob = await this.#createWorkerBlobURL();

                    channel.onmessage = () => channel.postMessage(blob);
                    resolve(blob);

                    // maintain lock for the lifetime of this tab if the original tab is closed or helper disconnected
                    return new Promise((resolve) => this.#abortCtl.signal.addEventListener('abort', resolve));
                } else {
                    return new Promise((resolve, reject) => {
                        channel.onmessage = (e) => resolve(e.data);
                        channel.postMessage(null);
                        setTimeout(() => reject('timeout'), 1000);
                    }).then((/** @type {string} */blob) => {
                        resolve(blob);

                        // Attempt to aquire new lock, if original tab gets closed, we will take over
                        return requestLock(`SharedWorker:${this.uri}`, { signal: this.#abortCtl.signal }, () => {
                            channel.onmessage = () => channel.postMessage(blob);
                            // maintain lock for the lifetime of this tab if the original tab is closed or helper disconnected
                            return new Promise((resolve) => this.#abortCtl.signal.addEventListener('abort', resolve));
                        });
                    });
                }
            }).catch(reject).finally(() => {
                channel.close()
            });
        });
    }
    // deno-coverage-ignore-stop

    /**
     * Creates a new Worker instance using the generated blob URL.
     * @return {Promise<Worker|SharedWorker>}
     */
    async #createWorker() {
        // deno-coverage-ignore-start - Not yet supported in Deno:
        if (this.options?.shared) {
            return new SharedWorker(await this.#createSharedWorkerBlobURL(), this.options);
        }
        // deno-coverage-ignore-stop

        return new Worker(await this.#createWorkerBlobURL(), this.options);
    }

    /**
     * Initializes the worker and prepares it for communication.
     */
    init() {
        this.#initPromise ??= (async () => {
            this.#abortCtl?.abort('Re-initializing worker');
            this.#abortCtl = new AbortController();

            this.#state = Object.freeze({
                worker:   await this.#createWorker(),
                channel:  new MessageChannel(),
            });

            this.state.channel.port1.onmessage = async ({ data: { uri, options }, ports: [port]}) => {
                const res     = await fetch(uri, options);
                const headers = new Headers(res.headers);

                const buffer = await res.arrayBuffer();

                /* c8 ignore start - This is covered by the deno tests */
                if (res.ok && !res.headers.get('content-type') && uri.startsWith('file://') && uri.endsWith('.js')) {
                    headers.set('Content-Type', 'application/javascript');
                }
                /* c8 ignore stop */

                port.postMessage({ uri, headers: Object.fromEntries(headers), status: res.status, statusText: res.statusText, body: buffer }, [buffer]);
                port.close();
            }

            // deno-coverage-ignore - Only used for SharedWorker which is not supported in Deno
            globalThis.addEventListener('pagehide', () => this.disconnect(), { signal: this.#abortCtl.signal });

            this.#target.postMessage({ type: 'connect' }, [this.state.channel.port2]);
        })();
        return this.#initPromise;
    }

    /**
     * Disconnects from the worker.
     */
    disconnect() {
        if (this.#state) {
            this.#state.channel.port1.postMessage({ type: 'disconnect' });
            this.#state.channel.port1.close();
            this.#state.channel.port2.close();
            this.#state = null;
        }
        this.#abortCtl.abort('Worker disconnected');
        this.#abortCtl = new AbortController();
    }

    /**
     * Calls a method on the worker.
     * @param {object} details - The method call details.
     * @param {string} details.method - The name of the method to call.
     * @param {any[]} [details.args] - The arguments to pass to the method.
     * @param {Iterable<Transferable>} [details.transfer] - Transferable objects to pass with the method call.
     * @param {AbortSignal} [details.signal] - An optional AbortSignal to cancel the method call.
     */
    async callMethod({ method, args, transfer, signal }) {
        const response = await WorkerHelper.#asyncPostMessage(this.state.channel.port1, { type: 'method', method, args }, transfer, signal);

        if (response.data?.ok) {
            return response.data.result;
        } else {
            throw response.data.error;
        }
    }

    /**
     * Generates the preamble script for the worker, which includes fetch proxying and import map handling.
     * @param {string} uri
     */
    static async #getModulePreamble(uri) {
        esModuleShimsPromise ??= fetch(esModuleShimsURL).then((res) => res.text());

        const esModuleShimsContent = await esModuleShimsPromise;

        return /* javascript */`// @ts-nocheck
            const _fetch = globalThis.fetch;

            const clients = [];

            ${WorkerHelper.#asyncPostMessage.toString().replace('async #asyncPostMessage', 'async function asyncPostMessage')}

            /** This is required for es-module-shims to work correctly */
            class ResponseWrapper extends Response {
                #url;
                get url() { return this.#url; }
                constructor(body, init) {
                    super(body, init);
                    this.#url = init.url;
                }
            }

            globalThis.fetch = async (uri, options) => {
                const client = clients[0];
                clients.push(clients.shift());

                return asyncPostMessage(client, { uri: uri.toString(), options }).catch(e => {
                    console.warn('Fetch proxy failed', e);
                }).then(response => {
                    const { uri, headers, status, statusText, body } = response.data;
                    return new ResponseWrapper(body, { headers, status, statusText, url: uri });
                });
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

            globalThis.importmapContent = ${importmap};
            ${esModuleShimsContent};
            importShim.addImportMap(globalThis.importmapContent);

            let modulePromise;

            self.onmessage = ({ ports: [client] }) => {
                clients.push(client);

                modulePromise ??= importShim('${uri}');

                client.onmessage = async ({ data, ports: [port] }) => {
                    switch(data.type) {
                        case 'disconnect':
                            client.close();
                            clients.splice(clients.indexOf(client), 1);
                            if (clients.length === 0) {
                                self.close();
                            }
                            break;
                        case 'method':
                            const module = await modulePromise;

                            const { method, args = [] } = data;

                            const abortCtl = new AbortController();

                            port.onmessage = (message) => abortCtl.abort(message.data);

                            try {
                                const { result, transfer } = await module[method]?.(...args, abortCtl.signal);

                                if (abortCtl.signal.aborted){ // check aborted in case method does not honor signal
                                    throw new DOMException(abortCtl.signal.reason, 'AbortError');
                                }

                                port.postMessage({ ok: true, result }, transfer);
                            } catch(e) {
                                port.postMessage({ ok: false, error: e });
                            }
                            break;
                    }
                    port.close();
                }
            }

            // Wrapper for SharedWorker
            self.onconnect = ({ ports: [port] }) => {
                console.log('SharedWorker connected');
                port.onmessage = ({ ports: [client] }) => {
                    console.log('SharedWorker onmessage received');
                    self.onmessage({ ports: [client] });
                    port.close();
                }
            }
        `
    }


    /**
     * Extends a postMessage call with MessageChannel and returns a promise that resolves when the MessagePort responds on the worker side.
     *
     * @param {MessagePort|Worker} target
     * @param {any} message
     * @param {Iterable<Transferable>} [transfer]
     * @param {AbortSignal} [signal]
     */
    static async #asyncPostMessage(target, message, transfer, signal) {
        const channel = new MessageChannel();

        target.postMessage(message, transfer ? [channel.port2, ...transfer] : [channel.port2]);

        return new Promise((resolve, reject) => {
            signal?.addEventListener('abort', () => {
                channel.port1.postMessage(signal.reason);
                reject(new DOMException(signal.reason, 'AbortError'));
            }, { once: true });
            channel.port1.onmessage = (e) => resolve(e);
        }).finally(() => {
            channel.port1.close();
            channel.port2.close();
        });
    }
}

/**
 * A pool of worker helpers for managing multiple web workers.
 * This class allows for distributing tasks across a specified number of workers,
 * balancing the load by assigning tasks to the least busy worker.
 * @example
 * ```javascript
 * const pool = new WorkerHelperPool('path/to/worker/script.js', 4);
 * await pool.init();
 * const result = await pool.callMethod({ method: 'myMethod', args: [1, 2, 3] });
 * ```
 */
export class WorkerHelperPool {
    /** @type {Promise<this>|null} */
    #initPromise = null;

    /** @type {{ tasks: number, worker: WorkerHelper }[]} */
    #workerPool = [];

    #count;

    /**
     * Creates an instance of WorkerHelperPool.
     * @param {URL|string} uri - a string representing the URL of the module script the worker will execute.
     * @param {WorkerOptions & WorkerHelperPoolOptions} options - options to pass to the Worker constructor along with the number of workers in the pool.
     */
    constructor(uri, { count, ...options }) {
        /**
         * The URI of the worker script.
         */
        this.uri    = uri;

        this.#count = count;
        /**
         * The options for the Worker constructor.
         */
        this.options = options;
    }

    /**
     * Initializes the worker pool.
     */
    init() {
        this.#initPromise ??= (async () => {
            this.#workerPool = [...new Array(this.#count)].map(() => {
                return { tasks: 0, worker: new WorkerHelper(this.uri, this.options) };
            });

            for (const worker of this.#workerPool) {
                await worker.worker.init();
            }

            return this;
        })();

        return this.#initPromise;
    }

    /**
     * Calls a method on the least busy worker in the pool.
     * @param {object} details - The method call details.
     * @param {string} details.method - The name of the method to call.
     * @param {any[]} [details.args] - The arguments to pass to the method.
     * @param {Iterable<Transferable>} [details.transfer] - Transferable objects to pass with the method call.
     * @param {AbortSignal} [details.signal] - An optional AbortSignal to cancel the method call.
     */
    async callMethod({ method, args, transfer, signal }) {
        const [target] = this.#workerPool.sort((a, b) => a.tasks - b.tasks);

        target.tasks++;

        return target.worker.callMethod({ method, args, transfer, signal }).finally(() => target.tasks--);
    }

    /**
     * Disconnects all workers in the pool.
     */
    disconnect() {
        for (const worker of this.#workerPool) {
            worker.worker.disconnect();
        }
        this.#workerPool.length = 0;
        this.#initPromise = null;
    }
}
