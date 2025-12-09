import * as THREE from 'three';
import { getFace2DInfo, projectedHalfExtentAlongAxis, computeFaceTransform } from './editorGeometry';
import { EDITOR_CONFIG } from '../constants';

export const calculateDrillCandidates = (
    partId,
    face,
    faceCenter,
    worldPoint,
    infoQuaternion, // The object's world quaternion
    faceSize, // Dimensions of the hovering face
    flatObjects,
    snapThreshold = 10
) => {
    // Reconstruct setup from useDrillTool

    // We need "Plane B" (The hover plane, also called Target/Base in logs)
    // Wait, useDrillTool logic is:
    // Hovering Object A (active/dragged? No, drill is virtual).
    // The "Part" we are hovering is PartId (Target?).
    // Actually:
    // partId = The object we are hovering over (Candidate A? or B?)
    // In useDrillTool: `handleDrillHover(info)` where info.partId is the object under cursor.
    // Let's call the Hovered Object "TargetObject" (ObjT).
    // The loop iterates over "Other Objects" (ObjO).
    // It checks if ObjO overlaps ObjT.

    // In useDrillTool:
    // planeNormalB / planePointB came from baseFaceTransform (TargetObject).
    // But then it creates planeA from... aFaceTransform (TargetObject).
    // Wait.
    // Let's look at useDrillTool.js logic again.
    // It iterates `flatObjects.forEach((obj) => ...)`
    // And creates `planeB` from `baseFaceTransform` (Source/Target?).

    // Actually, let's copy the logic structure exactly.

    const candidates = [];
    const margins = EDITOR_CONFIG.DRILL_MARGIN || 1.0;

    // The "Source" is the face we are hovering on.
    // Let's call it Face A for consistency with the code.
    // But wait, the code uses "planeB" for `distanceToPoint(objCenter)`.
    // And `obj` is the "Other Object" in the loop.
    // So "Plane B" corresponds to the HOVERED FACE.

    // Setup Plane B (The Hovered Face Plane)
    // We don't have the full object here, but we have worldPoint and normal (implied by face?).
    // We need usage of computeFaceTransform.
    // But wait, the function should take the "Hovered Object" as input too, to be pure.
    // Or just the component parts.

    // Let's simplify. I will try to port the logic 1:1.
    // Inputs:
    // targetObj: The object being hovered.
    // face: name of face on targetObj.
    // worldPoint: intersection point on targetObj.
    // flatObjects: all objects including targetObj.

    // Find target object
    const targetObj = flatObjects.find(o => o.id === partId);
    if (!targetObj) return [];

    // Setup Plane B (based on targetObj face)
    let baseFaceName = face;
    // The code flips the face name for Plane A vs B?
    // In useDrillTool:
    // if (face === "+X") baseFaceName = "-X"; ...
    // const baseFaceTransform = computeFaceTransform(baseObj, baseFaceName);
    // const aFaceTransform = computeFaceTransform(baseObj, face);
    //
    // So Plane B is the OPPOSITE face?
    // And Plane A is the HOVERED face?
    // Let's verify this specific logic block.

    // Code:
    // const planeB = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormalB, planePointB);
    // const planeA = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormalA, planePointA);
    // ...
    // signedDist = planeB.distanceToPoint(objCenter);
    // if (Math.abs(signedDist) > halfDepth...)

    // If Plane B is the "Opposite Face", then `distanceToPoint` checks if objCenter is between A and B?
    // Yes, classic slab check?
    // But `halfDepth` uses `projectedHalfExtent`.

    // I will use `targetObj` as the source of truth for Planes.

    if (face === "+X") baseFaceName = "-X";
    else if (face === "-X") baseFaceName = "+X";
    else if (face === "+Y") baseFaceName = "-Y";
    else if (face === "-Y") baseFaceName = "+Y";
    else if (face === "+Z") baseFaceName = "-Z";
    else if (face === "-Z") baseFaceName = "+Z";

    const baseFaceTransform = computeFaceTransform(targetObj, baseFaceName);
    const aFaceTransform = computeFaceTransform(targetObj, face);

    // Note: computeFaceTransform now returns object quaternion.

    const worldNormalA = aFaceTransform.normal; // Normal of Hovered Face

    const planeNormalB = baseFaceTransform?.normal || worldNormalA;
    const planePointB = baseFaceTransform?.center || worldPoint;

    const planeNormalA = aFaceTransform?.normal || worldNormalA;
    const planePointA = aFaceTransform?.center || worldPoint;

    const planeB = new THREE.Plane().setFromNormalAndCoplanarPoint(
        planeNormalB.clone().normalize(),
        planePointB
    );
    const planeA = new THREE.Plane().setFromNormalAndCoplanarPoint(
        planeNormalA.clone().normalize(),
        planePointA
    );

    // qA should be the OBJECT quaternion (as per my fix)
    const qA = aFaceTransform.quaternion ? new THREE.Quaternion(...aFaceTransform.quaternion) : targetObj.worldQuat;

    const maxDim = 1000; // Simplified
    const faceCenterVecB = planePointB.clone();

    // Iterate
    const results = [];

    flatObjects.forEach(obj => {
        if (obj.id === partId) return;

        const objCenter = new THREE.Vector3(...obj.pos); // Assuming world pos is just pos for simple test
        // In real app, worldPos is calculated. Use obj.worldPos if available.
        const realObjCenter = obj.worldPos || new THREE.Vector3(...obj.pos);
        const realObjQuat = obj.worldQuat || new THREE.Quaternion().setFromEuler(new THREE.Euler(...obj.rot));

        const axes = {
            ax: new THREE.Vector3(1, 0, 0).applyQuaternion(realObjQuat),
            ay: new THREE.Vector3(0, 1, 0).applyQuaternion(realObjQuat),
            az: new THREE.Vector3(0, 0, 1).applyQuaternion(realObjQuat)
        };

        const halfDepth = projectedHalfExtentAlongAxis(
            planeNormalB,
            obj.dims || {},
            axes
        );

        if (halfDepth <= 0) return;

        const signedDist = planeB.distanceToPoint(realObjCenter);

        // Debug Log
        // console.log(`Check ${obj.id}: Dist ${signedDist.toFixed(2)} vs Limit ${(halfDepth + margins).toFixed(2)}`);

        if (Math.abs(signedDist) > halfDepth + margins) {
            return;
        }

        const projectedOnB = new THREE.Vector3();
        planeB.projectPoint(realObjCenter, projectedOnB);

        const faceAInfo = getFace2DInfo(face, faceSize || [targetObj.dims.w, targetObj.dims.h, targetObj.dims.d]);
        // Note: faceSize usually comes from useDrillTool's own resolution, but we can approximate from dims for test.
        // Actually getFace2DInfo uses dims logic internally locally if faceSize not passed?
        // No, getFace2DInfo uses faceName to select DIMS from the size3D array.
        // In useDrillTool: getFace2DInfo(face, faceSize). faceSize comes from hoveredFaceDetails.size.
        // Let's replicate that.

        // ... (Overlap Logic from current useDrillTool) ...
        if (!faceAInfo || !qA) {
            // Fallback
            return;
        }

        // FIX: Derive 2D basis from face NORMAL, not from object axes
        const faceNormal = planeNormalA.clone().normalize();

        // Choose a reference "up" to create a consistent 2D frame on the face
        let worldUp = new THREE.Vector3(0, 1, 0);
        if (Math.abs(faceNormal.y) > 0.9) {
            worldUp = new THREE.Vector3(0, 0, 1);
        }

        const rightAxis = new THREE.Vector3().crossVectors(worldUp, faceNormal).normalize();
        const upAxis = new THREE.Vector3().crossVectors(faceNormal, rightAxis).normalize();

        const halfWA = faceAInfo.dims[0] / 2;
        const halfHA = faceAInfo.dims[1] / 2;
        const minA = [-halfWA, -halfHA];
        const maxA = [halfWA, halfHA];

        // Calc Corners of B
        const dimsB = obj.dims || { w: 10, h: 10, d: 10 };
        const halfWB = (dimsB.w || 0) / 2;
        const halfHB = (dimsB.h || 0) / 2;
        const halfDB = (dimsB.d || 0) / 2;

        const cornersLocal = [
            new THREE.Vector3(halfWB, halfHB, halfDB),
            new THREE.Vector3(halfWB, halfHB, -halfDB),
            new THREE.Vector3(halfWB, -halfHB, halfDB),
            new THREE.Vector3(halfWB, -halfHB, -halfDB),
            new THREE.Vector3(-halfWB, halfHB, halfDB),
            new THREE.Vector3(-halfWB, halfHB, -halfDB),
            new THREE.Vector3(-halfWB, -halfHB, halfDB),
            new THREE.Vector3(-halfWB, -halfHB, -halfDB),
        ];

        let minB = [Infinity, Infinity];
        let maxB = [-Infinity, -Infinity];

        cornersLocal.forEach(p => {
            const pWorld = p.clone().applyQuaternion(realObjQuat).add(realObjCenter);
            const relP = pWorld.clone().sub(planePointA);  // FIX: clone() to prevent mutation
            const x = relP.dot(rightAxis);
            const y = relP.dot(upAxis);

            minB[0] = Math.min(minB[0], x);
            minB[1] = Math.min(minB[1], y);
            maxB[0] = Math.max(maxB[0], x);
            maxB[1] = Math.max(maxB[1], y);
        });

        const overlapMin = [
            Math.max(minA[0], minB[0]),
            Math.max(minA[1], minB[1])
        ];
        const overlapMax = [
            Math.min(maxA[0], maxB[0]),
            Math.min(maxA[1], maxB[1])
        ];

        if (overlapMin[0] < overlapMax[0] && overlapMin[1] < overlapMax[1]) {
            const centerOverlap2D = [
                (overlapMin[0] + overlapMax[0]) / 2,
                (overlapMin[1] + overlapMax[1]) / 2
            ];
            const worldOverlap = planePointA.clone()
                .add(rightAxis.clone().multiplyScalar(centerOverlap2D[0]))
                .add(upAxis.clone().multiplyScalar(centerOverlap2D[1]));

            results.push(worldOverlap);
        }
    });

    return results;
};
