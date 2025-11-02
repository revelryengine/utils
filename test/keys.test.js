import { describe, it, expect } from 'bdd';

import { keys } from '../lib/keys.js';

describe('keys', () => {
    it('returns the enumerable own property keys of an object', () => {
        const base = { inherited: true };
        const foo = Object.create(base, {
            own: { value: 1, enumerable: true },
            hidden: { value: 2, enumerable: false },
        });

        const symbolKey = Symbol('sym');
        foo[symbolKey] = 3;
        foo.bar = 4;

        const result = keys(foo);

        expect(result).to.deep.equal(['own', 'bar']);
    });

    it('preserves the original insertion order of the keys', () => {
        const obj = /** @type {Record<string, number>} */ ({ first: 1, second: 2, third: 3 });
        obj.fourth = 4;

        const result = keys(obj);

        expect(result).to.deep.equal(['first', 'second', 'third', 'fourth']);
    });
});
