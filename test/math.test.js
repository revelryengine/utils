import { describe, it, expect } from 'bdd';

import {
    normalizers,
    float16,
    roundUp,
    nearestUpperPowerOf2,
    mod,
    lte,
    normalizeAngle,
    rad2Deg,
    deg2Rad,
    angleDiff,
    angleDiffDeg,
    angleIsBetween,
    signedAngle,
    clamp,
    NORMALIZER_TYPES,
} from '../lib/math.js';

const { FLOAT, BYTE, UNSIGNED_BYTE, SHORT, UNSIGNED_SHORT } = NORMALIZER_TYPES;
const EPSILON = 1e-6;

describe('math', () => {
    describe('normalizers', () => {
        it('converts numeric inputs using the relevant conversion', () => {
            expect(normalizers[FLOAT](0.5)).to.equal(0.5);
            expect(normalizers[BYTE](127)).to.equal(1);
            expect(normalizers[BYTE](-127)).to.equal(-1);
            expect(normalizers[BYTE](-128)).to.equal(-1);
            expect(normalizers[UNSIGNED_BYTE](0)).to.equal(0);
            expect(normalizers[UNSIGNED_BYTE](255)).to.equal(1);
            expect(normalizers[SHORT](32767)).to.be.closeTo(1, EPSILON);
            expect(normalizers[SHORT](0)).to.be.closeTo(0, EPSILON);
            expect(normalizers[SHORT](-32768)).to.equal(-1);
            expect(normalizers[UNSIGNED_SHORT](65535)).to.be.closeTo(1, EPSILON);
            expect(normalizers[UNSIGNED_SHORT](0)).to.equal(0);
        });
    });

    describe('float16', () => {
        it('converts 16-bit float representations to numbers', () => {
            expect(float16(0x3C00)).to.equal(1);
            expect(float16(0xC000)).to.equal(-2);
            expect(float16(0x7BFF)).to.equal(65504);

            expect(float16(0x3555)).to.be.closeTo(0.333251953125, EPSILON);
            expect(float16(0x8400)).to.be.closeTo(-0.00006103515625, EPSILON);
            expect(float16(0x0001)).to.be.closeTo(5.960464477539063e-8, EPSILON);

            expect(float16(0x7E00)).to.satisfy(Number.isNaN);
            expect(float16(0x7C00)).to.equal(Infinity);
            expect(Object.is(float16(0x8000), -0)).to.equal(true);

            expect(float16(0xFC00)).to.equal(-Infinity);
        });
    });

    describe('roundUp', () => {
        it('rounds up to the nearest increment', () => {
            expect(roundUp(4, 5)).to.equal(8);
            expect(roundUp(8, 16)).to.equal(16);
            expect(roundUp(4, 1)).to.equal(4);
        });
    });

    describe('nearestUpperPowerOf2', () => {
        it('returns the next highest power of two', () => {
            expect(nearestUpperPowerOf2(0)).to.equal(0);
            expect(nearestUpperPowerOf2(1)).to.equal(1);
            expect(nearestUpperPowerOf2(5)).to.equal(8);
            expect(nearestUpperPowerOf2(1024)).to.equal(1024);
            expect(nearestUpperPowerOf2(1025)).to.equal(2048);
        });
    });

    describe('mod', () => {
        it('provides modulus that supports negative dividends', () => {
            expect(mod(7, 5)).to.equal(2);
            expect(mod(-1, 5)).to.equal(4);
            expect(mod(-6, 3)).to.equal(0);
        });
    });

    describe('lte', () => {
        it('treats values within epsilon as equal', () => {
            expect(lte(0.1 + 0.2, 0.3)).to.equal(true);
            expect(lte(0.31, 0.3, 0.000001)).to.equal(false);
            expect(lte(2, 3)).to.equal(true);
        });
    });

    describe('normalizeAngle', () => {
        it('wraps an angle into the range [0, 2π)', () => {
            expect(normalizeAngle(-Math.PI / 2)).to.be.closeTo(Math.PI * 1.5, EPSILON);
            expect(normalizeAngle(Math.PI * 5)).to.be.closeTo(Math.PI, EPSILON);
            expect(normalizeAngle(2 * Math.PI)).to.be.closeTo(0, EPSILON);
        });
    });

    describe('rad2Deg and deg2Rad', () => {
        it('converts between radians and degrees', () => {
            expect(rad2Deg(Math.PI)).to.equal(180);
            expect(deg2Rad(180)).to.be.closeTo(Math.PI, EPSILON);
            expect(rad2Deg(deg2Rad(45))).to.be.closeTo(45, EPSILON);
        });
    });

    describe('angleDiff', () => {
        it('computes the smallest difference between two angles', () => {
            const forward = angleDiff(deg2Rad(10), deg2Rad(350));
            const backward = angleDiff(deg2Rad(350), deg2Rad(10));
            const halfTurn = angleDiff(deg2Rad(0), deg2Rad(180));

            expect(forward).to.be.closeTo(deg2Rad(20), EPSILON);
            expect(backward).to.be.closeTo(deg2Rad(-20), EPSILON);
            expect(halfTurn).to.be.closeTo(-Math.PI, EPSILON);
        });
    });

    describe('angleDiffDeg', () => {
        it('computes the smallest difference in degrees respecting direction', () => {
            const forward = angleDiffDeg(10, 350);
            const backward = angleDiffDeg(350, 10);
            const clockwise = angleDiffDeg(10, 350);
            const halfTurn = angleDiffDeg(0, 180);

            expect(forward).to.equal(20);
            expect(backward).to.equal(-20);
            expect(clockwise).to.equal(20);
            expect(halfTurn).to.equal(-180);
        });
    });

    describe('angleIsBetween', () => {
        it('determines whether an angle is within a range', () => {
            const betweenWrapped = angleIsBetween(deg2Rad(0), deg2Rad(350), deg2Rad(10));
            const betweenSegment = angleIsBetween(deg2Rad(45), deg2Rad(30), deg2Rad(60));
            const outsideRange = angleIsBetween(deg2Rad(180), deg2Rad(350), deg2Rad(10));
            const inclusiveLower = angleIsBetween(deg2Rad(30), deg2Rad(30), deg2Rad(90));
            const inclusiveUpper = angleIsBetween(deg2Rad(90), deg2Rad(30), deg2Rad(90));

            expect(betweenWrapped).to.equal(true);
            expect(betweenSegment).to.equal(true);
            expect(outsideRange).to.equal(false);
            expect(inclusiveLower).to.equal(true);
            expect(inclusiveUpper).to.equal(true);
        });
    });

    describe('signedAngle', () => {
        it('computes a signed angle between two vectors', () => {
            expect(signedAngle([1, 0], [0, 1])).to.be.closeTo(Math.PI / 2, EPSILON);
            expect(signedAngle([1, 0], [0, -1])).to.be.closeTo(-Math.PI / 2, EPSILON);
            expect(signedAngle([1, 0], [1, 0])).to.be.closeTo(0, EPSILON);
        });
    });

    describe('clamp', () => {
        it('clamps a number between the provided min and max', () => {
            expect(clamp(5, 0, 10)).to.equal(5);
            expect(clamp(-2, 0, 10)).to.equal(0);
            expect(clamp(12, 0, 10)).to.equal(10);
        });
    });
});
