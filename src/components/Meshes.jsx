import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { GPUBracketMesh, GPUMesh } from "./GpuMeshes";
import { anchorPoint, addVec } from "../utils/anchors";

import { Geometry, Base, Subtraction } from "@react-three/csg";
import { COLORS, COOLER_SPECS, REFERENCE_OBJECT_SPECS, MOTHERBOARD_SPECS } from "../constants";
export { GPUBracketMesh, GPUMesh } from "./GpuMeshes";

export function MotherboardMesh({ obj, selected, selectionOrder, selectedCount }) {
  const { dims, color, meta } = obj;
  const holeMap = Array.isArray(meta?.holeMap) ? meta.holeMap : [];
  const topLeftBack = useMemo(() => anchorPoint(dims, "top-left-back"), [dims]);
  const selColor = selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : null;

  return (
    <group>
      <mesh userData={{ objectId: obj.id }}>
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial
          color={selColor || color || COLORS.DEFAULT.MOTHERBOARD}
          opacity={selected ? 0.7 : 0.95}
          transparent
        />
      </mesh>

      {holeMap.length > 0 && (
        <group position={[0, dims.h / 2, 0]}>
          {holeMap.map(([x, z], i) => (
            <mesh
              key={i}
              position={addVec(topLeftBack, [x, -dims.h / 2, z])}
            >
              <cylinderGeometry args={[1.6, 1.6, 1.2, 24]} />
              <meshStandardMaterial color={COLORS.DEFAULT.MOTHERBOARD_HOLE} />
            </mesh>
          ))}
        </group>
      )}

      {/* Additional motherboard features are rendered as embedded parts */}
    </group>
  );
}

export function ChildMeshRenderer({ obj }) {
  switch (obj.type) {
    case "gpu-body":
      return <GPUMesh obj={obj} selected={false} />;
    case "gpu-bracket":
      return <GPUBracketMesh obj={obj} selected={false} />;
    case "cube":
      return <PartBox obj={obj} selected={false} />;
    case "cylinder":
      return <CylinderMesh obj={obj} selected={false} />;
    case "io-shield":
      console.log("[ChildMeshRenderer] Rendering io-shield", obj.id);
      return <IOShieldMesh obj={obj} selected={false} />;
    case "cone":
      // Re-using CylinderMesh for now, but we might want a dedicated ConeMesh later
      // For now, CylinderMesh uses cylinderGeometry which supports radiusTop/Bottom
      // But CylinderMesh hardcodes args... let's fix CylinderMesh first or make a ConeMesh
      return <CylinderMesh obj={obj} selected={false} />;
    case "structure":
      // Legacy support
      if (obj.meta?.shape === "sphere") return <SphereMesh obj={obj} selected={false} />;
      if (obj.meta?.shape === "cylinder") return <CylinderMesh obj={obj} selected={false} />;
      return <PartBox obj={obj} selected={false} />;
    default:
      return <PartBox obj={obj} selected={false} />;
  }
}

export function GroupMesh({ obj, selected, selectionOrder, selectedCount }) {
  if (!obj) return null;
  const children = Array.isArray(obj.children) ? obj.children : [];

  return (
    <group userData={{ objectId: obj.id }}>
      <mesh raycast={() => null}>
        <boxGeometry
          args={[
            obj.dims.w + 0.1,
            obj.dims.h + 0.1,
            obj.dims.d + 0.1,
          ]}
        />
        <meshStandardMaterial
          color={selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : COLORS.DEFAULT.GROUP_GHOST}
          transparent
          opacity={selected ? 0.2 : 0.1}
        />
      </mesh>
      {children.map((child) => {
        if (!child || !child.id) return null;
        return (
          <group key={child.id} position={child.pos || [0, 0, 0]} rotation={child.rot || [0, 0, 0]}>
            <ChildMeshRenderer obj={child} />
          </group>
        );
      })}
    </group>
  );
}

