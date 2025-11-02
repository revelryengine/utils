/**
 * Orbit controls for a 3D camera, allowing for rotation, zooming, and panning.
 *
 * @module
 */
import { Vec3, Mat4, Quat } from '../deps/gl-matrix.js';

/**
 * @import { Vec2Like, Vec3Like, Mat4Like, QuatLike } from '../deps/gl-matrix.js';
 */

const { PI, abs } = Math;

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} num
 * @param {number} min
 * @param {number} max
 */
function clamp(num, min, max) {
    if (num <= min) return min;
    if (num >= max) return max;
    return num;
}

/**
 * Linearly interpolates between two values.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
function lerp(a, b, t) {
    return a + t * (b - a);
}

/**
 * @typedef {object} OrbitControlInputDOF - The depth of field (dof) input state.
 * @property {number} start - Start distance.
 * @property {number} end - End distance.
 * @property {number} time - Transition time.
 */
/**
 * @typedef {object} OrbitControlInput - The input state of the OrbitControl.
 * @property {number} yaw - Yaw rotation input.
 * @property {number} pitch - Pitch rotation input.
 * @property {number} zoom - Zoom level input.
 * @property {[number, number]} pan - Pan position input.
 * @property {OrbitControlInputDOF} dof - Depth of field (dof) input.
 */

/**
 * @typedef {(matrix: Mat4Like) => void} OnUpdateCallback - A callback function invoked whenever the control is updated.
 * @typedef {(input: OrbitControlInput) => void} OnInputCallback - A callback function invoked whenever there is input.
 */

/**
 * A class that provides orbit controls for a 3D camera.
 */
export class OrbitControl {
    /**
     * The up direction vector.
     */
    static UP = new Vec3(0, 1, 0);
    /**
     * The right direction vector.
     */
    static RIGHT = new Vec3(1, 0, 0);
    /**
     * The forward direction vector.
     */
    static FORWARD = new Vec3(0, 0, -1);
    /**
     * The down direction vector.
     */
    static DOWN = new Vec3(this.UP).scale(-1);
    /**
     * The left direction vector.
     */
    static LEFT = new Vec3(this.RIGHT).scale(-1);
    /**
     * The backward direction vector.
     */
    static BACKWARD = new Vec3(this.FORWARD).scale(-1);
    /**
     * The origin point.
     */
    static ORIGIN = new Vec3();

    /**
     * A small value used for floating-point comparisons.
     */
    static EPSILON = 0.0001;

    /**
     * The minimum and maximum zoom levels.
     */
    static ZOOM_BOUNDS = /** @type {const} */([-5, 5]);
    /**
     * The damping factor for smoothing movements.
     */
    static DAMPING = 0.75;
    /**
     * The rotation speed factor.
     */
    static ROTATE_K = 0.0015;
    /**
     * The zoom speed factor.
     */
    static ZOOM_K = 0.0005;
    /**
     * The pan speed factor.
     */
    static PAN_K = 0.0005;

    /**
     * The default rotation quaternion (no rotation).
     */
    static DEFAULT_ROTATION = /** @type {Quat} */(Quat.fromEuler(new Quat(), 0, 0, 0));

    /**
     * The axis rotations for the camera.
     */
    static AXIS_ROTATIONS = /** @type {const} */({
        /**
         * X Axis
         */
        'x': /** @type {Quat} */(Quat.setAxisAngle(new Quat(), [0, 1, 0],  PI / 2)),
        /**
         * Y Axis
         */
        'y': /** @type {Quat} */(Quat.setAxisAngle(new Quat(), [1, 0, 0], -PI / 2)),
        /**
         * Z Axis
         */
        'z': new Quat(),

        /**
         * -X Axis
         */
        '-x': /** @type {Quat} */(Quat.setAxisAngle(new Quat(), [0, 1, 0], -PI / 2)),
        /**
         * -Y Axis
         */
        '-y': /** @type {Quat} */(Quat.setAxisAngle(new Quat(), [1, 0, 0],  PI / 2)),
        /**
         * -Z Axis
         */
        '-z': /** @type {Quat} */(Quat.setAxisAngle(new Quat(), [0, 1, 0],  PI)),
    });

