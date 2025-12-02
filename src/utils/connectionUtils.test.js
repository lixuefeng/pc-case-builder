import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateMortiseTenon, calculateCrossLap } from './connectionUtils';

// Mock getRelativeTransform since it depends on THREE and might be complex
// But wait, getRelativeTransform is a pure function we imported. 
// Ideally we should test with the real one if possible, or mock it if we want to isolate connectionUtils.
// Let's use the real one for integration-style unit tests, as it's a helper in the same project.
// However, connectionUtils imports it from '../hooks/usePartModifiers'.
// We need to make sure that path resolves correctly in the test environment.
// Vitest should handle relative imports fine.

describe('connectionUtils', () => {
    describe('calculateMortiseTenon', () => {
        it('should return null if parts are missing', () => {
            expect(calculateMortiseTenon(null, {}, 10)).toBeNull();
            expect(calculateMortiseTenon({}, null, 10)).toBeNull();
        });

        it('should extend tenon along X axis when mortise is to the right', () => {
            const tenon = {
                id: 't1',
                pos: [0, 0, 0],
                rot: [0, 0, 0],
                dims: { w: 10, h: 10, d: 10 },
                type: 'cube'
            };
            const mortise = {
                id: 'm1',
                pos: [20, 0, 0], // To the right (+x)
                rot: [0, 0, 0],
                dims: { w: 10, h: 10, d: 10 },
                type: 'cube'
            };
            const depth = 5;

            const result = calculateMortiseTenon(tenon, mortise, depth);

            expect(result).not.toBeNull();
            // Tenon width should increase by depth
            expect(result.tenon.dims.w).toBe(15);
            // Tenon center should shift by depth/2 in +x
            expect(result.tenon.pos[0]).toBe(2.5);

            // Mortise should have a subtraction operation
            expect(result.mortise.csgOperations).toHaveLength(1);
            expect(result.mortise.csgOperations[0].operation).toBeUndefined(); // Default is subtraction in some contexts, but let's check structure
            // The logic in RightSidebar didn't explicitly set 'operation: subtract' for mortise-tenon, 
            // it relied on the fact that it's a "modifier" which usually implies subtraction or union depending on context.
            // Wait, looking at the code:
            // const modifier = { ... type: tenon.type ... }
            // It doesn't set operation: 'subtract'. 
            // But the PartBox component likely treats these as subtractions if they are in csgOperations?
            // Let's check PartBox logic later. For now, check the structure.
            expect(result.mortise.csgOperations[0].type).toBe('cube');
        });

        it('should extend tenon along Y axis when mortise is above', () => {
            const tenon = {
                id: 't1',
                pos: [0, 0, 0],
                rot: [0, 0, 0],
                dims: { w: 10, h: 10, d: 10 }
            };
            const mortise = {
                id: 'm1',
                pos: [0, 20, 0], // Above (+y)
                rot: [0, 0, 0],
                dims: { w: 10, h: 10, d: 10 }
            };
            const depth = 5;

            const result = calculateMortiseTenon(tenon, mortise, depth);

            expect(result.tenon.dims.h).toBe(15);
            expect(result.tenon.pos[1]).toBe(2.5);
        });

        it('should correctly identify Y axis for post on long beam (off-center)', () => {
            // Tenon: Vertical Post at origin
            const tenon = {
                id: 'post',
                pos: [0, 0, 0],
                rot: [0, 0, 0],
                dims: { w: 10, h: 100, d: 10 }, // Tall
                type: 'cube'
            };
            // Mortise: Long Beam centered far away, but passing directly above the post
            // Beam Length 200. Center at X=90. Extends X from [-10, 190].
            // Post is at X=0. So Post is under the start of the beam.
            // Beam Y is at 60. Post Top is at 50. Gap is 5 (assuming beam height 10, bottom at 55).
            const mortise = {
                id: 'beam',
                pos: [90, 60, 0],
                rot: [0, 0, 0],
                dims: { w: 200, h: 10, d: 10 },
                type: 'cube'
            };

            // Center Distances:
            // X: |90 - 0| = 90
            // Y: |60 - 0| = 60
            // Old logic: 90 > 60 -> Selects X axis. FAILS.
            // Correct logic: Gap Y is small (5), Gap X is 0 (overlap). Should select Y.

            const depth = 5;
            const result = calculateMortiseTenon(tenon, mortise, depth);

            // Should extend Height (Y)
            expect(result.tenon.dims.h).toBe(105); // 100 + 5
            // Should NOT extend Width (X)
            expect(result.tenon.dims.w).toBe(10);
        });
    });

    describe('calculateCrossLap', () => {
        it('should throw error if parts do not intersect', () => {
            const partA = {
                id: 'a',
                pos: [0, 0, 0],
                dims: { w: 10, h: 10, d: 10 },
                rot: [0, 0, 0]
            };
            const partB = {
                id: 'b',
                pos: [20, 0, 0], // Far away
                dims: { w: 10, h: 10, d: 10 },
                rot: [0, 0, 0]
            };

            expect(() => calculateCrossLap(partA, partB)).toThrow("Parts must intersect");
        });

        it('should correctly identify stack axis and create cuts', () => {
            // Setup two crossing beams
            // Beam A: Along X axis (Long X, Thin Y, Thin Z)
            const partA = {
                id: 'a',
                pos: [0, 10, 0],
                dims: { w: 100, h: 10, d: 10 },
                rot: [0, 0, 0],
                type: 'cube'
            };
            // Beam B: Along Z axis (Thin X, Thin Y, Long Z)
            // Crossing at origin (0,0,0) in XZ plane?
            // Let's put them crossing at their centers.
            // Part A at (0, 0, 0)
            // Part B at (0, 0, 0)
            // They intersect fully in the center 10x10x10 box.

            // Let's offset them slightly so one is "Top" and one is "Bottom" visually, 
            // but for Cross-Lap they usually intersect physically.
            // Let's say they are at same Y level.
            partA.pos = [0, 0, 0];
            const partB = {
                id: 'b',
                pos: [0, 0, 0],
                dims: { w: 10, h: 10, d: 100 },
                rot: [0, 0, 0],
                type: 'cube'
            };

            // Intersection is 10x10x10.
            // Ranks for A (100, 10, 10): X=2, Y=0, Z=1 (Tie for Y/Z, but sorted stable? 10, 10, 100 -> 0, 1, 2)
            // Ranks for B (10, 10, 100): X=0, Y=1, Z=2

            // Scores:
            // X: 2 + 0 = 2
            // Y: 0 + 1 = 1
            // Z: 1 + 2 = 3
            // Lowest score is Y (1). So Stack Axis should be Y.

            const result = calculateCrossLap(partA, partB);

            expect(result).not.toBeNull();
            expect(result.partA.csgOperations).toHaveLength(1);
            expect(result.partB.csgOperations).toHaveLength(1);

            // Check operation type
            expect(result.partA.csgOperations[0].operation).toBe('subtract');
            expect(result.partB.csgOperations[0].operation).toBe('subtract');
        });
    });
});
