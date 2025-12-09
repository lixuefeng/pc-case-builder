import { useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { useToast } from "../context/ToastContext";
import { duplicateObject, generateObjectId } from "../utils/objectUtils";
import { adjustCSGOperations } from "../utils/csgUtils";

export function useCutTool({ objects, setObjects, selectedIds, setSelectedIds, transformMode, setTransformMode }) {
    const { showToast } = useToast();
    const [cutterFace, setCutterFace] = useState(null);

    // Clear cutterFace when leaving cut mode
    useEffect(() => {
        if (transformMode !== 'cut') {
            setCutterFace(null);
        }
    }, [transformMode]);

    const handleToggleCutMode = useCallback(() => {
        if (transformMode === 'cut') {
            setTransformMode('translate');
        } else {
            setTransformMode('cut');
        }
    }, [transformMode, setTransformMode]);

    const performSplit = useCallback(() => {
        if (!cutterFace) {
            showToast({ type: "error", text: "Please set a split plane (Shift+Click a face)", ttl: 2000 });
            return;
        }
        if (selectedIds.length === 0) {
            showToast({ type: "error", text: "No objects selected to split", ttl: 2000 });
            return;
        }

        const planePos = new THREE.Vector3(...cutterFace.point);
        const planeNormal = new THREE.Vector3(...cutterFace.normal).normalize();

        // Create a quaternion for the plane rotation (Z axis aligned to normal)
        const defaultUp = new THREE.Vector3(0, 0, 1);
        const planeQuat = new THREE.Quaternion().setFromUnitVectors(defaultUp, planeNormal);
        const planeRot = new THREE.Euler().setFromQuaternion(planeQuat);

        const huge = 10000;

        // Box Right Center (Along Normal)
        const boxRightPos = planePos.clone().add(planeNormal.clone().multiplyScalar(huge / 2));
        // Box Left Center (Opposite to Normal)
        const boxLeftPos = planePos.clone().sub(planeNormal.clone().multiplyScalar(huge / 2));

        const newObjects = [];
        const newSelection = [];

        setObjects(prev => {
            const nextObjects = [...prev];
            const objectsToRemove = [];

            selectedIds.forEach(id => {
                const original = nextObjects.find(o => o.id === id);
                if (!original) return;

                // --- Axis-Aligned Cut Detection ---
                const objPos = new THREE.Vector3(...(original.pos || [0, 0, 0]));
                const objRot = new THREE.Euler(...(original.rot || [0, 0, 0]));
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
                    console.log("Axis Aligned Split Detected:", { isX, isY, isZ });

                    const dims = original.dims || { w: 10, h: 10, d: 10 };
                    let axis = 'w'; // Default w (x)
                    let splitPos = localPoint.x;
                    let size = dims.w;

                    if (isY) { axis = 'h'; splitPos = localPoint.y; size = dims.h; }
                    if (isZ) { axis = 'd'; splitPos = localPoint.z; size = dims.d; }

                    // Validate split position is inside object
                    if (Math.abs(splitPos) >= size / 2) {
                        console.warn("Split plane is outside object bounds");
                        return; // Skip this object
                    }

                    const sizeA = splitPos + size / 2;
                    const centerA_Local = (splitPos - size / 2) / 2;

                    const sizeB = size / 2 - splitPos;
                    const centerB_Local = (size / 2 + splitPos) / 2;

                    // Create Part A
                    const partA = duplicateObject(original, 0);
                    partA.id = generateObjectId(original.type);
                    partA.name = `${original.name || original.type} (A)`;
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
                    const partB = duplicateObject(original, 0);
                    partB.id = generateObjectId(original.type);
                    partB.name = `${original.name || original.type} (B)`;
                    partB.dims = { ...dims, [axis]: sizeB };

                    const localCenterVecB = new THREE.Vector3();
                    if (isX) localCenterVecB.set(centerB_Local, 0, 0);
                    if (isY) localCenterVecB.set(0, centerB_Local, 0);
                    if (isZ) localCenterVecB.set(0, 0, centerB_Local);

                    const worldCenterB = localCenterVecB.applyQuaternion(objQuat).add(objPos);
                    partB.pos = worldCenterB.toArray();

                    // Adjust CSG for Part B
                    partB.csgOperations = adjustCSGOperations(partB, objPos, objQuat);

                    newObjects.push(partA, partB);
                    newSelection.push(partA.id, partB.id);
                    objectsToRemove.push(id);

                } else {
                    // --- Fallback to CSG Split (Non-Axis Aligned) ---
                    console.log("Non-Axis Aligned Split - Using CSG");

                    // Helper to get relative transform
                    const getRelTransform = (targetObj, cutterWorldPos, cutterWorldRot) => {
                        const targetPos = new THREE.Vector3(...(targetObj.pos || [0, 0, 0]));
                        const targetRot = new THREE.Euler(...(targetObj.rot || [0, 0, 0]));
                        const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);
                        const invTargetQuat = targetQuat.clone().invert();

                        const relPos = cutterWorldPos.clone().sub(targetPos).applyQuaternion(invTargetQuat);

                        const cutterQuat = new THREE.Quaternion().setFromEuler(cutterWorldRot);
                        const relQuat = invTargetQuat.clone().multiply(cutterQuat);
                        const relEuler = new THREE.Euler().setFromQuaternion(relQuat);

                        return { pos: relPos.toArray(), rot: [relEuler.x, relEuler.y, relEuler.z] };
                    };

                    // Part A (Keep "Left" / Negative Side) -> Subtract "Right" Box
                    const partA = duplicateObject(original, 0);
                    partA.id = generateObjectId(original.type);
                    partA.name = `${original.name || original.type} (A)`;

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
                    const partB = duplicateObject(original, 0);
                    partB.id = generateObjectId(original.type);
                    partB.name = `${original.name || original.type} (B)`;

                    const boxLeftRel = getRelTransform(partB, boxLeftPos, planeRot);
                    if (!partB.csgOperations) partB.csgOperations = [];
                    partB.csgOperations.push({
                        type: 'box',
                        dims: { w: huge, h: huge, d: huge },
                        relativeTransform: boxLeftRel,
                        operation: 'subtract',
                        id: generateObjectId('cut_l')
                    });

                    newObjects.push(partA, partB);
                    newSelection.push(partA.id, partB.id);
                    objectsToRemove.push(id);
                }
            });

            return nextObjects.filter(o => !objectsToRemove.includes(o.id)).concat(newObjects);
        });

        setSelectedIds(newSelection);
        setTransformMode('translate'); // Exit cut mode after split
        setCutterFace(null);
        showToast({ type: "success", text: "Split applied", ttl: 2000 });

    }, [cutterFace, selectedIds, setObjects, setSelectedIds, showToast, setTransformMode]);

    const handleCutPick = useCallback((faceInfo) => {
        if (faceInfo.event.shiftKey) {
            // faceInfo.point is already an array [x,y,z] from MovablePart
            // Fix: faceInfo.normal is already World Space (from MovablePart)
            // Do NOT apply transformDirection again!
            const worldNormal = faceInfo.normal.isVector3 ? faceInfo.normal.clone() : new THREE.Vector3(...faceInfo.normal);

            setCutterFace({
                point: faceInfo.point,
                normal: worldNormal.toArray()
            });
            showToast({ type: "info", text: "Split plane set", ttl: 1500 });
        }
    }, [setCutterFace, showToast]);

    return {
        cutterFace,
        setCutterFace,
        handleToggleCutMode,
        performSplit,
        handleCutPick
    };
}