const getRelativeTransform = (targetObj, sourceObj) => {
  const sourcePos = new THREE.Vector3(...(sourceObj.pos || [0, 0, 0]));
  const sourceRot = new THREE.Euler(...(sourceObj.rot || [0, 0, 0]));
  const sourceQuat = new THREE.Quaternion().setFromEuler(sourceRot);

  const targetPos = new THREE.Vector3(...(targetObj.pos || [0, 0, 0]));
  const targetRot = new THREE.Euler(...(targetObj.rot || [0, 0, 0]));
  const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);

  const invSourceQuat = sourceQuat.clone().invert();

  const relPos = targetPos.clone().sub(sourcePos).applyQuaternion(invSourceQuat);
  const relQuat = invSourceQuat.clone().multiply(targetQuat);
  const relEuler = new THREE.Euler().setFromQuaternion(relQuat);

  return { pos: relPos.toArray(), rot: [relEuler.x, relEuler.y, relEuler.z] };
};

export function PartBox({ obj, selected, modifiers = [], selectionOrder, selectedCount }) {
  const { dims, color, type } = obj;
  const defaultColor = (type === "structure" || type === "cube") ? COLORS.DEFAULT.STRUCTURE : COLORS.DEFAULT.GENERIC_PART;

  // Validate dimensions to prevent crashes
  if (!dims || dims.w <= 0 || dims.h <= 0 || dims.d <= 0) {
    return null;
  }

  // Use modifiers passed from parent (calculated via hook)
  const subtractingParts = modifiers;

  // Filter valid parts first to avoid passing null children to Geometry
  const validSubtractingParts = useMemo(() => {
    return subtractingParts.filter(other => {
      if (!other.relativeTransform) return false;
      const scale = other.scale || [1, 1, 1];
      // Filter out near-zero scales
      if (scale.some(s => Math.abs(s) < 0.0001)) return false;
      return true;
    });
  }, [subtractingParts]);

  return (
    <group userData={{ objectId: obj.id }}>
      <mesh>
        <Geometry computeVertexNormals>
          <Base>
            <boxGeometry args={[dims.w, dims.h, dims.d]} />
          </Base>
          {validSubtractingParts.map(other => {
            let geo = null;
            let args = [];
            if (other.type === 'cylinder') {
              args = [other.dims.w / 2, other.dims.w / 2, other.dims.h, 32];
              geo = <cylinderGeometry args={args} />;
            } else if (other.type === 'cone') {
              args = [0, other.dims.w / 2, other.dims.h, 32];
              geo = <cylinderGeometry args={args} />;
            } else {
              args = [other.dims.w, other.dims.h, other.dims.d];
              geo = <boxGeometry args={args} />;
            }

            return (
              <Subtraction
                key={other.id}
                position={other.relativeTransform.pos}
                rotation={other.relativeTransform.rot}
                scale={other.scale || [1, 1, 1]}
              >
                {geo}
              </Subtraction>
            );
          })}
        </Geometry>
        <meshStandardMaterial
          color={selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : color || defaultColor}
          opacity={selected ? 0.7 : 1}
          transparent={true}
        />
      </mesh>
    </group>
  );
}

export function SphereMesh({ obj, selected, selectionOrder, selectedCount }) {
  const { dims, color } = obj;
  return (
    <group userData={{ objectId: obj.id }}>
      <mesh scale={[dims.w, dims.h, dims.d]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : color || COLORS.DEFAULT.STRUCTURE}
          opacity={selected ? 0.7 : 1}
          transparent={true}
        />
      </mesh>
    </group>
  );
}

export function CylinderMesh({ obj, selected, selectionOrder, selectedCount }) {
  const { dims, color, type } = obj;
  const isCone = type === 'cone' || obj.meta?.shape === 'cone';

  // dims.w is diameter, dims.h is height
  // cylinderGeometry args: [radiusTop, radiusBottom, height, radialSegments]
  // We use scale to apply dimensions, so geometry should be unit size
  // Unit cylinder: radius 0.5 (diameter 1), height 1
  // Unit cone: radiusTop 0, radiusBottom 0.5, height 1

  const radiusTop = isCone ? 0 : 0.5;
  const radiusBottom = 0.5;

  return (
    <group userData={{ objectId: obj.id }}>
      <mesh scale={[dims.w, dims.h, dims.d]}>
        <cylinderGeometry args={[radiusTop, radiusBottom, 1, 32]} />
        <meshStandardMaterial
          color={selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : color || COLORS.DEFAULT.STRUCTURE}
          opacity={selected ? 0.7 : 1}
          transparent={true}
        />
      </mesh>
    </group>
  );
}

