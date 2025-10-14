import { beforeEach, afterEach, describe, it } from 'https://deno.land/std@0.208.0/testing/bdd.ts';
import { assert, assertEquals, assertExists, assertRejects, assertStrictEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { WorkerHelper, WorkerHelperPool, SharedWorkerHelper } from '../lib/worker-helper.js';

/**
 * Helper to await two microtasks to let any queued promises settle.
 */
async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

class MockMessagePort {
    constructor() {
        /** @type {MockMessagePort|undefined} */
        this.linkedPort = undefined;
        this.onmessage = null;
        this.onmessageerror = null;
    }

    postMessage(data) {
        this.linkedPort?.onmessage?.({ data });
    }

    triggerMessage(data) {
        this.linkedPort?.onmessage?.({ data });
    }

    triggerError(error) {
        this.linkedPort?.onmessageerror?.(error);
    }

    start() {}
    close() {}
}

class MockMessageChannel {
    constructor() {
        this.port1 = new MockMessagePort();
        this.port2 = new MockMessagePort();
        this.port1.linkedPort = this.port2;
        this.port2.linkedPort = this.port1;
    }
}

class MockBroadcastChannel {
    static channels = new Map();

    constructor(name) {
        this.name      = name;
        this.messages  = [];
        this.onmessage = null;

        const collection = MockBroadcastChannel.channels.get(name) ?? [];
        collection.push(this);
        MockBroadcastChannel.channels.set(name, collection);
    }

    postMessage(data) {
        this.messages.push(data);
        const peers = MockBroadcastChannel.channels.get(this.name) ?? [];
        for(const channel of peers) {
            if(channel !== this) {
                channel.onmessage?.({ data });
            }
        }
    }

    emit(data) {
        this.onmessage?.({ data });
    }

    close() {}

    static get(name) {
        return MockBroadcastChannel.channels.get(name) ?? [];
    }

    static reset() {
        MockBroadcastChannel.channels.clear();
    }
}

const originalGlobals = {
    fetch: globalThis.fetch,
    MessageChannel: globalThis.MessageChannel,
    BroadcastChannel: globalThis.BroadcastChannel,
    Worker: globalThis.Worker,
    SharedWorker: globalThis.SharedWorker,
    navigator: globalThis.navigator,
    createObjectURL: URL.createObjectURL,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
};
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let navigatorStub;

let fetchRoutes = [];
let fetchCalls = [];
let lockBehaviors = [];
let lockRequests = [];
let objectUrls = new Map();
let objectUrlCounter = 0;

function addFetchRoute(match, handler) {
    fetchRoutes.unshift({ match, handler });
}

function resetFetchRoutes() {
    fetchRoutes = [];
    addFetchRoute((url) => url.includes('es-module-shims'), () => Promise.resolve(new Response('//shim content', { status: 200 })));
}

function handleFetch(input, init) {
    const url = String(input);
    fetchCalls.push({ url, init });

    for(const route of fetchRoutes) {
        if(route.match(url, init)) {
            return route.handler(url, init);
        }
    }

    throw new Error(`Unhandled fetch: ${url}`);
}

function nextLockBehavior() {
    return lockBehaviors.length ? lockBehaviors.shift() : { lock: true };
}

function recordLockRequest(name, options, promise, callback) {
    lockRequests.push({ name, options, promise, callback });
    return promise;
}

function locksRequestStub(name, options, callback) {
    if(typeof options === 'function' && callback === undefined) {
        callback = options;
        options  = undefined;
    }

    const behavior = nextLockBehavior();

    if(behavior.reject) {
        const rejection = Promise.reject(behavior.reject);
        return recordLockRequest(name, options, rejection, callback);
    }

    if(behavior.skipCallback) {
        return recordLockRequest(name, options, Promise.resolve(undefined), callback);
    }

    const result = callback?.(behavior.lock);
    if(result instanceof Promise) {
        return recordLockRequest(name, options, result, callback);
    }

    return recordLockRequest(name, options, Promise.resolve(result), callback);
}

beforeEach(() => {
    fetchCalls      = [];
    lockBehaviors   = [];
    lockRequests    = [];
    objectUrls      = new Map();
    objectUrlCounter = 0;

    resetFetchRoutes();

    globalThis.fetch = handleFetch;
    globalThis.MessageChannel = MockMessageChannel;
    globalThis.BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.reset();

    navigatorStub = { locks: { request: locksRequestStub } };
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        get: () => navigatorStub,
        set: (value) => {
            navigatorStub = value;
        }
    });

    URL.createObjectURL = (blob) => {
        const url = `blob:${++objectUrlCounter}`;
        objectUrls.set(url, blob);
        return url;
    };
});

