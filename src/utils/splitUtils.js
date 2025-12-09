
import * as THREE from 'three';
import { duplicateObject, generateObjectId } from './objectUtils';
import { adjustCSGOperations } from './csgUtils';

/**
 * Calculates the split of an object by a plane.
 * Supports both axis-aligned geometric splits (modifying dimensions) and non-axis-aligned CSG splits.
 * 
 * @param {Object} targetObj - The object to split.
 * @param {THREE.Vector3} planePos - A point on the split plane (World Space).
 * @param {THREE.Vector3} planeNormal - The normal of the split plane (World Space).
 * @returns {Array|null} - An array of new objects [partA, partB] or null if split failed/skipped.
 */
export const calculateSplit = (targetObj, planePos, planeNormal) => {
    if (!targetObj || !planePos || !planeNormal) return null;

    const huge = 10000;

    // --- Axis-Aligned Cut Detection ---
    const objPos = new THREE.Vector3(...(targetObj.pos || [0, 0, 0]));
    const objRot = new THREE.Euler(...(targetObj.rot || [0, 0, 0]));
    const objQuat = new THREE.Quaternion().setFromEuler(objRot);
    const invObjQuat = objQuat.clone().invert();

    // Transform plane normal to local space
    const localNormal = planeNormal.clone().applyQuaternion(invObjQuat);
    const localPoint = planePos.clone().sub(objPos).applyQuaternion(invObjQuat);

    // Check for axis alignment (tolerance 0.01)
    const isX = Math.abs(Math.abs(localNormal.x) - 1) < 0.01;
    const isY = Math.abs(Math.abs(localNormal.y) - 1) < 0.01;
    const isZ = Math.abs(Math.abs(localNormal.z) - 1) < 0.01;

    if (isX || isY || isZ) {
        // --- Perform Actual Geometry Split ---
        // console.log("Axis Aligned Split Detected:", { isX, isY, isZ });

        const dims = targetObj.dims || { w: 10, h: 10, d: 10 };
        let axis = 'w'; // Default w (x)
        let splitPos = localPoint.x;
        let size = dims.w;

        if (isY) { axis = 'h'; splitPos = localPoint.y; size = dims.h; }
        if (isZ) { axis = 'd'; splitPos = localPoint.z; size = dims.d; }

        // Validate split position is inside object
        if (Math.abs(splitPos) >= size / 2) {
            console.warn("Split plane is outside object bounds");
            return null;
        }

        const sizeA = splitPos + size / 2;
        const centerA_Local = (splitPos - size / 2) / 2;

        const sizeB = size / 2 - splitPos;
        const centerB_Local = (size / 2 + splitPos) / 2;

        // Create Part A
        const partA = duplicateObject(targetObj, 0);
        partA.id = generateObjectId(targetObj.type);
        partA.name = `${targetObj.name || targetObj.type} (A)`;
        partA.dims = { ...dims, [axis]: sizeA };

        // Transform local center back to world
        const localCenterVecA = new THREE.Vector3();
        if (isX) localCenterVecA.set(centerA_Local, 0, 0);
        if (isY) localCenterVecA.set(0, centerA_Local, 0);
        if (isZ) localCenterVecA.set(0, 0, centerA_Local);

        const worldCenterA = localCenterVecA.applyQuaternion(objQuat).add(objPos);
        partA.pos = worldCenterA.toArray();

        // Adjust CSG for Part A
        partA.csgOperations = adjustCSGOperations(partA, objPos, objQuat);

        // Create Part B
        const partB = duplicateObject(targetObj, 0);
        partB.id = generateObjectId(targetObj.type);
        partB.name = `${targetObj.name || targetObj.type} (B)`;
        partB.dims = { ...dims, [axis]: sizeB };

        const localCenterVecB = new THREE.Vector3();
        if (isX) localCenterVecB.set(centerB_Local, 0, 0);
        if (isY) localCenterVecB.set(0, centerB_Local, 0);
        if (isZ) localCenterVecB.set(0, 0, centerB_Local);

        const worldCenterB = localCenterVecB.applyQuaternion(objQuat).add(objPos);
        partB.pos = worldCenterB.toArray();

        // Adjust CSG for Part B
        partB.csgOperations = adjustCSGOperations(partB, objPos, objQuat);

        return [partA, partB];

    } else {
        // --- Fallback to CSG Split (Non-Axis Aligned) ---
        // console.log("Non-Axis Aligned Split - Using CSG");

        // Helper to get relative transform
        const getRelTransform = (target, cutterWorldPos, cutterWorldRot) => {
            const targetPos = new THREE.Vector3(...(target.pos || [0, 0, 0]));
            const targetRot = new THREE.Euler(...(target.rot || [0, 0, 0]));
            const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);
            const invTargetQuat = targetQuat.clone().invert();

            const relPos = cutterWorldPos.clone().sub(targetPos).applyQuaternion(invTargetQuat);

            const cutterQuat = new THREE.Quaternion().setFromEuler(cutterWorldRot);
            const relQuat = invTargetQuat.clone().multiply(cutterQuat);
            const relEuler = new THREE.Euler().setFromQuaternion(relQuat);

            return { pos: relPos.toArray(), rot: [relEuler.x, relEuler.y, relEuler.z] };
        };

        // Plane Rotation
        const defaultUp = new THREE.Vector3(0, 0, 1);
        const planeQuat = new THREE.Quaternion().setFromUnitVectors(defaultUp, planeNormal);
        const planeRot = new THREE.Euler().setFromQuaternion(planeQuat);

        // Box Right Center (Along Normal)
        const boxRightPos = planePos.clone().add(planeNormal.clone().multiplyScalar(huge / 2));
        // Box Left Center (Opposite to Normal)
        const boxLeftPos = planePos.clone().sub(planeNormal.clone().multiplyScalar(huge / 2));

        // Part A (Keep "Left" / Negative Side) -> Subtract "Right" Box
        const partA = duplicateObject(targetObj, 0);
        partA.id = generateObjectId(targetObj.type);
        partA.name = `${targetObj.name || targetObj.type} (A)`;

        const boxRightRel = getRelTransform(partA, boxRightPos, planeRot);
        if (!partA.csgOperations) partA.csgOperations = [];
        partA.csgOperations.push({
            type: 'box',
            dims: { w: huge, h: huge, d: huge },
            relativeTransform: boxRightRel,
            operation: 'subtract',
            id: generateObjectId('cut_r')
        });

        // Part B (Keep "Right" / Positive Side) -> Subtract "Left" Box
        const partB = duplicateObject(targetObj, 0);
        partB.id = generateObjectId(targetObj.type);
        partB.name = `${targetObj.name || targetObj.type} (B)`;

        const boxLeftRel = getRelTransform(partB, boxLeftPos, planeRot);
        if (!partB.csgOperations) partB.csgOperations = [];
        partB.csgOperations.push({
            type: 'box',
            dims: { w: huge, h: huge, d: huge },
            relativeTransform: boxLeftRel,
            operation: 'subtract',
            id: generateObjectId('cut_l')
        });

        return [partA, partB];
    }
};