const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export function ImportedMesh({ obj, selected, selectionOrder, selectedCount }) {
  const geometry = useMemo(() => {
    if (!obj.meta?.geometryBase64) return null;
    try {
      const buffer = base64ToArrayBuffer(obj.meta.geometryBase64);
      const loader = new STLLoader();
      const geom = loader.parse(buffer);

      geom.computeBoundingBox();
      const center = new THREE.Vector3();
      geom.boundingBox.getCenter(center);
      geom.translate(-center.x, -center.y, -center.z);

      return geom;
    } catch (e) {
      console.error("Failed to parse stored STL geometry", e);
      return null;
    }
  }, [obj.meta?.geometryBase64]);

  if (!geometry) {
    return (
      <mesh>
        <boxGeometry args={[obj.dims.w || 10, obj.dims.h || 10, obj.dims.d || 10]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  }

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={selected ? (selectedCount > 2 ? COLORS.SELECTION.IMPORTED : (selectionOrder === 0 ? COLORS.SELECTION.IMPORTED : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.IMPORTED))) : COLORS.DEFAULT.IMPORTED_DEFAULT}
        metalness={0.3}
        roughness={0.6}
        opacity={selected ? 0.7 : 1}
        transparent={selected}
      />
    </mesh>
  );
}

export function ReferenceMesh({ obj, selected, selectionOrder, selectedCount }) {
  const { dims, color, key } = obj;

  // Check if it's a coke can to apply the custom shape
  // Note: obj.name is used for the display name, obj.key is the preset key
  const isCokeCan = key === "coke-can" || (obj.name && obj.name.toLowerCase().includes("coke"));

  if (isCokeCan) {
    const radius = (dims.w || REFERENCE_OBJECT_SPECS.COKE_CAN_DIAMETER) / 2;
    const height = dims.h || REFERENCE_OBJECT_SPECS.COKE_CAN_HEIGHT;
    const halfHeight = height / 2;

    // Define the profile points
    const { bottomPoints, bodyPoints, topPoints } = useMemo(() => {
      const p0 = new THREE.Vector2(0, -halfHeight);
      const p1 = new THREE.Vector2(radius * 0.7, -halfHeight);
      const p2 = new THREE.Vector2(radius * 0.75, -halfHeight + 2);
      const p3 = new THREE.Vector2(radius, -halfHeight + 10);

      const p4 = new THREE.Vector2(radius, halfHeight - 12);
      const p5 = new THREE.Vector2(radius * 0.82, halfHeight - 2);

      const p6 = new THREE.Vector2(radius * 0.82, halfHeight);
      const p7 = new THREE.Vector2(radius * 0.78, halfHeight);
      const p8 = new THREE.Vector2(0, halfHeight - 1);

      return {
        bottomPoints: [p0, p1, p2, p3],
        bodyPoints: [p3, p4, p5],
        topPoints: [p5, p6, p7, p8],
      };
    }, [radius, halfHeight]);

    const silverMaterial = (
      <meshStandardMaterial
        color={COLORS.DEFAULT.SILVER}
        metalness={0.8}
        roughness={0.2}
        opacity={selected ? 0.7 : 1}
        transparent={selected}
      />
    );

    const paintMaterial = (
      <meshStandardMaterial
        color={selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : color || COLORS.DEFAULT.RED_PAINT}
        metalness={0.6}
        roughness={0.3}
        opacity={selected ? 0.7 : 1}
        transparent={selected}
      />
    );

    return (
      <group userData={{ objectId: obj.id }}>
        {/* Bottom (Silver) */}
        <mesh>
          <latheGeometry args={[bottomPoints, 32]} />
          {silverMaterial}
        </mesh>

        {/* Body (Painted) */}
        <mesh>
          <latheGeometry args={[bodyPoints, 32]} />
          {paintMaterial}
        </mesh>

        {/* Top (Silver) */}
        <mesh>
          <latheGeometry args={[topPoints, 32]} />
          {silverMaterial}
        </mesh>
      </group>
    );
  }

  // Default cylinder for other reference objects
  const radius = (dims.w || REFERENCE_OBJECT_SPECS.COKE_CAN_DIAMETER) / 2;
  const height = dims.h || REFERENCE_OBJECT_SPECS.COKE_CAN_HEIGHT;

  return (
    <group userData={{ objectId: obj.id }}>
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 32]} />
        <meshStandardMaterial
          color={selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : color || COLORS.DEFAULT.RED_PAINT}
          metalness={0.6}
          roughness={0.3}
          opacity={selected ? 0.7 : 1}
          transparent={selected}
        />
      </mesh>
    </group>
  );
}

