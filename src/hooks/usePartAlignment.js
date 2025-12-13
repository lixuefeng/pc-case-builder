import * as THREE from "three";
import { useCallback, useRef } from "react";
import { projectedHalfExtentAlongAxis, getWorldTransform } from "../utils/editorGeometry";

// Only used for debug logging inside this hook
const DEBUG_LOG = false;
function dlog(...args) {
    if (DEBUG_LOG) console.log(...args);
}

// Previously in MovablePart.jsx as a standalone function
// getWorldTransform moved to ../utils/editorGeometry

export function getFacesAlongDir({ obj: targetObj, ref, dir }) {
    const dirN = dir.clone().normalize();
    const { p, axes } = getWorldTransform({ ref, obj: targetObj });

    // Note: projectedHalfExtentAlongAxis must be available. 
    // It was defined in MovablePart.jsx, we should probably move it to a util or export it here if it's small.
    // For now assuming it is imported or we can copy it here.
    const half = projectedHalfExtentAlongAxis(dirN, targetObj.dims, axes);
    const centerCoord = p.dot(dirN);

    const projections = [
        { label: "X", axis: axes.ax, proj: Math.abs(dirN.dot(axes.ax)) },
        { label: "Y", axis: axes.ay, proj: Math.abs(dirN.dot(axes.ay)) },
        { label: "Z", axis: axes.az, proj: Math.abs(dirN.dot(axes.az)) },
    ].sort((a, b) => b.proj - a.proj);
    const primary = projections[0];
    const sign = Math.sign(dirN.dot(primary.axis)) || 1;
    const facePosName = (sign >= 0 ? "+" : "-") + primary.label;
    const faceNegName = (sign >= 0 ? "-" : "+") + primary.label;

    return [
        { name: facePosName, coord: centerCoord + half },
        { name: faceNegName, coord: centerCoord - half },
    ];
}

// Default constants extracted from MovablePart
const ALIGN_ANG_TOL_DEG = 5;
const PARALLEL_COS = Math.cos(THREE.MathUtils.degToRad(ALIGN_ANG_TOL_DEG));
const DIST_THRESHOLD = 50;
const MIN_MOVE_EPS = 0.25;
const HYST_MM = 3;
const IMPROVE_MM = 2;
const GRACE_FRAMES = 6;

export function usePartAlignment({
    obj,
    setObj,
    allObjects,
    groupRef,
    activeAlignFace,
    mode, // 'translate' | 'rotate' etc
    setDragging, // optional
    isShiftPressed,
    setBestAlignCandidate,
}) {
    const lastAlignCandidateRef = useRef(null);
    const noHitFramesRef = useRef(0);

    const findBestAlignCandidate = useCallback((worldDir, axisLabel) => {
        const dirN = worldDir.clone().normalize();
        dlog("findBestAlignCandidate:start", { axisLabel, worldDir: dirN.toArray() });

        const gpuObjects = Array.isArray(allObjects)
            ? allObjects.filter((o) => o?.type === "gpu" || o?.type === "gpu-bracket")
            : [];

        // Self faces
        const selfFaces = getFacesAlongDir({ obj, ref: groupRef, dir: dirN });
        let bestCandidate = null;
        let minDistance = Infinity;

        // Filter potential targets
        const candidates = (allObjects || []).filter(
            (o) => o.id !== obj.id && !o.parentId && o.type !== "group"
        );

        for (const target of candidates) {
            if (obj.type === 'gpu' && target.type === 'gpu') continue; // gpu-gpu align skip? (preserve existing logic)

            const targetRef = { current: null }; // We don't have ref for others usually, logic used obj props
            // Actually MovablePart used logic: if(allObjects) ...
            // But notice `getFacesAlongDir` takes `ref`. If we don't have ref for target, we rely on target.pos/rot/dims
            // which `getWorldTransform` handles if `obj` is passed.

            // existing logic: 
            // const targetFaces = getFacesAlongDir({ obj: target, dir: dirN }); 
            // (Wait, the original code used `o` from map. Let's assume we pass `target` as `obj` param to getFacesAlongDir)

            const targetFaces = getFacesAlongDir({ obj: target, dir: dirN });

            // Compare selfFaces vs targetFaces
            for (const sf of selfFaces) {
                for (const tf of targetFaces) {
                    const dist = Math.abs(sf.coord - tf.coord);
                    if (dist < DIST_THRESHOLD && dist < minDistance) {
                        minDistance = dist;
                        bestCandidate = {
                            targetObj: target,
                            targetId: target.id,
                            targetFace: tf.name,    // e.g. "+X"
                            selfFace: sf.name,      // e.g. "-X"
                            targetCoord: tf.coord,
                            selfCoord: sf.coord,
                            dist: dist,
                            targetAxisLabel: axisLabel,
                            targetDir: dirN,
                            // Keep synonyms if needed elsewhere or just switch
                            axisLabel,
                            dir: dirN
                        };
                    }
                }
            }
        }
        return bestCandidate;
    }, [allObjects, obj, groupRef]);

    const calculateAlignPosition = useCallback((candidate) => {
        if (!candidate || !obj) return null;
        const { dir, dist, selfCoord, targetCoord } = candidate;
        // We want selfCoord to match targetCoord
        // shift = targetCoord - selfCoord
        // We move along `dir` by `shift`.
        const shift = targetCoord - selfCoord;
        const shiftVec = dir.clone().multiplyScalar(shift);

        const currentPos = new THREE.Vector3(...obj.pos);
        return currentPos.add(shiftVec);
    }, [obj]);

    const snapToCandidate = useCallback((candidate) => {
        if (!candidate) return;
        const newPos = calculateAlignPosition(candidate);
        if (newPos) {
            // Apply
            setObj((prev) => ({
                ...prev,
                pos: [newPos.x, newPos.y, newPos.z]
            }));
        }
    }, [calculateAlignPosition, setObj]);

    return {
        findBestAlignCandidate,
        calculateAlignPosition,
        snapToCandidate,
        // Export constants if needed or kept internal
        ALIGN_ANG_TOL_DEG,
        DIST_THRESHOLD
    };
}
