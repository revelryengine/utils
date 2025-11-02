/**
 * Import map content utility.
 * @module
 */

/**
 * @typedef {object} ImportMap - An import map structure. See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap
 * @property {Record<string, string>} imports - A map of module specifiers to their resolved URLs.
 * @property {Record<string, Record<string, string>>} [scopes] - A map of scopes to their import maps.
 */

/**
 * Get the import map content from globalThis.importmapContent or a script tag in the document
 *
 * If globalThis.importmapContent is defined, it is used directly and is expected to already have resolved URLs.
 * Otherwise, it looks for a `<script type="importmap">` in the document and resolves the URLs relative to location.href.
 * If neither are found, it returns an empty import map
 *
 * @example
 * ```js
 * // Example import map in HTML
 * <script type="importmap">
 * {
 *   "imports": {
 *    "module-a": "./path/to/module-a.js"
 *   }
 * }
 * </script>
 * <script type="module">
 * import { importmapContent } from './lib/importmap-content.js';
 * const importMap = importmapContent();
 * console.log(importMap.imports['module-a']); // Resolved URL of module-a
 * ```
 *
 * @example
 * ```js
 * // Example usage in JavaScript
 * const importMap = importmapContent();
 * console.log(importMap.imports['module-a']); // Resolved URL of module-a
 *
 */
export function importmapContent() {


    const globalImportMap = /** @type {globalThis & { importmapContent: ImportMap }} */(globalThis).importmapContent;

    if (globalImportMap) {
        return structuredClone(globalImportMap);
    }

    const documentImportMap = /** @type {ImportMap} */(JSON.parse(globalThis.document?.querySelector('script[type="importmap"]')?.textContent ?? '{ "imports": {} }'));

    for (const key of Object.keys(documentImportMap.imports)) {
       documentImportMap.imports[key] = new URL(documentImportMap.imports[key], location.href).href;
    }

    if (documentImportMap.scopes) {
        for (const [scope, imports] of Object.entries(documentImportMap.scopes)) {

            const scopeKey = new URL(scope, location.href).href;
            for (const [key, value] of Object.entries(imports)) {
                imports[key] = new URL(value, location.href).href;
            }

            documentImportMap.scopes[scopeKey] = imports;
            delete documentImportMap.scopes[scope];
        }
    }

    return documentImportMap;
}