// ... existing imports

export function IOShieldMesh({ obj, selected, selectionOrder, selectedCount }) {
  const { dims, color } = obj;
  const { w, h, d } = dims;

  // Constants for geometry
  const recess = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_SHIELD_RECESS_DEPTH || 2.0;
  const keepout = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_KEEPOUT || 2.54;

  // Geometry Strategy: Overlapping Boxes to create a "Step" / "Rabbet"
  // Goal: "Cut away edge 2mm deep" at the Front Face (-Z).
  // Body (Center): Full Depth `d`. Represents the protruding connectors.
  // Flange (Rim): Depth `d - recess`. Shifted back so it starts 2mm deeper than Body.
  
  // 1. Body: Full Size w * h * d. Centered at 0.
  const bodyW = w;
  const bodyH = h;
  const bodyD = d;
  const bodyZ = 0; // Center of [-d/2, d/2]

  // 2. Flange: Wide w+2k * h+2k. Depth d-recess.
  // Starts at -d/2 + recess. Ends at d/2.
  // Center = (-d/2 + recess + d/2) / 2 = recess / 2.
  const flangeW = w + keepout * 2;
  const flangeH = h + keepout * 2;
  const flangeD = d - recess;
  const flangeZ = recess / 2;

  // Debug Log
  console.log(`[IOShieldMesh] Debug ${obj.id}`, {
      dims: {w, h, d},
      recess,
      body: { w: bodyW, h: bodyH, d: bodyD, z: bodyZ },
      flange: { w: flangeW, h: flangeH, d: flangeD, z: flangeZ }
  });

  const selColor = selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : null;
  const mainColor = color || "#555";
  const flangeColor = "#a3a3a3";

  return (
    <group userData={{ objectId: obj.id }}>
      {/* Main Body (Protruding Center) */}
      <mesh position={[0, 0, bodyZ]}>
        <boxGeometry args={[bodyW, bodyH, bodyD]} />
        <meshStandardMaterial
           color={selColor || mainColor}
           opacity={selected ? 0.7 : 1}
           transparent={selected}
        />
      </mesh>

      {/* Flange (Recessed Rim) - Overlaps Body but starts deeper */}
      <mesh position={[0, 0, flangeZ]}>
         <boxGeometry args={[flangeW, flangeH, flangeD]} />
         <meshStandardMaterial
            color={selColor || flangeColor}
            opacity={selected ? 0.7 : 1}
            transparent={selected}
            metalness={0.6}
            roughness={0.4}
         />
      </mesh>
    </group>
  );
}

export function CPUCoolerMesh({ obj, selected, selectionOrder }) {
  const { dims, color } = obj;
  const { w, h, d } = dims;

  // Heatsink (Silver)
  const heatsinkMaterial = (
    <meshStandardMaterial
      color={COLORS.DEFAULT.SILVER}
      metalness={0.7}
      roughness={0.3}
      opacity={selected ? 0.7 : 1}
      transparent={selected}
    />
  );

  // Fan (Black) - Simplified as a block on the front
  const fanMaterial = (
    <meshStandardMaterial
      color={COLORS.DEFAULT.FAN_BLACK}
      metalness={0.2}
      roughness={0.8}
      opacity={selected ? 0.7 : 1}
      transparent={selected}
    />
  );

  const fanDepth = COOLER_SPECS.FAN_DEPTH;
  const heatsinkDepth = Math.max(COOLER_SPECS.MIN_HEATSINK_DEPTH, d - fanDepth);

  return (
    <group userData={{ objectId: obj.id }}>
      {/* Heatsink */}
      <mesh position={[0, 0, -fanDepth / 2]}>
        <boxGeometry args={[w, h, heatsinkDepth]} />
        {heatsinkMaterial}
      </mesh>

      {/* Fan */}
      <mesh position={[0, 0, heatsinkDepth / 2]}>
        <boxGeometry args={[w, h, fanDepth]} />
        {fanMaterial}
      </mesh>
    </group>
  );
}

// Duplicate function removed.
// End of file