afterEach(() => {
    globalThis.fetch            = originalGlobals.fetch;
    globalThis.MessageChannel   = originalGlobals.MessageChannel;
    globalThis.BroadcastChannel = originalGlobals.BroadcastChannel;
    globalThis.Worker           = originalGlobals.Worker;
    globalThis.SharedWorker     = originalGlobals.SharedWorker;
    URL.createObjectURL         = originalGlobals.createObjectURL;
    globalThis.setTimeout       = originalGlobals.setTimeout;
    globalThis.clearTimeout     = originalGlobals.clearTimeout;

    if(originalNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    } else {
        delete globalThis.navigator;
    }

    resetFetchRoutes();
    fetchCalls    = [];
    lockBehaviors = [];
    lockRequests  = [];
    objectUrls.clear();
    MockBroadcastChannel.reset();
});

function getObjectUrlContent(url) {
    const blob = objectUrls.get(url);
    assertExists(blob, `Missing blob for ${url}`);
    return blob.text();
}

function queueLockBehavior(behavior) {
    lockBehaviors.push(behavior);
}

function getFetchCallUrls() {
    return fetchCalls.map(({ url }) => url);
}

describe('WorkerHelper', () => {
    describe('constructor', () => {
        it('should store the uri as a string', () => {
            const helper = new WorkerHelper(new URL('https://example.com/worker.js'));
            assertStrictEquals(helper.uri, 'https://example.com/worker.js');
        });
    });

    describe('worker', () => {
        it('should throw when accessed before initialization', () => {
            const helper = new WorkerHelper('worker.js');
            assertThrows(() => helper.worker, Error, 'WorkerHelper not initialized');
        });

        it('should return the worker after initialization', async () => {
            const stubWorker = { postMessage: () => {} };
            const helper     = new WorkerHelper('worker.js');
            helper.createWorker = async () => stubWorker;

            await helper.init();

            assertStrictEquals(helper.worker, stubWorker);
        });
    });

    describe('target', () => {
        it('should return the same instance as worker', async () => {
            const stubWorker = { postMessage: () => {} };
            const helper     = new WorkerHelper('worker.js');
            helper.createWorker = async () => stubWorker;

            await helper.init();

            assertStrictEquals(helper.target, stubWorker);
        });
    });

    describe('createWorkerBlob', () => {
        const originalGetModulePreamble = WorkerHelper.getModulePreamble;

        beforeEach(() => {
            WorkerHelper.getModulePreamble = async (uri) => `// preamble for ${uri}`;
        });

        afterEach(() => {
            WorkerHelper.getModulePreamble = originalGetModulePreamble;
        });

        it('should create a blob URL containing the generated preamble', async () => {
            const helper = new WorkerHelper('worker.js');
            const url    = await helper.createWorkerBlob();

            assertExists(url);
            const content = await getObjectUrlContent(url);
            assert(content.includes('preamble for worker.js'));
        });
    });

    describe('createWorker', () => {
        let originalWorker;

        beforeEach(() => {
            originalWorker = globalThis.Worker;
        });

        afterEach(() => {
            globalThis.Worker = originalWorker;
        });

        it('should instantiate a Worker with the blob returned by createWorkerBlob', async () => {
            const created = [];

            class StubWorker {
                constructor(url) {
                    this.url = url;
                    created.push(this);
                }

                postMessage() {}
            }

            globalThis.Worker = StubWorker;

            const helper = new WorkerHelper('worker.js');
            helper.createWorkerBlob = async () => 'blob:123';

            const worker = await helper.createWorker();

            assertStrictEquals(worker, created[0]);
            assertStrictEquals(worker.url, 'blob:123');
        });
    });

    describe('init', () => {
        it('should initialize once and proxy successful fetch responses', async () => {
            const workerMessages = [];
            const helper         = new WorkerHelper('worker.js');
            helper.createWorker  = async () => ({
                postMessage(message) {
                    workerMessages.push(message);
                }
            });

            addFetchRoute((url) => url === 'https://assets/success', () =>
                Promise.resolve(new Response('payload', {
                    status: 201,
                    statusText: 'Created',
                    headers: new Headers([['x-test', 'value']])
                }))
            );

            await helper.init();

            const [requestChannel] = MockBroadcastChannel.get('WorkerFetchProxy:worker.js');
            assertExists(requestChannel);

            queueLockBehavior({ lock: true });
            requestChannel.emit({ id: 1, uri: 'https://assets/success', options: { method: 'GET' } });

            await lockRequests.at(-1)?.promise;
            await flushMicrotasks();

            const [responseMessage] = workerMessages;
            assertExists(responseMessage);
            assertEquals(responseMessage.type, 'file');
            assertEquals(responseMessage.id, 1);
            assertEquals(responseMessage.response.status, 201);
            assertEquals(responseMessage.response.statusText, 'Created');
            assertEquals(responseMessage.response.headers['x-test'], 'value');
            assertEquals(responseMessage.response.headers['content-type'], 'text/plain;charset=UTF-8');
            const decoded = new TextDecoder().decode(new Uint8Array(responseMessage.response.body));
            assertEquals(decoded, 'payload');

            const { options } = lockRequests.at(-1);
            assertExists(options?.signal);

            const [responseChannel] = MockBroadcastChannel.get('WorkerFetchProxy:worker.js:https://assets/success');
            assertExists(responseChannel);
            responseChannel.emit(null);

            assertEquals(options.signal.aborted, true);
        });

        it('should return the same promise when called multiple times', async () => {
            const helper = new WorkerHelper('worker.js');
            helper.createWorker = async () => ({ postMessage() {} });

            const first = helper.init();
            const second = helper.init();

            assertStrictEquals(first, second);
            await first;
        });

        it('should report fetch failures without throwing', async () => {
            const helper        = new WorkerHelper('worker.js');
            const workerMessages = [];
            helper.createWorker = async () => ({
                postMessage(message) {
                    workerMessages.push(message);
                }
            });

            addFetchRoute((url) => url === 'https://assets/fail', () => Promise.reject(new Error('boom')));

            const warnings    = [];
            const originalWarn = console.warn;
            console.warn = (...args) => warnings.push(args);

            try {
                await helper.init();

                queueLockBehavior({ lock: true });
                const [requestChannel] = MockBroadcastChannel.get('WorkerFetchProxy:worker.js');
                requestChannel.emit({ id: 2, uri: 'https://assets/fail', options: {} });

                await lockRequests.at(-1)?.promise;
                await flushMicrotasks();

                const message = workerMessages.at(-1);
                assertExists(message);
                assertEquals(message.response.status, 0);
                assertEquals('body' in message.response, false);
                assertEquals(warnings.length > 0, true);
            } finally {
                console.warn = originalWarn;
            }
        });

        it('should ignore navigator lock rejections', async () => {
            const helper = new WorkerHelper('worker.js');
            helper.createWorker = async () => ({ postMessage() {} });

            await helper.init();

            queueLockBehavior({ reject: new Error('busy') });
            const [requestChannel] = MockBroadcastChannel.get('WorkerFetchProxy:worker.js');
            requestChannel.emit({ id: 3, uri: 'https://assets/unhandled', options: {} });

            await flushMicrotasks();
        });

        it('should gracefully handle lock contention where no lock is acquired', async () => {
            const helper = new WorkerHelper('worker.js');
            helper.createWorker = async () => ({ postMessage() {} });

            await helper.init();

            queueLockBehavior({ lock: undefined });
            const [requestChannel] = MockBroadcastChannel.get('WorkerFetchProxy:worker.js');
            requestChannel.emit({ id: 4, uri: 'https://assets/skip', options: {} });

            await lockRequests.at(-1)?.promise;
        });
    });

    describe('getModulePreamble', () => {
        it('should fetch the shim once and embed the worker uri', async () => {
            let shimFetchCount = 0;
            addFetchRoute((url) => url.includes('es-module-shims'), () => {
                shimFetchCount++;
                return Promise.resolve(new Response('//shim', { status: 200 }));
            });

            const first = await WorkerHelper.getModulePreamble('https://example.com/worker.js');
            assert(first.includes('WorkerFetchProxy:https://example.com/worker.js'));
            assert(first.includes("importShim('https://example.com/worker.js')"));
            assertEquals(shimFetchCount, 1);

            const second = await WorkerHelper.getModulePreamble('https://example.com/other.js');
            assert(second.includes('WorkerFetchProxy:https://example.com/other.js'));
            assertEquals(shimFetchCount, 1);

            assertEquals(getFetchCallUrls().filter((url) => url.includes('es-module-shims')).length >= 1, true);
        });
    });

    describe('callMethod', () => {
        let originalAsyncPostMessage;

        beforeEach(() => {
            originalAsyncPostMessage = WorkerHelper.asyncPostMessage;
        });

        afterEach(() => {
            WorkerHelper.asyncPostMessage = originalAsyncPostMessage;
        });

        async function setupHelper() {
            const helper = new WorkerHelper('worker.js');
            helper.createWorker = async () => ({ postMessage() {} });
            await helper.init();
            return helper;
        }

        it('should resolve with the result when the worker responds successfully', async () => {
            WorkerHelper.asyncPostMessage = () => Promise.resolve({ data: { ok: true, result: 42 } });
            const helper = await setupHelper();

            const result = await helper.callMethod({ method: 'compute', args: [1, 2] });
            assertStrictEquals(result, 42);
        });

        it('should throw a wrapped error when message dispatch fails', async () => {
            WorkerHelper.asyncPostMessage = () => Promise.reject(new Error('channel broken'));
            const helper = await setupHelper();

            const warnings = [];
            const originalWarn = console.warn;
            console.warn = (...args) => warnings.push(args);

            try {
                await assertRejects(() => helper.callMethod({ method: 'compute' }), Error, 'Failed to call method');
                assertEquals(warnings.length > 0, true);
            } finally {
                console.warn = originalWarn;
            }
        });

        it('should rethrow worker provided errors', async () => {
            const workerError = new TypeError('bad request');
            WorkerHelper.asyncPostMessage = () => Promise.resolve({ data: { ok: false, error: workerError } });
            const helper = await setupHelper();

            const warnings = [];
            const originalWarn = console.warn;
            console.warn = (...args) => warnings.push(args);

            try {
                const error = await assertRejects(() => helper.callMethod({ method: 'compute' }), TypeError, 'bad request');
                assertStrictEquals(error, workerError);
                assertEquals(warnings.length > 0, true);
            } finally {
                console.warn = originalWarn;
            }
        });
    });

    describe('asyncPostMessage', () => {
        it('should resolve when the target responds', async () => {
            const target = {
                lastMessage: null,
                lastTransfer: null,
                postMessage(message, transfer) {
                    this.lastMessage  = message;
                    this.lastTransfer = transfer;
                }
            };

            const payload = { type: 'method' };
            const promise = WorkerHelper.asyncPostMessage(target, payload);

            assertStrictEquals(target.lastMessage, payload);
            assertEquals(target.lastTransfer.length, 1);

            target.lastTransfer[0].triggerMessage('ok');
            const event = await promise;
            assertEquals(event.data, 'ok');
        });

        it('should append the channel port to provided transferables', async () => {
            const target = {
                lastTransfer: null,
                postMessage(_, transfer) {
                    this.lastTransfer = transfer;
                }
            };

            const transferable = [{ id: 'buffer' }];
            const promise = WorkerHelper.asyncPostMessage(target, { type: 'method' }, transferable);

            assertEquals(target.lastTransfer.length, 2);
            assertStrictEquals(target.lastTransfer[0], transferable[0]);

            target.lastTransfer[1].triggerMessage('done');
            const event = await promise;
            assertEquals(event.data, 'done');
        });

        it('should reject when the port reports a message error', async () => {
            const target = {
                lastTransfer: null,
                postMessage(_, transfer) {
                    this.lastTransfer = transfer;
                }
            };

            const promise = WorkerHelper.asyncPostMessage(target, { type: 'method' });
            const error   = new Error('message error');

            target.lastTransfer[0].triggerError(error);

            const thrown = await assertRejects(() => promise);
            assertStrictEquals(thrown, error);
        });
    });
});

