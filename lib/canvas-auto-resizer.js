/**
 * Canvas auto-resizer utility.
 * @module
 */
/**
 * A utility to automatically resize a canvas element to match the DOM size of a given element.
 * If no element is provided, the canvas itself is used.
 *
 * The canvas will be resized using the device pixel ratio multiplied by an optional render scale (default 1).
 * This allows for high-DPI rendering and also allows for super-sampling if desired.
 */
export class CanvasAutoResizer {
    #observer;
    #canvas;
    #element;
    #onresize;

    /**
     * Creates an instance of CanvasAutoResizer.
     * @param {object} options - The options for the CanvasAutoResizer
     * @param {HTMLCanvasElement} options.canvas - The canvas element to resize
     * @param {HTMLElement} [options.element] - The element to track size changes on
     * @param {number} [options.renderScale=1] - The scale factor to apply when resizing the canvas
     * @param {(size: { width: number, height: number }) => void} [options.onresize] - Optional callback invoked whenever the canvas is resized
     */
    constructor({ canvas, element = canvas, renderScale = 1, onresize }) {
        this.#observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { inlineSize, blockSize } = entry.devicePixelContentBoxSize[0];
                this.#resizeCanvas(inlineSize * this.renderScale, blockSize * this.renderScale);
            }
        });

        this.#observer.observe(element);

        this.#canvas      = canvas;
        this.#element     = element;
        this.#onresize    = onresize;
        this.#renderScale = renderScale;
    }

    /**
     * @param {number} width
     * @param {number} height
     */
    #resizeCanvas(width, height) {
        if (Math.abs(width - this.#canvas.width) > 1 || Math.abs(height - this.#canvas.height) > 1) {
            this.#canvas.width  = width || 2;
            this.#canvas.height = height || 2;

            this.#onresize?.({ width, height });
        }
    }

    #renderScale = 1;
    /**
     * The scale factor used when rendering the canvas.
     */
    get renderScale() {
        return this.#renderScale;
    }

    /**
     * Sets the scale factor used when rendering the canvas. The canvas will be resized accordingly.
     * @param {number} scale - The new render scale value.
     */
    set renderScale(scale) {
        this.#renderScale = scale;
        const { width, height } = this.#element.getBoundingClientRect();
        this.#resizeCanvas(width * globalThis.devicePixelRatio * this.renderScale, height * globalThis.devicePixelRatio * this.renderScale);
    }

    /**
     * Stops observing the element and prevents further automatic resizing of the canvas.
     */
    stop() {
        this.#observer.unobserve(this.#element);
    }
}
