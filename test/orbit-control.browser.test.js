import { describe, it, expect, beforeEach, sinon } from 'bdd';

import { OrbitControl } from '../lib/orbit-control.js';
import { Vec3, Quat } from '../deps/gl-matrix.js';

/**
 * @import { Vec3Like, QuatLike } from '../deps/gl-matrix.js';
 */

/**
 *
 * @param {Vec3Like} actual
 * @param {Vec3Like} expected
 * @param {number} epsilon
 */
const expectVec3CloseTo = (actual, expected, epsilon = 1e-5) => {
    for (let i = 0; i < 3; i++) {
        expect(actual[i]).to.be.closeTo(expected[i], epsilon);
    }
};

/**
 *
 * @param {QuatLike} actual
 * @param {QuatLike} expected
 * @param {number} epsilon
 */
const expectQuatCloseTo = (actual, expected, epsilon = 1e-5) => {
    for (let i = 0; i < 4; i++) {
        expect(actual[i]).to.be.closeTo(expected[i], epsilon);
    }
};

describe('OrbitControl', () => {
    /** @type {OrbitControl} */
    let control;
    /** @type {sinon.SinonSpy} */
    let onupdate;
    /** @type {sinon.SinonSpy} */
    let oninput;

    beforeEach(() => {
        onupdate = sinon.spy(() => {});
        oninput  = sinon.spy(() => {});
        control  = new OrbitControl({ onupdate, oninput });
        control.update(0, true);
    });

    describe('update', () => {
        it('updates the zoom based on zoom input', () => {
            control.input.zoom = 1;

            control.update(0);
            expect(control.zoom).to.be.closeTo(1, 1e-6);
        });

        it('reduces the zoom input by damping factor', () => {
            control.input.zoom = 1;

            control.update(0);
            expect(control.input.zoom).to.be.closeTo(1 * OrbitControl.DAMPING, 1e-6);
        });

        it('clamps the zoom to the zoom bounds', () => {
            control.input.zoom = 10;

            control.update(0);
            expect(control.zoom).to.be.closeTo(OrbitControl.ZOOM_BOUNDS[1], 1e-6);

            control.input.zoom = -10;

            control.update(0);
            expect(control.zoom).to.be.closeTo(OrbitControl.ZOOM_BOUNDS[0], 1e-6);
        });

        it('updates the target based on pan input', () => {
            control.input.pan = [1, 1];

            control.update(0);
            expectVec3CloseTo(control.target, [1, -1, 0]);
        });

        it('reduces the pan input by damping factor', () => {
            control.input.pan = [1, 1];

            control.update(0);

            expect(control.input.pan[0]).to.be.closeTo(1 * OrbitControl.DAMPING, 1e-6);
            expect(control.input.pan[1]).to.be.closeTo(1 * OrbitControl.DAMPING, 1e-6);
        });

        it('updates the rotation based on yaw input', () => {
            control.input.yaw = Math.PI / 2;

            control.update(0);
            const expectedRotation = Quat.setAxisAngle(new Quat(), [0, 1, 0], Math.PI / 2);
            expectQuatCloseTo(control.rotation, expectedRotation);
        });

        it('reduces the yaw input by damping factor', () => {
            control.input.yaw = Math.PI / 2;
            control.update(0);

            expect(control.input.yaw).to.be.closeTo((Math.PI / 2) * OrbitControl.DAMPING, 1e-6);
        });
        it('updates the rotation based on pitch input', () => {
            control.input.pitch = Math.PI / 2;
            control.update(0);
            const expectedRotation = Quat.setAxisAngle(new Quat(), [1, 0, 0], Math.PI / 2);
            expectQuatCloseTo(control.rotation, expectedRotation);
        });
        it('reduces the pitch input by damping factor', () => {
            control.input.pitch = Math.PI / 2;
            control.update(0);
            expect(control.input.pitch).to.be.closeTo((Math.PI / 2) * OrbitControl.DAMPING, 1e-6);
        });

        it('handles orbits that go upside down', () => {
            control.input.pitch = Math.PI / 2;
            control.update(0);
            control.input.pitch = Math.PI / 2;
            control.update(0);
            control.input.pitch = Math.PI / 2;
            control.update(0);
            const expectedRotation = Quat.scale(new Quat(), Quat.setAxisAngle(new Quat(), [1, 0, 0], (3 * Math.PI) / 2), -1);
            expectQuatCloseTo(control.rotation, expectedRotation);
        });

        it('calls onupdate callback if provided', () => {
            control.input.zoom = 1;
            control.update(0);
            expect(onupdate).to.have.been.called;
        });

        it('calls oninput callback if provided', () => {
            control.input.zoom = 1;
            control.update(0);
            expect(oninput).to.have.been.called;
        });

        it('does not call oninput callback if no input', () => {
            control.update(0);
            expect(oninput).not.to.have.been.called;
        });

        it('updates interpolations if present', () => {
            control.interpolate({ zoom: 5, duration: 1000 });
            control.update(500);
            expect(control.zoom).to.be.closeTo(2.5, 1e-6);
        });
    });

    describe('interpolate', () => {
        it('interpolates zoom', () => {
            control.interpolate({ zoom: 5, duration: 1000 });
            control.update(500);
            expect(control.zoom).to.be.closeTo(2.5, 1e-6);
        });
        it('interpolates distance', () => {
            control.interpolate({ distance: 10, duration: 1000 });
            control.update(500);
            expect(control.idealDistance).to.be.closeTo(7.5, 1e-6);
        });
        it('interpolates rotation', () => {
            const targetRotation = Quat.setAxisAngle(new Quat(), [0, 1, 0], Math.PI);
            control.interpolate({ rotation: targetRotation, duration: 1000 });
            control.update(500);
            const expectedRotation = Quat.setAxisAngle(new Quat(), [0, 1, 0], Math.PI / 2);
            expectQuatCloseTo(control.rotation, expectedRotation);
        });
        it('interpolates target', () => {
            control.interpolate({ target: [10, 0, 0], duration: 1000 });
            control.update(500);
            expectVec3CloseTo(control.target, [5, 0, 0]);
        });
        it('interpolates offset', () => {
            control.interpolate({ offset: [0, 10, 0], duration: 1000 });
            control.update(500);
            expectVec3CloseTo(control.offset, [0, 5, 0]);
        });
        it('removes interpolation after duration', () => {
            control.interpolate({ zoom: 5, duration: 1000 });
            control.update(1000);
            expect(control.zoom).to.be.closeTo(5, 1e-6);
            control.update(1000);
            expect(control.zoom).to.be.closeTo(5, 1e-6);
        });
    });

    describe('axis', () => {
        it('gets x when the rotation is aligned to the x axis', () => {
            control.rotation = OrbitControl.AXIS_ROTATIONS['x'];
            control.update(0, true);
            expect(control.axis).to.equal('x');
        });
        it('gets y when the rotation is aligned to the y axis', () => {
            control.rotation = OrbitControl.AXIS_ROTATIONS['y'];
            control.update(0, true);
            expect(control.axis).to.equal('y');
        });
        it('gets z when the rotation is aligned to the z axis', () => {
            control.rotation = OrbitControl.AXIS_ROTATIONS['z'];
            control.update(0, true);
            expect(control.axis).to.equal('z');
        });
        it('gets -x when the rotation is aligned to the -x axis', () => {
            control.rotation = OrbitControl.AXIS_ROTATIONS['-x'];
            control.update(0, true);
            expect(control.axis).to.equal('-x');
        });
        it('gets -y when the rotation is aligned to the -y axis', () => {
            control.rotation = OrbitControl.AXIS_ROTATIONS['-y'];
            control.update(0, true);
            expect(control.axis).to.equal('-y');
        });
        it('gets -z when the rotation is aligned to the -z axis', () => {
            control.rotation = OrbitControl.AXIS_ROTATIONS['-z'];
            control.update(0, true);
            expect(control.axis).to.equal('-z');
        });
        it('gets user when the rotation is not aligned to any axis', () => {
            control.rotation = /** @type {Quat} */(Quat.setAxisAngle(new Quat(), [1, 1, 0], Math.PI / 4));
            control.update(0, true);
            expect(control.axis).to.equal('user');
        });
        it('sets the rotation to the specified axis', () => {
            control.axis = 'x';
            expectQuatCloseTo(control.rotation, OrbitControl.AXIS_ROTATIONS['x']);
        });
        it('ignores setting axis to user', () => {
            control.rotation = OrbitControl.AXIS_ROTATIONS['x'];
            control.update(0, true);
            control.axis = 'user';
            expectQuatCloseTo(control.rotation, OrbitControl.AXIS_ROTATIONS['x']);
        });
    });

    describe('distance', () => {
        it('gets the current distance from the ideal distance and zoom', () => {
            control.idealDistance = 10;
            control.zoom = 0.5;
            expect(control.distance).to.equal(10 * Math.pow(2, -0.5));
        });
    });

    describe('setTarget', () => {
        it('sets the target position at the specified coordinates and ideal distance', () => {
            control.setTarget({ target: [1, 2, 3], idealDistance: 10 });
            expectVec3CloseTo(control.target, [1, 2, 3]);
            expect(control.idealDistance).to.equal(10);
        });
        it('interpolates to the target position and ideal distance if specified', () => {
            control.setTarget({ target: [1, 2, 3], idealDistance: 10, interpolate: 1000 });
            control.update(500);
            expectVec3CloseTo(control.target, [0.5, 1, 1.5]);
            expect(control.idealDistance).to.be.closeTo(7.5, 1e-6);
        });
    });

    describe('observeElement', () => {
        class MockElement extends HTMLElement {
            /**
             * @override
             * @param {number} pointerId
             */
            setPointerCapture(pointerId) {
                pointerId;
            }
            /**
             * @override
             * @param {number} pointerId
             */
            releasePointerCapture(pointerId) {
                pointerId;
            }
        }
        customElements.define('mock-element', MockElement);

        /** @type {HTMLElement} */
        let element;

        beforeEach(() => {
            element = document.createElement('mock-element');
            control.observeElement(element);
        });

        it('adds zoom input on wheel events', () => {
            const wheelEvent = new WheelEvent('wheel', { deltaY: -1 });
            element.dispatchEvent(wheelEvent);
            expect(control.input.zoom).to.be.closeTo(OrbitControl.ZOOM_K, 1e-6);
        });

        it('adds zoom input on pinch gesture', () => {
            const finger1 = new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
            const finger2 = new PointerEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 100 });
            element.dispatchEvent(finger1);
            element.dispatchEvent(finger2);

            const pinchMove1 = new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 99, clientY: 100 });
            const pinchMove2 = new PointerEvent('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 101, clientY: 100 });
            element.dispatchEvent(pinchMove1);
            element.dispatchEvent(pinchMove2);

            const pinchEnd1 = new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 99, clientY: 100 });
            const pinchEnd2 = new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', clientX: 101, clientY: 100 });
            element.dispatchEvent(pinchEnd1);
            element.dispatchEvent(pinchEnd2);

            expect(control.input.zoom).to.be.closeTo(OrbitControl.ZOOM_K * 10, 1e-6);
        });

        it('adds pitch input on vertical pointer drag', () => {
            const pointerDown = new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100, isPrimary: true });
            element.dispatchEvent(pointerDown);
            const pointerMove = new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 101, isPrimary: true });
            element.dispatchEvent(pointerMove);
            const pointerUp = new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 101, isPrimary: true });
            element.dispatchEvent(pointerUp);

            expect(control.input.pitch).to.be.closeTo(-OrbitControl.ROTATE_K, 1e-6);
        });

        it('adds yaw input on horizontal pointer drag', () => {
            const pointerDown = new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100, isPrimary: true });
            element.dispatchEvent(pointerDown);
            const pointerMove = new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 101, clientY: 100, isPrimary: true });
            element.dispatchEvent(pointerMove);
            const pointerUp = new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: 101, clientY: 100, isPrimary: true });
            element.dispatchEvent(pointerUp);

            expect(control.input.yaw).to.be.closeTo(-OrbitControl.ROTATE_K, 1e-6);
        });

        it('adds pan input when the shift key is held during pointer drag', () => {
            const pointerDown = new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100, isPrimary: true, shiftKey: true });
            element.dispatchEvent(pointerDown);
            const pointerMove = new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 101, clientY: 100, isPrimary: true, shiftKey: true });
            element.dispatchEvent(pointerMove);
            const pointerUp = new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: 101, clientY: 100, isPrimary: true, shiftKey: true });
            element.dispatchEvent(pointerUp);
            expect(control.input.pan[0]).to.be.closeTo(-OrbitControl.PAN_K, 1e-6);
        });
    });

    describe('unobserveElement', () => {
        /** @type {HTMLElement} */
        let element;

        beforeEach(() => {
            element = document.createElement('div');
            control.observeElement(element);
            control.unobserveElement(element);
        });

        it('removes event listeners from the element', () => {
            const wheelEvent = new WheelEvent('wheel', { deltaY: -120 });
            element.dispatchEvent(wheelEvent);
            expect(control.input.zoom).to.be.closeTo(0, 1e-6);
        });
    });

    describe('unobserveAll', () => {
        /** @type {HTMLElement} */
        let elementA;

        /** @type {HTMLElement} */
        let elementB;

        beforeEach(() => {
            elementA = document.createElement('div');
            elementB = document.createElement('div');
            control.observeElement(elementA);
            control.observeElement(elementB);
            control.unobserveAll();
        });

        it('removes event listeners from all observed elements', () => {
            const wheelEvent = new WheelEvent('wheel', { deltaY: -120 });
            elementA.dispatchEvent(wheelEvent);
            elementB.dispatchEvent(wheelEvent);
            expect(control.input.zoom).to.be.closeTo(0, 1e-6);
        });
    });

    describe('static constants', () => {
        it('defines direction vectors and origin', () => {
            expect(Vec3.equals(OrbitControl.UP,       Vec3.fromValues(0, 1, 0))).to.equal(true);
            expect(Vec3.equals(OrbitControl.RIGHT,    Vec3.fromValues(1, 0, 0))).to.equal(true);
            expect(Vec3.equals(OrbitControl.FORWARD,  Vec3.fromValues(0, 0, -1))).to.equal(true);
            expect(Vec3.equals(OrbitControl.DOWN,     Vec3.fromValues(0, -1, 0))).to.equal(true);
            expect(Vec3.equals(OrbitControl.LEFT,     Vec3.fromValues(-1, 0, 0))).to.equal(true);
            expect(Vec3.equals(OrbitControl.BACKWARD, Vec3.fromValues(0, 0, 1))).to.equal(true);
            expect(Vec3.equals(OrbitControl.ORIGIN,   Vec3.fromValues(0, 0, 0))).to.equal(true);
        });

        it('defines epsilon constant', () => {
            expect(OrbitControl.EPSILON).to.equal(0.0001);
        });

        it('defines damping and speed constants', () => {
            expect(OrbitControl.DAMPING).to.equal(0.75);
            expect(OrbitControl.ROTATE_K).to.equal(0.0015);
            expect(OrbitControl.ZOOM_K).to.equal(0.0005);
            expect(OrbitControl.PAN_K).to.equal(0.0005);
        });

        it('defines zoom bounds', () => {
            expect(OrbitControl.ZOOM_BOUNDS).to.deep.equal([-5, 5]);
        });

        it('defines default rotation', () => {
            const defaultRotation = Quat.fromEuler(new Quat(), 0, 0, 0);
            expectQuatCloseTo(OrbitControl.DEFAULT_ROTATION, defaultRotation);
        });

        it('defines axis rotations', () => {
            const axes = OrbitControl.AXIS_ROTATIONS;
            expectQuatCloseTo(axes['x'],  Quat.setAxisAngle(new Quat(), [0, 1, 0],  Math.PI / 2));
            expectQuatCloseTo(axes['y'],  Quat.setAxisAngle(new Quat(), [1, 0, 0], -Math.PI / 2));
            expectQuatCloseTo(axes['z'],  new Quat());
            expectQuatCloseTo(axes['-x'], Quat.setAxisAngle(new Quat(), [0, 1, 0], -Math.PI / 2));
            expectQuatCloseTo(axes['-y'], Quat.setAxisAngle(new Quat(), [1, 0, 0],  Math.PI / 2));
            expectQuatCloseTo(axes['-z'], Quat.setAxisAngle(new Quat(), [0, 1, 0],  Math.PI));
        });
    });
});
