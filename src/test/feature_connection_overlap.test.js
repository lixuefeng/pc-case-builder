import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateMortiseTenon } from '../utils/connectionUtils';

describe('Feature: Mortise/Tenon Overlap Logic', () => {
    it('should select the axis with smallest overlap (contact face) when parts intersect (Z-axis stack)', () => {
        // Tenon: Flat Plate 50x50x5
        // Extents: X[-25,25], Y[-25,25], Z[-2.5, 2.5]
        const tenon = {
            id: 't1',
            pos: [0, 0, 0],
            rot: [0, 0, 0],
            dims: { w: 50, h: 50, d: 5 },
            type: 'cube'
        };

        // Mortise: Flat Plate 50x50x5
        // Placed directly on top of Tenon in Z.
        // Pos Z = 4. 
        // Mortise Extents: X[-25,25], Y[-25,25], Z[1.5, 6.5]
        // Overlap Z range: [1.5, 2.5]. Overlap Amount: 1.0.
        // Overlap X range: [-25, 25]. Overlap Amount: 50.
        // Overlap Y range: [-25, 25]. Overlap Amount: 50.
        // Smallest overlap is Z (1.0). Should pick Z.

        const mortise = {
            id: 'm1',
            pos: [0, 0, 4],
            rot: [0, 0, 0],
            dims: { w: 50, h: 50, d: 5 },
            type: 'cube'
        };

        const result = calculateMortiseTenon(tenon, mortise, 5);

        // Should select Z axis.
        // Tenon dims.d should increase.
        // Original d=5. Add 5 depth -> 10.
        expect(result.tenon.dims.d).toBe(10);
        // Tenon Center Z shift: +2.5. New Z = 2.5.
        expect(result.tenon.pos[2]).toBeCloseTo(2.5, 0.1);
    });

    it('should select correct axis when touching laterally (X-axis)', () => {
        // Tenon: 50x50x5
        const tenon = {
            id: 't1',
            pos: [0, 0, 0],
            rot: [0, 0, 0],
            dims: { w: 50, h: 50, d: 5 },
            type: 'cube'
        };

        // Mortise: Touching on right side (+X).
        // Pos X = 49. (Tenon max X = 25. Mortise min X = 24).
        // Overlap X: [24, 25]. Size 1.
        // Overlap Y: 50.
        // Overlap Z: 5.
        // Smallest is X (1). Should pick X.

        const mortise = {
            id: 'm2',
            pos: [49, 0, 0],
            rot: [0, 0, 0],
            dims: { w: 50, h: 50, d: 5 },
            type: 'cube'
        };

        const result = calculateMortiseTenon(tenon, mortise, 5);

        // Should select X axis.
        expect(result.tenon.dims.w).toBe(55); // 50 + 5
    });
});
