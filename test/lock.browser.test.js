import { describe, it, expect, PromiseDeferred } from 'bdd';

import { requestLock } from '../lib/lock.js';

describe('requestLock - browser.only', () => {

    /**
     * @param {'exclusive' | 'shared'} [mode='exclusive']
     */
    async function openSecondSource(mode = 'exclusive') {
        const page = globalThis.open(`${import.meta.resolve('./fixtures/lock-browser.html')}#${mode}`, '_blank');

        return PromiseDeferred.timeout(new Promise((resolve) => {
            globalThis.addEventListener('message', resolve, { once: true });
        }), 1000, 'Timeout').finally(() => page?.close());
    }

    describe('mode=exclusive', () => {
        it('acquires the lock when only a single page is running', async () => {
            let lockAquired = false;
            requestLock('test-lock', { mode: 'exclusive' }, async () => {
                lockAquired = true;
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(lockAquired).to.be.true;
        });

        it('blocks second source until first releases lock', async () => {
            let lockAquired = false;

            const deferred = new PromiseDeferred();

            // First acquire the lock and hold it
            requestLock('test-lock', { mode: 'exclusive' }, async () => {
                await deferred;
            });

            // Give the first lock a moment to be acquired
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Now open a second source
            const secondSourcePromise = openSecondSource().then(() => lockAquired = true);

            // Second source should not be able to acquire the lock yet (give it some time to try)
            await new Promise((resolve) => setTimeout(resolve, 200));
            expect(lockAquired).to.be.false;

            // Now release the lock
            deferred.resolve();

            // Wait for the second source to acquire the lock
            await secondSourcePromise;
            expect(lockAquired).to.be.true;
        });
    });

    describe('mode=shared', () => {
        it('allows multiple sources to acquire shared lock simultaneously', async () => {
            let lockAquired = false;

            const deferred = new PromiseDeferred();

            // First acquire the lock and hold it
            requestLock('test-lock', { mode: 'shared' }, async () => {
                await deferred;
            });

            // Give the first lock a moment to be acquired
            await new Promise((resolve) => setTimeout(resolve, 50));

            openSecondSource('shared').then(() => lockAquired = true);

            // Give process a moment to attempt to acquire the lock
            await new Promise((resolve) => setTimeout(resolve, 250));
            expect(lockAquired).to.be.true;

            deferred.resolve();
        });
    });

    describe('signal', () => {
        it('aborts lock request when signal is aborted', async () => {
            const controller = new AbortController();
            const signal = controller.signal;
            let lockAquired = false;

            const deferred = new PromiseDeferred();

            // First acquire the lock and hold it
            requestLock('test-lock', { mode: 'exclusive' }, async () => {
                await deferred;
            });

            // Give the first lock a moment to be acquired
            await new Promise((resolve) => setTimeout(resolve, 50));

            const promise2 = requestLock('test-lock', { mode: 'exclusive', signal }, async () => {
                lockAquired = true;
            });

            controller.abort('test abort');
            await expect(promise2).to.be.rejectedWith('test abort');
            expect(lockAquired).to.be.false;
            deferred.resolve();
        });

        it('aborts lock request when signal is aborted before requesting lock', async () => {
            const controller = new AbortController();
            const signal = controller.signal;
            controller.abort('test abort');
            let lockAquired = false;
            const promise = requestLock('test-lock', { mode: 'exclusive', signal }, async () => {
                lockAquired = true;
            });
            await expect(promise).to.be.rejectedWith('test abort');
            expect(lockAquired).to.be.false;
        });
    });
});
