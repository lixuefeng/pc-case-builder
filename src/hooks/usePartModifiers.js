import { useMemo } from 'react';
import * as THREE from 'three';

// Helper to calculate relative transform
export const getRelativeTransform = (sourceObj, targetObj) => {
    if (!sourceObj || !targetObj) return null;

    const sourcePos = new THREE.Vector3(...(sourceObj.pos || [0, 0, 0]));
    const sourceRot = new THREE.Euler(...(sourceObj.rot || [0, 0, 0]));
    const sourceQuat = new THREE.Quaternion().setFromEuler(sourceRot);
    const targetPos = new THREE.Vector3(...(targetObj.pos || [0, 0, 0]));
    const targetRot = new THREE.Euler(...(targetObj.rot || [0, 0, 0]));
    const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);
    const targetScale = new THREE.Vector3(...(targetObj.scale || [1, 1, 1]));

    // Calculate relative position and rotation
    // We want sourceObj's transform relative to targetObj's local space
    const invTargetQuat = targetQuat.clone().invert();

    // (WorldPos - TargetWorldPos) -> Rotate to Target Local -> Divide by Target Scale
    const relPos = sourcePos.clone().sub(targetPos).applyQuaternion(invTargetQuat).divide(targetScale);
    const relQuat = invTargetQuat.clone().multiply(sourceQuat);
    const relEuler = new THREE.Euler().setFromQuaternion(relQuat);

    const result = { pos: relPos.toArray(), rot: [relEuler.x, relEuler.y, relEuler.z] };
    if (result.pos.some(isNaN) || result.rot.some(isNaN)) {
        console.error("getRelativeTransform produced NaNs:", result, sourceObj, targetObj);
        return null;
    }
    return result;
};

export function usePartModifiers(obj, connections = [], rawObjects = []) {
    return useMemo(() => {
        if (!obj || !connections || !rawObjects) return [];

        const modifiers = [];

        // 1. Add baked/static modifiers from the object itself
        if (obj.csgOperations && Array.isArray(obj.csgOperations)) {
            modifiers.push(...obj.csgOperations);
        }

        // 2. Add dynamic modifiers from connections
        connections.forEach(conn => {
            // Filter out legacy types to prevent errors
            const validTypes = ['mortise-tenon', 'cross-lap', 'subtraction'];
            if (!validTypes.includes(conn.type)) return;

            // Logic for Cross-Lap Joint (Handled by RightSidebar baking)
            // if (conn.type === 'cross-lap') { ... }



            // Logic for Generic Subtraction (Part A is cut by Part B)
            if (conn.type === 'subtraction') {
                if (conn.partA === obj.id) { // Only cut if we are Part A (Host)
                    const otherObj = rawObjects.find(o => o.id === conn.partB);
                    if (otherObj) {
                        modifiers.push({
                            ...otherObj,
                            operation: 'subtract',
                            relativeTransform: getRelativeTransform(otherObj, obj)
                        });
                    }
                }
            }
        });

        return modifiers;
    }, [obj.id, obj.pos, obj.rot, obj.csgOperations, connections, rawObjects]);
}
