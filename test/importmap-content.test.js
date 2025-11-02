import { describe, it, expect, beforeEach, afterEach, sinon } from 'bdd';

import { importmapContent } from '../lib/importmap-content.js';

describe('importmapContent', () => {
    describe('importmapContent', () => {
        beforeEach(() => {
            /** @type {any} */ (globalThis).importmapContent = { imports: { foo: 'bar' } };
        });

        afterEach(() => {
            /** @type {any} */ (globalThis).importmapContent = undefined;
        });

        it('returns global importmapContent when defined', () => {
            expect(importmapContent()).to.deep.equal({ imports: { foo: 'bar' } });
        });
    });

    describe('document importmap script', () => {
        /**
         * @type {sinon.SinonStub}
         */
        let documentQuerySelectorStub;
        beforeEach(() => {
            const importMapContent = '{ "imports": { "foo": "bar" }, "scopes": { "/scope/": { "baz": "qux" } } }';

            globalThis.document ??= /** @type {any} */ ({ querySelector: () => null });
            /** @ts-expect-error */
            documentQuerySelectorStub = sinon.stub(globalThis.document, 'querySelector').returns({ textContent: importMapContent });
        });

        afterEach(() => {
            documentQuerySelectorStub.restore();
        });

        it('falls back to document importmap script content and resolves urls relative to location.href', () => {
            expect(importmapContent()).to.deep.equal({
                imports: { foo: new URL('bar', location.href).href },
                scopes: { [new URL('/scope/', location.href).href]: { baz: new URL('qux', location.href).href } }
            });
        });
    });

    describe('no importmap defined', () => {
        /**
         * @type {sinon.SinonStub}
         */
        let documentQuerySelectorStub;
        beforeEach(() => {
            globalThis.document ??= /** @type {any} */ ({ querySelector: () => null });
            documentQuerySelectorStub = sinon.stub(globalThis.document, 'querySelector').returns(null);
        });

        afterEach(() => {
            documentQuerySelectorStub.restore();
        });
        it('returns empty imports object when neither global nor document import maps exist', () => {
            expect(importmapContent()).to.deep.equal({ imports: {} });
        });
    });
});
