import { describe, it, expect } from 'vitest';
import {
    anchorPoint,
    calculateHolePosition,
    calculateAllHolePositions,
    calculateConnectorPosition
} from '../utils/positionCalculators';
import { MOTHERBOARD_SPECS } from '../constants';

describe('positionCalculators', () => {
    const ITX_DIMS = { w: 170, h: 2, d: 170 };
    const MATX_DIMS = { w: 244, h: 2, d: 244 };
    const ATX_DIMS = { w: 305, h: 2, d: 244 };
    const ANCHOR_OFFSET = MOTHERBOARD_SPECS.ANCHOR; // { x: -6.35, y: 10.16 }

    describe('anchorPoint', () => {
        it('should calculate top-right-back correctly for ITX', () => {
            const result = anchorPoint(ITX_DIMS, 'top-right-back');
            expect(result[0]).toBe(85);  // w/2
            expect(result[1]).toBe(1);   // h/2
            expect(result[2]).toBe(-85); // -d/2
        });

        it('should calculate top-left-back correctly for ITX', () => {
            const result = anchorPoint(ITX_DIMS, 'top-left-back');
            expect(result[0]).toBe(-85); // -w/2
            expect(result[1]).toBe(1);   // h/2
            expect(result[2]).toBe(-85); // -d/2
        });
    });

    describe('calculateHolePosition', () => {
        it('should calculate ITX hole C position correctly', () => {
            // Hole C: relX = -157.48, relZ = 0
            const result = calculateHolePosition(ITX_DIMS, -157.48, 0, ANCHOR_OFFSET);

            // Expected: topRightBack[0] + relX + anchorOffset.x = 85 + (-157.48) + (-6.35) = -78.83
            expect(result[0]).toBeCloseTo(-78.83, 2);
            expect(result[1]).toBe(0);
            // Expected: topRightBack[2] + relZ + anchorOffset.y = -85 + 0 + 10.16 = -74.84
            expect(result[2]).toBeCloseTo(-74.84, 2);
        });

        it('should calculate ITX hole F position correctly', () => {
            // Hole F: relX = 0, relZ = 22.86
            const result = calculateHolePosition(ITX_DIMS, 0, 22.86, ANCHOR_OFFSET);

            expect(result[0]).toBeCloseTo(78.65, 2); // 85 + 0 + (-6.35)
            expect(result[2]).toBeCloseTo(-51.98, 2); // -85 + 22.86 + 10.16
        });

        it('should calculate ITX hole H position correctly', () => {
            // Hole H: relX = -157.48, relZ = 154.94
            const result = calculateHolePosition(ITX_DIMS, -157.48, 154.94, ANCHOR_OFFSET);

            expect(result[0]).toBeCloseTo(-78.83, 2);
            expect(result[2]).toBeCloseTo(80.1, 2); // -85 + 154.94 + 10.16
        });

        it('should calculate ITX hole J position correctly', () => {
            // Hole J: relX = 0, relZ = 154.94
            const result = calculateHolePosition(ITX_DIMS, 0, 154.94, ANCHOR_OFFSET);

            expect(result[0]).toBeCloseTo(78.65, 2);
            expect(result[2]).toBeCloseTo(80.1, 2);
        });
    });

    describe('calculateAllHolePositions', () => {
        it('should calculate all ITX holes', () => {
            const holeMap = MOTHERBOARD_SPECS.ITX_HOLES;
            const results = calculateAllHolePositions(ITX_DIMS, holeMap, ANCHOR_OFFSET);

            expect(results).toHaveLength(4);

            // Hole C
            expect(results[0].pos[0]).toBeCloseTo(-78.83, 2);
            expect(results[0].pos[2]).toBeCloseTo(-74.84, 2);

            // Hole F
            expect(results[1].pos[0]).toBeCloseTo(78.65, 2);
            expect(results[1].pos[2]).toBeCloseTo(-51.98, 2);
        });
    });

    describe('calculateConnectorPosition', () => {
        it('should match hole position (except Y)', () => {
            const holePos = calculateHolePosition(ITX_DIMS, -157.48, 0, ANCHOR_OFFSET);
            const connPos = calculateConnectorPosition(ITX_DIMS, -157.48, 0, ANCHOR_OFFSET);

            // X and Z should match
            expect(connPos[0]).toBeCloseTo(holePos[0], 2);
            expect(connPos[2]).toBeCloseTo(holePos[2], 2);

            // Y differs: hole is at 0, connector is at -dims.h/2
            expect(connPos[1]).toBe(-1); // -2/2
        });
    });

    describe('Connector-Hole Alignment Regression', () => {
        it('ITX mount connectors should align with screw holes (X and Z)', () => {
            const holeMap = MOTHERBOARD_SPECS.ITX_HOLES;

            holeMap.forEach(([relX, relZ], index) => {
                const holePos = calculateHolePosition(ITX_DIMS, relX, relZ, ANCHOR_OFFSET);
                const connPos = calculateConnectorPosition(ITX_DIMS, relX, relZ, ANCHOR_OFFSET);

                expect(connPos[0]).toBeCloseTo(holePos[0], 2,
                    `Hole ${index} X mismatch: connector ${connPos[0]} vs hole ${holePos[0]}`);
                expect(connPos[2]).toBeCloseTo(holePos[2], 2,
                    `Hole ${index} Z mismatch: connector ${connPos[2]} vs hole ${holePos[2]}`);
            });
        });

        it('ATX mount connectors should align with screw holes (X and Z)', () => {
            const holeMap = MOTHERBOARD_SPECS.ATX_HOLES;

            holeMap.forEach(([relX, relZ], index) => {
                const holePos = calculateHolePosition(ATX_DIMS, relX, relZ, ANCHOR_OFFSET);
                const connPos = calculateConnectorPosition(ATX_DIMS, relX, relZ, ANCHOR_OFFSET);

                expect(connPos[0]).toBeCloseTo(holePos[0], 2);
                expect(connPos[2]).toBeCloseTo(holePos[2], 2);
            });
        });
    });
});
