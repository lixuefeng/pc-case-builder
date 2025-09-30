// components/Meshes.jsx — MotherboardMesh / PartBox
import React from "react";

const toMeters = (mm) => mm / 1000;

export function MotherboardMesh({ obj, selected }) {
  const { dims, color, meta } = obj;
  const holeMap = Array.isArray(meta?.holeMap) ? meta.holeMap : [];
  return (
    <group>
      <mesh userData={{ objectId: obj.id }}>
        <boxGeometry args={[toMeters(dims.w), toMeters(dims.h), toMeters(dims.d)]} />
        <meshStandardMaterial
          color={selected ? "#ef4444" : color || "#81a1c1"}
          opacity={0.95}
          transparent
        />
      </mesh>

      {/* ITX/M-ATX/ATX 螺丝孔标记：映射到顶面本地坐标 */}
      {holeMap.length > 0 && (
        <group position={[0, toMeters(dims.h / 2), 0]}>
          {holeMap.map(([x, z], i) => (
            <mesh
              key={i}
              position={[toMeters(x - dims.w / 2), 0, toMeters(z - dims.d / 2)]}
            >
              <cylinderGeometry args={[toMeters(1.6), toMeters(1.6), toMeters(1.2), 24]} />
              <meshStandardMaterial color="#202020" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export function PartBox({ obj, selected }) {
  const { dims, color, type } = obj;
  const defaultColor = type === "structure" ? "#d1d5db" : "#ffaa44";
  return (
    <mesh userData={{ objectId: obj.id }}>
      <boxGeometry args={[toMeters(dims.w), toMeters(dims.h), toMeters(dims.d)]} />
      <meshStandardMaterial
        color={selected ? "#ef4444" : color || defaultColor}
        opacity={0.95}
        transparent
      />
    </mesh>
  );
}
