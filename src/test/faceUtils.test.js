import { describe, it, expect } from 'vitest';
import { getFaceDetails } from '../utils/faceUtils';
import * as THREE from 'three';

describe('faceUtils', () => {
    describe('getFaceDetails', () => {
        // Mock object: 10x10x10 cube at 0,0,0 with no rotation
        const mockObj = {
            id: 'obj1',
            type: 'cube',
            dims: { w: 10, h: 10, d: 10 },
            pos: [0, 0, 0],
            rot: [0, 0, 0]
        };

        // Surface padding from faceUtils implementation (0.02)
        const PADDING = 0.02;

        it('should calculate correct position for +X (Right) face', () => {
            const details = getFaceDetails({ obj: mockObj, ref: null, faceName: '+X' });
            // Expected: X = 5 + padding, Y = 0, Z = 0
            expect(details.center[0]).toBeCloseTo(5 + PADDING);
            expect(details.center[1]).toBeCloseTo(0);
            expect(details.center[2]).toBeCloseTo(0);
            // Size for X face should be [d, h] = [10, 10]
            expect(details.size).toEqual([10, 10]);
        });

        it('should calculate correct position for -X (Left) face', () => {
            const details = getFaceDetails({ obj: mockObj, ref: null, faceName: '-X' });
            expect(details.center[0]).toBeCloseTo(-5 - PADDING);
            expect(details.center[1]).toBeCloseTo(0);
            expect(details.center[2]).toBeCloseTo(0);
        });

        it('should calculate correct position for +Y (Top) face', () => {
            const details = getFaceDetails({ obj: mockObj, ref: null, faceName: '+Y' });
            // Expected: X = 0, Y = 5 + padding, Z = 0
            expect(details.center[0]).toBeCloseTo(0);
            expect(details.center[1]).toBeCloseTo(5 + PADDING);
            expect(details.center[2]).toBeCloseTo(0);
            // Size for Y face should be [w, d] = [10, 10]
            expect(details.size).toEqual([10, 10]);
        });

        it('should calculate correct position for -Y (Bottom) face', () => {
            const details = getFaceDetails({ obj: mockObj, ref: null, faceName: '-Y' });
            expect(details.center[0]).toBeCloseTo(0);
            expect(details.center[1]).toBeCloseTo(-5 - PADDING);
            expect(details.center[2]).toBeCloseTo(0);
        });

        it('should calculate correct position for +Z (Front) face', () => {
            const details = getFaceDetails({ obj: mockObj, ref: null, faceName: '+Z' });
            // Expected: X = 0, Y = 0, Z = 5 + padding
            expect(details.center[0]).toBeCloseTo(0);
            expect(details.center[1]).toBeCloseTo(0);
            expect(details.center[2]).toBeCloseTo(5 + PADDING);
            // Size for Z face should be [w, h] = [10, 10]
            expect(details.size).toEqual([10, 10]);
        });

        it('should calculate correct position for -Z (Back) face', () => {
            const details = getFaceDetails({ obj: mockObj, ref: null, faceName: '-Z' });
            expect(details.center[0]).toBeCloseTo(0);
            expect(details.center[1]).toBeCloseTo(0);
            expect(details.center[2]).toBeCloseTo(-5 - PADDING);
        });
    });
});
