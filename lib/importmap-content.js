/**
 * Get the importMap content from globalThis or a script tag in the document
 */
export function importmapContent() {
    return /** @type {globalThis & { importmapContent: string }} */(globalThis).importmapContent ?? globalThis.document?.querySelector('script[type="importmap"]')?.textContent ?? '{}';
}
