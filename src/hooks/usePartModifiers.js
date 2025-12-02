import { useMemo } from 'react';
import * as THREE from 'three';
import { getRelativeTransform } from '../utils/mathUtils';

export function usePartModifiers(obj, connections = [], rawObjects = []) {
    return useMemo(() => {
        if (!obj || !connections || !rawObjects) return [];

        const modifiers = [];

        // 1. Add baked/static modifiers from the object itself
        if (obj.csgOperations && Array.isArray(obj.csgOperations)) {
            const validOps = obj.csgOperations.filter(op => {
                // Check for valid dimensions
                if (!op.dims || op.dims.w <= 0 || op.dims.h <= 0 || op.dims.d <= 0) {
                    console.warn("Skipping invalid CSG op (bad dims):", op);
                    return false;
                }
                // Check for valid transform
                if (op.relativeTransform) {
                    const { pos, rot } = op.relativeTransform;
                    if (pos.some(isNaN) || rot.some(isNaN)) {
                        console.warn("Skipping invalid CSG op (NaN transform):", op);
                        return false;
                    }
                }
                return true;
            });
            modifiers.push(...validOps);
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
