import { describe, it } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';

import { keys } from '../lib/keys.js';

describe('keys', () => {
    it('should return the enumerable own property keys of an object', () => {
        const base = { inherited: true };
        const foo  = Object.create(base, {
            own: { value: 1, enumerable: true },
            hidden: { value: 2, enumerable: false },
        });

        const symbolKey = Symbol('sym');
        foo[symbolKey]  = 3;
        foo.bar         = 4;

        const result = keys(foo);

        assertEquals(result, ['own', 'bar']);
    });

    it('should preserve the original insertion order of the keys', () => {
        const obj = /** @type {Record<string, number>}*/({ first: 1, second: 2, third: 3 });
        obj.fourth = 4;

        const result = keys(obj);

        assertEquals(result, ['first', 'second', 'third', 'fourth']);
    });
});
