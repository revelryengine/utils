import { describe, it, expect, beforeEach, afterEach, sinon } from 'bdd';

import { CanvasAutoResizer } from '../lib/canvas-auto-resizer.js';

const dpr = globalThis.devicePixelRatio ?? 1;

describe('CanvasAutoResizer', () => {
    /** @type {HTMLCanvasElement & { context?: CanvasRenderingContext2D }} */
    let canvas;
    /** @type {HTMLElement} */
    let element;

    beforeEach(() => {
        canvas  = document.createElement('canvas');
        element = document.createElement('div');

        canvas.style.width  = `${300 / dpr}px`;
        canvas.style.height = `${150 / dpr}px`;

        element.style.width  = `${300 / dpr}px`;
        element.style.height = `${150 / dpr}px`;

        element.appendChild(canvas);
        document.body.appendChild(element);
    });

    afterEach(() => {
        document.body.removeChild(element);
    });

    it('resizes canvas when the element size changes', async () => {
        const _ = new CanvasAutoResizer({ canvas, element });

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        expect(canvas.width).to.equal(300);
        expect(canvas.height).to.equal(150);

        element.style.width  = `${200 / dpr}px`;
        element.style.height = `${100 / dpr}px`;

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        expect(canvas.width).to.equal(200);
        expect(canvas.height).to.equal(100);
    });

    it('calls the onresize callback when the canvas is resized', async () => {
        const onresize = sinon.spy();
        const _ = new CanvasAutoResizer({ canvas, element, onresize });

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        element.style.width  = `${200 / dpr}px`;
        element.style.height = `${100 / dpr}px`;

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        expect(onresize).to.have.been.calledOnce;
        expect(onresize).to.have.been.calledWith({ width: 200, height: 100 });
    });

    it('defaults to canvas as the element when none is provided', async () => {
        const _ = new CanvasAutoResizer({ canvas });

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        expect(canvas.width).to.equal(300);
        expect(canvas.height).to.equal(150);

        canvas.style.width  = `${200 / dpr}px`;
        canvas.style.height = `${100 / dpr}px`;

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        expect(canvas.width).to.equal(200);
        expect(canvas.height).to.equal(100);
    });

    it('ignores size changes smaller than pixel threshold', async () => {
        const onresize = sinon.spy();
        const _ = new CanvasAutoResizer({ canvas, element, onresize });

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        element.style.width  = `${(300 / dpr) + 0.3}px`;
        element.style.height = `${(150 / dpr) + 0.3}px`;

        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        expect(onresize).to.not.have.been.called;
        expect(canvas.width).to.equal(300);
        expect(canvas.height).to.equal(150);
    });

    describe('stop', ()=> {
        it('stops observing the element', async () => {
            const _ = new CanvasAutoResizer({ canvas, element });
            _.stop();

            element.style.width  = `${200 / dpr}px`;
            element.style.height = `${100 / dpr}px`;

            await new Promise(requestAnimationFrame);;
            await new Promise(requestAnimationFrame);

            expect(canvas.width).to.equal(300);
            expect(canvas.height).to.equal(150);
        });
    });

    describe('renderScale', () => {
        it('returns current render scale', () => {
            const resizer = new CanvasAutoResizer({ canvas, element, renderScale: 2 });
            expect(resizer.renderScale).to.equal(2);
        });

        it('updates render scale when set', () => {
            const resizer = new CanvasAutoResizer({ canvas, element });
            resizer.renderScale = 3;
            expect(resizer.renderScale).to.equal(3);
        });

        it('reapplies size when render scale changes', async () => {
            const resizer = new CanvasAutoResizer({ canvas, element });

            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);

            expect(canvas.width).to.equal(300);
            expect(canvas.height).to.equal(150);

            resizer.renderScale = 2;

            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);

            expect(canvas.width).to.equal(600);
            expect(canvas.height).to.equal(300);
        });
    });
});
