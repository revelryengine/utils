import { describe, it, beforeEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert           } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertEquals     } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertThrows     } from 'https://deno.land/std@0.208.0/assert/assert_throws.ts';
import { assertInstanceOf } from 'https://deno.land/std@0.208.0/assert/assert_instance_of.ts';


import { UUID } from '../lib/uuid.js';

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

// This string and bytes are equivalent
const UUID_STRING = 'b47b93ce-4c65-4aba-bf15-287a8934656f';
const UUID_BYTES  = new Uint8Array([180, 123, 147, 206, 76, 101, 74, 186, 191, 21, 40, 122, 137, 52, 101, 111]);

describe('UUID', () => {
    /** @type {string} */
    let id;
    /** @type {Uint8Array} */
    let bytes;

    beforeEach(() => {
        id = UUID();
    });

    it('should generate random UUID in xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx format', () => {
        assert(UUID_REGEX.test(id));
    });

    describe('toBytes', () => {
        beforeEach(() => {
            bytes = UUID.toBytes(UUID_STRING);
        });

        it('should result in 128 bit Uint8Array', () => {
            assertInstanceOf(bytes, Uint8Array);
            assertEquals(bytes.length, 16);
        });

        it('should result in an equivlanent byte array', () => {
            assertEquals(bytes, UUID_BYTES);
        });

        it('should throw if not a valid UUID v4 string', () => {
            assertThrows(() => UUID.toBytes('foobar'));
        });
    });

    describe('fromBytes', () => {
        beforeEach(() => {
            id = UUID.fromBytes(UUID_BYTES);
        });

        it('should result in an equivalent string ', () => {
            assertEquals(id, UUID_STRING);
        });
    });

    describe('isUUID', () => {
        it('should return true if string is in xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hex format', () => {
            assert(UUID.isUUID(UUID_STRING));
        });

        it('should return false if string is not in xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hex format', () => {
            assert(!UUID.isUUID('xxxx-xxxx-xxxx'));
        });
    });
});
