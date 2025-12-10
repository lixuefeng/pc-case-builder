import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStretchAxisInfo, computeAxisOffsetFromRay } from '../hooks/usePartStretch';

describe('usePartStretch', () => {
    describe('getStretchAxisInfo', () => {
        const obj = { dims: { w: 10, h: 20, d: 30 } };

        it('maps +X face to X axis and w dim', () => {
            const info = getStretchAxisInfo(obj, '+X');
            expect(info).toEqual({ axis: 'X', dimKey: 'w', sign: 1 });
        });

        it('maps -Y face to Y axis and h dim with negative sign', () => {
            // Wait, MovablePart logic returned sign: -1 for -Y.
            // Let's verify logic in hook.
            // if (faceName === '+Y') sign = 1. if '-Y' sign = -1.
            const info = getStretchAxisInfo(obj, '-Y');
            expect(info).toEqual({ axis: 'Y', dimKey: 'h', sign: -1 });
        });
    });

    describe('computeAxisOffsetFromRay', () => {
        // Setup a ray looking down Z
        // Ray origin (0,0,10), direction (0,0,-1)
        const ray = new THREE.Ray(
            new THREE.Vector3(0, 0, 10),
            new THREE.Vector3(0, 0, -1)
        );

        it('computes offset along axis perpendicular to view', () => {
            // Axis is X axis passing through (0,0,0)
            const axisOrigin = new THREE.Vector3(0, 0, 0);
            const axisDir = new THREE.Vector3(1, 0, 0);

            // Ray passes through (0,0,0). Closest point on axis is (0,0,0).
            // Result should be 0 (projection on axisDir).

            const offset = computeAxisOffsetFromRay(ray, axisOrigin, axisDir);
            expect(offset).toBeCloseTo(0);
        });

        it('computes offset correctly when ray is shifted', () => {
            // Ray origin (5,0,10) -> passes through (5,0,0)
            const shiftedRay = new THREE.Ray(
                new THREE.Vector3(5, 0, 10),
                new THREE.Vector3(0, 0, -1)
            );
            const axisOrigin = new THREE.Vector3(0, 0, 0);
            const axisDir = new THREE.Vector3(1, 0, 0);

            const offset = computeAxisOffsetFromRay(shiftedRay, axisOrigin, axisDir);
            // Should project to 5 on X axis
            expect(offset).toBeCloseTo(5);
        });
    });
});
