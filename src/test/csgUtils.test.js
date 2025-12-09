import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { adjustCSGOperations } from '../utils/csgUtils';

describe('adjustCSGOperations', () => {
    it('should adjust CSG operation position when object moves', () => {
        // 1. Setup Original Object
        const originalPos = new THREE.Vector3(0, 0, 0);
        const originalRot = new THREE.Euler(0, 0, 0);
        const originalQuat = new THREE.Quaternion().setFromEuler(originalRot);

        const originalPart = {
            id: 'part1',
            pos: originalPos.toArray(),
            rot: [0, 0, 0],
            csgOperations: [
                {
                    id: 'cut1',
                    type: 'box',
                    relativeTransform: {
                        pos: [10, 0, 0], // Cut is at X=10 in World (since Part is at 0,0,0)
                        rot: [0, 0, 0]
                    }
                }
            ]
        };

        // 2. Simulate Split/Move (Part moves to X=5)
        const newPos = new THREE.Vector3(5, 0, 0);
        const newPart = {
            ...originalPart,
            pos: newPos.toArray(),
            // csgOperations are copied initially
        };

        // 3. Adjust CSG Operations
        const updatedOps = adjustCSGOperations(newPart, originalPos, originalQuat);

        // 4. Verify
        // Original Cut World Pos: 0 + 10 = 10.
        // New Part World Pos: 5.
        // For Cut to stay at World X=10, relative pos should be 10 - 5 = 5.

        expect(updatedOps).toHaveLength(1);
        const newOp = updatedOps[0];
        expect(newOp.relativeTransform.pos[0]).toBe(5);
        expect(newOp.relativeTransform.pos[1]).toBe(0);
        expect(newOp.relativeTransform.pos[2]).toBe(0);
    });

    it('should handle rotation correctly', () => {
        // 1. Setup Original Object (Rotated 90 deg around Y)
        const originalPos = new THREE.Vector3(0, 0, 0);
        const originalRot = new THREE.Euler(0, Math.PI / 2, 0); // 90 deg Y
        const originalQuat = new THREE.Quaternion().setFromEuler(originalRot);

        const originalPart = {
            id: 'part1',
            pos: originalPos.toArray(),
            rot: [0, Math.PI / 2, 0],
            csgOperations: [
                {
                    id: 'cut1',
                    type: 'box',
                    relativeTransform: {
                        // Local X=10.
                        // World: Rotated 90 deg Y. Local X -> World Z?
                        // X axis (1,0,0) -> (0,0,-1).
                        // So World Pos should be (0, 0, -10).
                        pos: [10, 0, 0],
                        rot: [0, 0, 0]
                    }
                }
            ]
        };

        // 2. Simulate Move (Part moves to World Z = -5)
        // Movement is along World Z.
        const newPos = new THREE.Vector3(0, 0, -5);
        const newPart = {
            ...originalPart,
            pos: newPos.toArray()
        };

        // 3. Adjust
        const updatedOps = adjustCSGOperations(newPart, originalPos, originalQuat);

        // 4. Verify
        // Original Cut World Pos: (0, 0, -10).
        // New Part World Pos: (0, 0, -5).
        // Cut should still be at (0, 0, -10).
        // Relative to New Part: (0, 0, -10) - (0, 0, -5) = (0, 0, -5) in World Frame.

        // We need to transform this World Difference into Local Frame.
        // Part Rotation is 90 deg Y.
        // World (0, 0, -5) -> Local?
        // Inverse Rotation (-90 deg Y).
        // Z axis (0,0,1) -> X axis (1,0,0).
        // -Z axis (0,0,-1) -> X axis (1,0,0)? No.
        // Let's check:
        // Rot Y 90: X->-Z, Z->X.
        // Inv Rot Y 90 (Rot Y -90): X->Z, Z->-X.
        // Vector (0, 0, -5).
        // Apply Inv Rot: -5 * Z_unit -> -5 * (-X_unit) = 5 * X_unit.
        // So Local Pos should be (5, 0, 0).

        const newOp = updatedOps[0];
        expect(newOp.relativeTransform.pos[0]).toBeCloseTo(5);
        expect(newOp.relativeTransform.pos[1]).toBeCloseTo(0);
        expect(newOp.relativeTransform.pos[2]).toBeCloseTo(0);
    });
});
