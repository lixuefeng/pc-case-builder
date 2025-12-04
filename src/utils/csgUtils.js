import * as THREE from 'three';

/**
 * Adjusts the relative transform of CSG operations to account for a shift in the object's center.
 * @param {Object} part - The object containing csgOperations.
 * @param {THREE.Vector3} originalPos - The original world position of the object (before split/move).
 * @param {THREE.Quaternion} originalQuat - The original world rotation of the object.
 * @returns {Array} - The updated csgOperations array.
 */
export const adjustCSGOperations = (part, originalPos, originalQuat) => {
    if (!part.csgOperations) return [];

    const partPos = new THREE.Vector3(...part.pos);
    const shiftWorld = partPos.clone().sub(originalPos);

    const invQuat = originalQuat.clone().invert();
    const shiftLocal = shiftWorld.applyQuaternion(invQuat);

    return part.csgOperations.map(op => {
        const oldRelPos = new THREE.Vector3(...op.relativeTransform.pos);
        const newRelPos = oldRelPos.clone().sub(shiftLocal);
        return {
            ...op,
            relativeTransform: {
                ...op.relativeTransform,
                pos: newRelPos.toArray()
            }
        };
    });
};