    static #upsideDown = new Vec3();

    /**
     * Checks if the camera is upside down.
     * @param {QuatLike} rotation
     */
    static #isUpsideDown(rotation) {
        Vec3.transformQuat(this.#upsideDown, this.UP, rotation);
        return Vec3.dot(this.#upsideDown, this.UP) < 0;
    }

    #orbit  = new Quat();
    #pitch  = new Quat();
    #yaw    = new Quat();
    #unit   = new Vec3();

    /**
     * @type {{
     *  zoom?:     { origin: number,   destination: number,   duration: number, elapsedTime: number },
     *  distance?: { origin: number,   destination: number,   duration: number, elapsedTime: number },
     *  rotation?: { origin: QuatLike, destination: QuatLike, duration: number, elapsedTime: number },
     *  target?:   { origin: Vec3Like, destination: Vec3Like, duration: number, elapsedTime: number },
     *  offset?:   { origin: Vec3Like, destination: Vec3Like, duration: number, elapsedTime: number },
     * }}
     */
    #interpolation = {};

    /**
     * @type {PointerEvent[]}
     */
    #ptrCache = [];

    #prevDiff = -1;

    /**
     * The current rotation quaternion.
     */
    rotation = new Quat(OrbitControl.DEFAULT_ROTATION);
    /**
     * The current target position.
     */
    target = new Vec3();
    /**
     * The current offset position.
     */
    offset = new Vec3();
    /**
     * The current zoom level.
     */
    zoom = 0;
    /**
     * The current ideal distance from the target.
     */
    idealDistance = 5;
    /**
     * The current matrix representing the camera's transformation.
     */
    matrix = /** @type {Mat4} */(Mat4.fromQuat(new Mat4(), this.rotation));
    /**
     * The current up direction vector.
     */
    up = new Vec3();
    /**
     * The current right direction vector.
     */
    right = new Vec3();
    /**
     * The current forward direction vector.
     */
    forward = new Vec3();
    /**
     * The current user input sensitivity settings for rotation, zoom, pan, and focus.
     */
    sensitivity = {
        /** Rotation sensitivity */
        rotate: 1,
        /** Zoom sensitivity */
        zoom: 1,
        /** Pan sensitivity */
        pan: 1,
        /** Focus sensitivity */
        focus: 100,
    };
    /**
     * The current input state for yaw, pitch, zoom, pan, and depth of field (dof).
     * @type {OrbitControlInput}
     */
    input = {
        yaw:   0,
        pitch: 0,
        zoom:  0,
        pan:  [0, 0],
        dof: {
            start: 0,
            end:   0,
            time:  0,
        },
    };

    #axis = /** @type {keyof typeof OrbitControl['AXIS_ROTATIONS']|'user'}*/('user');
    /**
     * The current axis of the camera (one of 'x', 'y', 'z', '-x', '-y', '-z', or 'user').
     */
    get axis() {
        return this.#axis;
    }

    /**
     * Sets the rotation to match the specified axis.
     * @param {keyof typeof OrbitControl['AXIS_ROTATIONS']|'user'} value - The axis to set the rotation to.
     */
    set axis(value) {
        if (value === 'user') {
            return;
        }
        Quat.copy(this.rotation, OrbitControl.AXIS_ROTATIONS[value]);
    }

    /**
     * The current distance from the target, calculated based on the ideal distance and zoom level.
     * Uses the following formula: distance = idealDistance * 2^(-zoom)
     */
    get distance() {
        return this.idealDistance * Math.pow(2, -this.zoom);
    }

    /**
     * Creates an instance of OrbitControl.
     * @param {object} options - The options for the OrbitControl
     * @param {OnUpdateCallback} [options.onupdate] - Callback invoked whenever the control is updated
     * @param {OnInputCallback} [options.oninput] - Callback invoked whenever there is input
     */
    constructor({ onupdate, oninput }) {
        /**
         * Callback invoked whenever the control is updated
         * @type {OnUpdateCallback | undefined}
         */
        this.onupdate = onupdate;
        /**
         * Callback invoked whenever there is input
         * @type {OnInputCallback | undefined}
         */
        this.oninput  = oninput;
    }

    /**
     * @param {WheelEvent} e
     */
    #handleWheelEvent = (e) => {
        const { ZOOM_K } = OrbitControl;
        const delta = e.deltaY;
            // switch(e.deltaMode) { //see https://bugzilla.mozilla.org/show_bug.cgi?id=1392460#c34
            //     case e.DOM_DELTA_PIXEL:
            //         delta = e.deltaY;
            //         break;
            //     case e.DOM_DELTA_LINE:
            //         delta = e.deltaY * parseInt(self.getComputedStyle(this.canvas).lineHeight);
            //         break;
            //     case e.DOM_DELTA_PAGE:
            //         delta = e.deltaY * screen.height;
            //         break;
            // }
        this.input.zoom -= delta * (this.sensitivity.zoom * ZOOM_K) ;
        delete this.#interpolation.zoom;

        e.preventDefault();
    }

