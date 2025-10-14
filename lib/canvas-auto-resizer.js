/**
 * A utility to automatically resize a canvas element to match the size of a given element.
 * By default the canvas element is used as the element to match.
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
     * @param {{ canvas: HTMLCanvasElement, element?: HTMLElement, renderScale?: number, onresize?: (size: { width: number, height: number }) => void }} options
     */
    constructor({ canvas, element, renderScale = 1, onresize }) {
        element ??= canvas;

        this.#observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target != element) { continue; }
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
     * Sets the scale factor used when rendering the canvas. If the scale factor changes, the canvas will be resized accordingly.
     * @param {number} v
     */
    set renderScale(v) {
        if(this.#renderScale === v) return;
        this.#renderScale = v;
        const { width, height } = this.#element.getBoundingClientRect();
        this.#resizeCanvas(width * devicePixelRatio * this.renderScale, height * devicePixelRatio * this.renderScale);
    }

    /**
     * Stops observing the element and prevents further automatic resizing of the canvas.
     */
    stop() {
        this.#observer.unobserve(this.#element);
    }
}
