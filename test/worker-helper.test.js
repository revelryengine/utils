import { describe, it, expect } from 'bdd';

import { WorkerHelper, WorkerHelperPool } from '../lib/worker-helper.js';

describe('WorkerHelper', () => {
    describe('callMethod', () => {
        it('calls a method on the worker and returns the result', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module' });
            await helper.init();
            const result = await helper.callMethod({ method: 'method', args: [] });
            expect(result).to.equal('bar');
            helper.disconnect();
        });

        it('aborts the method call when the provided signal is aborted', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module' });
            await helper.init();
            const controller = new AbortController();
            const promise = helper.callMethod({ method: 'method', args: [], signal: controller.signal });
            controller.abort('test abort');
            await expect(promise).to.be.rejectedWith('test abort');

            helper.disconnect();
        });

        it('rejects the method call when the worker method throws an error', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module' });
            await helper.init();
            const promise = helper.callMethod({ method: 'methodError', args: [] });
            await expect(promise).to.be.rejectedWith('Test error');
            helper.disconnect();
        });

        it('transfers ownership of Transferable objects to the worker', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module' });
            await helper.init();

            const bytes  = new Uint8Array([1, 2, 3, 4, 5]);
            const result = await helper.callMethod({ method: 'methodTransfer', args: [bytes], transfer: [bytes.buffer] });

            expect(bytes.byteLength).to.equal(0);
            expect(result.byteLength).to.equal(5);
            expect(result).to.deep.equal(new Uint8Array([5, 4, 3, 2, 1]));

            helper.disconnect();
        });
    });

    describe('worker', ()=> {
        it('throws if trying to access worker before init', () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module' });
            expect(() => helper.worker).to.throw('WorkerHelper has not been initialized. Call init() before accessing the worker state.');
        });

        it('returns the Worker instance after init', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module' });
            await helper.init();
            expect(helper.worker).to.be.instanceOf(Worker);
            helper.disconnect();
        });
    });
});

describe('WorkerHelperPool', () => {
    it('loads multiple worker modules and calls their method', async () => {
        const pool = new WorkerHelperPool(import.meta.resolve('./fixtures/worker.js'), { count: 2, type: 'module' });
        await pool.init();
        const result1 = await pool.callMethod({ method: 'method', args: [] });
        const result2 = await pool.callMethod({ method: 'method', args: [] });
        expect(result1).to.equal('bar');
        expect(result2).to.equal('bar');
        await new Promise((resolve) => setTimeout(resolve, 100)); // Avoid unresolved fetch request leaks
        pool.disconnect();
    });

    it('aborts the method call when the provided signal is aborted', async () => {
        const helper = new WorkerHelperPool(import.meta.resolve('./fixtures/worker.js'), { count: 2, type: 'module' });
        await helper.init();
        const controller = new AbortController();
        const promise = helper.callMethod({ method: 'method', args: [], signal: controller.signal });
        controller.abort('test abort');
        await expect(promise).to.be.rejectedWith('test abort');

        helper.disconnect();
    });
});

