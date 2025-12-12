import React, { useRef } from "react";
import * as THREE from "three";
import { applyConnectorRaycastBias } from "../utils/interactionUtils";

// If applyConnectorRaycastBias wasn't found (it was inside MovablePart), 
// we'll need to extract it to utils/raycastUtils.js or similar.
// For now, I'll allow this import assuming I will create it or it exists.
// Wait, looking at file outline, it was defined locally in MovablePart.
// I should probably put it in `src/utils/editorGeometry.js` or similar if appropriate.
// Let's assume it will be in `../utils/editorGeometry`.

// Redefine locally or import. Ideally import.
// I will check if applyConnectorRaycastBias is complex. It's small.
// I'll put it in `src/utils/interactionUtils.js` for now along with the component if needed, 
// but better to stick to a proper utils file. 
// I will create `src/utils/interactionUtils.js` for these helpers.

// Re-implementing simplified version since I can't see the util file right now:
const CONNECTOR_TYPE_COLORS = {
    "screw-m3": "#38bdf8",
    "screw-m4": "#f97316",
    "pcie-slot": "#f87171",
    "pcie-fingers": "#22d3ee",
    "dimm-slot": "#facc15",
    "dimm-edge": "#fbbf24",
    "bracket-tab": "#a855f7",
};

export function getConnectorBaseColor(connector) {
    if (connector.type && CONNECTOR_TYPE_COLORS[connector.type]) {
        return CONNECTOR_TYPE_COLORS[connector.type];
    }
    return connector.gender === "male" ? "#60a5fa" : "#a3e635";
}

export default function ConnectorMarker({ connector, isUsed, onPick, setConnectorHovered }) {
    const meshRef = useRef();

    // Debug flag for connector interactions
    const DEBUG_CONNECTOR = false;

    const handlePointerEnter = (event) => {
        event.stopPropagation();
        if (DEBUG_CONNECTOR) console.log('Connector Enter:', connector.id);
        document.body.style.cursor = "crosshair";
        setConnectorHovered(true);
        meshRef.current.material.color.set("#ffffff");
    };

    const handlePointerLeave = (event) => {
        event.stopPropagation();
        if (DEBUG_CONNECTOR) console.log('Connector Leave:', connector.id);
        document.body.style.cursor = "default";
        setConnectorHovered(false);
        meshRef.current.material.color.set(getConnectorBaseColor(connector));
    };

    const handlePointerDown = (event) => {
        event.stopPropagation();
        if (DEBUG_CONNECTOR) console.log('Connector Click:', connector.id);
        onPick?.(connector);
    };

    // Visuals for connector
    const size = 6;
    const color = getConnectorBaseColor(connector);

    // Position/Rotation from connector data
    // Presets use 'pos' (array), but some might use 'position'
    const posVal = connector.pos || connector.position || [0, 0, 0];
    const pos = Array.isArray(posVal) ? new THREE.Vector3(...posVal) : posVal;

    // Direction/Normal
    // Presets use 'normal' (array), logic uses 'direction'
    const dirVal = connector.normal || connector.direction || [0, 0, 1];
    const dir = new THREE.Vector3(...dirVal).normalize();

    // Quaternion to align Z with direction
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

    return (
        <mesh
            ref={meshRef}
            position={pos}
            quaternion={q}
            renderOrder={999}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
            raycast={(raycaster, intersects) =>
                applyConnectorRaycastBias(meshRef.current, raycaster, intersects)
            }
        >
            <sphereGeometry args={[size / 2, 16, 16]} />
            <meshBasicMaterial
                color={color}
                depthTest={false}
                depthWrite={false}
                transparent
                opacity={0.8}
            />
            {/* If used, maybe show visual indicator? */}
            {isUsed && (
                <meshBasicMaterial color="#4ade80" wireframe depthTest={false} depthWrite={false} />
            )}
        </mesh>
    );
}
