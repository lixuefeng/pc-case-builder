import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateDrillCandidates } from './drillMath';
import { computeFaceTransform } from './editorGeometry';

describe('Drill Tool Logic', () => {
    it('should find overlap for flush half-lap joint (+Y)', () => {
        // Setup Objects
        const objA = {
            id: 'A',
            pos: [0, 0, 0],
            rot: [0, 0, 0],
            dims: { w: 100, h: 10, d: 100 },
            visible: true
        };
        // ObjB shifted right by 50, flush vertically
        const objB = {
            id: 'B',
            pos: [50, 0, 0],
            rot: [0, 0, 0],
            dims: { w: 100, h: 10, d: 100 },
            visible: true
        };

        const flatObjects = [objA, objB];

        // Setup Hover Context (Hovering ObjA Top Face)
        const partId = 'A';
        const face = '+Y';
        const worldPoint = new THREE.Vector3(25, 5, 0); // Roughly middle of overlap

        // Face Center of A (+Y) is at (0, 5, 0)
        const faceCenter = [0, 5, 0];

        // Info Quaternion (Object Rotation of A) -> Identity
        const infoQuaternion = [0, 0, 0, 1];

        // Face Dimensions (X, Z for +Y face) -> 100, 100
        const faceSize = [100, 100, 10]; // 3D dims passed often 

        // Run Logic
        const candidates = calculateDrillCandidates(
            partId,
            face,
            faceCenter,
            worldPoint,
            infoQuaternion,
            faceSize,
            flatObjects,
            10 // Threshold
        );

        console.log("Candidates found:", candidates.map(c => c.toArray()));

        expect(candidates.length).toBeGreaterThan(0);

        // Expect candidate close to (25, 5, 0)
        // Overlap X: BoxA [-50, 50], BoxB [0, 100]. Intersection [0, 50]. Center 25.
        // Overlap Z: BoxA [-50, 50], BoxB [-50, 50]. Intersection [-50, 50]. Center 0.
        // Y: 5.
        const c = candidates[0];
        expect(c.x).toBeCloseTo(25);
        expect(c.y).toBeCloseTo(5);
        expect(c.z).toBeCloseTo(0);
    });

    it('should find overlap for rotated half-lap joint', () => {
        // Rotate entire assembly 90 degrees around Z? No, use previous user bug scenario.
        // User had "Blue dot on side".
        // Let's verify X-Rotation (Top becomes Front).
        // Rotate A and B -90 deg X.
        // A Pos: (0,0,0). Rot (-PI/2, 0, 0).
        // A Dims: 100, 10, 100.
        // Old Top (+Y) is now Front (+Z). Bounds: X[-50,50], Y[-50,50], Z[0, 10] (if origin centered, wait).
        // If center (0,0,0), rot -90 X:
        // Y -> Z. Z -> -Y.
        // Top Face (Old +Y, 0,5,0) -> Rotated (0, 0, 5) -> +Z face.

        const objA = {
            id: 'A',
            pos: [0, 0, 0],
            rot: [-Math.PI / 2, 0, 0],
            dims: { w: 100, h: 10, d: 100 },
            visible: true
        };
        // B shifted along local X (World X).
        const objB = {
            id: 'B',
            pos: [50, 0, 0],
            rot: [-Math.PI / 2, 0, 0],
            dims: { w: 100, h: 10, d: 100 },
            visible: true
        };

        const flatObjects = [objA, objB];

        // Hovering "Top" of the geometry in Local Space (Face +Y).
        // Which is now physically facing +Z.
        const partId = 'A';
        const face = '+Y'; // The feature name

        // Face Center should be calculated by logic, but passed in info.
        // (0, 5, 0) rotated -90X -> (0, 0, 5).
        const faceCenter = [0, 0, 5];

        // Info Quaternion (Object Rotation of A) -> from Euler
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        const infoQuaternion = q.toArray();

        const faceSize = [100, 100, 10];
        const worldPoint = new THREE.Vector3(25, 0, 5);

        const candidates = calculateDrillCandidates(
            partId,
            face,
            faceCenter,
            worldPoint,
            infoQuaternion,
            faceSize,
            flatObjects
        );

        // Debug: Calculate what computeFaceTransform would give us
        const aFaceTransform = computeFaceTransform(objA, face);
        console.log("DEBUG Face Transform:", {
            center: aFaceTransform?.center?.toArray(),
            normal: aFaceTransform?.normal?.toArray(),
        });

        console.log("Rotated Candidates:", candidates.map(c => c.toArray()));

        expect(candidates.length).toBeGreaterThan(0);
        // Expect (25, 0, 5)
        const c = candidates[candidates.length - 1];
        expect(c.x).toBeCloseTo(25);
        expect(c.y).toBeCloseTo(0);
        expect(c.z).toBeCloseTo(5);
    });
});
