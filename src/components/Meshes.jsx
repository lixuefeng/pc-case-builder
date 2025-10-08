// components/Meshes.jsx — MotherboardMesh / PartBox
import React, { useMemo } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

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

// Base64 解码工具
const base64ToArrayBuffer = (base64) => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

export function ImportedMesh({ obj, selected }) {
  const geometry = useMemo(() => {
    if (!obj.meta?.geometryBase64) return null;
    try {
      const buffer = base64ToArrayBuffer(obj.meta.geometryBase64);
      const loader = new STLLoader();
      const geom = loader.parse(buffer);

      // 重要：将几何体中心移动到原点
      // STLLoader 加载的模型可能自带偏移，我们需要将其归零，
      // 因为我们的位置控制是基于物体中心在 (0,0,0) 的假设。
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
    // 如果几何体加载失败，显示一个红色错误盒子
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
        color={selected ? "#60a5fa" : "#94a3b8"}
        metalness={0.3}
        roughness={0.6}
      />
    </mesh>
  );
}
