import { describe, it } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assertEquals       } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertStrictEquals } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';
import { assertThrows       } from 'https://deno.land/std@0.208.0/assert/assert_throws.ts';

import { NonNull } from '../lib/non-null.js';

describe('NonNull', () => {
    it('should return the provided value when it is not nullish', () => {
        const value = { foo: 'bar' };
        assertStrictEquals(NonNull(value), value);
        assertStrictEquals(NonNull(0), 0);
        assertStrictEquals(NonNull(false), false);
    });

    it('should throw with the default message for nullish values', () => {
        assertThrows(() => NonNull(null), Error, 'Unexpected null or undefined.');
        assertThrows(() => NonNull(undefined), Error, 'Unexpected null or undefined.');
    });

    it('should use the provided message when throwing', () => {
        const message = 'Custom message';
        assertThrows(() => NonNull(null, message), Error, message);
    });

    it('should not evaluate custom message when value is non-null', () => {
        const message = 'Custom message';
        assertEquals(NonNull('value', message), 'value');
    });
});
