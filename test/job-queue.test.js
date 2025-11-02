import { describe, it, expect, beforeEach, sinon } from 'bdd';

import { Job, Queue } from '../lib/job-queue.js';

/**
 * @typedef {(signal: AbortSignal) => (void | Promise<void>)} Impl
 */

describe('Queue', () => {
    /** @type {Queue} */
    let queue;

    beforeEach(() => {
        queue = new Queue();
    });

    /**
     * @param {Impl} [impl]
     */
    const createJob = (impl) => {
        const taskSpy = sinon.spy(async (signal) => {
            await impl?.(signal);
        });
        const job = new Job(taskSpy);
        return { job, taskSpy };
    };

    it('processes jobs in insertion order and returns processed count', async () => {
        /** @type {string[]} */
        const results = [];
        const { job: jobA } = createJob(() => { results.push('a'); });
        const { job: jobB } = createJob(() => { results.push('b'); });

        queue.add(jobA);
        queue.add(jobB);

        const count = await queue.process();

        expect(results).to.deep.equal(['a', 'b']);
        expect(count).to.equal(2);
        expect(await queue.process()).to.equal(0);
    });

    it('skips aborted jobs', async () => {
        const { job: jobA, taskSpy: taskA } = createJob(() => {});
        const { job: jobB, taskSpy: taskB } = createJob(() => {});

        queue.add(jobA);
        queue.add(jobB);

        jobB.abort();
        const count = await queue.process();

        expect(taskA).to.have.callCount(1);
        expect(taskB).to.have.callCount(0);
        expect(count).to.equal(1);
    });

    it('ignores re-adding the currently processing job', async () => {
        /** @type {((value?: unknown) => void) | undefined} */
        let release;
        const { job } = createJob(async () => {
            await new Promise((resolve) => { release = resolve; });
        });

        queue.add(job);

        const processing = queue.process();
        queue.add(job);

        release?.();
        await processing;

        expect(queue.add(job)).to.equal(undefined);
    });

    it('calls abort() when deleting the currently processing job', async () => {
        /** @type {((value?: unknown) => void) | undefined} */
        let release;
        const { job: jobA, taskSpy: taskA } = createJob(async () => {
            await new Promise((resolve) => { release = resolve; });
        });
        const { job: jobB, taskSpy: taskB } = createJob(() => {});

        queue.add(jobA);
        queue.add(jobB);

        const processing = queue.process();
        queue.delete(jobA);

        release?.();
        await processing;

        expect(taskA).to.have.callCount(1);
        expect(taskB).to.have.callCount(1);
        expect(jobA.signal.aborted).to.equal(true);
    });

    it('aborts current job and prevents further processing when dispose() is called', async () => {
        /** @type {((value?: unknown) => void) | undefined} */
        let release;
        const { job: jobA, taskSpy: taskA } = createJob(async () => {
            await new Promise((resolve) => { release = resolve; });
        });
        const { job: jobB, taskSpy: taskB } = createJob(() => {});

        queue.add(jobA);
        queue.add(jobB);

        const processing = queue.process();
        queue.dispose();
        release?.();

        const processed = await processing;
        const remainder = await queue.process();

        expect(jobA.signal.aborted).to.equal(true);
        expect(processed).to.equal(1);
        expect(remainder).to.equal(0);
        expect(taskA).to.have.callCount(1);
        expect(taskB).to.have.callCount(0);
    });
});
