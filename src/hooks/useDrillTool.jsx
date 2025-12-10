import { useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { EDITOR_CONFIG } from "../constants";
import { useToast } from "../context/ToastContext";
import { computeFaceTransform, flattenObjectsWithTransforms, projectedHalfExtentAlongAxis, getFace2DInfo } from "../utils/editorGeometry";
import { generateObjectId } from "../utils/objectUtils";

export function useDrillTool({ objects, setObjects, selectedObject, expandedObjects, drillParams, transformMode }) {
    const { showToast } = useToast();
    const [drillGhost, setDrillGhost] = useState(null);
    const [drillCandidates, setDrillCandidates] = useState([]);
    const [drillDebugIds, setDrillDebugIds] = useState([]);

    const snapThreshold = EDITOR_CONFIG.SNAP_THRESHOLD;

    // Clear drill state when mode changes
    useEffect(() => {
        if (transformMode !== "drill") {
            setDrillGhost(null);
            setDrillCandidates([]);
            setDrillDebugIds([]);
        }
    }, [transformMode]);

    const handleDrillHover = useCallback(
        (info) => {
            if (transformMode !== "drill" || !info?.point || !info?.normal) {
                setDrillGhost(null);
                setDrillCandidates([]);
                return;
            }

            const flatObjects = flattenObjectsWithTransforms(expandedObjects);
            const { partId, point, normal, face, faceCenter, faceSize } = info;
            const worldPoint = new THREE.Vector3(...point);
            const worldNormalA = new THREE.Vector3(...normal).normalize();

            const baseObj = flatObjects.find((o) => o.id === partId);

            if (!baseObj) {
                setDrillGhost(null);
                setDrillCandidates([]);
                return;
            }

            let baseFaceName = face;
            // Simplify face opposite logic if needed, but keeping existing logic for now
            if (face === "+X") baseFaceName = "-X";
            else if (face === "-X") baseFaceName = "+X";
            else if (face === "+Y") baseFaceName = "-Y";
            else if (face === "-Y") baseFaceName = "+Y";
            else if (face === "+Z") baseFaceName = "-Z";
            else if (face === "-Z") baseFaceName = "+Z";

            const baseFaceTransform = computeFaceTransform(baseObj, baseFaceName);
            const aFaceTransform = computeFaceTransform(baseObj, face);

            // DEBUG
            // console.log("DrillDebug: Face", face, "BaseObjPos", baseObj?.worldPos?.y, "FaceTransformCenter", aFaceTransform?.center?.y);

            const planeNormalB = baseFaceTransform?.normal || worldNormalA;
            const planePointB =
                baseFaceTransform?.center ||
                (faceCenter ? new THREE.Vector3(...faceCenter) : worldPoint);

            const planeNormalA = aFaceTransform?.normal || worldNormalA;

            const planePointA =
                aFaceTransform?.center ||
                (faceCenter ? new THREE.Vector3(...faceCenter) : worldPoint);

            const planeB = new THREE.Plane().setFromNormalAndCoplanarPoint(
                planeNormalB.clone().normalize(),
                planePointB
            );
            const planeA = new THREE.Plane().setFromNormalAndCoplanarPoint(
                planeNormalA.clone().normalize(),
                planePointA
            );

            const allCandidates = [];
            const debugIds = [];

            const maxDim = faceSize
                ? Math.max(faceSize[0], faceSize[1], faceSize[2])
                : EDITOR_CONFIG.DRILL_MAX_DIM;
            const faceCenterVecB = planePointB.clone();

            flatObjects.forEach((obj) => {
                if (obj.id === partId) return; // Skip self

                const objCenter = obj.worldPos;
                const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(obj.worldQuat);
                const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.worldQuat);
                const az = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.worldQuat);
                const axes = { ax, ay, az };

                const halfDepth = projectedHalfExtentAlongAxis(
                    planeNormalB,
                    obj.dims || {},
                    axes
                );

                if (halfDepth <= 0) return;

                const signedDist = planeB.distanceToPoint(objCenter);
                const margin = EDITOR_CONFIG.DRILL_MARGIN;

                if (Math.abs(signedDist) > halfDepth + margin) {
                    return;
                }

                const projectedOnB = new THREE.Vector3();
                planeB.projectPoint(objCenter, projectedOnB);

                const targetInfo = baseObj ? [baseObj.dims.w, baseObj.dims.h, baseObj.dims.d] : faceSize;
                const faceAInfo = getFace2DInfo(face, targetInfo);
                const qA = aFaceTransform ? aFaceTransform.quaternion : (info.quaternion ? new THREE.Quaternion(...info.quaternion) : new THREE.Quaternion());

                if (!faceAInfo) {
                    const candidateMaxDim = Math.max(obj.dims.w || 0, obj.dims.h || 0, obj.dims.d || 0);
                    const threshold = (maxDim / 2) + (candidateMaxDim / 2);
                    if (projectedOnB.distanceTo(faceCenterVecB) < threshold) {
                        const projectedOnA = new THREE.Vector3();
                        planeA.projectPoint(projectedOnB, projectedOnA);
                        allCandidates.push(projectedOnA);
                        debugIds.push(obj.id);
                    }
                    return;
                }

                const basis = [
                    new THREE.Vector3(1, 0, 0).applyQuaternion(qA),
                    new THREE.Vector3(0, 1, 0).applyQuaternion(qA),
                    new THREE.Vector3(0, 0, 1).applyQuaternion(qA),
                ];
                const rightAxis = basis[faceAInfo.axesIndices[0]];
                const upAxis = basis[faceAInfo.axesIndices[1]];

                const halfWA = faceAInfo.dims[0] / 2;
                const halfHA = faceAInfo.dims[1] / 2;
                const minA = [-halfWA, -halfHA];
                const maxA = [halfWA, halfHA];

                const dimsB = obj.dims || { w: 10, h: 10, d: 10 };
                const halfWB = (dimsB.w || 0) / 2;
                const halfHB = (dimsB.h || 0) / 2;
                const halfDB = (dimsB.d || 0) / 2;

                const cornersLocal = [
                    new THREE.Vector3(halfWB, halfHB, halfDB),
                    new THREE.Vector3(halfWB, halfHB, -halfDB),
                    new THREE.Vector3(halfWB, -halfHB, halfDB),
                    new THREE.Vector3(halfWB, -halfHB, -halfDB),
                    new THREE.Vector3(-halfWB, halfHB, halfDB),
                    new THREE.Vector3(-halfWB, halfHB, -halfDB),
                    new THREE.Vector3(-halfWB, -halfHB, halfDB),
                    new THREE.Vector3(-halfWB, -halfHB, -halfDB),
                ];

                const posB = obj.worldPos;
                const qB = obj.worldQuat;

                let minB = [Infinity, Infinity];
                let maxB = [-Infinity, -Infinity];

                cornersLocal.forEach(p => {
                    const pWorld = p.clone().applyQuaternion(qB).add(posB);
                    const relP = pWorld.sub(planePointA);
                    const x = relP.dot(rightAxis);
                    const y = relP.dot(upAxis);

                    minB[0] = Math.min(minB[0], x);
                    minB[1] = Math.min(minB[1], y);
                    maxB[0] = Math.max(maxB[0], x);
                    maxB[1] = Math.max(maxB[1], y);
                });

                const overlapMin = [
                    Math.max(minA[0], minB[0]),
                    Math.max(minA[1], minB[1])
                ];
                const overlapMax = [
                    Math.min(maxA[0], maxB[0]),
                    Math.min(maxA[1], maxB[1])
                ];

                if (overlapMin[0] < overlapMax[0] && overlapMin[1] < overlapMax[1]) {
                    const centerOverlap2D = [
                        (overlapMin[0] + overlapMax[0]) / 2,
                        (overlapMin[1] + overlapMax[1]) / 2
                    ];
                    // Reconstruct world Point on Plane A
                    // We need to be careful with axis addition.
                    // relP = pWorld - planePointA => pWorld = planePointA + relP
                    // relP = x * right + y * up + z * normal ? (projected z is 0)

                    const worldOverlap = planePointA.clone()
                        .add(rightAxis.clone().multiplyScalar(centerOverlap2D[0]))
                        .add(upAxis.clone().multiplyScalar(centerOverlap2D[1]));

                    allCandidates.push(worldOverlap);
                    debugIds.push(obj.id);
                }
            });

            setDrillCandidates(allCandidates);
            setDrillDebugIds(debugIds);

            // Determine Ghost State
            let bestSnap = null;
            let minDist = snapThreshold;

            allCandidates.forEach((cand) => {
                const d = worldPoint.distanceTo(cand);
                if (d < minDist) {
                    minDist = d;
                    bestSnap = cand;
                }
            });

            if (bestSnap) {
                setDrillGhost({
                    position: bestSnap.toArray(),
                    direction: planeNormalA.toArray(),
                    snapped: true,
                });
            } else {
                setDrillGhost({
                    position: point,
                    direction: normal,
                    snapped: false, // Normal unsnapped ghost
                });
            }

        },
        [expandedObjects, snapThreshold, transformMode]
    );

    const handleHoleDelete = useCallback((partId, holeId) => {
        setObjects((prev) =>
            prev.map((obj) => {
                if (obj.id !== partId) return obj;
                const updatedHoles = (obj.holes || []).filter((h) => h.id !== holeId);
                return { ...obj, holes: updatedHoles };
            })
        );
        showToast({
            type: "success",
            text: "Hole deleted",
            ttl: 1500,
        });
    }, [setObjects, showToast]);

    const handleGenerateStandoffs = useCallback(() => {
        if (!selectedObject) return;

        const holes = selectedObject.connectors?.filter(c => c.type === 'screw-m3' || c.type === 'mb-mount') || [];
        if (holes.length === 0) {
            showToast({ type: "error", text: "No suitable holes found.", ttl: 2000 });
            return;
        }

        const flatObjects = flattenObjectsWithTransforms(expandedObjects);
        const sourceObjFlat = flatObjects.find(o => o.id === selectedObject.id);
        if (!sourceObjFlat) return;

        const newStandoffs = [];
        const raycaster = new THREE.Raycaster();

        holes.forEach(hole => {
            const holeLocalPos = new THREE.Vector3(...hole.pos);
            const holeLocalNormal = new THREE.Vector3(...(hole.normal || [0, -1, 0]));

            const holeWorldPos = holeLocalPos.clone().applyQuaternion(sourceObjFlat.worldQuat).add(sourceObjFlat.worldPos);
            const holeWorldNormal = holeLocalNormal.clone().applyQuaternion(sourceObjFlat.worldQuat).normalize();

            raycaster.set(holeWorldPos, holeWorldNormal);

            let bestHit = null;
            let minDistance = Infinity;

            flatObjects.forEach(target => {
                if (target.id === selectedObject.id) return;

                const invTargetQuat = target.worldQuat.clone().invert();
                const rayOriginLocal = holeWorldPos.clone().sub(target.worldPos).applyQuaternion(invTargetQuat);
                const rayDirLocal = holeWorldNormal.clone().applyQuaternion(invTargetQuat).normalize();
                const localRay = new THREE.Ray(rayOriginLocal, rayDirLocal);

                const halfW = (target.dims?.w || 0) / 2;
                const halfH = (target.dims?.h || 0) / 2;
                const halfD = (target.dims?.d || 0) / 2;
                const box = new THREE.Box3(
                    new THREE.Vector3(-halfW, -halfH, -halfD),
                    new THREE.Vector3(halfW, halfH, halfD)
                );

                const intersection = localRay.intersectBox(box, new THREE.Vector3());
                if (intersection) {
                    const dist = rayOriginLocal.distanceTo(intersection);
                    if (dist < minDistance && dist > 0.1) {
                        minDistance = dist;
                        bestHit = { target, point: intersection, dist };
                    }
                }
            });

            if (bestHit) {
                const worldHit = bestHit.point.clone().applyQuaternion(bestHit.target.worldQuat).add(bestHit.target.worldPos);
                const up = new THREE.Vector3(0, 1, 0);
                const targetUp = holeWorldNormal.clone().negate();
                const q = new THREE.Quaternion().setFromUnitVectors(up, targetUp);
                const euler = new THREE.Euler().setFromQuaternion(q);

                newStandoffs.push({
                    id: generateObjectId("standoff"),
                    type: "standoff",
                    name: "Standoff",
                    pos: worldHit.toArray(),
                    rot: [euler.x, euler.y, euler.z],
                    height: minDistance,
                    outerDiameter: 6,
                    holeDiameter: 3,
                    baseHeight: 3,
                    baseDiameter: 10,
                    dims: { w: 6, h: minDistance, d: 6 }
                });
            }
        });

        if (newStandoffs.length > 0) {
            setObjects(prev => [...prev, ...newStandoffs]);
            showToast({ type: "success", text: `Generated ${newStandoffs.length} standoffs.`, ttl: 2000 });

        } else {
            showToast({ type: "warning", text: "No target parts found below holes.", ttl: 2000 });
        }

    }, [selectedObject, expandedObjects, setObjects, showToast]);

    const handleDrillClick = useCallback((faceInfo) => {
        // Use ghost position if available (snapped), otherwise click point
        // Need access to drillGhost state
        // drillGhost is state in this hook.
        // But we need 'drillGhost' value inside this callback.
        // 'drillGhost' is in scope.

        const targetPoint = drillGhost?.snapped ? drillGhost.position : (faceInfo.point || [0, 0, 0]);

        if (!targetPoint) return;

        const obj = expandedObjects.find((o) => o.id === faceInfo.partId);
        if (!obj) return;

        const worldP = new THREE.Vector3(...targetPoint);
        const pos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));

        let invQ;
        if (faceInfo.quaternion) {
            const worldQ = new THREE.Quaternion(...faceInfo.quaternion);
            invQ = worldQ.clone().invert();
        } else {
            const rot = new THREE.Euler(...(obj.rot || [0, 0, 0]));
            const q = new THREE.Quaternion().setFromEuler(rot);
            invQ = q.clone().invert();
        }

        const localP = worldP.clone().sub(pos).applyQuaternion(invQ);
        const worldNormal = new THREE.Vector3(...(faceInfo.normal || [0, 0, 1]));
        const localNormal = worldNormal.clone().applyQuaternion(invQ).normalize();

        const newHole = {
            id: `hole_${Date.now()}`,
            type: drillParams.drillType === 'nut' ? 'nut' : 'counterbore',
            diameter: drillParams.drillType === 'nut' ? (drillParams.nutDiameter || 6) : drillParams.holeDiameter,
            position: localP.toArray(),
            direction: localNormal.toArray(),
            depth: drillParams.drillType === 'nut' ? (drillParams.nutDepth || 2.5) : drillParams.holeDepth,
            headDiameter: drillParams.headDiameter,
            headDepth: drillParams.headDepth,
        };

        setObjects((prev) =>
            prev.map((o) => {
                if (o.id === obj.id) {
                    return {
                        ...o,
                        holes: [...(o.holes || []), newHole],
                    };
                }
                return o;
            })
        );

        showToast({
            type: "success",
            text: "Hole drilled!",
            ttl: 2000,
        });
    }, [drillGhost, expandedObjects, drillParams, setObjects, showToast]);

    return {
        drillGhost,
        setDrillGhost,
        drillCandidates,
        setDrillCandidates,
        handleDrillHover,
        handleDrillClick,
        handleHoleDelete,
        handleGenerateStandoffs,
        drillDebugIds
    };
}

