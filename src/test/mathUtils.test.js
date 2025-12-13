import * as THREE from 'three';
import {
    getRelativeTransform,
    projectedHalfExtentAlongAxis,
    inferAxisFromMovement,
    pickTargetBasis,
    normalizeDegree,
    setEulerFromQuaternionPreservingContinuity
} from '../utils/mathUtils';

describe('mathUtils', () => {
    describe('normalizeDegree', () => {
        it('should normalize degrees within (-180, 180]', () => {
            expect(normalizeDegree(0)).toBe(0);
            expect(normalizeDegree(180)).toBe(180);
            expect(normalizeDegree(-180)).toBe(180); // -180 becomes 180
            expect(normalizeDegree(360)).toBe(0);
            expect(normalizeDegree(370)).toBe(10);
            expect(normalizeDegree(-370)).toBe(-10);
            expect(normalizeDegree(190)).toBe(-170);
            expect(normalizeDegree(-190)).toBe(170);
        });

        it('should handle large numbers', () => {
            expect(normalizeDegree(720)).toBe(0);
            expect(normalizeDegree(730)).toBe(10);
            expect(normalizeDegree(-730)).toBe(-10);
        });

        it('should handle non-numbers', () => {
            expect(normalizeDegree(null)).toBe(0);
            expect(normalizeDegree(undefined)).toBe(0);
            expect(normalizeDegree("10")).toBe(0);
        });
    });

    describe('setEulerFromQuaternionPreservingContinuity', () => {
        it('should preserve winding number', () => {
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
            // Rotate 360 + 10 degrees around X
            const angle = THREE.MathUtils.degToRad(370); // 360+10
            const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0));

            const prev = new THREE.Euler(THREE.MathUtils.degToRad(360), 0, 0);
            const target = new THREE.Euler(0, 0, 0); // initial garbage

            setEulerFromQuaternionPreservingContinuity(target, q2, prev);

            // Expected: Close to 370 degrees, not 10 degrees
            expect(target.x).toBeCloseTo(angle);
        });

        it('should handle negative winding', () => {
            const angle = THREE.MathUtils.degToRad(-370);
            const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0));
            const prev = new THREE.Euler(THREE.MathUtils.degToRad(-360), 0, 0);
            const target = new THREE.Euler();

            setEulerFromQuaternionPreservingContinuity(target, q2, prev);
            expect(target.x).toBeCloseTo(angle);
        });
    });
});
