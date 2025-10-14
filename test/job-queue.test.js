import { describe, it, beforeEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assertEquals        } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertSpyCalls, spy } from 'https://deno.land/std@0.208.0/testing/mock.ts';

import { Job, Queue } from '../lib/job-queue.js';

/**
 * @import { Spy } from 'https://deno.land/std@0.208.0/testing/mock.ts'
 */

describe('Queue', () => {
    /** @type {Queue} */
    let queue;

    /**
     * @typedef {(signal: AbortSignal) => (void | Promise<void>)} Impl
     */

    beforeEach(() => {
        queue = new Queue();
    });

    /**
     * @param {Impl} [impl]
     */
    const createJob = (impl) => {
        /** @type {Spy<unknown, [AbortSignal], Promise<void>>} */
        const taskSpy = spy(async (signal) => {
            await impl?.(signal);
        });
        const job = new Job(taskSpy);
        return { job, taskSpy };
    };

    it('should process jobs in insertion order and returns processed count', async () => {
        /** @type {string[]} */
        const results = [];
        const { job: jobA } = createJob(() => { results.push('a'); });
        const { job: jobB } = createJob(() => { results.push('b'); });

        queue.add(jobA);
        queue.add(jobB);

        const count = await queue.process();

        assertEquals(results, ['a', 'b']);
        assertEquals(count, 2);
        assertEquals(await queue.process(), 0);
    });

    it('should skip aborted jobs', async () => {
        const { job: jobA, taskSpy: taskA } = createJob(() => {});
        const { job: jobB, taskSpy: taskB } = createJob(() => {});

        queue.add(jobA);
        queue.add(jobB);

        jobB.abort();
        const count = await queue.process();

        assertSpyCalls(taskA, 1);
        assertSpyCalls(taskB, 0);
        assertEquals(count, 1);
    });

    it('should ignore re-adding the currently processing job', async () => {
        /** @type {((value?: unknown) => void)|undefined} */
        let release;
        const { job } = createJob(async () => {
            await new Promise((resolve) => { release = resolve; });
        });

        queue.add(job);

        const processing = queue.process();
        queue.add(job);

        release?.();
        await processing;

        assertEquals(queue.add(job), undefined);
    });

    it('should call abort() when deleting the currently processing job', async () => {
        /** @type {((value?: unknown) => void)|undefined} */
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

        assertSpyCalls(taskA, 1);
        assertSpyCalls(taskB, 1);
        assertEquals(jobA.signal.aborted, true);
    });

    it('should abort the current job and prevents further processing when dispose() is called', async () => {
        /** @type {((value?: unknown) => void)|undefined} */
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

        assertEquals(jobA.signal.aborted, true);
        assertEquals(processed, 1);
        assertEquals(remainder, 0);
        assertSpyCalls(taskA, 1);
        assertSpyCalls(taskB, 0);
    });
});