    /**
     * @param {PointerEvent} e
     */
    #handleUpEvent = (e) => {
        this.#ptrCache.splice(this.#ptrCache.findIndex(ev => e.pointerId === ev.pointerId), 1);
        if (this.#ptrCache.length < 2) this.#prevDiff = -1;

        /** @type {HTMLElement} */(e.target).releasePointerCapture(e.pointerId);
    }

    /**
     * @param {PointerEvent} e
     */
    #handleDownEvent = (e) => {
        this.#ptrCache.push(e);

        /** @type {HTMLElement} */(e.target).setPointerCapture(e.pointerId);
    }

    /**
     * @param {PointerEvent} e
     */
    #handleMoveEvent = (e) => {
        const { PAN_K, ROTATE_K, ZOOM_K } = OrbitControl;

        const i = this.#ptrCache.findIndex(ev => e.pointerId === ev.pointerId);

        if (i !== -1){ // dragging
            const lastPointerEvent = this.#ptrCache[i];
            this.#ptrCache[i] = e;

            if (this.#ptrCache.length === 2) {
                const curDiff = abs(this.#ptrCache[0].clientX - this.#ptrCache[1].clientX);

                if (this.#prevDiff > 0) {
                    this.input.zoom -= (this.#prevDiff - curDiff) * (this.sensitivity.zoom * ZOOM_K) * 10;
                    delete this.#interpolation.zoom;
                }
                this.#prevDiff = curDiff;
            } else if (this.#ptrCache.length === 1 && e.isPrimary) {
                const deltaX = lastPointerEvent.clientX - e.clientX;
                const deltaY = lastPointerEvent.clientY - e.clientY;
                if (e.shiftKey) {
                    this.input.pan[0] += deltaX * (this.sensitivity.pan * PAN_K);
                    this.input.pan[1] += deltaY * (this.sensitivity.pan * PAN_K);
                } else {
                    this.input.yaw   += deltaX * (this.sensitivity.rotate * ROTATE_K);
                    this.input.pitch += deltaY * (this.sensitivity.rotate * ROTATE_K);
                }
            }
            delete this.#interpolation.rotation;
        }
    }

    #up      = new Vec3();
    #right   = new Vec3();

    /**
     * Updates the camera's state.
     * @param {number} hrTime - High-resolution time delta
     * @param {boolean} [forceUpdate] - Whether to force an update regardless of input
     */
    update(hrTime, forceUpdate) {
        const {
            UP, DOWN, BACKWARD, ORIGIN, ZOOM_BOUNDS, DAMPING, EPSILON
        } = OrbitControl;

        const { rotation, target, input, up, right } = this;

        let updateState = false;

        // ------Zoom-----------------
        if (abs(input.zoom) > EPSILON) {
            this.zoom = clamp(this.zoom + input.zoom, ...ZOOM_BOUNDS);

            updateState = true;
        }

        // ------Panning-----------
        if (abs(input.pan[0]) > EPSILON || abs(input.pan[1]) > EPSILON) {
            Vec3.add(target, target, Vec3.scale(this.#up,    up,   -input.pan[1]));
            Vec3.add(target, target, Vec3.scale(this.#right, right, input.pan[0]));

            updateState = true;
        }


        // ------Orbit-------------
        if (abs(input.pitch) > 0.0001 || abs(input.yaw) > 0.0001) {
            const orbit  = this.#orbit;
            const unit   = this.#unit;
            const pitch  = this.#pitch;
            const yaw    = this.#yaw;

            const orbitPitch = Quat.setAxisAngle(pitch, right, input.pitch);
            const orbitYaw   = Quat.setAxisAngle(yaw,   UP,    input.yaw);

            Quat.multiply(orbit, orbitYaw, orbitPitch); //Yaw has to be first or it results in a jump near the pole when the camera goes upside down
            Quat.multiply(orbit, orbit, rotation);

            Vec3.transformQuat(unit, BACKWARD, orbit);

            Mat4.targetTo(this.matrix, unit, ORIGIN, OrbitControl.#isUpsideDown(orbit) ? DOWN : UP);
            Mat4.getRotation(rotation, this.matrix);

            updateState = true;
        }

        if (updateState) this.oninput?.(input);

        // ---------- Apply -----------------


        if (updateState || forceUpdate) this.#updateState();

        input.zoom   *= DAMPING; if (Math.abs(input.zoom) < EPSILON)   input.zoom   = 0;
        input.pan[0] *= DAMPING; if (Math.abs(input.pan[0]) < EPSILON) input.pan[0] = 0;
        input.pan[1] *= DAMPING; if (Math.abs(input.pan[1]) < EPSILON) input.pan[1] = 0;
        input.pitch  *= DAMPING; if (Math.abs(input.pitch) < EPSILON)  input.pitch  = 0;
        input.yaw    *= DAMPING; if (Math.abs(input.yaw) < EPSILON)    input.yaw    = 0;

        this.#updateInterpolations(hrTime);

        return updateState || forceUpdate;
    }

    #translation = new Vec3();

    #updateState() {
        const { BACKWARD, AXIS_ROTATIONS } = OrbitControl;

        const { rotation, target, offset, zoom, idealDistance, up, right, forward, matrix } = this;

        Vec3.transformQuat(this.#translation, BACKWARD, rotation);

        const distance = idealDistance * Math.pow(2, -zoom);

        this.#translation.scale(distance);
        this.#translation.add(target);
        this.#translation.sub(offset);

        Mat4.fromRotationTranslation(matrix, rotation, this.#translation);

        Vec3.normalize(up,      new Float32Array(matrix.buffer, 16, 3));
        Vec3.normalize(right,   new Float32Array(matrix.buffer,  0, 3));
        Vec3.normalize(forward, new Float32Array(matrix.buffer, 32, 3));

        const axis = /** @type {keyof typeof AXIS_ROTATIONS|undefined} */(Object.entries(AXIS_ROTATIONS).find(([, r]) => Quat.equals(r, rotation))?.[0]);
        this.#axis = axis ?? 'user';

        this.onupdate?.(matrix);
    }
    /**
     * @param {number} hrTime
     */
    #updateInterpolations(hrTime) {
        for (const [_, interpolation] of Object.entries(this.#interpolation)) {
            if (interpolation) {
                interpolation.elapsedTime += hrTime;
            }
        }

        const { zoom, rotation, target, offset, distance } = this.#interpolation;

        if (zoom)     this.zoom          = lerp(zoom.origin, zoom.destination, clamp(zoom.elapsedTime / zoom.duration, 0, 1));
        if (distance) this.idealDistance = lerp(distance.origin, distance.destination, clamp(distance.elapsedTime / distance.duration, 0, 1));

        if (rotation) Quat.slerp(this.rotation, rotation.origin, rotation.destination, clamp(rotation.elapsedTime / rotation.duration, 0, 1));
        if (target)   Vec3.lerp(this.target,    target.origin,   target.destination,   clamp(target.elapsedTime / target.duration, 0, 1));
        if (offset)   Vec3.lerp(this.offset,    offset.origin,   offset.destination,   clamp(offset.elapsedTime / offset.duration, 0, 1));


        if (zoom || rotation || target || offset || distance) this.#updateState();

        for (const [name, interpolation] of Object.entries(this.#interpolation)) {
            if (interpolation && interpolation.elapsedTime >= interpolation.duration) {
                delete this.#interpolation[/**@type {'zoom'|'distance'|'rotation'|'target'|'offset'} */(name)];
            }
        }
    }

    /**
     * Interpolates the camera's properties over time.
     * @param {object}   values            - The values to interpolate.
     * @param {number}   [values.zoom]     - Destination zoom level
     * @param {number}   [values.distance] - Destination distance
     * @param {QuatLike} [values.rotation] - Destination rotation
     * @param {Vec3Like} [values.target]   - Destination target position
     * @param {Vec3Like} [values.offset]   - Destination offset position
     * @param {number}   values.duration   - Duration of the interpolation in milliseconds
     */
    interpolate({ zoom, distance, rotation, target, offset, duration }){
        if (zoom !== undefined)     this.#interpolation.zoom      = { origin: this.zoom, destination: zoom, duration, elapsedTime: 0 };
        if (distance !== undefined) this.#interpolation.distance  = { origin: this.idealDistance, destination: distance, duration, elapsedTime: 0 };

        if (rotation) this.#interpolation.rotation = { origin: new Quat(this.rotation), destination: new Quat(rotation), duration, elapsedTime: 0 };
        if (target)   this.#interpolation.target   = { origin: new Vec3(this.target),   destination: new Vec3(target),   duration, elapsedTime: 0 };
        if (offset)   this.#interpolation.offset   = { origin: new Vec3(this.offset),   destination: new Vec3(offset),   duration, elapsedTime: 0 };
    }

    /**
     * Sets the camera's target position and ideal distance, with optional interpolation.
     * @param {object} options - The options for setting the target.
     * @param {Vec3Like} options.target - Target position.
     * @param {number} options.idealDistance - Desired distance from the target.
     * @param {number} [options.interpolate] - Interpolation duration in milliseconds.
     */
    setTarget({ target, idealDistance, interpolate }) {
        if (interpolate) {
            this.interpolate({ zoom: 0, distance: idealDistance, target, duration: interpolate });
        } else {
            this.idealDistance = idealDistance;
            this.zoom = 0;
            this.target.copy(target);
            this.#updateState();
        }
    }

    /**
     * @type {Map<HTMLElement, AbortController>}
     */
    #observers = new Map();

    /**
     * Observes a DOM element for camera control events.
     * @param {HTMLElement} element - The element to observe.
     * @param {number} [button] - The mouse button to use for rotation (default is 0 - left button).
     */
    observeElement(element, button = 0) {
        const abortCtrl = new AbortController();
        element.addEventListener('wheel',       this.#handleWheelEvent, { signal: abortCtrl.signal });
        element.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse' || e.button === button){
                this.#handleDownEvent(e)
            }
        },  { signal: abortCtrl.signal });
        element.addEventListener('pointermove', this.#handleMoveEvent, { signal: abortCtrl.signal });
        element.addEventListener('pointerup',   this.#handleUpEvent,   { signal: abortCtrl.signal });

        this.#observers.set(element, abortCtrl);

        this.#updateState();
    }

    /**
     * Stops observing a DOM element for camera control events.
     * @param {HTMLElement} element - The element to stop observing.
     */
    unobserveElement(element) {
        this.#observers.get(element)?.abort();
    }

    /**
     * Stops observing all DOM elements for camera control events.
     */
    unobserveAll() {
        for (const ctrl of this.#observers.values()) {
            ctrl.abort();
        }
    }
}
