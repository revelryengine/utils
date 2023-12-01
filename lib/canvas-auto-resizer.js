export class CanvasAutoResizer {
    #observer;
    #canvas;
    #element;
    #onresize;

    /**
     * @param {{ canvas: HTMLCanvasElement, element?: HTMLElement, renderScale?: number, onresize: (size: { width: number, height: number }) => void }} options
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
            this.#canvas.width  = width;
            this.#canvas.height = height;

            this.#onresize?.({ width, height });
        }
    }

    #renderScale = 1;
    get renderScale() {
        return this.#renderScale;
    }

    set renderScale(v) {
        if(this.#renderScale === v) return;
        this.#renderScale = v;
        const { width, height } = this.#element.getBoundingClientRect();
        this.#resizeCanvas(width * devicePixelRatio * this.renderScale, height * devicePixelRatio * this.renderScale);
    }

    stop() {
        this.#observer.unobserve(this.#element);
    }
}
