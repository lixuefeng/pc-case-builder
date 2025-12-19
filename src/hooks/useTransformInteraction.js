import { useState, useCallback, useEffect } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import * as THREE from "three";
import { useToast } from "../context/ToastContext";
import { computeFaceTransform } from "../utils/editorGeometry";
import { formatPartName } from "../utils/objectUtils";

// NOTE: We renamed it slightly to match the file name convention proposed
export function useTransformInteraction({ objects, setObjects, expandedObjects, setSelectedIds, transformMode }) {
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [pendingAlignFace, setPendingAlignFace] = useState(null);

    const alignEnabled = transformMode === "translate" || transformMode === "scale" || transformMode === "rotate" || transformMode === "ruler" || transformMode === "drill";

    // Clear pending face when mode changes (approximate logic from original)
    useEffect(() => {
        if (!alignEnabled) {
            setPendingAlignFace(null);
        }
    }, [alignEnabled]);

    const handleAlignmentPick = useCallback(
        (faceInfo) => {
            if (!alignEnabled || !faceInfo) {
                return;
            }

            if (!pendingAlignFace) {
                setPendingAlignFace(faceInfo);
                showToast({
                    type: "info",
                    text: t("toast.selectTargetFace"),
                });
                return;
            }

            if (pendingAlignFace.partId === faceInfo.partId) {
                showToast({
                    type: "warning",
                    text: t("toast.selectDifferentPart"),
                });
                setPendingAlignFace(null);
                return;
            }

            const movingObj = expandedObjects.find((obj) => obj.id === pendingAlignFace.partId);
            const anchorObj = expandedObjects.find((obj) => obj.id === faceInfo.partId);
            if (!anchorObj || !movingObj) {
                setPendingAlignFace(null);
                return;
            }
            if (movingObj.embeddedParentId) {
                showToast({
                    type: "warning",
                    text: t("toast.cantMoveEmbedded"),
                });
                setPendingAlignFace(null);
                return;
            }

            // We need dragging the ACTUAL object from objects list, not just the expanded one which might be derived
            // But for update we need the ID.
            // Wait, for updates we map over 'objects'.

            const movingTransform = computeFaceTransform(movingObj, pendingAlignFace.face);
            const anchorTransform = computeFaceTransform(anchorObj, faceInfo.face);
            if (!anchorTransform || !movingTransform) {
                setPendingAlignFace(null);
                return;
            }

            if (transformMode === "rotate") {
                const startNormal = movingTransform.normal.clone();
                const targetNormal = anchorTransform.normal.clone();
                const alignQuat = new THREE.Quaternion().setFromUnitVectors(startNormal, targetNormal);

                const currentQuat = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(
                        movingObj.rot?.[0] ?? 0,
                        movingObj.rot?.[1] ?? 0,
                        movingObj.rot?.[2] ?? 0,
                        "XYZ"
                    )
                );

                const newQuat = alignQuat.multiply(currentQuat);
                const newEuler = new THREE.Euler().setFromQuaternion(newQuat, "XYZ");

                setObjects((prev) =>
                    prev.map((obj) =>
                        obj.id === movingObj.id
                            ? {
                                ...obj,
                                rot: [newEuler.x, newEuler.y, newEuler.z],
                            }
                            : obj
                    )
                );

                setSelectedIds([movingObj.id]);
                setPendingAlignFace(null);
                showToast({
                    type: "success",
                    text: t("toast.rotatedDetailed", {
                        moving: formatPartName(movingObj, t),
                        anchor: formatPartName(anchorObj, t)
                    }),
                });
                return;
            }

            const parallel = Math.abs(anchorTransform.normal.dot(movingTransform.normal));
            if (parallel < 0.999) {
                showToast({
                    type: "warning",
                    text: t("toast.notParallel"),
                });
                setPendingAlignFace(null);
                return;
            }

            const direction = movingTransform.normal.clone();
            const delta = direction.dot(
                anchorTransform.center.clone().sub(movingTransform.center)
            );

            if (transformMode === "scale") {
                const getStretchAxisInfo = (obj, faceName) => {
                    if (!faceName || faceName.length < 2) return null;
                    const axis = faceName[1];
                    const dimKey = obj?.type === "gpu"
                        ? (axis === "X" ? "d" : axis === "Z" ? "w" : "h")
                        : (axis === "X" ? "w" : axis === "Y" ? "h" : "d");
                    return { dimKey };
                };

                const axisInfo = getStretchAxisInfo(movingObj, pendingAlignFace.face);
                if (!axisInfo) {
                    showToast({ type: "warning", text: t("toast.cantStretch") });
                    setPendingAlignFace(null);
                    return;
                }

                const currentSize = movingObj.dims[axisInfo.dimKey];
                let newSize = currentSize + delta;
                if (newSize < 1) newSize = 1;
                const appliedDelta = newSize - currentSize;

                const offset = direction.clone().multiplyScalar(appliedDelta / 2);
                // Need to find original object to get pos if moved?
                // Actually movingObj came from expandedObjects which is up to date usually.
                const newPos = new THREE.Vector3(...movingObj.pos).add(offset);

                setObjects((prev) =>
                    prev.map((obj) =>
                        obj.id === movingObj.id
                            ? {
                                ...obj,
                                pos: [newPos.x, newPos.y, newPos.z],
                                dims: { ...obj.dims, [axisInfo.dimKey]: newSize },
                            }
                            : obj
                    )
                );
            } else {
                // Translate
                const newPos = new THREE.Vector3(
                    movingObj.pos?.[0] ?? 0,
                    movingObj.pos?.[1] ?? 0,
                    movingObj.pos?.[2] ?? 0
                ).add(direction.multiplyScalar(delta));

                setObjects((prev) =>
                    prev.map((obj) =>
                        obj.id === movingObj.id ? { ...obj, pos: [newPos.x, newPos.y, newPos.z] } : obj
                    )
                );
            }

            setSelectedIds([movingObj.id]);
            setPendingAlignFace(null);
            showToast({
                type: "success",
                text: t("toast.alignedDetailed", {
                    moving: formatPartName(movingObj, t),
                    anchor: formatPartName(anchorObj, t)
                }),
            });

        }, [alignEnabled, pendingAlignFace, expandedObjects, transformMode, setObjects, setSelectedIds, showToast]
    );

    return {
        pendingAlignFace,
        setPendingAlignFace,
        handleAlignmentPick
    };
}
