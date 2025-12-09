import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    getRelativeTransform,
    projectedHalfExtentAlongAxis,
    inferAxisFromMovement,
    pickTargetBasis
} from '../utils/mathUtils';

describe('mathUtils', () => {
    describe('getRelativeTransform', () => {
        it('should return null for invalid inputs', () => {
            expect(getRelativeTransform(null, {})).toBeNull();
            expect(getRelativeTransform({}, null)).toBeNull();
        });

        it('should calculate relative transform correctly (Identity)', () => {
            const source = { pos: [10, 0, 0], rot: [0, 0, 0] };
            const target = { pos: [0, 0, 0], rot: [0, 0, 0] };
            const result = getRelativeTransform(source, target);

            expect(result.pos[0]).toBeCloseTo(10);
            expect(result.pos[1]).toBeCloseTo(0);
            expect(result.pos[2]).toBeCloseTo(0);
            expect(result.rot[0]).toBeCloseTo(0);
            expect(result.rot[1]).toBeCloseTo(0);
            expect(result.rot[2]).toBeCloseTo(0);
        });

        it('should calculate relative transform with target rotation', () => {
            // Target rotated 90 deg around Y
            const target = { pos: [0, 0, 0], rot: [0, Math.PI / 2, 0] };
            // Source at (10, 0, 0) in World
            const source = { pos: [10, 0, 0], rot: [0, 0, 0] };

            const result = getRelativeTransform(source, target);

            expect(result.pos[0]).toBeCloseTo(0);
            expect(result.pos[1]).toBeCloseTo(0);
            expect(result.pos[2]).toBeCloseTo(10); // Target Z axis aligns with World X
        });
    });

    describe('projectedHalfExtentAlongAxis', () => {
        it('should calculate projection correctly', () => {
            const dims = { w: 10, h: 20, d: 30 };
            const axes = {
                ax: new THREE.Vector3(1, 0, 0),
                ay: new THREE.Vector3(0, 1, 0),
                az: new THREE.Vector3(0, 0, 1)
            };
            const worldAxis = new THREE.Vector3(1, 0, 0); // Along X

            const result = projectedHalfExtentAlongAxis(worldAxis, dims, axes);
            expect(result).toBe(5); // w/2
        });

        it('should handle rotated axes', () => {
            const dims = { w: 10, h: 10, d: 10 }; // 5, 5, 5
            const axes = {
                ax: new THREE.Vector3(0.707, 0.707, 0), // 45 deg
                ay: new THREE.Vector3(-0.707, 0.707, 0),
                az: new THREE.Vector3(0, 0, 1)
            };
            const worldAxis = new THREE.Vector3(1, 0, 0);

            const result = projectedHalfExtentAlongAxis(worldAxis, dims, axes);
            // 5 * 0.707 + 5 * 0.707 + 0 = 7.07
            expect(result).toBeCloseTo(7.07, 2);
        });
    });

    describe('inferAxisFromMovement', () => {
        it('should infer X axis', () => {
            const mv = new THREE.Vector3(10, 1, 1);
            const tf = { axes: { ax: new THREE.Vector3(1, 0, 0), ay: new THREE.Vector3(0, 1, 0), az: new THREE.Vector3(0, 0, 1) } };
            const result = inferAxisFromMovement(mv, tf);
            expect(result.axis).toBe('X');
        });

        it('should infer Y axis', () => {
            const mv = new THREE.Vector3(1, 10, 1);
            const tf = { axes: { ax: new THREE.Vector3(1, 0, 0), ay: new THREE.Vector3(0, 1, 0), az: new THREE.Vector3(0, 0, 1) } };
            const result = inferAxisFromMovement(mv, tf);
            expect(result.axis).toBe('Y');
        });
    });

    describe('pickTargetBasis', () => {
        it('should pick closest aligned axis', () => {
            const targetTF = { axes: { ax: new THREE.Vector3(1, 0, 0), ay: new THREE.Vector3(0, 1, 0), az: new THREE.Vector3(0, 0, 1) } };
            const selfDir = new THREE.Vector3(0.9, 0.1, 0);

            const result = pickTargetBasis(targetTF, selfDir);
            expect(result.label).toBe('X');
            expect(result.dir.x).toBe(1);
        });
    });
});
