import { useState, useCallback } from "react";
import * as THREE from "three";
import { useToast } from "../context/ToastContext";
import { computeConnectorTransform, getConnectorLabel } from "../utils/editorGeometry";
import { formatPartName, generateObjectId } from "../utils/objectUtils";

export function useConnectors({ objects, setObjects, selectedIds, setSelectedIds, setConnections }) {
    const { showToast } = useToast();
    const [activeConnectorId, setActiveConnectorId] = useState(null);
    const [pendingConnector, setPendingConnector] = useState(null);

    const selectedObject = objects.find((o) => o.id === selectedIds[selectedIds.length - 1]);

    const handleConnectorPick = useCallback(
        ({ partId, connectorId }) => {
            if (!partId || !connectorId) {
                return;
            }
            const currentObj = objects.find((obj) => obj.id === partId);
            if (!currentObj) {
                return;
            }

            if (!pendingConnector) {
                setPendingConnector({ partId, connectorId });
                setSelectedIds([partId]);
                showToast({
                    type: "info",
                    text: `已选中 ${formatPartName(currentObj)} (移动部件)。请选择目标连接点。`,
                    ttl: 4000,
                });
                return;
            }

            if (
                pendingConnector.partId === partId &&
                pendingConnector.connectorId === connectorId
            ) {
                setPendingConnector(null);
                showToast(null);
                return;
            }

            const movingObj = objects.find((obj) => obj.id === pendingConnector.partId);
            const anchorObj = objects.find((obj) => obj.id === partId);

            if (!anchorObj || !movingObj) {
                setPendingConnector(null);
                return;
            }
            if (anchorObj.id === movingObj.id) {
                showToast({
                    type: "warning",
                    text: "请选择不同零件的连接点。",
                    ttl: 2000,
                });
                setPendingConnector(null);
                return;
            }

            const movingTransform = computeConnectorTransform(
                movingObj,
                pendingConnector.connectorId
            );
            const anchorTransform = computeConnectorTransform(anchorObj, connectorId);

            if (!anchorTransform || !movingTransform) {
                setPendingConnector(null);
                return;
            }

            const targetNormal = anchorTransform.worldNormal.clone().multiplyScalar(-1);
            const normalRotation = new THREE.Quaternion().setFromUnitVectors(
                movingTransform.worldNormal.clone(),
                targetNormal
            );
            const rotatedUp = movingTransform.worldUp.clone().applyQuaternion(normalRotation);
            const anchorUpProjected = anchorTransform.worldUp
                .clone()
                .projectOnPlane(anchorTransform.worldNormal);
            const rotatedUpProjected = rotatedUp
                .clone()
                .projectOnPlane(anchorTransform.worldNormal);
            if (anchorUpProjected.lengthSq() < 1e-6) {
                anchorUpProjected.copy(anchorTransform.worldUp);
            }
            if (rotatedUpProjected.lengthSq() < 1e-6) {
                rotatedUpProjected.copy(rotatedUp);
            }
            anchorUpProjected.normalize();
            rotatedUpProjected.normalize();

            const twistNumerator = anchorTransform.worldNormal
                .clone()
                .dot(rotatedUpProjected.clone().cross(anchorUpProjected));
            const twistDenominator = rotatedUpProjected.dot(anchorUpProjected);
            const twistAngle = Math.atan2(twistNumerator, twistDenominator);
            const twistQuat = new THREE.Quaternion().setFromAxisAngle(
                anchorTransform.worldNormal,
                twistAngle
            );
            const totalRotation = twistQuat.multiply(normalRotation);
            const nextQuat = totalRotation.clone().multiply(movingTransform.quaternion);
            const nextEuler = new THREE.Euler().setFromQuaternion(nextQuat, "XYZ");

            const rotatedLocalPos = movingTransform.localPos.clone().applyQuaternion(nextQuat);
            const targetPos = anchorTransform.worldCenter.clone().sub(rotatedLocalPos);

            setObjects((prev) =>
                prev.map((obj) =>
                    obj.id === movingObj.id
                        ? {
                            ...obj,
                            pos: [targetPos.x, targetPos.y, targetPos.z],
                            rot: [nextEuler.x, nextEuler.y, nextEuler.z],
                        }
                        : obj
                )
            );
            setSelectedIds([movingObj.id]);
            setPendingConnector(null);
            showToast({
                type: "success",
                text: `已将 ${formatPartName(movingObj)} 连接到 ${formatPartName(anchorObj)}`,
            });
        },
        [
            objects,
            pendingConnector,
            showToast,
            setObjects,
            setSelectedIds,
        ]
    );

    const handleApplyConnectorOrientation = useCallback(
        (connectorId, normal, up) => {
            if (!selectedObject) {
                return;
            }
            setObjects((prev) =>
                prev.map((obj) => {
                    if (obj.id !== selectedObject.id) {
                        return obj;
                    }
                    const nextConnectors = (obj.connectors || []).map((connector) =>
                        connector?.id === connectorId ? { ...connector, normal, up } : connector
                    );
                    return { ...obj, connectors: nextConnectors };
                })
            );
            showToast({
                type: "info",
                text: `Updated ${getConnectorLabel(selectedObject, connectorId)} orientation.`,
                ttl: 2000,
            });
        },
        [selectedObject, showToast, setObjects]
    );

    const handleConnect = useCallback((typeArg) => {
        if (selectedIds.length !== 2) {
            return;
        }
        const partA = objects.find(o => o.id === selectedIds[0]);
        const partB = objects.find(o => o.id === selectedIds[1]);
        if (!partA || !partB) {
            return;
        }

        let type = typeArg;
        if (!type) {
            type = window.prompt("Enter connection type (half-lap, external-plate, blind-joint, cross-lap, shear-boss):", "half-lap");
        }
        if (!type) return;

        const newConnection = {
            id: generateObjectId("conn"),
            type: type,
            partA: partA.id,
            partB: partB.id,
            params: {}
        };

        setConnections(prev => {
            const next = [...prev, newConnection];
            return next;
        });
        showToast({ type: "success", text: `Created ${type} connection.`, ttl: 2000 });

    }, [selectedIds, objects, setConnections, showToast]);

    return {
        activeConnectorId,
        setActiveConnectorId,
        pendingConnector,
        setPendingConnector, // Exporting setter in case we need to clear it from outside?
        handleConnectorPick,
        handleApplyConnectorOrientation,
        handleConnect
    };
}