describe('WorkerHelperPool', () => {
    describe('constructor', () => {
        it('should store the provided uri string', () => {
            const pool = new WorkerHelperPool('worker.js', 2);
            assertStrictEquals(pool.uri, 'worker.js');
        });
    });

    describe('init', () => {
        let originalInit;
        let initCallCount;
        let createdUris;

        beforeEach(() => {
            originalInit   = WorkerHelper.prototype.init;
            initCallCount  = 0;
            createdUris    = [];
            WorkerHelper.prototype.init = function () {
                initCallCount++;
                createdUris.push(this.uri);
                return Promise.resolve(this);
            };
        });

        afterEach(() => {
            WorkerHelper.prototype.init = originalInit;
        });

        it('should create the requested number of workers and resolve to the pool', async () => {
            const pool   = new WorkerHelperPool('worker.js', 3);
            const result = await pool.init();

            assertStrictEquals(result, pool);
            assertEquals(initCallCount, 3);
            assertEquals(createdUris, ['worker.js', 'worker.js', 'worker.js']);
        });

        it('should only initialize once when called repeatedly', async () => {
            const pool = new WorkerHelperPool('worker.js', 1);

            const first  = pool.init();
            const second = pool.init();

            assertStrictEquals(first, second);
            await first;
            assertEquals(initCallCount, 1);
        });
    });

    describe('callMethod', () => {
        let originalInit;
        let originalCallMethod;
        /** @type {Array<(record: { workerId: number, payload: any }) => Promise<any>>} */
        let callBehaviors;
        let callRecords;
        let workerIdCounter;

        beforeEach(() => {
            originalInit       = WorkerHelper.prototype.init;
            originalCallMethod = WorkerHelper.prototype.callMethod;
            callBehaviors      = [];
            callRecords        = [];
            workerIdCounter    = 0;

            WorkerHelper.prototype.init = function () {
                if(!Object.prototype.hasOwnProperty.call(this, '__id')) {
                    Object.defineProperty(this, '__id', {
                        configurable: true,
                        enumerable: false,
                        writable: true,
                        value: workerIdCounter++
                    });
                }
                return Promise.resolve(this);
            };

            WorkerHelper.prototype.callMethod = function (payload) {
                const record = { workerId: this.__id, payload };
                callRecords.push(record);
                const behaviour = callBehaviors.shift();
                return behaviour ? behaviour(record) : Promise.resolve(`${payload.method}-result`);
            };
        });

        afterEach(() => {
            WorkerHelper.prototype.init       = originalInit;
            WorkerHelper.prototype.callMethod = originalCallMethod;
        });

        it('should dispatch work to the least busy worker', async () => {
            const pool = new WorkerHelperPool('worker.js', 2);
            await pool.init();

            /** @type {(value: string) => void} */
            let resolveFirst;
            callBehaviors.push(() => new Promise((resolve) => { resolveFirst = resolve; }));
            callBehaviors.push(() => Promise.resolve('second result'));

            const firstPromise  = pool.callMethod({ method: 'one' });
            const secondPromise = pool.callMethod({ method: 'two' });

            resolveFirst?.('first result');

            assertEquals(await firstPromise, 'first result');
            assertEquals(await secondPromise, 'second result');
            assertEquals(callRecords.map((record) => record.workerId), [0, 1]);
        });

        it('should decrement task counts even when a worker rejects', async () => {
            const pool = new WorkerHelperPool('worker.js', 1);
            await pool.init();

            callBehaviors.push(() => Promise.reject(new Error('failure')));
            callBehaviors.push(() => Promise.resolve('recovered'));

            await assertRejects(() => pool.callMethod({ method: 'fail' }), Error, 'failure');
            const result = await pool.callMethod({ method: 'succeed' });

            assertEquals(result, 'recovered');
            assertEquals(callRecords.map((record) => record.workerId), [0, 0]);
        });
    });
});

