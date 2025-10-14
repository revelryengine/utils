import { describe, it } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert             } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertEquals       } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertStrictEquals } from 'https://deno.land/std@0.208.0/assert/assert_strict_equals.ts';

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
        it('should convert numeric inputs using the relevant conversion', () => {
            assertStrictEquals(normalizers[FLOAT](0.5), 0.5);
            assertStrictEquals(normalizers[BYTE](127), 1);
            assertStrictEquals(normalizers[BYTE](-127), -1);
            assertStrictEquals(normalizers[BYTE](-128), -1);
            assertStrictEquals(normalizers[UNSIGNED_BYTE](0), 0);
            assertStrictEquals(normalizers[UNSIGNED_BYTE](255), 1);
            assert(Math.abs(normalizers[SHORT](32767) - 1) < EPSILON);
            assert(Math.abs(normalizers[SHORT](0) - 0) < EPSILON);
            assertStrictEquals(normalizers[SHORT](-32768), -1);
            assert(Math.abs(normalizers[UNSIGNED_SHORT](65535) - 1) < EPSILON);
            assertStrictEquals(normalizers[UNSIGNED_SHORT](0), 0);
        });
    });

    describe('float16', () => {
        it('should convert 16-bit float representations to numbers', () => {

            assertStrictEquals(float16(0x3C00), 1);
            assertStrictEquals(float16(0xC000), -2);
            assertStrictEquals(float16(0x7BFF), 65504);

            assert(Math.abs(float16(0x3555) - 0.333251953125) < EPSILON);
            assert(Math.abs(float16(0x8400) + 0.00006103515625) < EPSILON);
            assert(Math.abs(float16(0x0001) - 5.960464477539063e-8) < EPSILON);

            assert(Number.isNaN(float16(0x7E00)));
            assertStrictEquals(float16(0x7C00), Infinity);
            assertStrictEquals(float16(0x8000), -0);


            assertStrictEquals(float16(0x3C00), 1);
            assertStrictEquals(float16(0xC000), -2);
            assertStrictEquals(float16(0xFC00), -Infinity);
        });
    });

    describe('roundUp', () => {
        it('should round up to the nearest increment', () => {
            assertStrictEquals(roundUp(4, 5), 8);
            assertStrictEquals(roundUp(8, 16), 16);
            assertStrictEquals(roundUp(4, 1), 4);
        });
    });

    describe('nearestUpperPowerOf2', () => {
        it('should return the next highest power of two', () => {
            assertStrictEquals(nearestUpperPowerOf2(0), 0);
            assertStrictEquals(nearestUpperPowerOf2(1), 1);
            assertStrictEquals(nearestUpperPowerOf2(5), 8);
            assertStrictEquals(nearestUpperPowerOf2(1024), 1024);
            assertStrictEquals(nearestUpperPowerOf2(1025), 2048);
        });
    });

    describe('mod', () => {
        it('should provide modulus that supports negative dividends', () => {
            assertStrictEquals(mod(7, 5), 2);
            assertStrictEquals(mod(-1, 5), 4);
            assertStrictEquals(mod(-6, 3), 0);
        });
    });

    describe('lte', () => {
        it('should treat values within epsilon as equal', () => {
            assert(lte(0.1 + 0.2, 0.3));
            assertEquals(lte(0.31, 0.3, 0.000001), false);
            assertEquals(lte(2, 3), true);
        });
    });

    describe('normalizeAngle', () => {
        it('should wrap an angle into the range [0, 2π)', () => {
            assert(Math.abs(normalizeAngle(-Math.PI / 2) - (Math.PI * 1.5)) < EPSILON);
            assert(Math.abs(normalizeAngle(Math.PI * 5) - Math.PI) < EPSILON);
            assert(Math.abs(normalizeAngle(2 * Math.PI)) < EPSILON);
        });
    });

    describe('rad2Deg and deg2Rad', () => {
        it('should convert between radians and degrees', () => {
            assertStrictEquals(rad2Deg(Math.PI), 180);
            assert(Math.abs(deg2Rad(180) - Math.PI) < EPSILON);
            assert(Math.abs(rad2Deg(deg2Rad(45)) - 45) < EPSILON);
        });
    });

    describe('angleDiff', () => {
        it('should compute the smallest difference between two angles', () => {
            const forward = angleDiff(deg2Rad(10), deg2Rad(350));
            const backward = angleDiff(deg2Rad(350), deg2Rad(10));
            const halfTurn = angleDiff(deg2Rad(0), deg2Rad(180));

            assert(Math.abs(forward - deg2Rad(20)) < EPSILON);
            assert(Math.abs(backward - deg2Rad(-20)) < EPSILON);
            assert(Math.abs(halfTurn + Math.PI) < EPSILON);
        });
    });

    describe('angleDiffDeg', () => {
        it('should compute the smallest difference in degrees respecting direction', () => {
            const forward = angleDiffDeg(10, 350, false);
            const backward = angleDiffDeg(350, 10, false);
            const clockwise = angleDiffDeg(10, 350, true);
            const halfTurn = angleDiffDeg(0, 180, false);

            assertStrictEquals(forward, 20);
            assertStrictEquals(backward, -20);
            assertStrictEquals(clockwise, 20);
            assertStrictEquals(halfTurn, -180);
        });
    });

    describe('angleIsBetween', () => {
        it('should determine whether an angle is within a range', () => {
            const betweenWrapped = angleIsBetween(deg2Rad(0),   deg2Rad(350), deg2Rad(10));
            const betweenSegment = angleIsBetween(deg2Rad(45),  deg2Rad(30),  deg2Rad(60));
            const outsideRange   = angleIsBetween(deg2Rad(180), deg2Rad(350), deg2Rad(10));
            const inclusiveLower = angleIsBetween(deg2Rad(30),  deg2Rad(30),  deg2Rad(90));
            const inclusiveUpper = angleIsBetween(deg2Rad(90),  deg2Rad(30),  deg2Rad(90));

            assertEquals(betweenWrapped, true);
            assertEquals(betweenSegment, true);
            assertEquals(outsideRange, false);
            assertEquals(inclusiveLower, true);
            assertEquals(inclusiveUpper, true);
        });
    });

    describe('signedAngle', () => {
        it('should compute a signed angle between two vectors', () => {
            assert(Math.abs(signedAngle([1, 0], [0, 1]) - Math.PI / 2) < EPSILON);
            assert(Math.abs(signedAngle([1, 0], [0, -1]) + Math.PI / 2) < EPSILON);
            assert(Math.abs(signedAngle([1, 0], [1, 0])) < EPSILON);
        });
    });

    describe('clamp', () => {
        it('should clamp a number between the provided min and max', () => {
            assertStrictEquals(clamp(5, 0, 10), 5);
            assertStrictEquals(clamp(-2, 0, 10), 0);
            assertStrictEquals(clamp(12, 0, 10), 10);
        });
    });
});
