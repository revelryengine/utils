import { describe, it, expect } from 'bdd';

import { requestLock } from '../lib/lock.js';

describe('requestLock', () => {
    describe('options', () => {
        it('defaults to exclusive mode', async () => {
            let modeUsed = null;
            await requestLock('test-lock', {}, async (lock) => {
                modeUsed = lock?.mode;
            });
            expect(modeUsed).to.equal('exclusive');
        });

        it('accepts shared mode', async () => {
            let modeUsed = null;
            await requestLock('test-lock', { mode: 'shared' }, async (lock) => {
                modeUsed = lock?.mode;
            });
            expect(modeUsed).to.equal('shared');
        });

        it('accepts exclusive mode', async () => {
            let modeUsed = null;
            await requestLock('test-lock', { mode: 'exclusive' }, async (lock) => {
                modeUsed = lock?.mode;
            });
            expect(modeUsed).to.equal('exclusive');
        });

        it('throws for an empty lock name', async () => {
            expect(() => requestLock('', { mode: 'exclusive' }, async () => {})).to.throw(TypeError, 'Lock name must be a non-empty string.');
        });

        it('accepts a callback as the second argument', async () => {
            let modeUsed = null;
            await requestLock('test-lock', async (lock) => {
                modeUsed = lock?.mode;
            });
            expect(modeUsed).to.equal('exclusive');
        });

        it('throws if the callback is not a function', async () => {
            expect(() => requestLock('test-lock', { mode: 'exclusive' }, undefined)).to.throw(TypeError, 'Lock callback must be a function.');
        });
    });
});

