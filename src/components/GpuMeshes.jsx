import React, { useMemo } from "react";
import * as THREE from "three";
import { buildGpuFingerPlacement } from "../utils/gpuPcieSpec";
import { GPU_BRACKET_SPEC } from "../utils/gpuBracketSpec";

const buildPcieBracketGeometry = ({ width, height, thickness }) => {
  const x0 = -width / 2;
  const x1 = width / 2;
  const yBottom = 0;
  const yTop = height;

  const shape = new THREE.Shape();
  shape.moveTo(x0, yBottom);
  shape.lineTo(x1, yBottom);
  shape.lineTo(x1, yTop);
  shape.lineTo(x0, yTop);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 16,
  });

  geo.translate(-thickness / 2, 0, 0);

  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const cx = (b.min.x + b.max.x) / 2;
  const cy = (b.min.y + b.max.y) / 2;
  const cz = (b.min.z + b.max.z) / 2;

  geo.translate(-cx, -cy, -cz);
  geo.computeVertexNormals();
  return geo;
};

export function GPUBracketMesh({ obj, selected, selectionOrder, selectedCount }) {

  const bracketGeometry = useMemo(
    () =>
      buildPcieBracketGeometry({
        width: GPU_BRACKET_SPEC.width,
        height: GPU_BRACKET_SPEC.height,
        thickness: GPU_BRACKET_SPEC.thickness,
      }),
    []
  );

  return (
    <group userData={{ objectId: obj.id }}>
      {bracketGeometry && (
        <mesh
          geometry={bracketGeometry}
          rotation={[0, Math.PI / 2, 0]}
        >
          <meshStandardMaterial
            color={selected ? (selectedCount > 2 ? "#ef4444" : (selectionOrder === 0 ? "#ef4444" : (selectionOrder === 1 ? "#eab308" : "#ef4444"))) : "#9ca3af"}
            metalness={0.55}
            roughness={0.32}
            opacity={selected ? 0.7 : 1}
            transparent={selected}
          />
        </mesh>
      )}
    </group>
  );
}

export function GPUMesh({ obj, selected, selectionOrder, selectedCount }) {
  const { dims, color, meta = {} } = obj;
  const BODY_LENGTH = 265; // mm
  const coolerColor = selected ? (selectedCount > 2 ? "#ef4444" : (selectionOrder === 0 ? "#ef4444" : (selectionOrder === 1 ? "#eab308" : "#ef4444"))) : color || "#475569";

  const fingerPlacement = useMemo(
    () => buildGpuFingerPlacement({ dims, pcie: meta.pcie || {} }),
    [dims, meta.pcie]
  );

  return (
    <group userData={{ objectId: obj.id }}>
      <mesh>
        <boxGeometry args={[BODY_LENGTH, dims.h, dims.d]} />
        <meshStandardMaterial
          color={coolerColor}
          metalness={0.6}
          roughness={0.4}
          opacity={selected ? 0.7 : 1}
          transparent={true}
        />
      </mesh>

      <mesh position={fingerPlacement.center}>
        <boxGeometry
          args={[
            fingerPlacement.length,
            fingerPlacement.height,
            fingerPlacement.thickness,
          ]}
        />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}
