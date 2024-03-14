import { vec3, mat4, quat } from '../deps/gl-matrix.js';

const { PI, abs } = Math;

/**
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
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
function lerp(a, b, t) {
    return a + t * (b - a);
}

export class OrbitControl {
    static UP       = vec3.fromValues(0, 1, 0);
    static RIGHT    = vec3.fromValues(1, 0, 0);
    static FORWARD  = vec3.fromValues(0, 0,-1);
    static DOWN     = vec3.scale(vec3.create(), this.UP,      -1);
    static LEFT     = vec3.scale(vec3.create(), this.RIGHT,   -1);
    static BACKWARD = vec3.scale(vec3.create(), this.FORWARD, -1);
    static ORIGIN   = vec3.create();

    static EPSILON  = 0.0001;

    static ZOOM_BOUNDS      = /** @type {const} */([-5, 5]);
    static DAMPING          = 0.75;
    static DEFAULT_ROTATION = quat.fromEuler(quat.create(), 0, 0, 0);

    static ROTATE_K = 0.0015;
    static ZOOM_K   = 0.0005;
    static PAN_K    = 0.0005;

    static AXIS_ROTATIONS = /** @type {const} */({
        'x': quat.setAxisAngle(quat.create(), [0, 1, 0],  PI / 2),
        'y': quat.setAxisAngle(quat.create(), [1, 0, 0], -PI / 2),
        'z': quat.create(),

        '-x': quat.setAxisAngle(quat.create(), [0, 1, 0], -PI / 2),
        '-y': quat.setAxisAngle(quat.create(), [1, 0, 0],  PI / 2),
        '-z': quat.setAxisAngle(quat.create(), [0, 1, 0],  PI),
    });

    static #upsideDown = quat.create();

    /**
     * @param {quat} rotation
     */
    static isUpsideDown(rotation) {
        vec3.transformQuat(this.#upsideDown, this.UP, rotation);
        return vec3.dot(this.#upsideDown, this.UP) < 0;
    }

    #orbit  = quat.create();
    #pitch  = quat.create();
    #yaw    = quat.create();
    #unit   = vec3.create();
    // #matrix = mat4.create();

    /**
     * @type {{
     *  zoom?:     { origin: number, destination: number, duration: number, elapsedTime: number },
     *  distance?: { origin: number, destination: number, duration: number, elapsedTime: number },
     *  rotation?: { origin: quat,   destination: quat,   duration: number, elapsedTime: number },
     *  target?:   { origin: vec3,   destination: vec3,   duration: number, elapsedTime: number },
     *  offset?:   { origin: vec3,   destination: vec3,   duration: number, elapsedTime: number },
     * }}
     */
    #interpolation = {};

    rotation      = quat.clone(OrbitControl.DEFAULT_ROTATION);
    target        = vec3.create();
    offset        = vec3.create();
    zoom          = -1;
    idealDistance = 5;

    matrix  = mat4.fromQuat(mat4.create(), this.rotation);

    up      = vec3.create();
    right   = vec3.create();
    forward = vec3.create();

    speed = { rotate: 1, zoom: 1, pan: 1, focus: 100 };
    input = { yaw: 0, pitch: 0, zoom: 0, pan: [0, 0], dof: { start: 0, end: 0, time: 0 } };

    #axis = /** @type {keyof typeof OrbitControl['AXIS_ROTATIONS']|'user'}*/('user');
    get axis() {
        return this.#axis;
    }

    get distance() {
        return this.idealDistance * Math.pow(2, -this.zoom);
    }

    /**
     * @type {PointerEvent[]}
     */
    #ptrCache = [];

    #prevDiff = -1;

    /**
     * @param {{ onupdate?: (matrix: mat4) => void, oninput?: (input: OrbitControl['input']) => void }} handlers
     */
    constructor({ onupdate, oninput }) {
        this.onupdate = onupdate;
        this.oninput  = oninput
    }

    /**
     * @param {WheelEvent} e
     */
    #handleWheelEvent = (e) => {
        const { ZOOM_K } = OrbitControl;
        let delta = e.deltaY;
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
        this.input.zoom -= delta * (this.speed.zoom * ZOOM_K) ;
        delete this.#interpolation.zoom;
    }

    /**
     * @param {PointerEvent} e
     */
    #handleUpEvent = (e) => {
        this.#ptrCache.splice(this.#ptrCache.findIndex(ev => e.pointerId === ev.pointerId), 1);
        if(this.#ptrCache.length < 2) this.#prevDiff = -1;

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

        if(i !== -1){ // dragging
            const lastPointerEvent = this.#ptrCache[i];
            this.#ptrCache[i] = e;

            if(this.#ptrCache.length === 2) {
                const curDiff = abs(this.#ptrCache[0].clientX - this.#ptrCache[1].clientX);

                if (this.#prevDiff > 0) {
                    this.input.zoom -= (this.#prevDiff - curDiff) * (this.speed.zoom * ZOOM_K) * 10;
                    delete this.#interpolation.zoom;
                }
                this.#prevDiff = curDiff;
            } else if(this.#ptrCache.length === 1 && e.isPrimary) {
                const deltaX = lastPointerEvent.clientX - e.clientX;
                const deltaY = lastPointerEvent.clientY - e.clientY;
                if (e.shiftKey) {
                    this.input.pan[0] += deltaX * (this.speed.pan * PAN_K);
                    this.input.pan[1] += deltaY * (this.speed.pan * PAN_K);
                } else {
                    this.input.yaw   += deltaX * (this.speed.rotate * ROTATE_K);
                    this.input.pitch += deltaY * (this.speed.rotate * ROTATE_K);
                }
            }
            delete this.#interpolation.rotation;
        }
    }

    #up      = vec3.create();
    #right   = vec3.create();

    /**
     * @param {number} hrTime
     * @param {boolean} [forceUpdate]
     */
    update(hrTime, forceUpdate) {
        const {
            UP, DOWN, BACKWARD, ORIGIN, ZOOM_BOUNDS, DAMPING, EPSILON
        } = OrbitControl;

        const { rotation, target, input, up, right } = this;

        let updateState = false;

        // ------Zoom-----------------
        if(abs(input.zoom) > EPSILON) {
            this.zoom = clamp(this.zoom + input.zoom, ...ZOOM_BOUNDS);

            updateState = true;
        }

        // ------Panning-----------
        if(abs(input.pan[0]) > EPSILON || abs(input.pan[1]) > EPSILON) {
            vec3.add(target, target, vec3.scale(this.#up,    up,   -input.pan[1]));
            vec3.add(target, target, vec3.scale(this.#right, right, input.pan[0]));

            updateState = true;
        }


        // ------Orbit-------------
        if(abs(input.pitch) > 0.0001 || abs(input.yaw) > 0.0001) {
            const orbit  = this.#orbit;
            const unit   = this.#unit;
            const pitch  = this.#pitch;
            const yaw    = this.#yaw;

            const orbitPitch = quat.setAxisAngle(pitch, right, input.pitch);
            const orbitYaw   = quat.setAxisAngle(yaw,   UP,    input.yaw);

            quat.multiply(orbit, orbitYaw, orbitPitch); //Yaw has to be first or it results in a jump near the pole when the camera goes upside down
            quat.multiply(orbit, orbit, rotation);

            vec3.transformQuat(unit, BACKWARD, orbit);

            mat4.targetTo(this.matrix, unit, ORIGIN, OrbitControl.isUpsideDown(orbit) ? DOWN : UP);
            mat4.getRotation(rotation, this.matrix);

            updateState = true;
        }

        if(updateState) this.oninput?.(input);

        // ---------- Apply -----------------


        if(updateState || forceUpdate) this.#updateState();

        input.zoom   *= DAMPING;
        input.pan[0] *= DAMPING;
        input.pan[1] *= DAMPING;
        input.pitch  *= DAMPING;
        input.yaw    *= DAMPING;

        this.#updateInterpolations(hrTime);

        return updateState || forceUpdate;
    }

    #translation = vec3.create();

    #updateState() {
        const { BACKWARD, AXIS_ROTATIONS } = OrbitControl;

        const { rotation, target, offset, zoom, idealDistance, up, right, forward, matrix } = this;

        vec3.transformQuat(this.#translation, BACKWARD, rotation);

        const distance = idealDistance * Math.pow(2, -zoom);

        vec3.scale(this.#translation, this.#translation, distance);
        vec3.add(this.#translation, this.#translation, target);
        vec3.sub(this.#translation, this.#translation, offset);

        mat4.fromRotationTranslation(matrix, rotation, this.#translation);

        vec3.normalize(up,      new Float32Array(/** @type {Float32Array} */(matrix).buffer, 16, 3));
        vec3.normalize(right,   new Float32Array(/** @type {Float32Array} */(matrix).buffer,  0, 3));
        vec3.normalize(forward, new Float32Array(/** @type {Float32Array} */(matrix).buffer, 32, 3));

        const axis = /** @type {keyof typeof AXIS_ROTATIONS|undefined} */(Object.entries(AXIS_ROTATIONS).find(([, r]) => quat.equals(r, rotation))?.[0]);
        this.#axis = axis ?? 'user';

        this.onupdate?.(matrix);
    }
    /**
     * @param {number} hrTime
     */
    #updateInterpolations(hrTime) {
        for(const [_, interpolation] of Object.entries(this.#interpolation)) {
            if(interpolation) {
                interpolation.elapsedTime += hrTime;
            }
        }

        const { zoom, rotation, target, offset, distance } = this.#interpolation;

        if(zoom)     this.zoom          = lerp(zoom.origin, zoom.destination, clamp(zoom.elapsedTime / zoom.duration, 0, 1));
        if(distance) this.idealDistance = lerp(distance.origin, distance.destination, clamp(distance.elapsedTime / distance.duration, 0, 1));

        if(rotation) quat.slerp(this.rotation, rotation.origin, rotation.destination, clamp(rotation.elapsedTime / rotation.duration, 0, 1));
        if(target)   vec3.lerp(this.target,    target.origin,   target.destination,   clamp(target.elapsedTime / target.duration, 0, 1));
        if(offset)   vec3.lerp(this.offset,    offset.origin,   offset.destination,   clamp(offset.elapsedTime / offset.duration, 0, 1));


        if(zoom || rotation || target || offset || distance) this.#updateState();

        for(const [name, interpolation] of Object.entries(this.#interpolation)) {
            if(interpolation && interpolation.elapsedTime >= interpolation.duration) {
                delete this.#interpolation[/**@type {'zoom'|'distance'|'rotation'|'target'|'offset'} */(name)];
            }
        }
    }

    /**
     * @param {{ zoom?: number, distance?: number, rotation?: quat, target?: vec3, offset?: vec3, duration: number }} values
     */
    interpolate({ zoom, distance, rotation, target, offset, duration }){
        if(zoom !== undefined)     this.#interpolation.zoom      = { origin: this.zoom, destination: zoom, duration, elapsedTime: 0 };
        if(distance !== undefined) this.#interpolation.distance  = { origin: this.idealDistance, destination: distance, duration, elapsedTime: 0 };

        if(rotation) this.#interpolation.rotation = { origin: quat.clone(this.rotation), destination: quat.clone(rotation), duration, elapsedTime: 0 };
        if(target)   this.#interpolation.target   = { origin: vec3.clone(this.target),   destination: vec3.clone(target),   duration, elapsedTime: 0 };
        if(offset)   this.#interpolation.offset   = { origin: vec3.clone(this.offset),   destination: vec3.clone(offset),   duration, elapsedTime: 0 };

    }

    /**
     * @param {{ target: vec3, idealDistance: number, interpolate?: boolean }} options
     */
    setTarget({ target, idealDistance, interpolate = false }) {
        if(interpolate) {
            this.interpolate({ zoom: 0, distance: idealDistance, target, duration: 300 });
        } else {
            this.idealDistance = idealDistance;
            this.zoom = 0;
            vec3.copy(this.target, target);
            this.#updateState();
        }
    }

    /**
     * @type {Map<HTMLElement, AbortController>}
     */
    #observers = new Map();

    /**
     * @param {HTMLElement} element
     * @param {number} [button]
     */
    observeElement(element, button = 0) {
        const abortCtrl = new AbortController();
        element.addEventListener('wheel',       this.#handleWheelEvent, { passive: true, signal: abortCtrl.signal });
        element.addEventListener('pointerdown', (e) => {
            if(e.pointerType !== 'mouse' || e.button === button){
                this.#handleDownEvent(e)
            }
        },  { passive: false, signal: abortCtrl.signal });
        element.addEventListener('pointermove', this.#handleMoveEvent, { passive: false, signal: abortCtrl.signal });
        element.addEventListener('pointerup',   this.#handleUpEvent,   { signal: abortCtrl.signal});

        this.#observers.set(element, abortCtrl);

        this.#updateState();
    }

    /**
     * @param {HTMLElement} element
     */
    unobserveElement(element) {
        this.#observers.get(element)?.abort();
    }

    unobserveAll() {
        for(const ctrl of this.#observers.values()) {
            ctrl.abort();
        }
    }
}
