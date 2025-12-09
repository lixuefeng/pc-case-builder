
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateDrillCandidates } from '../utils/drillMath';

const userScene = [
    {
        "id": "obj_1765263636437_67621",
        "key": "cube",
        "type": "cube",
        "name": "Cube 1 (Bottom)",
        "dims": { "w": 200, "h": 10, "d": 10 },
        "pos": [0, 5, 0],
        "rot": [0, 0, 0],
        "visible": true,
        "includeInExport": true,
        "meta": { "shape": "cube" },
        "connectors": []
    },
    {
        "id": "obj_1765263644099_12209",
        "key": "cube",
        "type": "cube",
        "name": "Cube 2 (Top)",
        "dims": { "w": 10, "h": 10, "d": 200 },
        "pos": [0, 15, 0],
        "rot": [0, 0, 0],
        "visible": true,
        "includeInExport": true,
        "meta": { "shape": "cube" },
        "connectors": []
    }
];

describe('Drill Feature Regression', () => {
    it('should identify overlap candidates when drilling Top Cube (+Y face)', () => {
        // Prepare Data
        const flatObjects = userScene.map(o => ({
            ...o,
            worldPos: new THREE.Vector3(...o.pos),
            worldQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rot)),
            dims: o.dims
        }));

        const targetObj = flatObjects.find(o => o.pos[1] === 15); // Top

        // Arguments for calculateDrillCandidates
        const partId = targetObj.id;
        const face = "+Y";
        // Top Face center world coordinates: (0, 15 + 5, 0) = (0, 20, 0)
        const faceCenter = [0, 20, 0];
        const worldPoint = new THREE.Vector3(0, 20, 0);
        const infoQuaternion = targetObj.worldQuat.toArray();
        // Face Size for Top (+Y) face: W=10, D=200.
        // For +Y face, local X aligns with world X (w=10), local Y (normal) up, local Z aligns with world Z (d=200).
        // getFace2DInfo("+Y", [w, h, d]) returns dims: [w, d]
        const faceSize = [10, 200];

        const candidates = calculateDrillCandidates(
            partId,
            face,
            faceCenter,
            worldPoint,
            infoQuaternion,
            faceSize,
            flatObjects
        );

        console.log("Candidates Found:", candidates.length);
        candidates.forEach(c => console.log("Candidate at:", c.toArray()));

        // Expectation:
        // We are drilling at (0, 20, 0) on Top Cube.
        // It should raycast down (-Y).
        // It hits Bottom Cube at Y=5. (Top face of bottom cube? Or Center?)
        // The overlap check logic projects the bottom cube onto the top face.
        // Bottom cube is wide (w=200) and thin (h=10, d=10).
        // It runs along X.
        // Top cube is thin (w=10) and long (d=200).
        // They form a cross.
        // The overlap is a square in the center.
        // calculateDrillCandidates returns the CENTER of the overlap region projected on Plane A.
        // Overlap center should be (0, 20, 0).

        expect(candidates.length).toBeGreaterThan(0);

        const match = candidates.find(c => Math.abs(c.x) < 0.1 && Math.abs(c.z) < 0.1);
        expect(match).toBeDefined();

        // Y position should be on the hovered face (Plane A), i.e., 20.
        expect(match.y).toBeCloseTo(20);
    });

    it('should identify overlap candidates when drilling Side Cube (+X face)', () => {
        // Scenario: Two vertical plates.
        // Plate A (Target, Front): X=15. Thin in X.
        // Plate B (Behind, Back): X=5. Wide in Y/Z.

        const sideScene = [
            {
                "id": "plate_behind",
                "dims": { "w": 10, "h": 100, "d": 10 },
                "pos": [5, 0, 0],
                "rot": [0, 0, 0],
            },
            {
                "id": "plate_target",
                "dims": { "w": 10, "h": 10, "d": 100 },
                "pos": [15, 0, 0],
                "rot": [0, 0, 0],
            }
        ];

        const flatObjects = sideScene.map(o => ({
            ...o,
            worldPos: new THREE.Vector3(...o.pos),
            worldQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rot)),
            dims: o.dims
        }));

        const targetObj = flatObjects.find(o => o.id === "plate_target");

        // Arguments
        const partId = targetObj.id;
        const face = "+X";
        // Target Center at X=15. Width=10. +X Face is at 15 + 5 = 20.
        // Center: (20, 0, 0).
        const faceCenter = [20, 0, 0];
        const worldPoint = new THREE.Vector3(20, 0, 0); // Drill at center
        const infoQuaternion = targetObj.worldQuat.toArray();
        // Face Size for +X: Y=200, Z=200.
        const faceSize = [200, 200];

        const candidates = calculateDrillCandidates(
            partId,
            face,
            faceCenter,
            worldPoint,
            infoQuaternion,
            faceSize,
            flatObjects
        );

        console.log("Side candidates:", candidates.length);
        candidates.forEach(c => console.log("Cand X:", c.toArray()));

        expect(candidates.length).toBeGreaterThan(0);

        // Match should be at center of overlap (20, 0, 0)
        const match = candidates.find(c => Math.abs(c.y) < 0.1 && Math.abs(c.z) < 0.1);
        expect(match).toBeDefined();
        expect(match.x).toBeCloseTo(20);
    });
});