describe('SharedWorkerHelper', () => {
    describe('constructor', () => {
        it('should store the provided uri string', () => {
            const helper = new SharedWorkerHelper(new URL('https://example.com/shared-worker.js'));
            assertStrictEquals(helper.uri, 'https://example.com/shared-worker.js');
        });
    });

    describe('target', () => {
        it('should return the underlying shared worker port', async () => {
            const helper = new SharedWorkerHelper('shared-worker.js');
            const port   = { postMessage() {} };
            helper.createWorker = async () => ({ port });

            await helper.init();

            assertStrictEquals(helper.target, port);
        });
    });

    describe('createWorker', () => {
        let originalSharedWorker;

        beforeEach(() => {
            originalSharedWorker = globalThis.SharedWorker;
        });

        afterEach(() => {
            globalThis.SharedWorker = originalSharedWorker;
        });

        it('should instantiate a SharedWorker with the blob URL', async () => {
            let constructedUrl;
            let createdWorker;

            class StubSharedWorker {
                constructor(url) {
                    constructedUrl = url;
                    createdWorker = this;
                    this.port = { postMessage() {} };
                }
            }

            globalThis.SharedWorker = StubSharedWorker;

            const helper = new SharedWorkerHelper('shared-worker.js');
            helper.createWorkerBlob = async () => 'blob:shared';

            const worker = await helper.createWorker();

            assertStrictEquals(constructedUrl, 'blob:shared');
            assertStrictEquals(worker, createdWorker);
        });
    });

    describe('createWorkerBlob', () => {
        const originalGetModulePreamble = WorkerHelper.getModulePreamble;

        beforeEach(() => {
            WorkerHelper.getModulePreamble = async (uri) => `// shared preamble for ${uri}`;
        });

        afterEach(() => {
            WorkerHelper.getModulePreamble = originalGetModulePreamble;
        });

        it('should create a shared worker blob when a lock is acquired', async () => {
            queueLockBehavior({ lock: true });

            const helper = new SharedWorkerHelper('shared-worker.js');
            const url    = await helper.createWorkerBlob();

            const content = await getObjectUrlContent(url);
            assert(content.includes('shared preamble for shared-worker.js'));
            assert(content.includes('self.onconnect'));

            const [channel] = MockBroadcastChannel.get('SharedWorker:shared-worker.js');
            assertExists(channel);

            const listener = new MockBroadcastChannel('SharedWorker:shared-worker.js');
            const forwarded = [];
            listener.onmessage = ({ data }) => forwarded.push(data);

            channel.onmessage?.();
            assertEquals(forwarded.at(-1), url);
        });

        it('should wait for an existing blob when the lock is unavailable', async () => {
            queueLockBehavior({ lock: false });
            queueLockBehavior({ lock: true });

            const responder = new MockBroadcastChannel('SharedWorker:shared-worker.js');
            responder.onmessage = (event) => {
                if(event.data === null) {
                    responder.postMessage('blob:existing');
                    responder.onmessage = null;
                }
            };

            const originalTimeout = globalThis.setTimeout;
            const originalClearTimeout = globalThis.clearTimeout;
            globalThis.setTimeout = () => 0;
            globalThis.clearTimeout = () => {};

            const helper = new SharedWorkerHelper('shared-worker.js');
            try {
                const blob = await helper.createWorkerBlob();

                assertStrictEquals(blob, 'blob:existing');
                assertEquals(lockRequests.length >= 2, true);

                const sharedChannels = MockBroadcastChannel.get('SharedWorker:shared-worker.js');
                const channelUnderTest = sharedChannels.find((channel) => channel !== responder && channel.messages.includes(null));
                assertExists(channelUnderTest);
                assertEquals(typeof channelUnderTest.onmessage, 'function');

                assertEquals(lockRequests.length, 2);
                const [, takeoverLock] = lockRequests;
                assertExists(takeoverLock?.callback);
                takeoverLock?.callback?.();

                const forwarded = [];
                const third = new MockBroadcastChannel('SharedWorker:shared-worker.js');
                third.onmessage = ({ data }) => forwarded.push(data);
                channelUnderTest.onmessage?.();
                assertEquals(forwarded.at(-1), 'blob:existing');

                const lastLock = lockRequests.at(-1);
                assertExists(lastLock);
                assert(lastLock.promise instanceof Promise);
            } finally {
                globalThis.setTimeout = originalTimeout;
                globalThis.clearTimeout = originalClearTimeout;
            }
        });

        it('should reject when no blob can be retrieved from another tab', async () => {
            queueLockBehavior({ lock: false });

            const originalTimeout = globalThis.setTimeout;
            const originalClearTimeout = globalThis.clearTimeout;
            let timeoutCallback;
            globalThis.setTimeout = (fn) => {
                timeoutCallback = fn;
                return 0;
            };
            globalThis.clearTimeout = () => {};

            const helper = new SharedWorkerHelper('shared-worker.js');

            try {
                const promise = helper.createWorkerBlob();
                assertExists(timeoutCallback);
                timeoutCallback?.();

                const reason = await promise.catch((error) => error);
                assertStrictEquals(reason, 'Failed to fetch blob: timeout');
            } finally {
                globalThis.setTimeout = originalTimeout;
                globalThis.clearTimeout = originalClearTimeout;
            }
        });
    });
});
