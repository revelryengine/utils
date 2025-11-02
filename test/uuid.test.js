import { describe, it, expect, beforeEach } from 'bdd';

import { UUID } from '../lib/uuid.js';

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const UUID_STRING = 'b47b93ce-4c65-4aba-bf15-287a8934656f';
const UUID_BYTES = new Uint8Array([180, 123, 147, 206, 76, 101, 74, 186, 191, 21, 40, 122, 137, 52, 101, 111]);

describe('UUID', () => {
    /** @type {string} */
    let id;
    /** @type {Uint8Array} */
    let bytes;

    beforeEach(() => {
        id = UUID();
    });

    it('generates random UUID in xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx format', () => {
        expect(UUID_REGEX.test(id)).to.equal(true);
    });

    describe('toBytes', () => {
        beforeEach(() => {
            bytes = UUID.toBytes(UUID_STRING);
        });

        it('results in 128 bit Uint8Array', () => {
            expect(bytes).to.be.instanceOf(Uint8Array);
            expect(bytes.length).to.equal(16);
        });

        it('results in an equivalent byte array', () => {
            expect(bytes).to.deep.equal(UUID_BYTES);
        });

        it('throws if not a valid UUID v4 string', () => {
            expect(() => UUID.toBytes('foobar')).to.throw();
        });
    });

    describe('fromBytes', () => {
        beforeEach(() => {
            id = UUID.fromBytes(UUID_BYTES);
        });

        it('results in an equivalent string', () => {
            expect(id).to.equal(UUID_STRING);
        });
    });

    describe('isUUID', () => {
        it('returns true if string is in xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hex format', () => {
            expect(UUID.isUUID(UUID_STRING)).to.equal(true);
        });

        it('returns false if string is not in xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx hex format', () => {
            expect(UUID.isUUID('xxxx-xxxx-xxxx')).to.equal(false);
        });
    });
});
