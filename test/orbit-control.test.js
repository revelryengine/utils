import { describe, it, beforeEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert               } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertEquals         } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertStrictEquals   } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';
import { assertAlmostEquals   } from 'https://deno.land/std@0.208.0/assert/assert_almost_equals.ts';
import { assertSpyCalls, spy  } from 'https://deno.land/std@0.208.0/testing/mock.ts';

import { OrbitControl } from '../lib/orbit-control.js';
import { vec3, quat }    from '../deps/gl-matrix.js';

class ElementStub {
    constructor(name) {
        this.name = name;
        this.listeners = new Map();
        this.captured = new Set();
    }

    addEventListener(type, handler, options) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push({ handler, options });
    }

    dispatch(type, event) {
        event.target ??= this;
        const listeners = this.listeners.get(type);
        if (!listeners) return;
        for (const { handler } of listeners) {
            handler(event);
        }
    }

    setPointerCapture(id) {
        this.captured.add(id);
    }

    releasePointerCapture(id) {
        this.captured.delete(id);
    }
}

const createWheelEvent = (deltaY) => {
    const event = {
        deltaY,
        deltaMode: 0,
        prevented: false,
        preventDefault() {
            this.prevented = true;
        }
    };
    return event;
};

const createPointerEvent = (overrides = {}) => {
    const event = {
        pointerId: overrides.pointerId ?? 1,
        clientX: overrides.clientX ?? 0,
        clientY: overrides.clientY ?? 0,
        pointerType: overrides.pointerType ?? 'mouse',
        button: overrides.button ?? 0,
        isPrimary: overrides.isPrimary ?? true,
        shiftKey: overrides.shiftKey ?? false,
        prevented: false,
        preventDefault() {
            this.prevented = true;
        },
        ...overrides
    };
    return event;
};

const assertVec3AlmostEquals = (actual, expected, epsilon = 1e-5) => {
    for (let i = 0; i < 3; i++) {
        assertAlmostEquals(actual[i], expected[i], epsilon);
    }
};

const assertQuatAlmostEquals = (actual, expected, epsilon = 1e-5) => {
    for (let i = 0; i < 4; i++) {
        assertAlmostEquals(actual[i], expected[i], epsilon);
    }
};

