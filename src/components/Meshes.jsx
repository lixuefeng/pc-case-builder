// components/Meshes.jsx — MotherboardMesh / PartBox
import React from "react";
import * as THREE from "three";

export function MotherboardMesh({ obj, selected }) {
  const { dims, color, meta } = obj;
  const holeMap = Array.isArray(meta?.holeMap) ? meta.holeMap : [];
  return (
    <group>
      <mesh userData={{ objectId: obj.id }}>
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial
          color={selected ? "#ef4444" : color || "#81a1c1"}
          opacity={0.95}
          transparent
        />
      </mesh>

      {/* ITX/M-ATX/ATX 螺丝孔标记：映射到顶面本地坐标 */}
      {holeMap.length > 0 && (
        <group position={[0, dims.h / 2, 0]}>
          {holeMap.map(([x, z], i) => (
            <mesh
              key={i}
              position={[x - dims.w / 2, 0, z - dims.d / 2]}
            >
              <cylinderGeometry args={[1.6, 1.6, 1.2, 24]} />
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
            obj.dims.w + 0.1,
            obj.dims.h + 0.1,
            obj.dims.d + 0.1,
          ]}
        />
        <meshStandardMaterial color={selected ? "#ef4444" : "#4f46e5"} transparent opacity={selected ? 0.2 : 0.1} />
      </mesh>
      {/* 渲染子物件 */}
      {obj.children.map((child) => {
        // 在 GroupMesh 内部，为每个子物件创建一个 group 来应用其相对位置
        return (
          <group key={child.id} position={child.pos}>
            <PartBox obj={child} selected={false} />
          </group>
        );
      })}
    </group>
  );
}

export function PartBox({ obj, selected }) {
  const { dims, color, type } = obj;
  const defaultColor = type === "structure" ? "#d1d5db" : "#ffaa44";
  // PartBox 只在自己的原点 [0,0,0] 渲染一个 mesh，位置由父组件控制
  return (
    <mesh userData={{ objectId: obj.id }}>
      <boxGeometry args={[dims.w, dims.h, dims.d]} />
      {/* 修复：将实体零件改为不透明，以解决透明物体排序导致的渲染问题 (Z-fighting/flickering) */}
      <meshStandardMaterial
        color={selected ? "#ef4444" : color || defaultColor}
        opacity={1}
        transparent={false}
      />
    </mesh>
  );
}
