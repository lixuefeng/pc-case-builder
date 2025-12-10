import { useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

const DEBUG_LOG = false;

// Helpers
export const getStretchAxisInfo = (obj, faceName) => {
    if (!obj || !faceName) return null;
    // Simple mapping for box-like objects
    if (faceName === '+X' || faceName === '-X') return { axis: 'X', dimKey: 'w', sign: faceName === '+X' ? 1 : -1 };
    if (faceName === '+Y' || faceName === '-Y') return { axis: 'Y', dimKey: 'h', sign: faceName === '+Y' ? 1 : -1 };
    if (faceName === '+Z' || faceName === '-Z') return { axis: 'Z', dimKey: 'd', sign: faceName === '+Z' ? 1 : -1 };
    return null;
};

export const computeAxisOffsetFromRay = (ray, axisOrigin, axisDirection) => {
    if (!ray || !axisOrigin || !axisDirection) {
        return null;
    }
    const w0 = axisOrigin.clone().sub(ray.origin);
    const rayDir = ray.direction.clone().normalize();
    const b = axisDirection.dot(rayDir);
    const d = axisDirection.dot(w0);
    const e = rayDir.dot(w0);
    const denom = 1 - b * b;
    let result;
    if (Math.abs(denom) < 0.05) {
        if (DEBUG_LOG) console.log("[stretch/axisOffset] denom too small (parallel view)", denom);
        return null;
    } else {
        result = (b * e - d) / denom;
    }
    if (DEBUG_LOG) console.log("[stretch/axisOffset]", {
        rayOrigin: ray.origin.toArray?.() ?? null,
        rayDir: rayDir.toArray?.() ?? null,
        axisOrigin: axisOrigin.toArray?.() ?? null,
        axisDir: axisDirection.toArray?.() ?? null,
        denom,
        result,
    });
    return result;
};

export function usePartStretch({
    obj,
    setObj,
    isEmbedded,
    setHudState,
    groupRef,
    onFacePick,
    isShiftPressed,
    setUiLock,
    setHoveredFace,
}) {
    const { gl, camera } = useThree();
    const stretchStateRef = useRef(null);

    // Use a stable ref for setObj to avoid dependency loops in callbacks
    const setObjRef = useRef(setObj);
    useEffect(() => {
        setObjRef.current = setObj;
    }, [setObj]);

    const pointerNdc = useRef(new THREE.Vector2()).current;
    const raycaster = useRef(new THREE.Raycaster()).current;
    const finishStretchRef = useRef(null);

    const requestFinish = useCallback((reason) => {
        if (DEBUG_LOG) console.log("[stretch/finish-request]", reason);
        finishStretchRef.current?.();
    }, []);

    const handleWindowPointerUp = useCallback((event) => {
        if (DEBUG_LOG) console.log("[stretch/window-pointerup]", {
            pointerId: event.pointerId,
            buttons: event.buttons,
        });
        requestFinish("pointerup");
    }, [requestFinish]);

    const handleWindowPointerCancel = useCallback((event) => {
        if (DEBUG_LOG) console.log("[stretch/window-pointercancel]", {
            pointerId: event.pointerId,
        });
        requestFinish("pointercancel");
    }, [requestFinish]);

    const handleWindowBlur = useCallback(() => {
        if (DEBUG_LOG) console.log("[stretch/window-blur]");
        requestFinish("window-blur");
    }, [requestFinish]);

    const applyStretchDelta = useCallback(
        (delta) => {
            const state = stretchStateRef.current;
            if (!state || !groupRef.current) return;

            // Optimization: Skip if delta hasn't changed significantly
            if (Math.abs(delta - (state.lastDelta || 0)) < 0.001) return;

            const { axisInfo, startDims, startPosVec, axisDirection, objectId } = state;
            if (!axisInfo?.dimKey || !axisDirection || !startPosVec) return;
            const startSize = Number(startDims[axisInfo.dimKey]) || 0;
            let appliedDelta = delta;
            let nextSize = startSize + appliedDelta;
            const minSize = 1;
            if (nextSize < minSize) {
                nextSize = minSize;
                appliedDelta = nextSize - startSize;
            }
            const newDims = { ...startDims, [axisInfo.dimKey]: nextSize };
            const centerOffset = axisDirection.clone().multiplyScalar(appliedDelta / 2);
            const newPosVec = startPosVec.clone().add(centerOffset);

            groupRef.current.position.copy(newPosVec);

            setObjRef.current((prev) => ({
                ...prev,
                dims: newDims,
                pos: [newPosVec.x, newPosVec.y, newPosVec.z],
            }));

            // Update HUD during stretch
            setHudState?.({
                type: 'scale',
                data: {
                    sx: newDims.w,
                    sy: newDims.h,
                    sz: newDims.d,
                    factor: newDims.w // Fallback
                }
            });

            state.lastDelta = appliedDelta;
            if (DEBUG_LOG) console.log("[stretch/applyDelta]", {
                part: objectId,
                face: state.faceName,
                dimKey: axisInfo.dimKey,
                startSize,
                nextSize,
                appliedDelta,
                centerOffset: centerOffset.toArray(),
                startPos: startPosVec.toArray(),
                newPos: newPosVec.toArray(),
            });
        },
        [setHudState, groupRef]
    );

    const handleStretchPointerMove = useCallback(
        (event) => {
            if (DEBUG_LOG) console.log("[stretch/pointerMove:raw]", {
                type: event.type,
                buttons: event.buttons,
                pointerId: event.pointerId,
                pointerType: event.pointerType,
            });
            const state = stretchStateRef.current;
            if (!state || !state.axisDirection || !state.axisOrigin) return;
            if (event.buttons === 0) {
                return;
            }
            const rect = gl.domElement.getBoundingClientRect();
            pointerNdc.set(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycaster.setFromCamera(pointerNdc, camera);
            const { axisDirection: axisDir, axisOrigin, objectId, pointerId } = state;
            if (pointerId !== undefined && pointerId !== event.pointerId) {
                if (DEBUG_LOG) console.log("[stretch/pointerMove] pointerId mismatch (ignoring)", {
                    expected: pointerId,
                    received: event.pointerId,
                });
                return;
            }

            const axisOffset = computeAxisOffsetFromRay(
                raycaster.ray,
                axisOrigin,
                axisDir
            );

            if (typeof axisOffset !== "number" || Number.isNaN(axisOffset)) {
                return;
            }

            const delta = axisOffset - state.startAxisOffset;

            if (!state.hasTriggeredDrag) {
                const dist = Math.sqrt(
                    Math.pow(event.clientX - state.startScreenPos.x, 2) +
                    Math.pow(event.clientY - state.startScreenPos.y, 2)
                );
                if (dist < 5) {
                    return;
                }
                state.hasTriggeredDrag = true;
            }

            applyStretchDelta(delta);
        },
        [
            applyStretchDelta,
            gl,
            pointerNdc,
            raycaster,
            camera
        ]
    );

    const finishStretch = useCallback(() => {
        if (!stretchStateRef.current) return;
        window.removeEventListener("pointermove", handleStretchPointerMove);
        window.removeEventListener("pointerup", handleWindowPointerUp);
        window.removeEventListener("pointercancel", handleWindowPointerCancel);
        window.removeEventListener("blur", handleWindowBlur);
        if (DEBUG_LOG) console.log("[stretch/finish]", {
            part: stretchStateRef.current?.objectId,
            face: stretchStateRef.current?.faceName,
        });
        const captureTarget = stretchStateRef.current?.pointerCaptureTarget;
        const pointerId = stretchStateRef.current?.pointerId;
        if (captureTarget && typeof captureTarget.releasePointerCapture === "function" && pointerId !== undefined) {
            try {
                captureTarget.releasePointerCapture(pointerId);
                if (DEBUG_LOG) console.log("[stretch/finish] releasePointerCapture", { pointerId });
            } catch (releaseError) {
                if (DEBUG_LOG) console.warn("[stretch/finish] failed to release pointer capture", releaseError);
            }
        }
        const wasDrag = stretchStateRef.current?.hasTriggeredDrag;
        const faceName = stretchStateRef.current?.faceName;
        const objectId = stretchStateRef.current?.objectId;

        stretchStateRef.current = null;
        setUiLock?.(false);

        if (!wasDrag && onFacePick && faceName && objectId) {
            if (DEBUG_LOG) console.log("[stretch/finish] treated as click", { objectId, faceName });
            onFacePick({ partId: objectId, face: faceName, shiftKey: isShiftPressed });
        }

        setObjRef.current((prev) => {
            // Clear connectors if connectors is undefined... preserving original logic slightly weird though
            if (!Array.isArray(prev.connectors) || prev.connectors.length === 0) {
                return prev;
            }
            return { ...prev, connectors: [] };
        });
    }, [handleStretchPointerMove, handleWindowBlur, handleWindowPointerCancel, handleWindowPointerUp, onFacePick, isShiftPressed, setUiLock]);

    useEffect(() => {
        finishStretchRef.current = finishStretch;
    }, [finishStretch]);

    useEffect(() => {
        return () => {
            if (DEBUG_LOG) console.log("[stretch/cleanup] removing listeners");
            window.removeEventListener("pointermove", handleStretchPointerMove);
            window.removeEventListener("pointerup", handleWindowPointerUp);
            window.removeEventListener("pointercancel", handleWindowPointerCancel);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, [handleStretchPointerMove, handleWindowBlur, handleWindowPointerCancel, handleWindowPointerUp]);

    const beginStretch = useCallback(
        (faceName, faceDetails, event) => {
            if (stretchStateRef.current) {
                if (DEBUG_LOG) console.log("[stretch/begin] aborted: existing session, forcing finish");
                requestFinish("begin-stale-session");
                if (stretchStateRef.current) {
                    return false;
                }
            }
            if (!faceDetails) {
                if (DEBUG_LOG) console.log("[stretch/begin] aborted: no faceDetails");
                return false;
            }
            if (isEmbedded) {
                if (DEBUG_LOG) console.log("[stretch/begin] aborted: embedded part");
                return false;
            }
            const axisInfo = getStretchAxisInfo(obj, faceName);
            if (!axisInfo) {
                if (DEBUG_LOG) console.log("[stretch/begin] aborted: axisInfo missing");
                return false;
            }
            const axisDirection = new THREE.Vector3(...(faceDetails.normal || [0, 0, 1])).normalize();
            const axisOrigin = new THREE.Vector3(...(faceDetails.center || [0, 0, 0]));
            const startPosVec = new THREE.Vector3(
                ...(Array.isArray(obj.pos) ? obj.pos : [0, 0, 0])
            );
            const startAxisOffset = computeAxisOffsetFromRay(
                event.ray,
                axisOrigin,
                axisDirection
            );
            if (typeof startAxisOffset !== "number" || Number.isNaN(startAxisOffset)) {
                if (DEBUG_LOG) console.log("[stretch/begin] aborted: invalid axis offset", {
                    rayOrigin: event.ray.origin.toArray(),
                    rayDir: event.ray.direction.toArray(),
                    axisOrigin: axisOrigin.toArray(),
                    axisDir: axisDirection.toArray(),
                });
                return false;
            }
            stretchStateRef.current = {
                faceName,
                axisDirection,
                axisOrigin,
                objectId: obj?.id ?? obj?.name ?? "unknown",
                axisInfo,
                startAxisOffset,
                startDims: { ...(obj.dims || {}) },
                startPosVec,
                lastDelta: 0,
                pointerId: event.pointerId,
                pointerCaptureTarget:
                    event.target && typeof event.target.setPointerCapture === "function"
                        ? event.target
                        : null,
                hasTriggeredDrag: false,
                startScreenPos: { x: event.clientX, y: event.clientY },
            };
            if (stretchStateRef.current.pointerCaptureTarget) {
                try {
                    stretchStateRef.current.pointerCaptureTarget.setPointerCapture(event.pointerId);
                    if (DEBUG_LOG) console.log("[stretch/begin] setPointerCapture", {
                        pointerId: event.pointerId,
                        target: stretchStateRef.current.pointerCaptureTarget,
                    });
                } catch (captureError) {
                    if (DEBUG_LOG) console.warn("[stretch/begin] failed to capture pointer", captureError);
                    stretchStateRef.current.pointerCaptureTarget = null;
                }
            }

            setHoveredFace?.(faceName);
            setUiLock?.(true);

            window.addEventListener("pointermove", handleStretchPointerMove);
            window.addEventListener("pointerup", handleWindowPointerUp);
            window.addEventListener("pointercancel", handleWindowPointerCancel);
            window.addEventListener("blur", handleWindowBlur);
            return true;
        },
        [
            handleStretchPointerMove,
            handleWindowBlur,
            handleWindowPointerCancel,
            handleWindowPointerUp,
            isEmbedded,
            obj,
            setHoveredFace,
            setUiLock,
            requestFinish,
        ]
    );

    return {
        beginStretch,
        isStretching: !!stretchStateRef.current
    };
}
