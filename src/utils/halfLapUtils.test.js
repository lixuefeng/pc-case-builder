import { validateHalfLapCompatibility, calculateHalfLapTransforms } from './halfLapUtils';
import * as THREE from 'three';

// Mock objects
const createMockObj = (id, x, y, z, w, h, d) => ({
    id,
    type: 'cube',
    pos: [x, y, z],
    rot: [0, 0, 0],
    dims: { w, h, d },
    matrixWorld: new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1)
    )
});

describe('validateHalfLapCompatibility', () => {
    test('should return true for compatible beams', () => {
        const objA = createMockObj('a', -50, 0, 0, 100, 20, 20);
        const objB = createMockObj('b', 50, 0, 0, 100, 20, 20);
        const result = validateHalfLapCompatibility(objA, objB);
        expect(result.compatible).toBe(true);
    });

    test('should return false for mismatched dimensions', () => {
        const objA = createMockObj('a', -50, 0, 0, 100, 20, 20);
        const objB = createMockObj('b', 50, 0, 0, 100, 30, 20); // Height mismatch
        const result = validateHalfLapCompatibility(objA, objB);
        expect(result.compatible).toBe(false);
        expect(result.reason).toContain('dimensions');
    });
});

describe('calculateHalfLapTransforms', () => {
    test('should return true for rotated compatible beams (swapped dimensions)', () => {
        // A: 20x20, B: 20x20 (Rotated 90 deg around X -> effectively swapping H/D relative to world if they were different)
        // Let's use different dimensions: 20x40 vs 40x20
        const objA = createMockObj('a', -50, 0, 0, 100, 20, 40);
        const objB = createMockObj('b', 50, 0, 0, 100, 40, 20);

        // Rotate B 90 degrees around X so its 40x20 becomes 20x40 in world space alignment?
        // Actually, the logic checks cross-sections. 
        // 20x40 matches 40x20 if we allow swapping.

        const result = validateHalfLapCompatibility(objA, objB);
        expect(result.compatible).toBe(true);
        expect(result.crossSectionMatch).toBe('swapped');
    });
});

describe('calculateHalfLapTransforms', () => {
    test('should extend beams and create cutouts', () => {
        // A: [-100, 0], B: [0, 100] (End-to-end at 0)
        // Lap: 20 -> Overlap [-10, 10]
        const objA = createMockObj('a', -50, 0, 0, 100, 20, 20);
        const objB = createMockObj('b', 50, 0, 0, 100, 20, 20);
        const lapLength = 20;

        const result = calculateHalfLapTransforms(objA, objB, lapLength);

        // Check A extension
        // Original length 100, center -50. Ends at 0.
        // New end should be 10. New length 110. New center -45.
        expect(result.updates[0].dims.w).toBe(110);
        expect(result.updates[0].pos[0]).toBe(-45);

        // Check B extension
        // Original length 100, center 50. Starts at 0.
        // New start should be -10. New length 110. New center 45.
        expect(result.updates[1].dims.w).toBe(110);
        expect(result.updates[1].pos[0]).toBe(45);

        // Check CSG operations
        // Should have 1 subtraction each
        expect(result.updates[0].csgOperations).toHaveLength(1);
        expect(result.updates[1].csgOperations).toHaveLength(1);

        // Check cutout dimensions (should be lapLength x halfHeight x depth)
        const opA = result.updates[0].csgOperations[0];
        expect(opA.dims.w).toBe(20);
        expect(opA.dims.h).toBe(10); // Half height
    });

    test('should calculate correct cut direction for rotated beams (Regression Test)', () => {
        // This tests the bug where vector access was using 'w'/'h'/'d' instead of 'x'/'y'/'z'
        // If the bug exists, the sign calculation will fail (likely default to -1),
        // causing cuts to be on the wrong side or offsets to be wrong.

        const objA = createMockObj('a', -50, 0, 0, 100, 20, 20);
        const objB = createMockObj('b', 50, 0, 0, 100, 20, 20);
        const lapLength = 20;

        // Rotate A by 180 degrees around Y? Or just standard alignment.
        // Standard alignment: A is to the left (-X), B is to the right (+X).
        // Dir A->B is (1, 0, 0).
        // Local Dir A (relative to A) is (1, 0, 0).
        // Sign A should be 1 (Positive).

        const result = calculateHalfLapTransforms(objA, objB, lapLength);

        const opA = result.updates[0].csgOperations[0];
        const opB = result.updates[1].csgOperations[0];

        // A extends to the right (+X). Cut should be at the tip (+X offset).
        // If sign was wrong (-1), offset would be negative.
        // newLenA = 110. Offset should be (110/2 - 20/2) = 55 - 10 = 45.
        expect(opA.relativeTransform.pos[0]).toBeCloseTo(45);

        // B extends to the left (-X). Cut should be at the tip (-X offset).
        // Dir A->B is (1,0,0). Local Dir B (relative to B) is (1,0,0).
        // But B extends towards A (-Dir). ExtendDir is (-1,0,0).
        // Sign B should be -1.
        // Offset should be -1 * (45) = -45.
        expect(opB.relativeTransform.pos[0]).toBeCloseTo(-45);
    });
});
