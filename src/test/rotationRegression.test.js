
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeFaceTransform } from '../utils/editorGeometry';
import { calculateSplit } from '../utils/splitUtils';

describe('Rotation Regression Tests', () => {

    // --- Scenario 1: Hover Highlight on Rotated Object ---
    // User reported highlight appeared at original (unrotated) position.
    // We check computeFaceTransform returns CORRECT world coordinates.
    describe('computeFaceTransform', () => {
        it('should return correct world coordinates for 90-degree rotated object', () => {
            // Object: Cube 100x100x100 at (0,0,0).
            // Rotated 90 deg around Z.
            // X-axis becomes Y-axis. Y-axis becomes -X.
            // "Top" Face (+Y in local) should now face -X direction.
            // Center of "Top" face local: (0, 50, 0).
            // Rotated 90 Z: (-50, 0, 0).

            const obj = {
                id: 'rot_cube',
                pos: [0, 0, 0],
                rot: [0, 0, Math.PI / 2], // 90 deg Z
                dims: { w: 100, h: 100, d: 100 },
                type: 'cube'
            };

            const result = computeFaceTransform(obj, '+Y');

            // Expected World Center: (-50, 0, 0)
            expect(result).not.toBeNull();
            expect(result.center.x).toBeCloseTo(-50);
            expect(result.center.y).toBeCloseTo(0);
            expect(result.center.z).toBeCloseTo(0);

            // Expected World Normal: (-1, 0, 0)
            expect(result.normal.x).toBeCloseTo(-1);
            expect(result.normal.y).toBeCloseTo(0);
            expect(result.normal.z).toBeCloseTo(0);
        });

        it('should return correct world coordinates for transformed position', () => {
            // Object at (100, 100, 0). No rotation.
            // +X face center valid.
            const obj = {
                id: 'pos_cube',
                pos: [100, 100, 0],
                rot: [0, 0, 0],
                dims: { w: 10, h: 10, d: 10 }
            };
            const result = computeFaceTransform(obj, '+X');
            // Local +X center: (5, 0, 0)
            // World: (105, 100, 0)
            expect(result.center.x).toBeCloseTo(105);
            expect(result.center.y).toBeCloseTo(100);
            expect(result.center.z).toBeCloseTo(0);
        });
    });

    // --- Scenario 2: Split on Rotated Object ---
    // User reported split didn't work (or acted weird) on rotated objects.
    // We test splitting an object that is rotated 90 degrees.
    describe('calculateSplit on Rotated Object', () => {
        it('should detect axis-aligned split in LOCAL space even if rotated in WORLD space', () => {
            // Object: Beam 100(W) x 10(H) x 10(D).
            // Rotated 90 deg Z. Aligned with World Y.
            // World Bounds: X[-5, 5], Y[-50, 50], Z[-5, 5].
            const obj = {
                id: 'beam',
                pos: [0, 0, 0],
                rot: [0, 0, Math.PI / 2],
                dims: { w: 100, h: 10, d: 10 },
                type: 'cube'
            };

            // We want to split it horizontally in World (Y=0 plane).
            // Normal = (0, 1, 0). Point = (0, 0, 0).
            // In Local Space:
            // World (0,1,0) -> Rot(-90Z) -> Local (-1, 0, 0). (Wait, +Y rotated 90Z is -X? No. X->Y. Y->-X. Yes.)
            // So Local Normal is (-1, 0, 0) or (1, 0, 0). This IS Axis Aligned (X-axis).
            // The split should happen along the 'w' dimension of the object.

            const planePos = new THREE.Vector3(0, 0, 0);
            const planeNormal = new THREE.Vector3(0, 1, 0); // Cutting horizontally across the vertical beam

            const result = calculateSplit(obj, planePos, planeNormal);

            expect(result).not.toBeNull();
            expect(result.length).toBe(2);

            const [partA, partB] = result;

            // Original Width 100. Split at center. New Widths ~50.
            // Since plane passes through center.
            expect(partA.dims.w).toBeCloseTo(50);
            expect(partB.dims.w).toBeCloseTo(50);

            // Validate positions
            // Part A center should be shifted.
            // If local X was split, new centers are +/- 25 local X.
            // Rotated to World Y.
            // Centers should be (0, -25, 0) and (0, 25, 0).

            const posA = partA.pos;
            const posB = partB.pos;

            // One should be positive Y, one negative
            const isAPositive = posA[1] > 0;
            const isBPositive = posB[1] > 0;
            expect(isAPositive !== isBPositive).toBe(true);

            expect(Math.abs(posA[1])).toBeCloseTo(25);
            expect(Math.abs(posB[1])).toBeCloseTo(25);
        });

        it('should fallback to CSG for non-axis-aligned split', () => {
            // Object: Cube 10x10x10.
            // Cut with 45-degree plane.
            const obj = {
                id: 'cube',
                pos: [0, 0, 0],
                rot: [0, 0, 0],
                dims: { w: 10, h: 10, d: 10 },
                type: 'cube'
            };

            const planePos = new THREE.Vector3(0, 0, 0);
            const planeNormal = new THREE.Vector3(1, 1, 0).normalize();

            const result = calculateSplit(obj, planePos, planeNormal);

            expect(result).not.toBeNull();
            const [partA, partB] = result;

            // Should contain CSG operations
            expect(partA.csgOperations).toBeDefined();
            expect(partA.csgOperations.length).toBeGreaterThan(0);
            expect(partA.csgOperations[0].type).toBe('box');
        });
    });
});
