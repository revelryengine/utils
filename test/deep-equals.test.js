import { describe, it, expect } from 'bdd';

import { deepEquals } from '../lib/deep-equals.js';

describe('deepEquals', () => {
    it('treats identical references and primitives as equal', () => {
        const obj = { foo: 1 };
        expect(deepEquals(obj, obj)).to.be.true;
        expect(deepEquals(1, 1)).to.be.true;
        expect(deepEquals(null, null)).to.be.true;
        expect(deepEquals(undefined, undefined)).to.be.true;
    });

    it('performs deep equality checks on plain objects', () => {
        const left = { foo: { bar: 1, baz: [true, false] }, qux: 'hi' };
        const right = { foo: { bar: 1, baz: [true, false] }, qux: 'hi' };

        expect(deepEquals(left, right)).to.be.true;
        expect(deepEquals(right, left)).to.be.true;
    });

    it('detects inequality due to differing values or missing keys', () => {
        const base = { foo: 1, nested: { bar: 2 } };
        const change = { foo: 2, nested: { bar: 2 } };
        const missing = { nested: { bar: 2 } };

        expect(deepEquals(base, change)).to.be.false;
        expect(deepEquals(base, missing)).to.be.false;
    });

    it('returns false for non-object comparisons', () => {
        expect(deepEquals({ foo: 1 }, null)).to.be.false;
        expect(deepEquals('foo', 'bar')).to.be.false;
        expect(deepEquals({ foo: 1 }, ['foo'])).to.be.false;
    });

    it('uses Set iteration covering both objects keys', () => {
        const left = { a: 1, extra: 2 };
        const right = { a: 1 };
        expect(deepEquals(left, right)).to.be.false;
        expect(deepEquals(right, left)).to.be.false;
    });

    it('handles array comparisons by index', () => {
        const a = [1, 2, { foo: 'bar' }];
        const b = [1, 2, { foo: 'bar' }];
        const c = [1, 2, { foo: 'baz' }];

        expect(deepEquals(a, b)).to.be.true;
        expect(deepEquals(a, c)).to.be.false;
    });
});
