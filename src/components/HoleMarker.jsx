import React, { useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { applyConnectorRaycastBias } from "../utils/interactionUtils";

export default function HoleMarker({ hole, partId, onDelete, canDelete = false, setHoveredFace, onDrillHover }) {
    const [hovered, setHovered] = useState(false);
    const headRef = useRef(null);
    const shaftRef = useRef(null);
    const position = new THREE.Vector3(...(hole.position || [0, 0, 0]));
    const direction = new THREE.Vector3(...(hole.direction || [0, 0, 1])).normalize();

    const isNut = hole.type === 'nut';

    // Specs
    const headDia = hole.headDiameter || 6;
    const headDepth = hole.headDepth || 2;
    const shaftDia = hole.diameter || 3;
    const shaftLength = hole.depth || 10;

    // Align cylinder to direction. Cylinder default is Y-axis.
    // If direction is Normal (OUT), we want the hole to go IN (along -Y in local space).
    const quaternion = useMemo(() => {
        const q = new THREE.Quaternion();
        const defaultUp = new THREE.Vector3(0, 1, 0);
        if (direction.dot(defaultUp) < -0.99) {
            // Handle opposite direction (180 deg rotation)
            q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        } else {
            q.setFromUnitVectors(defaultUp, direction);
        }
        return q;
    }, [direction]);

    const headColor = hovered && canDelete ? "#f87171" : "#ef4444";
    const shaftColor = hovered && canDelete ? "#dc2626" : "#b91c1c";
    const nutColor = hovered && canDelete ? "#fcd34d" : "#fbbf24"; // Goldish for nut
    const opacity = hovered && canDelete ? 0.9 : 0.6;

    const handlePointerEnter = (e) => {
        if (canDelete) {

            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
            setHoveredFace?.(null);
            onDrillHover?.(null);
        }
    };

    const handlePointerLeave = (e) => {
        if (canDelete) {
            e.stopPropagation();
            setHovered(false);
            document.body.style.cursor = "default";
        }
    };

    const handlePointerMove = (e) => {
        if (canDelete) {
            e.stopPropagation();
        }
    };

    const handlePointerDown = (e) => {
        if (canDelete && onDelete) {
            e.stopPropagation();
            onDelete(partId, hole.id);
        }
    };

    if (isNut) {
        const hexRadius = shaftDia / Math.sqrt(3);

        return (
            <group position={position} quaternion={quaternion}>
                <mesh
                    ref={shaftRef}
                    position={[0, -shaftLength / 2, 0]} // Center it
                    onPointerEnter={handlePointerEnter}
                    onPointerLeave={handlePointerLeave}
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerDown}
                    renderOrder={1003}
                    frustumCulled={false}
                    userData={{ isHole: true, holeId: hole.id, partId }}
                    raycast={(raycaster, intersects) =>
                        applyConnectorRaycastBias(shaftRef.current, raycaster, intersects)
                    }
                >
                    <cylinderGeometry args={[hexRadius, hexRadius, shaftLength, 6]} />
                    <meshBasicMaterial color={nutColor} transparent opacity={opacity} depthTest={false} />
                </mesh>
                <mesh position={[0, -shaftLength / 2, 0]} userData={{ noExport: true }}>
                    <cylinderGeometry args={[shaftDia * 0.3, shaftDia * 0.3, shaftLength + 0.1, 16]} />
                    <meshBasicMaterial color="#000" />
                </mesh>
            </group>
        );
    }

    return (
        <group
            position={position}
            quaternion={quaternion}
        >
            {/* Head: Goes from epsilon to -headDepth + epsilon (Top Flush / Counterbore) */}
            <mesh
                ref={headRef}
                position={[0, -headDepth / 2 + 0.02, 0]}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerDown}
                renderOrder={1002}
                frustumCulled={false}
                userData={{ isHole: true, holeId: hole.id, partId }}
                raycast={(raycaster, intersects) =>
                    applyConnectorRaycastBias(headRef.current, raycaster, intersects)
                }
            >
                <cylinderGeometry args={[headDia / 2, headDia / 2, headDepth, 32]} />
                <meshBasicMaterial color={headColor} transparent opacity={opacity} depthTest={false} />
            </mesh>
            {/* Shaft: Goes from -headDepth + epsilon to deeper */}
            <mesh
                ref={shaftRef}
                position={[0, -headDepth - shaftLength / 2 + 0.02, 0]}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerDown}
                renderOrder={1003}
                frustumCulled={false}
                userData={{ isHole: true, holeId: hole.id, partId }}
                raycast={(raycaster, intersects) =>
                    applyConnectorRaycastBias(shaftRef.current, raycaster, intersects)
                }
            >
                <cylinderGeometry args={[shaftDia / 2, shaftDia / 2, shaftLength, 32]} />
                <meshBasicMaterial color={shaftColor} transparent opacity={opacity} depthTest={false} />
            </mesh>
        </group>
    );
};
