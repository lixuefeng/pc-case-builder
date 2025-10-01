import React, { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import MovablePart from "./MovablePart";
import GridPlane from "./GridPlane";

export default function Scene({ objects, setObjects, selectedIds, onSelect, snap }) {
  const orbitRef = useRef();
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 修复：恢复对 Alt 键的全局监听，以控制视角
  useEffect(() => {
    const down = (e) => {
      if (e.key === "Alt") {
        e.preventDefault();
        setIsAltPressed(true);
      }
    };
    const up = (e) => {
      if (e.key === "Alt") {
        e.preventDefault();
        setIsAltPressed(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // 对齐回调函数
  const handleAlign = (alignData) => {
    console.log('对齐完成:', alignData);
    // 这里可以添加对齐完成后的处理逻辑
  };

  return (
    <Canvas 
      style={{ width: "100%", height: "100%" }} 
      camera={{
        position: [450, 280, 850],
        fov: 55,
        near: 1,
        far: 5000, // 调整相机远裁剪平面以匹配新的、更小的网格尺寸
      }}
      onPointerMissed={() => onSelect(null)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, 2, 1]} intensity={1} />
      <group ref={(ref) => (window.__lastThreeRoot = ref)}>
        <GridPlane size={1000} divisions={100} />
        {objects.map((obj) => obj.visible && (
          <MovablePart
            key={obj.id}
            obj={obj}
            selected={selectedIds.includes(obj.id)}
            setObj={(updater) => setObjects((prev) => prev.map((o) => (o.id === obj.id ? (typeof updater === "function" ? updater(o) : updater) : o)))}
            onSelect={onSelect}
            snap={snap}
            allObjects={objects}
            onAlign={handleAlign}
            setDragging={setIsDragging}
          />
        ))}
      </group>
      <OrbitControls
        ref={orbitRef}
        enabled={isAltPressed && !isDragging} // ✅ 最终修复：同时检查 Alt 键和拖拽状态
        // 修复：禁用阻尼效果，让视角旋转立即停止，感觉更“跟手”
        enableDamping={false}
      />
    </Canvas>
  );
}