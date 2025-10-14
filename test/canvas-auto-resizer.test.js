import { describe, it, beforeEach, afterEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assertEquals        } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertSpyCalls, spy } from 'https://deno.land/std@0.208.0/testing/mock.ts';

import { CanvasAutoResizer } from '../lib/canvas-auto-resizer.js';

/**
 * Creates a stub ResizeObserver that records observations.
 */
class ResizeObserverStub {
    /**
     * @param {(entries: ResizeObserverEntry[]) => void} callback
     */
    constructor(callback) {
        this.callback = callback;
        this.observed = new Set();
        this.unobserved = new Set();
    }

    /**
     * @param {Element} target
     */
    observe(target) {
        this.observed.add(target);
    }

    /**
     * @param {Element} target
     */
    unobserve(target) {
        this.unobserved.add(target);
    }

    /**
     * Simulates a resize event.
     * @param {ResizeObserverEntry[]} entries
     */
    trigger(entries) {
        this.callback(entries);
    }
}

describe('CanvasAutoResizer', () => {
    /** @type {HTMLCanvasElement & { context?: CanvasRenderingContext2D }} */
    let canvas;
    /** @type {HTMLElement} */
    let element;
    /** @type {number} */
    let originalDevicePixelRatio;
    /** @type {typeof ResizeObserver | undefined} */
    let originalResizeObserver;
    /** @type {ResizeObserverStub} */
    let resizeObserver;

    beforeEach(() => {
        originalDevicePixelRatio = globalThis.devicePixelRatio ?? 1;
        globalThis.devicePixelRatio = 2;

        originalResizeObserver = globalThis.ResizeObserver;
        resizeObserver = new ResizeObserverStub(() => {});
        globalThis.ResizeObserver = class {
            constructor(callback) {
                resizeObserver = new ResizeObserverStub(callback);
                return resizeObserver;
            }
        };

        canvas = /** @type {any} */ ({ width: 0, height: 0 });
        element = /** @type {any} */ ({
            width: 100,
            height: 50,
            getBoundingClientRect() {
                return { width: this.width, height: this.height };
            }
        });
    });

    afterEach(() => {
        if (originalResizeObserver === undefined) {
            delete globalThis.ResizeObserver;
        } else {
            globalThis.ResizeObserver = originalResizeObserver;
        }
        globalThis.devicePixelRatio = originalDevicePixelRatio;
    });

    /**
     * @param {{ inlineSize: number, blockSize: number }} contentSize
     */
    const makeEntry = (contentSize) => ({
        target: element,
        devicePixelContentBoxSize: [contentSize]
    });

    describe('constructor', () => {
        it('should observe the provided element and resizes on matching entries', () => {
            const onresize = spy(() => {});
            const resizer = new CanvasAutoResizer({ canvas, element, renderScale: 1.5, onresize });

            assertEquals(resizeObserver.observed.has(element), true);

            resizeObserver.trigger([makeEntry({ inlineSize: 80, blockSize: 30 })]);

            assertEquals(canvas.width, 80 * 1.5);
            assertEquals(canvas.height, 30 * 1.5);
            assertSpyCalls(onresize, 1);
            assertEquals(onresize.calls[0].args[0], { width: 80 * 1.5, height: 30 * 1.5 });

            resizer.stop();
            assertEquals(resizeObserver.unobserved.has(element), true);
        });

        it('should filter out entries that target a different element', () => {
            const other = /** @type {any} */ ({
                getBoundingClientRect() { return { width: 10, height: 10 }; }
            });
            const onresize = spy(() => {});
            new CanvasAutoResizer({ canvas, element, onresize });

            resizeObserver.trigger([{
                target: other,
                devicePixelContentBoxSize: [{ inlineSize: 10, blockSize: 10 }]
            }]);

            assertEquals(canvas.width, 0);
            assertEquals(canvas.height, 0);
            assertSpyCalls(onresize, 0);
        });

        it('should default element to canvas when not provided', () => {
            canvas = /** @type {any} */ ({ width: 0, height: 0, getBoundingClientRect: () => ({ width: 90, height: 40 }) });
            const onresize = spy(() => {});
            new CanvasAutoResizer({ canvas, renderScale: 1.2, onresize });

            resizeObserver.trigger([{
                target: canvas,
                devicePixelContentBoxSize: [{ inlineSize: 60, blockSize: 25 }]
            }]);

            assertEquals(canvas.width, 60 * 1.2);
            assertEquals(canvas.height, 25 * 1.2);
            assertSpyCalls(onresize, 1);
        });

        it('should ignore changes smaller than a pixel threshold', () => {
            const _ = new CanvasAutoResizer({ canvas, element });
            canvas.width = 10;
            canvas.height = 10;

            const entries = [makeEntry({ inlineSize: 10.4, blockSize: 10.4 })];
            resizeObserver.trigger(entries);
            assertEquals(canvas.width, 10);
            assertEquals(canvas.height, 10);

            const largerEntries = [makeEntry({ inlineSize: 12, blockSize: 13 })];
            resizeObserver.trigger(largerEntries);
            assertEquals(canvas.width, 12);
            assertEquals(canvas.height, 13);

            const zeroEntries = [makeEntry({ inlineSize: 0, blockSize: 0 })];
            resizeObserver.trigger(zeroEntries);
            assertEquals(canvas.width, 2);
            assertEquals(canvas.height, 2);
        });
    });

    describe('renderScale', () => {
        it('should return the current render scale', () => {
            const resizer = new CanvasAutoResizer({ canvas, element, renderScale: 1.25 });
            assertEquals(resizer.renderScale, 1.25);
        });

        it('should reapply size when render scale changes', () => {
            const onresize = spy(() => {});
            canvas.width = 10;
            canvas.height = 10;
            const resizer = new CanvasAutoResizer({ canvas, element, renderScale: 1, onresize });

            element.width = 50;
            element.height = 20;
            resizer.renderScale = 2;

            const expectedWidth = element.width * globalThis.devicePixelRatio * resizer.renderScale;
            const expectedHeight = element.height * globalThis.devicePixelRatio * resizer.renderScale;
            assertEquals(canvas.width, expectedWidth);
            assertEquals(canvas.height, expectedHeight);
            assertSpyCalls(onresize, 1);
            assertEquals(onresize.calls[0].args[0], { width: expectedWidth, height: expectedHeight });

            // Check the early return path
            resizer.renderScale = 2;
            assertSpyCalls(onresize, 1);
        });
    });

    describe('stop', () => {
        it('should stop observing the element', () => {
            new CanvasAutoResizer({ canvas, element }).stop();
            assertEquals(resizeObserver.unobserved.has(element), true);
        });
    });
});
