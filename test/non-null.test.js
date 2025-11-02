import { describe, it, expect } from 'bdd';

import { NonNull } from '../lib/non-null.js';

describe('NonNull', () => {
    it('returns the provided value when it is not nullish', () => {
        const value = { foo: 'bar' };
        expect(NonNull(value)).to.equal(value);
        expect(NonNull(0)).to.equal(0);
        expect(NonNull(false)).to.equal(false);
    });

    it('throws with the default message for nullish values', () => {
        expect(() => NonNull(null)).to.throw('Unexpected null or undefined.');
        expect(() => NonNull(undefined)).to.throw('Unexpected null or undefined.');
    });

    it('uses the provided message when throwing', () => {
        const message = 'Custom message';
        expect(() => NonNull(null, message)).to.throw(message);
    });

    it('does not evaluate custom message when value is non-null', () => {
        const message = 'Custom message';
        expect(NonNull('value', message)).to.equal('value');
    });
});
