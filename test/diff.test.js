import { describe, it } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';

import { diff } from '../lib/diff.js';

describe('diff', () => {
    it('should return empty object when values are strictly equal or undefined', () => {
        assertEquals(/** @type {unknown} */(diff(/** @type {any} */({ a: 1 }), /** @type {any} */({ a: 1 }))), {});
        assertEquals(/** @type {unknown} */(diff(/** @type {any} */({ a: 1 }), /** @type {any} */(undefined))), {});
    });

    it('should return new value when comparing primitives', () => {
        assertEquals(diff(/** @type {any} */({ a: 1 }), /** @type {any} */({ a: 2 })), /** @type {Record<string, unknown>} */({ a: 2 }));
        assertEquals(diff(/** @type {any} */(undefined), /** @type {any} */({ b: 1 })), { b: 1 });
        assertEquals(diff(/** @type {any} */('foo'), /** @type {any} */('bar')), 'bar');
    });

    it('should deeply diff objects and strips empty objects', () => {
        const obj1 = { a: 1, b: { c: 2, d: 3 } };
        const obj2 = { a: 1, b: { c: 20, d: 3 }, e: 40, f: {} };
        assertEquals(diff(/** @type {any} */(obj1), /** @type {any} */(obj2)), { b: { c: 20 }, e: 40 });
    });
});
