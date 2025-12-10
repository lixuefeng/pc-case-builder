import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getWorldTransform } from '../utils/editorGeometry';
import { getFacesAlongDir } from '../hooks/usePartAlignment';

// Mock projectedHalfExtentAlongAxis since it is imported in implementation
// Vitest hoisting might be needed if I was running a true module mock, 
// but since I'm testing exported functions that rely on logic I can just test behavior if they are pure.
// Actually getFacesAlongDir relies on projectedHalfExtentAlongAxis which is imported. 
// Since it's a util, integration testing it together is fine.

describe('usePartAlignment', () => {
    describe('getWorldTransform', () => {
        it('returns correct transform from obj props', () => {
            const obj = {
                pos: [10, 20, 30],
                rot: [0, Math.PI / 2, 0] // 90 deg Y rotation
            };
            const { p, q, axes } = getWorldTransform({ obj });

            expect(p.x).toBeCloseTo(10);
            expect(p.y).toBeCloseTo(20);
            expect(p.z).toBeCloseTo(30);

            // 90 deg Y rot: X -> -Z, Z -> X
            expect(axes.ax.x).toBeCloseTo(0);
            expect(axes.ax.z).toBeCloseTo(-1);

            expect(axes.az.x).toBeCloseTo(1);
            expect(axes.az.z).toBeCloseTo(0);
        });
    });

    describe('getFacesAlongDir', () => {
        const obj = {
            pos: [0, 0, 0],
            rot: [0, 0, 0],
            dims: { w: 10, h: 10, d: 10 }
        };

        it('identifies +X/-X faces correctly', () => {
            const ref = null;
            const dir = new THREE.Vector3(1, 0, 0); // Looking along X
            const faces = getFacesAlongDir({ obj, ref, dir });

            // Sorted by projection, primary should be X
            // faces[0] is Positive direction face relative to scan dir?
            // Logic: sign = Math.sign(dir.dot(primary.axis)) || 1
            // If dir is (1,0,0) and axis is (1,0,0), sign is +. Face is "+X"
            // coord = center + half = 0 + 5 = 5.

            expect(faces[0].name).toBe('+X');
            expect(faces[0].coord).toBeCloseTo(5);
            expect(faces[1].name).toBe('-X');
            expect(faces[1].coord).toBeCloseTo(-5);
        });

        it('identifies faces correctly when rotated 90 deg Y', () => {
            const rotatedObj = {
                ...obj,
                rot: [0, Math.PI / 2, 0]
            };
            // Obj local X is now World -Z. Obj local Z is now World X.
            // Dims w=10 (local X size), d=10 (local Z size).

            // Scan along World X. This aligns with Local Z.
            const dir = new THREE.Vector3(1, 0, 0);
            const faces = getFacesAlongDir({ obj: rotatedObj, ref: null, dir });

            // Primary axis found should be Z (since World X dot Local Z is 1).
            // sign = dir(1,0,0) dot LocalZ(1,0,0) = +1. 
            // Face should be "+Z".
            // Coord should be center + half(d/2) = 5.

            expect(faces[0].name).toBe('+Z');
            expect(faces[0].coord).toBeCloseTo(5);
            expect(faces[1].name).toBe('-Z'); // Logic: negName = (sign>=0 ? "-" : "+") + label => "-Z"
        });
    });
});
