import React, { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import MovablePart from "./MovablePart";
import GridPlane from "./GridPlane";

export default function Scene({ objects, setObjects, selectedId, setSelectedId, snap }) {
  const orbitRef = useRef();
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 全局监听 Alt 键，仅在按住 Alt 时允许调整视角
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
      camera={{ position: [0.45, 0.28, 0.85], fov: 55 }} 
      onPointerMissed={() => setSelectedId(null)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, 2, 1]} intensity={1} />
      <group ref={(ref) => (window.__lastThreeRoot = ref)}>
        <GridPlane size={1000} divisions={25} />
        {objects.map((obj) => obj.visible && (
          <MovablePart
            key={obj.id}
            obj={obj}
            selected={selectedId === obj.id}
            setObj={(updater) => setObjects((prev) => prev.map((o) => (o.id === obj.id ? (typeof updater === "function" ? updater(o) : updater) : o)))}
            onSelect={setSelectedId}
            snap={snap}
            allObjects={objects}
            onAlign={handleAlign}
            setDragging={setIsDragging}
          />
        ))}
      </group>
      <OrbitControls ref={orbitRef} enabled={isAltPressed && !isDragging} />
    </Canvas>
  );
}