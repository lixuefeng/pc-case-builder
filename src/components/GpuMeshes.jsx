import React, { useMemo } from "react";
import * as THREE from "three";
import { anchorPoint, addVec } from "../utils/anchors";

const requireParam = (value, name) => {
  if (value === undefined || value === null) {
    throw new Error(`Missing GPU parameter: ${name}`);
  }
  return value;
};

const buildPcieBracketGeometry = (width, height) => {
  const spec = {
    thickness: 1.6,
    width,
    height,
  };

  const x0 = -spec.width / 2;
  const x1 = spec.width / 2;
  const yBottom = 0;
  const yTop = spec.height;

  const shape = new THREE.Shape();
  shape.moveTo(x0, yBottom);
  shape.lineTo(x1, yBottom);
  shape.lineTo(x1, yTop);
  shape.lineTo(x0, yTop);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: spec.thickness,
    bevelEnabled: false,
    curveSegments: 16,
  });

  geo.translate(-spec.thickness / 2, 0, 0);

  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2;

  geo.translate(-cx, -b.min.y, -cz);
  geo.computeVertexNormals();
  return geo;
};

export function GPUBracketMesh({ obj, selected }) {
  const { dims } = obj;
  // Anchor at GPU's top-left-back for human-friendly positioning
  // Match previous placement (~x=-2, y=-h/2, z=0) by offsetting from the anchor.
  const anchor = anchorPoint(obj.meta?.anchorBaseDims ?? dims, "top-left-back");
  const bracketOffset = [dims.w / 2 - 2, -dims.h, dims.d / 2];
  const bracketPos = addVec(anchor, bracketOffset);

  const bracketGeometry = useMemo(
    () => buildPcieBracketGeometry(dims.d, dims.h),
    [dims.d, dims.h]
  );

  return (
    <group userData={{ objectId: obj.id }}>
      {bracketGeometry && (
        <mesh
          geometry={bracketGeometry}
          position={bracketPos}
          rotation={[0, Math.PI / 2, 0]}
        >
          <meshStandardMaterial
            color={selected ? "#ef4444" : "#9ca3af"}
            metalness={0.55}
            roughness={0.32}
          />
        </mesh>
      )}
    </group>
  );
}

export function GPUMesh({ obj, selected }) {
  const { dims, color, meta = {} } = obj;
  const coolerColor = selected ? "#ef4444" : color || "#475569";
  // Anchor choices: top-left-back for bracket, bottom-left-back for fingers (PCB side)
  const bottomLeftBack = useMemo(() => anchorPoint(dims, "bottom-left-back"), [dims]);

  const pcie = meta.pcie || {};
  const fingersLength = requireParam(pcie.fingerLength, "meta.pcie.fingerLength");
  const fingersHeight = requireParam(pcie.fingerHeight, "meta.pcie.fingerHeight");
  const fingersThickness = requireParam(pcie.fingerThickness, "meta.pcie.fingerThickness");
  const fingerOffsetFromBracket = requireParam(
    pcie.fingerOffsetFromBracket,
    "meta.pcie.fingerOffsetFromBracket"
  );
  const fingerDrop = requireParam(pcie.fingerDrop, "meta.pcie.fingerDrop");

  // Place gold fingers relative to bottom-left-back anchor (PCB side)
  const fingersPos = addVec(bottomLeftBack, [
    fingersLength / 2 + fingerOffsetFromBracket, // move right from the left edge
    -fingersHeight / 2 + fingerDrop, // drop below the PCB plane
    3, // 3mm from the "back" (PCB) face
  ]);

  return (
    <group userData={{ objectId: obj.id }}>
      <mesh>
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial
          color={coolerColor}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      <mesh position={fingersPos}>
        <boxGeometry args={[fingersLength, fingersHeight, fingersThickness]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}
