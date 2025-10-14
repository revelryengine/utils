import { describe, it, beforeEach, afterEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assertStrictEquals } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';

import { importmapContent } from '../lib/importmap-content.js';

describe('importmapContent', () => {
    /** @type {typeof globalThis.document | undefined} */
    let originalDocument;
    /** @type {string | undefined} */
    let originalImportmapContent;

    const setDocumentImportMap = (textContent) => {
        globalThis.document = /** @type {any} */ ({
            querySelector(selector) {
                if (selector === 'script[type="importmap"]') {
                    return textContent === undefined ? null : { textContent };
                }
                return null;
            }
        });
    };

    beforeEach(() => {
        originalDocument = globalThis.document;
        originalImportmapContent = /** @type {any} */ (globalThis).importmapContent;
        delete /** @type {any} */ (globalThis).importmapContent;
        delete (globalThis).document;
    });

    afterEach(() => {
        if (originalDocument === undefined) {
            delete (globalThis).document;
        } else {
            globalThis.document = originalDocument;
        }
        if (originalImportmapContent === undefined) {
            delete /** @type {any} */ (globalThis).importmapContent;
        } else {
            /** @type {any} */ (globalThis).importmapContent = originalImportmapContent;
        }
    })

    it('should return global importmapContent when defined', () => {
        /** @type {any} */ (globalThis).importmapContent = '{ "imports": {}}';
        setDocumentImportMap('{ "imports": { "unused": "value" } }');
        assertStrictEquals(importmapContent(), '{ "imports": {}}');
    });

    it('should fall back to document importmap script content', () => {
        setDocumentImportMap('{ "imports": { "doc": "value" } }');
        assertStrictEquals(importmapContent(), '{ "imports": { "doc": "value" } }');
    });

    it('should return empty JSON object when neither global nor document import maps exist', () => {
        setDocumentImportMap(undefined);
        assertStrictEquals(importmapContent(), '{}');
    });
});
