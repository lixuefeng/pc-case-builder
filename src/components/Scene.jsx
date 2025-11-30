import React, { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import MovablePart from "./MovablePart";
import GridPlane from "./GridPlane";
import RulerMarkers from "./RulerMarkers";
import { expandObjectsWithEmbedded } from "../utils/embeddedParts";

export default function Scene({
  objects,
  setObjects,
  selectedIds,
  onSelect,
  connections = [],
  showHorizontalGrid = true,
  alignMode = false,
  onFacePick,
  onConnectorPick,
  activeAlignFace = null,
  transformMode = "translate",
  onChangeTransformMode,
  showTransformControls = false,
  measurements = [],
  onDrillHover,
  drillGhost,
  drillCandidates = [],
  onHoleDelete,
  rulerPoints = [],
}) {
  const orbitRef = useRef();
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [gizmoHovered, setGizmoHovered] = useState(false);
  const [connectorHovered, setConnectorHovered] = useState(false);

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

  const renderObjects = useMemo(() => expandObjectsWithEmbedded(objects), [objects]);

  const alignmentCandidates = useMemo(() => {
    const result = [];
    
    const traverse = (obj, parentWorldPos = null, parentWorldQuat = null, visited = new Set()) => {
      // Safety checks
      if (!obj || !obj.id) return;
      if (visited.has(obj.id)) {
        // Circular reference detected, skip to prevent infinite loop
        console.warn(`Circular reference detected for object ${obj.id}, skipping`);
        return;
      }
      visited.add(obj.id);
      
      // Calculate world transform for current object
      let worldPos, worldQuat, worldRot;

      if (parentWorldPos && parentWorldQuat) {
        // It's a child
        const localPos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
        const localEuler = new THREE.Euler(...(obj.rot || [0, 0, 0]), 'XYZ');
        const localQuat = new THREE.Quaternion().setFromEuler(localEuler);

        // World Pos = ParentPos + (LocalPos rotated by ParentQuat)
        worldPos = parentWorldPos.clone().add(localPos.applyQuaternion(parentWorldQuat));
        
        // World Quat = ParentQuat * LocalQuat
        worldQuat = parentWorldQuat.clone().multiply(localQuat);
        const e = new THREE.Euler().setFromQuaternion(worldQuat, 'XYZ');
        worldRot = [e.x, e.y, e.z];
      } else {
        // It's a root object
        worldPos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
        const e = new THREE.Euler(...(obj.rot || [0, 0, 0]), 'XYZ');
        worldQuat = new THREE.Quaternion().setFromEuler(e);
        worldRot = obj.rot || [0, 0, 0];
      }

      // Add to result (as a virtual object with world transform)
      // We preserve the ID so MovablePart can identify it.
      // We also need dims and type for alignment logic.
      result.push({
        ...obj,
        pos: worldPos.toArray(),
        rot: worldRot,
        // If it's a group, we might still want to align to its bounding box? 
        // Or just its children?
        // If we align to group, we use the group's dims/pos.
        // If we align to children, we use children's dims/pos.
        // Let's include both.
      });

      if (Array.isArray(obj.children)) {
        obj.children.forEach(child => {
          if (child && child.id) {
            traverse(child, worldPos, worldQuat, visited);
          }
        });
      }
    };

    renderObjects.forEach(obj => {
      if (obj && obj.id) {
        traverse(obj); // Each root object gets its own visited set
      }
    });
    return result;
  }, [renderObjects]);

  const gridOffset = useMemo(() => {
    const objectMinY = renderObjects.reduce((min, obj) => {
      if (!obj?.dims || !Array.isArray(obj.pos)) return min;
      const height = Number(obj.dims.h) || 0;
      const posY = Number(obj.pos[1]) || 0;
      return Math.min(min, posY - height / 2);
    }, 0);

    return Math.min(0, objectMinY);
  }, [renderObjects]);

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
        <GridPlane
          size={1000}
          divisions={100}
          showHorizontalGrid={showHorizontalGrid}
          offsetY={gridOffset}
        />
        {renderObjects.map((obj) => obj.visible !== false && (
          <MovablePart
            key={obj.id}
            obj={obj}
            selected={selectedIds.includes(obj.id)}
            setObj={(updater) => {
              if (obj.embeddedParentId) return;
              setObjects((prev) =>
                prev.map((o) =>
                  o.id === obj.id
                    ? typeof updater === "function"
                      ? updater(o)
                      : updater
                    : o
                )
              );
            }}
            onSelect={onSelect}
            allObjects={alignmentCandidates}
            setDragging={setIsDragging}
            connections={connections}
            alignMode={alignMode}
            onFacePick={onFacePick}
            onConnectorPick={onConnectorPick}
            activeAlignFace={activeAlignFace}
            mode={transformMode}
            onModeChange={onChangeTransformMode}
            showTransformControls={showTransformControls}
            gizmoHovered={gizmoHovered}
            setGizmoHovered={setGizmoHovered}
            connectorHovered={connectorHovered}
            setConnectorHovered={setConnectorHovered}
            onDrillHover={onDrillHover}
            onHoleDelete={onHoleDelete}
          />
        ))}
        <RulerMarkers measurements={measurements} />

        {/* Drill Ghost */}
        {transformMode === "drill" && drillGhost && (
          <mesh position={drillGhost.position} raycast={() => null}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color={drillGhost.snapped ? "#10b981" : "#ef4444"} transparent opacity={0.8} depthTest={false} />
          </mesh>
        )}

        {/* Drill Candidates (Blue Markers) */}
        {transformMode === "drill" && drillCandidates.map((cand, i) => (
          <mesh key={i} position={cand} raycast={() => null}>
            <sphereGeometry args={[1.5, 16, 16]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} depthTest={false} />
          </mesh>
        ))}

        {/* Ruler Visualization */}
        {transformMode === "ruler" && rulerPoints.length > 0 && (
          <>
            {rulerPoints.map((p, i) => (
              <mesh key={i} position={p}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial color="#ef4444" depthTest={false} />
              </mesh>
            ))}
            {rulerPoints.length === 2 && (
               <Line
                  points={rulerPoints}
                  color="#ef4444"
                  lineWidth={2}
                  depthTest={false}
               />
            )}
          </>
        )}

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
