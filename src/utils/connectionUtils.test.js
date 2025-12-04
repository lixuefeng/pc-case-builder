import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateMortiseTenon, calculateCrossLap } from './connectionUtils';

// Mock getRelativeTransform since it's a hook dependency (but pure function)
// We need to import it or mock it. Since it's in a hook file, it might be hard to import in node environment if it uses React stuff.
// But getRelativeTransform is exported separately and uses only THREE.
// Let's import it.
import { getRelativeTransform } from '../utils/mathUtils';

describe('connectionUtils', () => {
    // ... existing tests ...

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

        it('should apply clearance to mortise hole', () => {
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
            const clearance = 0.5;

            const result = calculateMortiseTenon(tenon, mortise, depth, clearance);

            // Mortise hole dimensions should be inflated by 2 * clearance
            const holeOp = result.mortise.csgOperations[0];
            expect(holeOp.dims.w).toBe(15 + 2 * clearance); // 10 + 5 + 1
            expect(holeOp.dims.h).toBe(10 + 2 * clearance); // 10 + 1
            expect(holeOp.dims.d).toBe(10 + 2 * clearance); // 10 + 1
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
                pos: [0, 0, 0],
                dims: { w: 100, h: 10, d: 10 },
                rot: [0, 0, 0],
                type: 'cube'
            };
            // Beam B: Along Z axis (Thin X, Thin Y, Long Z)
            const partB = {
                id: 'b',
                pos: [0, 0, 0],
                dims: { w: 10, h: 10, d: 100 },
                rot: [0, 0, 0],
                type: 'cube'
            };

            // Intersection is 10x10x10.
            // Lowest score is Y (1). So Stack Axis should be Y.

            const result = calculateCrossLap(partA, partB);

            expect(result).not.toBeNull();
            expect(result.partA.csgOperations).toHaveLength(1);
            expect(result.partB.csgOperations).toHaveLength(1);

            // Check operation type
            expect(result.partA.csgOperations[0].operation).toBe('subtract');
            expect(result.partB.csgOperations[0].operation).toBe('subtract');
        });

        it('should apply clearance to cross lap cuts', () => {
            const partA = {
                id: 'a',
                pos: [0, 0, 0],
                dims: { w: 100, h: 10, d: 10 },
                rot: [0, 0, 0],
                type: 'cube'
            };
            const partB = {
                id: 'b',
                pos: [0, 0, 0],
                dims: { w: 10, h: 10, d: 100 },
                rot: [0, 0, 0],
                type: 'cube'
            };
            const clearance = 0.5;

            const result = calculateCrossLap(partA, partB, clearance);

            // Cutter dimensions should be inflated by 2 * clearance
            const cutA = result.partA.csgOperations[0];
            expect(cutA.dims.w).toBe(10 + 2 * clearance);
            expect(cutA.dims.h).toBe(10 + 2 * clearance);
            expect(cutA.dims.d).toBe(100 + 2 * clearance);
        });

        it('should preserve rotation and alignment stability after Cross-Lap', () => {
            const partA = {
                id: 'a',
                pos: [0, 0, 0],
                dims: { w: 100, h: 10, d: 10 },
                rot: [0, 0, 0], // Identity rotation
                type: 'cube'
            };
            const partB = {
                id: 'b',
                pos: [0, 0, 0],
                dims: { w: 10, h: 10, d: 100 },
                rot: [0, 0, 0], // Identity rotation
                type: 'cube'
            };

            const result = calculateCrossLap(partA, partB);

            // Verify rotation is preserved EXACTLY
            expect(result.partA.rot).toEqual([0, 0, 0]);
            expect(result.partB.rot).toEqual([0, 0, 0]);

            // Simulate Alignment Math
            // Assume we want to align Part A to Part B along Z axis.
            // Part A is at (0,0,0). Part B is at (0,0,0).
            // Let's say we want to align Part A's +Z face to Part B's -Z face.

            // Mock getWorldTransform logic
            const getMockWorldTransform = (obj) => {
                const p = new THREE.Vector3(...obj.pos);
                const e = new THREE.Euler(...obj.rot);
                const q = new THREE.Quaternion().setFromEuler(e);
                const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
                const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
                const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
                return { p, q, axes: { ax, ay, az } };
            };

            const selfTF = getMockWorldTransform(result.partA);
            const targetTF = getMockWorldTransform(result.partB);

            // Check if axes are clean
            expect(selfTF.axes.az.y).toBeCloseTo(0, 10); // Y component of Z axis should be 0
            expect(targetTF.axes.az.y).toBeCloseTo(0, 10);

            // Simulate calculateAlignPosition
            // dir = selfTF.axes.az (Z axis)
            const dir = selfTF.axes.az.clone().normalize();

            // If dir has any Y component, alignment will shift Y.
            expect(dir.y).toBeCloseTo(0, 10);

            // Calculate target position
            // delta = arbitrary distance (e.g. 50)
            const delta = 50;
            const targetPos = selfTF.p.clone().add(dir.clone().multiplyScalar(delta));

            // Final Y should be same as start Y (0)
            expect(targetPos.y).toBeCloseTo(0, 10);
        });

    });
});

