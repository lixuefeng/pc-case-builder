
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateDrillCandidates } from '../utils/drillMath';
import { calculateCrossLap } from '../utils/connectionUtils';

describe('Drill Feature Regression', () => {

    it('should calculate correct snap point for Cross Joint (Cross Lap) objects', () => {
        // Scenario: Cross Joint (Cross Lap)
        // Two bars occupying the same vertical space, crossing each other.
        // Bar A (Along X): 200 x 10 x 10. Pos: 0, 5, 0.
        // Bar B (Along Z): 10 x 10 x 200. Pos: 0, 5, 0.
        // Both range Y from 0 to 10. Top Surface Y = 10.

        const barA = {
            "id": "bar_a_x",
            "type": "cube",
            "dims": { "w": 200, "h": 10, "d": 10 },
            "pos": [0, 5, 0],
            "rot": [0, 0, 0]
        };
        const barB = {
            "id": "bar_b_z",
            "type": "cube",
            "dims": { "w": 10, "h": 10, "d": 200 },
            "pos": [0, 5, 0],
            "rot": [0, 0, 0]
        };

        // Apply Cross Lap Calculation
        const result = calculateCrossLap(barA, barB);
        expect(result).not.toBeNull();
        const { partA, partB } = result;

        // These parts now have csgOperations.
        const flatObjects = [partA, partB].map(o => ({
            ...o,
            worldPos: new THREE.Vector3(...o.pos),
            worldQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rot)),
            dims: o.dims // Note: dims are NOT modified by CrossLap usually, only CSG ops added.
        }));

        const targetObj = flatObjects.find(o => o.id === "bar_b_z"); // Drill overlapping Bar B
        const partId = targetObj.id;
        const face = "+Y"; // Top face
        // Top Face Center of Bar B: (0, 10, 0)
        const faceCenter = [0, 10, 0];
        const worldPoint = new THREE.Vector3(0, 10, 0);
        const infoQuaternion = targetObj.worldQuat.toArray();
        const faceSize = [10, 200]; // W=10, D=200 for Bar B (+Y face)

        const candidates = calculateDrillCandidates(
            partId,
            face,
            faceCenter,
            worldPoint,
            infoQuaternion,
            faceSize,
            flatObjects
        );

        console.log("Cross Lap candidates:", candidates.length);
        candidates.forEach(c => console.log("Cross Lap Cand:", c.toArray()));

        // Expectation:
        // Even with Cross Joint, we expect the drill snap to be on the TOP SURFACE (Y=10).
        // If it snaps to the Connecting Face (Y=5), that matches the user's reported bug.

        expect(candidates.length).toBeGreaterThan(0);
        const match = candidates.find(c => Math.abs(c.x) < 0.1 && Math.abs(c.z) < 0.1);
        expect(match).toBeDefined();

        // Assert it is at Y=10 (Top).
        // If the code is buggy, this might fail (it might be 5).
        expect(match.y).toBeCloseTo(10);
    });

});
