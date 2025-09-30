// components/Meshes.jsx — MotherboardMesh / PartBox
import React from "react";
import * as THREE from "three";

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

export function GroupMesh({ obj, selected }) {
  return (
    <group userData={{ objectId: obj.id }}>
      {/* 可选：渲染一个半透明的包围盒以供选择 */}
      <mesh>
        {/* 修复 Z-fighting：让包围盒比内容物稍大一点点，避免表面重叠闪烁 */}
        <boxGeometry
          args={[
            toMeters(obj.dims.w + 0.1),
            toMeters(obj.dims.h + 0.1),
            toMeters(obj.dims.d + 0.1),
          ]}
        />
        <meshStandardMaterial color={selected ? "#ef4444" : "#4f46e5"} transparent opacity={selected ? 0.2 : 0.1} />
      </mesh>
      {/* 渲染子物件 */}
      {obj.children.map((child) => {
        // 修复：之前错误地将 dims 也用 pos 覆盖了
        // 正确的做法是只转换 pos，保持 dims 不变
        const childInMeters = { ...child, pos: child.pos.map(toMeters) }; // dims 保持毫米单位
        return <PartBox key={child.id} obj={childInMeters} selected={false} />;
      })}
    </group>
  );
}

export function PartBox({ obj, selected }) {
  const { dims, color, type } = obj;
  const defaultColor = type === "structure" ? "#d1d5db" : "#ffaa44";
  // PartBox 接收米为单位的 pos 和毫米为单位的 dims
  return (
    <mesh userData={{ objectId: obj.id }} position={obj.pos}>
      <boxGeometry args={[toMeters(dims.w), toMeters(dims.h), toMeters(dims.d)]} />
      {/* 修复：将实体零件改为不透明，以解决透明物体排序导致的渲染问题 (Z-fighting/flickering) */}
      <meshStandardMaterial
        color={selected ? "#ef4444" : color || defaultColor}
        opacity={1}
        transparent={false}
      />
    </mesh>
  );
}
