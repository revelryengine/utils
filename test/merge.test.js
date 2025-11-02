import { describe, it, expect } from 'bdd';

import { merge } from '../lib/merge.js';

describe('merge', () => {
    it('deep merges nested objects into the target', () => {
        /** @type {{ config: { enabled: boolean; threshold: number; mode?: string } }} */
        const target = { config: { enabled: false, threshold: 10 } };
        /** @type {{ config: { threshold: number; mode: string } }} */
        const source = { config: { threshold: 20, mode: 'auto' } };

        const result = merge(target, source);

        expect(result).to.equal(target);
        expect(target).to.deep.equal({ config: { enabled: false, threshold: 20, mode: 'auto' } });
    });

    it('preserves existing nested object references when merging', () => {
        /** @type {{ enabled: boolean; threshold?: number }} */
        const nested = { enabled: true };
        /** @type {{ config: { enabled: boolean; threshold?: number } }} */
        const target = { config: nested };
        /** @type {{ config: { threshold: number } }} */
        const source = { config: { threshold: 5 } };

        merge(target, source);

        expect(target.config).to.equal(nested);
        expect(target.config).to.deep.equal({ enabled: true, threshold: 5 });
    });

    it('creates nested objects with matching prototypes when absent on target', () => {
        class Example {
            value = 42;
            extra = '';

            method() {
                return 'example';
            }
        }

        const example = new Example();
        example.extra = 'data';

        /** @type {{ nested?: Example & { extra: string } }} */
        const target = {};
        merge(target, { nested: example });

        const nestedResult = /** @type {Example & { extra: string }} */ (target.nested);
        expect(nestedResult).to.be.instanceOf(Example);
        expect(nestedResult.value).to.equal(42);
        expect(nestedResult.extra).to.equal('data');
        expect(nestedResult.method()).to.equal('example');
    });

    it('overrides primitive properties from subsequent sources', () => {
        const target = { count: 1, flag: false };

        merge(target, { count: 3 }, { flag: true });

        expect(target).to.deep.equal({ count: 3, flag: true });
    });
});
