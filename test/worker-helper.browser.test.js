import { describe, it, expect, PromiseDeferred, afterEach } from 'bdd';

import { WorkerHelper } from '../lib/worker-helper.js';

describe('WorkerHelper shared=true', () => {
    describe('worker', ()=> {
        it('throws if trying to access target before init', () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            expect(() => helper.worker).to.throw('WorkerHelper has not been initialized. Call init() before accessing the worker state.');
        });

        it('returns the Worker instance after init', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper.init();
            expect(helper.worker).to.be.instanceOf(SharedWorker);
            helper.disconnect();
        });
    });

    describe('callMethod', () => {
        it('calls a method on the worker and returns the result', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper.init();
            const result = await helper.callMethod({ method: 'method', args: [] });
            expect(result).to.equal('bar');
            helper.disconnect();
        });

        it('aborts the method call when the provided signal is aborted', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper.init();
            const controller = new AbortController();
            const promise = helper.callMethod({ method: 'method', args: [], signal: controller.signal });
            controller.abort('test abort');
            await expect(promise).to.be.rejectedWith('test abort');

            helper.disconnect();
        });

        it('rejects the method call when the worker method throws an error', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper.init();
            const promise = helper.callMethod({ method: 'methodError', args: [] });
            await expect(promise).to.be.rejectedWith('Test error');
            helper.disconnect();
        });

        it('transfers ownership of Transferable objects to the worker', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper.init();

            const bytes  = new Uint8Array([1, 2, 3, 4, 5]);
            const result = await helper.callMethod({ method: 'methodTransfer', args: [bytes], transfer: [bytes.buffer] });

            expect(bytes.byteLength).to.equal(0);
            expect(result.byteLength).to.equal(5);
            expect(result).to.deep.equal(new Uint8Array([5, 4, 3, 2, 1]));

            helper.disconnect();
        });
    });

    describe('multiple pages', () => {
        afterEach(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50)); // Give time for SharedWorker locks to clear
        });

        async function openPage() {
            const id = Math.random().toString(16).slice(2);
            const page = globalThis.open(`${import.meta.resolve('./fixtures/worker-browser.html')}#${id}`, '_blank');

            if (!page) throw new Error('Failed to open page');

            const abortCtl = new AbortController();

            return PromiseDeferred.timeout(new Promise((resolve) => {
                globalThis.addEventListener('message', (message) => {
                    if (message.data?.id === id) {
                        resolve(message);
                    }
                }, { signal: abortCtl.signal });
            }), 1000, 'Timeout').catch((e) => {
                page?.close();
                throw e;
            }).then((message) => ({ count: message.data.count, page })).finally(() => abortCtl.abort());
        }

        it('disconnects on pagehide', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper.init();

            globalThis.dispatchEvent(new Event('pagehide'));
            expect(() => helper.worker).to.throw('WorkerHelper has not been initialized. Call init() before accessing the worker state.');
        });

        it('shares the same worker instance between pages', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper.init();

            const count0 = await helper.callMethod({ method: 'methodIncrement', args: [] });
            expect(count0).to.equal(0);

            const { count: count1, page: page1 } = await openPage();
            const { count: count2, page: page2 } = await openPage();
            const { count: count3, page: page3 } = await openPage();

            expect(count1).to.equal(1);
            expect(count2).to.equal(2);
            expect(count3).to.equal(3);

            page1.close();
            page2.close();
            page3.close();

            helper.disconnect();
        });

        it('falls back to new worker when original page is closed', async () => {
            const helper0 = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper0.init();

            const count0 = await helper0.callMethod({ method: 'methodIncrement', args: [] });
            expect(count0).to.equal(0);

            const helper1 = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
            await helper1.init();

            const count1 = await helper1.callMethod({ method: 'methodIncrement', args: [] });
            expect(count1).to.equal(1);

            helper0.disconnect();

            const { count: count2, page: page2 } = await openPage();
            expect(count2).to.equal(2);

            page2.close();

            helper1.disconnect();
        });
    });
});
