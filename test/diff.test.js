import { describe, it, expect } from 'bdd';

import { diff } from '../lib/diff.js';

describe('diff', () => {
    it('returns empty object when values are strictly equal or undefined', () => {
        expect(diff(/** @type {any} */({ a: 1 }), /** @type {any} */({ a: 1 }))).to.deep.equal({});
        expect(diff(/** @type {any} */({ a: 1 }), /** @type {any} */(undefined))).to.deep.equal({});
    });

    it('returns new value when comparing primitives', () => {
        expect(diff(/** @type {any} */({ a: 1 }), /** @type {any} */({ a: 2 }))).to.deep.equal({ a: 2 });
        expect(diff(/** @type {any} */(undefined), /** @type {any} */({ b: 1 }))).to.deep.equal({ b: 1 });
        expect(diff(/** @type {any} */('foo'), /** @type {any} */('bar'))).to.equal('bar');
    });

    it('deeply diffs objects and strips empty objects', () => {
        const obj1 = { a: 1, b: { c: 2, d: 3 } };
        const obj2 = { a: 1, b: { c: 20, d: 3 }, e: 40, f: {} };
        expect(diff(/** @type {any} */(obj1), /** @type {any} */(obj2))).to.deep.equal({ b: { c: 20 }, e: 40 });
    });
});