describe('OrbitControl', () => {
    /** @type {OrbitControl} */
    let control;
    /** @type {ReturnType<typeof spy>} */
    let onupdate;
    /** @type {ReturnType<typeof spy>} */
    let oninput;

    beforeEach(() => {
        onupdate = spy(() => {});
        oninput = spy(() => {});
        control = new OrbitControl({ onupdate, oninput });
        control.update(0, true);
    });

    it('should update zoom, pan, and orbit while damping inputs and reporting axis', () => {
        control.zoom = 4.5;
        control.input.zoom = 10;
        control.input.pan = [0.5, -0.75];
        control.input.pitch = Math.PI / 2;
        control.input.yaw = -Math.PI / 4;

        const updated = control.update(16, false);
        assert(updated);
        assertSpyCalls(oninput, 1);

        assertAlmostEquals(control.zoom, OrbitControl.ZOOM_BOUNDS[1], 1e-6);

        // Damping should reduce but not eliminate input in one frame.
        assertAlmostEquals(control.input.zoom, 10 * OrbitControl.DAMPING, 1e-6);

        // Force update path should still trigger update even without input changes.
        const forced = control.update(16, true);
        assert(forced);
        assertSpyCalls(onupdate, 3);

        // Trigger minimum clamp by zooming out aggressively.
        control.input.zoom = -50;
        control.update(16, false);
        assertAlmostEquals(control.zoom, OrbitControl.ZOOM_BOUNDS[0], 1e-6);

        // Ensure midpoint clamp path keeps value as-is.
        control.input.zoom = 0.5;
        control.update(16, false);
        assertAlmostEquals(control.zoom, -4.5, 1e-6);

        // Flip the camera upside down to exercise the down-vector branch.
        control.input.pitch = Math.PI;
        control.input.yaw = 0;
        let attempts = 0;
        while (!OrbitControl.isUpsideDown(control.rotation) && attempts < 5) {
            control.update(16, false);
            attempts++;
        }
        assert(OrbitControl.isUpsideDown(control.rotation));
    });

    it('should interpolate zoom, distance, rotation, target, and offset, and clears completed interpolations', () => {
        const destinationRotation = quat.setAxisAngle(quat.create(), [0, 1, 0], Math.PI / 2);
        const destinationTarget = vec3.fromValues(3, 4, 5);
        const destinationOffset = vec3.fromValues(1, -2, 0.5);

        control.interpolate({
            zoom: 2,
            distance: 10,
            rotation: destinationRotation,
            target: destinationTarget,
            offset: destinationOffset,
            duration: 100
        });

        control.update(25, false);

        assertAlmostEquals(control.zoom, 0.5, 1e-6);
        assertAlmostEquals(control.idealDistance, 6.25, 1e-6);
        assertVec3AlmostEquals(control.target, vec3.fromValues(0.75, 1, 1.25));
        assertVec3AlmostEquals(control.offset, vec3.fromValues(0.25, -0.5, 0.125));

        control.update(100, false);

        assertAlmostEquals(control.zoom, 2, 1e-6);
        assertAlmostEquals(control.idealDistance, 10, 1e-6);
        assertVec3AlmostEquals(control.target, destinationTarget);
        assertVec3AlmostEquals(control.offset, destinationOffset);
        assertQuatAlmostEquals(control.rotation, destinationRotation);

        // Additional updates should keep the interpolation targets without changes.
        const zoomBefore = control.zoom;
        control.update(200, false);
        assertAlmostEquals(control.zoom, zoomBefore, 1e-6);
    });

    it('should set targets directly or via interpolation', () => {
        const directTarget = vec3.fromValues(1, 2, 3);
        control.zoom = 2;
        control.setTarget({ target: directTarget, idealDistance: 15, interpolate: false });
        assertAlmostEquals(control.zoom, 0, 1e-6);
        assertAlmostEquals(control.idealDistance, 15, 1e-6);
        assertVec3AlmostEquals(control.target, directTarget);

        const interpolatedTarget = vec3.fromValues(-2, 5, 1);
        control.setTarget({ target: interpolatedTarget, idealDistance: 8, interpolate: true });
        control.update(150, false);
        assert(control.idealDistance < 15);
        control.update(300, false);
        assertAlmostEquals(control.zoom, 0, 1e-6);
        assertAlmostEquals(control.idealDistance, 8, 1e-6);
        assertVec3AlmostEquals(control.target, interpolatedTarget);
    });

    it('should observe elements and handles wheel, pointer, and pinch interactions', () => {
        const elementA = new ElementStub('A');
        control.observeElement(elementA, 2);
        assertSpyCalls(onupdate, 2);

        // Wheel handling with existing interpolation entry.
        control.interpolate({ zoom: 1, duration: 100 });
        const wheelEvent = createWheelEvent(-120);
        elementA.dispatch('wheel', wheelEvent);
        assert(wheelEvent.prevented);
        assertAlmostEquals(control.input.zoom, 0.06, 1e-6);

        // Pointer move when pointer is unknown should do nothing.
        const pointerMoveUnknown = createPointerEvent({ pointerId: 99 });
        elementA.dispatch('pointermove', pointerMoveUnknown);

        // Mouse pointer with non-matching button should not capture.
        const mouseEventIgnored = createPointerEvent({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
        elementA.dispatch('pointerdown', mouseEventIgnored);
        assertEquals(elementA.captured.has(1), false);

        // Matching mouse button triggers capture and enables rotation/pan.
        const mouseEvent = createPointerEvent({ pointerId: 2, pointerType: 'mouse', button: 2, clientX: 20, clientY: 20 });
        elementA.dispatch('pointerdown', mouseEvent);
        assertEquals(elementA.captured.has(2), true);

        const rotateMove = createPointerEvent({ pointerId: 2, pointerType: 'mouse', button: 2, clientX: 15, clientY: 10, isPrimary: true });
        elementA.dispatch('pointermove', rotateMove);
        assert(control.input.yaw > 0);
        assert(control.input.pitch > 0);

        const panMove = createPointerEvent({ pointerId: 2, pointerType: 'mouse', button: 2, clientX: 10, clientY: 8, isPrimary: true, shiftKey: true });
        elementA.dispatch('pointermove', panMove);
        assert(control.input.pan[0] !== 0 || control.input.pan[1] !== 0);

        const pointerUp = createPointerEvent({ pointerId: 2 });
        pointerUp.target = elementA;
        elementA.dispatch('pointerup', pointerUp);
        assertEquals(elementA.captured.has(2), false);

        // Two-finger pinch zoom handling.
        const touch1Down = createPointerEvent({ pointerId: 10, pointerType: 'touch', clientX: 0, clientY: 0 });
        const touch2Down = createPointerEvent({ pointerId: 11, pointerType: 'touch', clientX: 100, clientY: 0 });
        elementA.dispatch('pointerdown', touch1Down);
        elementA.dispatch('pointerdown', touch2Down);

        const firstPinchMove = createPointerEvent({ pointerId: 10, pointerType: 'touch', clientX: 90, clientY: 0 });
        elementA.dispatch('pointermove', firstPinchMove);
        const secondPinchMove = createPointerEvent({ pointerId: 10, pointerType: 'touch', clientX: 80, clientY: 0 });
        elementA.dispatch('pointermove', secondPinchMove);
        assert(control.input.zoom !== 0);

        const touchUp = createPointerEvent({ pointerId: 10 });
        touchUp.target = elementA;
        elementA.dispatch('pointerup', touchUp);

        control.unobserveElement(elementA);
        const wheelListener = elementA.listeners.get('wheel')?.[0];
        assert(wheelListener?.options?.signal?.aborted);

        const elementB = new ElementStub('B');
        control.observeElement(elementB);
        control.unobserveAll();
        const listenerB = elementB.listeners.get('wheel')?.[0];
        assert(listenerB?.options?.signal?.aborted);
    });

    it('should detect upside down state and axis alignment', () => {
        const upright = OrbitControl.isUpsideDown(quat.create());
        assertStrictEquals(upright, false);

        const invertedRotation = quat.setAxisAngle(quat.create(), [1, 0, 0], Math.PI);
        const inverted = OrbitControl.isUpsideDown(invertedRotation);
        assertStrictEquals(inverted, true);

        control.rotation = quat.clone(OrbitControl.AXIS_ROTATIONS['-x']);
        control.update(0, true);
        assertStrictEquals(control.axis, '-x');

        const customRotation = quat.setAxisAngle(quat.create(), [0, 1, 0], Math.PI / 3);
        control.rotation = customRotation;
        control.update(0, true);
        assertStrictEquals(control.axis, 'user');
    });

    it('should derive distance from the current zoom and ideal distance', () => {
        control.idealDistance = 6;
        control.zoom = 0;
        assertAlmostEquals(control.distance, 6, 1e-6);

        control.zoom = 2;
        assertAlmostEquals(control.distance, 1.5, 1e-6);

        control.zoom = -1;
        assertAlmostEquals(control.distance, 12, 1e-6);
    });
});
