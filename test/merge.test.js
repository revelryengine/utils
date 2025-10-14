import { describe, it } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert             } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertEquals       } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertStrictEquals } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';

import { merge } from '../lib/merge.js';

describe('merge', () => {
    it('should deep merge nested objects into the target', () => {
        /** @type {{ config: { enabled: boolean; threshold: number; mode?: string } }} */
        const target = { config: { enabled: false, threshold: 10 } };
        /** @type {{ config: { threshold: number; mode: string } }} */
        const source = { config: { threshold: 20, mode: 'auto' } };

        const result = merge(target, source);

        assertStrictEquals(result, target);
        assertEquals(target, { config: { enabled: false, threshold: 20, mode: 'auto' } });
    });

    it('should preserve existing nested object references when merging', () => {
        /** @type {{ enabled: boolean; threshold?: number }} */
        const nested = { enabled: true };
        /** @type {{ config: { enabled: boolean; threshold?: number } }} */
        const target = { config: nested };
        /** @type {{ config: { threshold: number } }} */
        const source = { config: { threshold: 5 } };

        merge(target, source);

        assertStrictEquals(target.config, nested);
        assertEquals(target.config, { enabled: true, threshold: 5 });
    });

    it('should create nested objects with matching prototypes when absent on target', () => {
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
        assert(nestedResult instanceof Example);
        assertEquals(nestedResult.value, 42);
        assertEquals(nestedResult.extra, 'data');
        assertEquals(nestedResult.method(), 'example');
    });

    it('should override primitive properties from subsequent sources', () => {
        const target = { count: 1, flag: false };

        merge(target, { count: 3 }, { flag: true });

        assertEquals(target, { count: 3, flag: true });
    });

    it('should ignore nullish sources', () => {
        const target = { foo: 'bar' };

        merge(target, null, undefined, false);

        assertEquals(target, { foo: 'bar' });
    });
});
