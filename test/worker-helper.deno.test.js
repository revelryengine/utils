import { describe, it, expect } from 'bdd';

import { WorkerHelper } from '../lib/worker-helper.js';

describe('WorkerHelper shared=true', () => {
    it('throws if trying to use SharedWorker in unsupported environment', () => {
        const fn = () => new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'module', shared: true });
        expect(fn).to.throw('SharedWorker is not supported in this environment');
    });
});

describe('WorkerHelper', () => {
    describe('type=undefined', () => {
        it('throws if classic worker not supported in environment', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'));

            await expect(helper.init()).to.be.rejectedWith('Classic workers are not supported.');
            helper.disconnect();
        });
    });

    describe('type=class', () => {
        it('throws if classic worker not supported in environment', async () => {
            const helper = new WorkerHelper(import.meta.resolve('./fixtures/worker.js'), { type: 'classic' });

            await expect(helper.init()).to.be.rejectedWith('Classic workers are not supported.');
            helper.disconnect();
        });
    });
});

