import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { useToast } from "../context/ToastContext";
import { useStore } from "../store"; // We can access measurements here or pass them? Logic was in PCEditor
// PCEditor passed measurements to Scene. 
// PCEditor managed rulerPoints and measurements via useStore calls.
// Since rulerPoints and measurements are in useStore, we might not need to duplicate state here,
// but extract the logic that SETS them.

export function useRulerTool({ transformMode }) {
    const { showToast } = useToast();
    const { rulerPoints, setRulerPoints, measurements, setMeasurements, setHudState } = useStore();
    const rulerStartRef = useRef(null);

    useEffect(() => {
        if (transformMode !== "ruler") {
            setRulerPoints([]);
            setStartFace(null);
            rulerStartRef.current = null;
        }
    }, [transformMode, setRulerPoints]);

    useEffect(() => {
        if (transformMode === 'ruler') {
            let distance = 0;
            if (rulerPoints.length === 2) {
                distance = new THREE.Vector3(...rulerPoints[0]).distanceTo(new THREE.Vector3(...rulerPoints[1]));
            }
            setHudState({
                type: 'ruler',
                data: { distance, pointsCount: rulerPoints.length }
            });
        }
    }, [transformMode, rulerPoints, setHudState]);

    const handleRulerPick = useCallback((pointInfo) => {
        const { center, normal, shiftKey } = pointInfo;

        if (rulerPoints.length === 0) {
            if (!shiftKey) {
                showToast({
                    type: "info",
                    text: "Hold Shift + Click to select start face.",
                    ttl: 3000,
                });
                return;
            }

            rulerStartRef.current = { center, normal };
            setRulerPoints([center.toArray()]);
            setStartFace({ partId: pointInfo.partId, face: pointInfo.face });

            showToast({
                type: "info",
                text: "Start face selected. Click target face to measure.",
                ttl: 3000,
            });
        } else {
            const p1 = rulerStartRef.current;
            if (!p1) {
                setRulerPoints([]);
                return;
            }
            const p2 = { center, normal };

            const n1 = p1.normal.clone();
            const n2 = p2.normal.clone();
            const parallel = Math.abs(n1.dot(n2));
            let dist, p2Final, label;

            if (parallel > 0.99) {
                const v = p2.center.clone().sub(p1.center);
                dist = Math.abs(v.dot(n1));

                if (dist > 0.1) {
                    const sign = Math.sign(v.dot(n1));
                    p2Final = p1.center.clone().add(n1.clone().multiplyScalar(dist * sign));
                    label = "Perpendicular Distance";
                } else {
                    dist = p1.center.distanceTo(p2.center);
                    p2Final = p2.center;
                    label = "Center to Center";
                }
            } else {
                dist = p1.center.distanceTo(p2.center);
                p2Final = p2.center;
                label = "Center to Center";
            }

            setRulerPoints([p1.center.toArray(), p2Final.toArray()]); // Store simple arrays in store

            const dx = Math.abs(p1.center.x - p2.center.x);
            const dy = Math.abs(p1.center.y - p2.center.y);
            const dz = Math.abs(p1.center.z - p2.center.z);

            setMeasurements((prev) => [
                ...prev,
                {
                    p1: p1.center.toArray(),
                    p2: p2Final.toArray(),
                    distance: dist,
                    label,
                },
            ]);

            showToast({
                type: "success",
                text: `${label}: ${dist.toFixed(2)}mm (X: ${dx.toFixed(2)}, Y: ${dy.toFixed(2)}, Z: ${dz.toFixed(2)})`,
                ttl: 5000,
            });

            rulerStartRef.current = null;
            setStartFace(null);
        }
    }, [rulerPoints, setRulerPoints, setMeasurements, showToast]);

    const clearMeasurements = useCallback(() => {
        setMeasurements([]);
        setRulerPoints([]);
        setStartFace(null);
        showToast({ type: "info", text: "Measurements cleared.", ttl: 2000 });
    }, [setMeasurements, setRulerPoints, showToast]);

    const [startFace, setStartFace] = useState(null);

    return {
        handleRulerPick,
        clearMeasurements,
        startFace
    };
}
