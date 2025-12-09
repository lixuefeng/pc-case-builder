import { useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { useToast } from "../context/ToastContext";
import { duplicateObject, generateObjectId } from "../utils/objectUtils";
import { adjustCSGOperations } from "../utils/csgUtils";
import { calculateSplit } from "../utils/splitUtils";

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

                const splitResult = calculateSplit(original, planePos, planeNormal);

                if (splitResult) {
                    const [partA, partB] = splitResult;
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
