import { describe, it } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert       } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertFalse  } from 'https://deno.land/std@0.208.0/assert/assert_false.ts';
import { assertStrictEquals } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';

import { deepEquals } from '../lib/deep-equals.js';

describe('deepEquals', () => {
    it('should treat identical references and primitives as equal', () => {
        const obj = { foo: 1 };
        assert(deepEquals(obj, obj));
        assert(deepEquals(1, 1));
        assert(deepEquals(null, null));
        assert(deepEquals(undefined, undefined));
    });

    it('should perform deep equality checks on plain objects', () => {
        const left = { foo: { bar: 1, baz: [true, false] }, qux: 'hi' };
        const right = { foo: { bar: 1, baz: [true, false] }, qux: 'hi' };

        assert(deepEquals(left, right));
        assert(deepEquals(right, left));
    });

    it('should detect inequality due to differing values or missing keys', () => {
        const base   = { foo: 1, nested: { bar: 2 } };
        const change = { foo: 2, nested: { bar: 2 } };
        const missing = { nested: { bar: 2 } };

        assertFalse(deepEquals(base, change));
        assertFalse(deepEquals(base, missing));
    });

    it('should return false for non-object comparisons', () => {
        assertFalse(deepEquals({ foo: 1 }, null));
        assertFalse(deepEquals('foo', 'bar'));
        assertFalse(deepEquals({ foo: 1 }, ['foo']));
    });

    it('should use Set iteration covering both objects keys', () => {
        const left  = { a: 1, extra: 2 };
        const right = { a: 1 };
        assertFalse(deepEquals(left, right));
        assertFalse(deepEquals(right, left));
    });

    it('should handle array comparisons by index', () => {
        const a = [1, 2, { foo: 'bar' }];
        const b = [1, 2, { foo: 'bar' }];
        const c = [1, 2, { foo: 'baz' }];

        assertStrictEquals(deepEquals(a, b), true);
        assertStrictEquals(deepEquals(a, c), false);
    });
});
