// components/MovablePart.jsx — 选中/移动/旋转 + HUD（修复下拉被吞事件 & 旋转下高亮/吸附准确）
import React, { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { TransformControls, Html } from "@react-three/drei";
import { MotherboardMesh, PartBox, GroupMesh } from "./Meshes.jsx";

export default function MovablePart({
  obj,
  selected,
  setObj,
  onSelect,
  snap,
  palette,
  allObjects = [], // 用于面检测
  onAlign, // 可选：对齐回调
  setDragging, // 告知父组件控制 OrbitControls
}) {
  const t = palette;
  const groupRef = useRef();
  const controlsRef = useRef();
  const [mode, setMode] = useState("translate");

  // ✅ UI 锁：当在 HUD 上交互时，禁用 TransformControls + OrbitControls
  const [uiLock, setUiLock] = useState(false);

  const handleDimChange = (axis, value) => {
    const newDimValue = Number(value) || 0;
    setObj((prev) => {
      const newDims = { ...prev.dims, [axis]: newDimValue };
      // group 的子对象布局调整，暂不实现，仅更新包围盒
      return { ...prev, dims: newDims };
    });
  };

  const dragStartRef = useRef({ pos: [0, 0, 0], rot: [0, 0, 0] });
  const [delta, setDelta] = useState({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });

  // ✅ 智能对齐状态
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [bestAlignCandidate, setBestAlignCandidate] = useState(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!controlsRef.current || !groupRef.current) return;
    if (selected) controlsRef.current.attach(groupRef.current);
    else controlsRef.current.detach();
  }, [selected]);

  // ⌨️ 仅处理 Shift
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Shift') setIsShiftPressed(true); };
    const handleKeyUp = (e) => { if (e.key === 'Shift') { setIsShiftPressed(false); setBestAlignCandidate(null); } };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ===== 工具：世界位姿、轴与 OBB 投影 =====
  function getWorldTransform({ ref, obj }) {
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    if (ref?.current) {
      ref.current.getWorldPosition(p);
      ref.current.getWorldQuaternion(q);
    } else {
      p.set(obj.pos[0], obj.pos[1], obj.pos[2]);
      const e = new THREE.Euler(obj.rot[0], obj.rot[1], obj.rot[2], 'XYZ');
      q.setFromEuler(e);
    }
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    return { p, q, axes: { ax, ay, az } };
  }

  // OBB 在世界轴 a 上的投影半径
  function projectedHalfExtentAlongAxis(worldAxis, dims, axes) {
    const { ax, ay, az } = axes;
    const w2 = dims.w / 2, h2 = dims.h / 2, d2 = dims.d / 2;
    return (
      Math.abs(worldAxis.dot(ax)) * w2 +
      Math.abs(worldAxis.dot(ay)) * h2 +
      Math.abs(worldAxis.dot(az)) * d2
    );
  }

  // 计算物体在三个世界轴上的“面中心坐标”（考虑旋转后的投影半宽）
  const getObjectFaces = ({ obj, ref }) => {
    const { p, q, axes } = getWorldTransform({ ref, obj });
    const X = new THREE.Vector3(1, 0, 0);
    const Y = new THREE.Vector3(0, 1, 0);
    const Z = new THREE.Vector3(0, 0, 1);
    const hx = projectedHalfExtentAlongAxis(X, obj.dims, axes);
    const hy = projectedHalfExtentAlongAxis(Y, obj.dims, axes);
    const hz = projectedHalfExtentAlongAxis(Z, obj.dims, axes);
    return {
      X: [
        { name: '+X', coord: p.x + hx, center: new THREE.Vector3(p.x + hx, p.y, p.z), p, q },
        { name: '-X', coord: p.x - hx, center: new THREE.Vector3(p.x - hx, p.y, p.z), p, q },
      ],
      Y: [
        { name: '+Y', coord: p.y + hy, center: new THREE.Vector3(p.x, p.y + hy, p.z), p, q },
        { name: '-Y', coord: p.y - hy, center: new THREE.Vector3(p.x, p.y - hy, p.z), p, q },
      ],
      Z: [
        { name: '+Z', coord: p.z + hz, center: new THREE.Vector3(p.x, p.y, p.z + hz), p, q },
        { name: '-Z', coord: p.z - hz, center: new THREE.Vector3(p.x, p.y, p.z - hz), p, q },
      ],
    };
  };

  // === 基于“任意世界方向”的面（用于本地轴拖拽后的世界方向） ===
  function getFacesAlongDir({ obj, ref, dir }) {
    const { p, q, axes } = getWorldTransform({ ref, obj });
    const n = dir.clone().normalize();
    const half = projectedHalfExtentAlongAxis(n, obj.dims, axes);
    const centerPlus = p.clone().add(n.clone().multiplyScalar(half));
    const centerMinus = p.clone().add(n.clone().multiplyScalar(-half));
    const s = p.dot(n);
    return [
      { name: '+D', coord: s + half, center: centerPlus, p, q, n },
      { name: '-D', coord: s - half, center: centerMinus, p, q, n },
    ];
  }

  function getLocalAxisDir(tf, axisLabel) {
    if (axisLabel === 'X') return tf.axes.ax.clone();
    if (axisLabel === 'Y') return tf.axes.ay.clone();
    if (axisLabel === 'Z') return tf.axes.az.clone();
    return null;
  }

  function pickTargetBasis(targetTF, selfDir) {
    const { ax, ay, az } = targetTF.axes;
    const candidates = [
      { v: ax, label: 'X' },
      { v: ay, label: 'Y' },
      { v: az, label: 'Z' },
    ];
    let best = candidates[0], bestAbs = -1;
    for (const c of candidates) {
      const v = Math.abs(c.v.dot(selfDir));
      if (v > bestAbs) { bestAbs = v; best = c; }
    }
    return { dir: best.v.clone().normalize(), label: best.label };
}

// 查找最佳对齐候选（基于当前拖拽本地轴投影到世界后的方向）
  const findBestAlignCandidate = (worldDir, axisLabel) => {
    const threshold = 50; // 50mm 检测距离
    let bestCandidate = null;
    let minDistance = Infinity;

    const selfFaces = getFacesAlongDir({ obj, ref: groupRef, dir: worldDir });

    for (const targetObj of allObjects) {
      if (targetObj.id === obj.id || !targetObj.visible) continue;
      const targetTF = getWorldTransform({ ref: null, obj: targetObj });
      const picked = pickTargetBasis(targetTF, worldDir);
      const targetDir = picked.dir;
      const targetAxisLabel = picked.label; // 'X' | 'Y' | 'Z'
      const targetFaces = getFacesAlongDir({ obj: targetObj, ref: null, dir: targetDir });

      for (const selfFace of selfFaces) {
        for (const targetFace of targetFaces) {
          const distance = Math.abs(selfFace.coord - targetFace.coord);
          if (distance < minDistance && distance < threshold) {
            minDistance = distance;
            bestCandidate = {
              axisLabel,
              selfFace: selfFace.name,
              targetFace: targetFace.name,
              targetObj,
              distance,
              selfDir: worldDir.clone(),
              targetDir: targetDir.clone(),
              targetAxisLabel,
            };
          }
        }
      }
    }
    setBestAlignCandidate(bestCandidate);
  };

  // 旋转安全的吸附计算：沿当前拖拽方向做一维替换
  const calculateAlignPosition = (candidate) => {
    const { selfFace, targetFace, targetObj, selfDir, targetDir } = candidate;
    const dir = selfDir.clone().normalize();

    const selfTF = getWorldTransform({ ref: groupRef, obj });
    const targetTF = getWorldTransform({ ref: null, obj: targetObj });

    const selfHalf = projectedHalfExtentAlongAxis(dir, obj.dims, selfTF.axes);
    const targetHalf = projectedHalfExtentAlongAxis(targetDir, targetObj.dims, targetTF.axes);

    const selfSign = selfFace[0] === '+' ? +1 : -1;
    const targetSign = targetFace[0] === '+' ? +1 : -1;

    const targetFaceCoord = targetTF.p.dot(targetDir) + targetSign * targetHalf;

    const cur = groupRef.current.position.clone();
    const s = cur.dot(dir);
    const newCenterCoord = targetFaceCoord - selfSign * selfHalf;
    const newPos = cur.add(dir.multiplyScalar(newCenterCoord - s));
    return newPos.toArray();
  };

  // 根据面名得到高亮薄盒的世界中心/尺寸/朝向
  const getFaceDetails = ({ obj, ref, faceName }) => {
    const { p, q } = getWorldTransform({ ref, obj });
    const { w, h, d } = obj.dims;
    const sign = faceName[0] === '+' ? 1 : -1;
    const thickness = 0.2;
    const offset = thickness / 2 + 0.1; // 防止 Z-fighting

    let localOffset, size;
    switch (faceName) {
      case '+X': case '-X':
        localOffset = new THREE.Vector3(sign * (w / 2 + offset), 0, 0);
        size = [thickness, h, d];
        break;
      case '+Y': case '-Y':
        localOffset = new THREE.Vector3(0, sign * (h / 2 + offset), 0);
        size = [w, thickness, d];
        break;
      case '+Z': case '-Z':
        localOffset = new THREE.Vector3(0, 0, sign * (d / 2 + offset));
        size = [w, h, thickness];
        break;
      default:
        return null;
    }
    const worldOffset = localOffset.applyQuaternion(q);
    const center = new THREE.Vector3().copy(p).add(worldOffset);
    return { center: center.toArray(), size, quaternion: q };
  };

  const startDrag = () => {
    if (!groupRef.current) return;
    const p = groupRef.current.position.clone().toArray();
    const r = [groupRef.current.rotation.x, groupRef.current.rotation.y, groupRef.current.rotation.z];
    dragStartRef.current = { pos: p, rot: r };
    setDelta({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });
    isDraggingRef.current = true;
  };

  const updateDuringDrag = () => {
    if (!groupRef.current) return;
    const p = groupRef.current.position.clone().toArray();
    const r = [groupRef.current.rotation.x, groupRef.current.rotation.y, groupRef.current.rotation.z];
    const s = dragStartRef.current;
    const d = {
      dx: +(p[0] - s.pos[0]).toFixed(3),
      dy: +(p[1] - s.pos[1]).toFixed(3),
      dz: +(p[2] - s.pos[2]).toFixed(3),
      rx: +(((r[0] - s.rot[0]) * 180) / Math.PI).toFixed(2),
      ry: +(((r[1] - s.rot[1]) * 180) / Math.PI).toFixed(2),
      rz: +(((r[2] - s.rot[2]) * 180) / Math.PI).toFixed(2),
    };
    setDelta(d);

    const absDx = Math.abs(d.dx), absDy = Math.abs(d.dy), absDz = Math.abs(d.dz);
    let currentDragAxis = null;
    if (absDx > absDy && absDx > absDz) currentDragAxis = 'X';
    else if (absDy > absDx && absDy > absDz) currentDragAxis = 'Y';
    else if (absDz > absDx && absDz > absDy) currentDragAxis = 'Z';

    if (isShiftPressed) {
      const axisLabel = controlsRef.current?.axis; // 'X' | 'Y' | 'Z' | null
      if (axisLabel === 'X' || axisLabel === 'Y' || axisLabel === 'Z') {
        const selfTF = getWorldTransform({ ref: groupRef, obj });
        const worldDir = getLocalAxisDir(selfTF, axisLabel);
        if (worldDir) findBestAlignCandidate(worldDir, axisLabel);
      } else if (currentDragAxis) {
        // 退化：按世界三轴判断
        const worldDir = currentDragAxis === 'X' ? new THREE.Vector3(1,0,0) : currentDragAxis === 'Y' ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
        findBestAlignCandidate(worldDir, currentDragAxis);
      } else {
        setBestAlignCandidate(null);
      }
    } else {
      setBestAlignCandidate(null);
    }
  };

  const hudInputStyle = {
    width: 50,
    padding: "4px 6px",
    border: `1px solid ${t?.border || "#e5e7eb"}`,
    borderRadius: 6,
    background: t?.inputBg || "#fff",
    color: t?.inputText || "#111827",
    fontSize: 12,
    outline: 'none',
    textAlign: 'center',
  };

  // ✅ 工具：把事件彻底拦下
  const eat = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
      e.nativeEvent.stopPropagation?.();
      e.nativeEvent.preventDefault?.();
    }
  };

  // ✅ HUD 聚焦期间上锁；失焦/关闭时解锁
  const lock = (e) => { eat(e); setUiLock(true); };
  const unlock = (e) => { eat(e); setUiLock(false); };

  // ===== 计算高亮薄盒 =====
  const targetHighlightDetails = useMemo(() => {
    if (!bestAlignCandidate) return null;
    const { targetObj, targetDir, targetFace, targetAxisLabel } = bestAlignCandidate;
    const { p, q, axes } = getWorldTransform({ ref: null, obj: targetObj });
    const half = projectedHalfExtentAlongAxis(targetDir, targetObj.dims, axes);
    const sign = targetFace[0] === '+' ? 1 : -1;
    const offset = 0.1; // 防穿模
    const center = p.clone().add(targetDir.clone().multiplyScalar(sign * (half + offset)));

    // 根据目标轴选择正确的薄盒尺寸（在目标的本地空间定义，再由 quaternion 对齐）
    const thickness = 0.2;
    let size;
    if (targetAxisLabel === 'X') size = [thickness, targetObj.dims.h, targetObj.dims.d];
    else if (targetAxisLabel === 'Y') size = [targetObj.dims.w, thickness, targetObj.dims.d];
    else size = [targetObj.dims.w, targetObj.dims.h, thickness];

    return { center: center.toArray(), size, quaternion: q };
  }, [bestAlignCandidate]);

  const selfHighlightDetails = useMemo(() => {
    if (!bestAlignCandidate) return null;
    const axis = bestAlignCandidate.axisLabel;
    const face = bestAlignCandidate.selfFace[0] + axis; // '+X' / '-Y' / ...
    return getFaceDetails({ obj, ref: groupRef, faceName: face });
  }, [bestAlignCandidate, obj]);

  return (
    <>
      <group
        ref={groupRef}
        position={obj.pos}
        rotation={obj.rot}
        userData={{ objectId: obj.id }}
        onPointerDown={(e) => {
          e.stopPropagation();
          const multi = e.ctrlKey || e.metaKey;
          onSelect?.(obj.id, multi);
        }}
      >
        {obj.type === "motherboard" ? (
          <MotherboardMesh obj={obj} selected={selected} />
        ) : obj.type === "group" ? (
          <GroupMesh obj={obj} selected={selected} />
        ) : (
          <PartBox obj={obj} selected={selected} />
        )}
      </group>

      {selected && (
        <TransformControls
          ref={controlsRef}
          object={groupRef.current}
          mode={mode}
          space="local"
          enabled={!uiLock}
          translationSnap={snap?.enabled ? snap.translate : undefined}
          rotationSnap={snap?.enabled ? (snap.rotate * Math.PI) / 180 : undefined}
          onObjectChange={() => {
            // 拖拽过程中持续更新
            updateDuringDrag();
            const p = groupRef.current.position.clone().toArray();
            const r = [groupRef.current.rotation.x, groupRef.current.rotation.y, groupRef.current.rotation.z];
            setObj((prev) => ({ ...prev, pos: p, rot: r }));
          }}
          onMouseDown={() => {
            startDrag();
          }}
          onDraggingChange={(dragging) => {
            isDraggingRef.current = dragging;
            setDragging?.(dragging);
            if (!dragging) {
              if (isShiftPressed && bestAlignCandidate) {
                const newPos = calculateAlignPosition(bestAlignCandidate);
                setObj((prev) => ({ ...prev, pos: newPos }));
                onAlign?.(bestAlignCandidate);
              } else {
                const p = groupRef.current.position.clone().toArray();
                const r = [groupRef.current.rotation.x, groupRef.current.rotation.y, groupRef.current.rotation.z];
                setObj((prev) => ({ ...prev, pos: p, rot: r }));
              }
              setBestAlignCandidate(null);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}

      {/* ✅ 面高亮（世界坐标 & 继承物体旋转） */}
      {bestAlignCandidate && (
        <group>
          {targetHighlightDetails && (
            <mesh position={targetHighlightDetails.center} quaternion={targetHighlightDetails.quaternion}>
              <boxGeometry args={targetHighlightDetails.size} />
              <meshBasicMaterial color="#00ff00" transparent opacity={0.5} />
            </mesh>
          )}
          {selfHighlightDetails && (
            <mesh position={selfHighlightDetails.center} quaternion={selfHighlightDetails.quaternion}>
              <boxGeometry args={selfHighlightDetails.size} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
            </mesh>
          )}
          <Html position={bestAlignCandidate.targetObj.pos}>
            <div
              style={{
                background: "rgba(0, 255, 0, 0.8)",
                color: "white",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "bold",
                pointerEvents: "none",
              }}
            >
              {bestAlignCandidate.selfFace} → {bestAlignCandidate.targetFace}
            </div>
          </Html>
        </group>
      )}

      {selected && (
        <Html fullscreen style={{ pointerEvents: "none" }} zIndexRange={[1000, 0]}>
          <div
            style={{
              position: "absolute",
              right: 20,
              bottom: 20,
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: t?.cardBg || "rgba(255,255,255,0.95)",
              border: `1px solid ${t?.border || "#e5e7eb"}`,
              borderRadius: 10,
              padding: "6px 10px",
              boxShadow: t?.shadow || "0 6px 18px rgba(0,0,0,.12)",
              color: t?.text || "#111827",
              fontSize: 12,
              zIndex: 1000,
            }}
            onPointerDown={lock}
            onPointerUp={unlock}
            onWheel={eat}
            onContextMenu={eat}
            onPointerMove={eat}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: t?.muted || "#64748b" }}>Mode:</span>
              <select
                value={mode}
                onChange={(e) => { e.stopPropagation(); setMode(e.target.value); }}
                style={{
                  width: 110,
                  padding: "6px 10px",
                  border: `1px solid ${t?.border || "#e5e7eb"}`,
                  borderRadius: 10,
                  background: t?.inputBg || "#fff",
                  color: t?.inputText || "#111827",
                  position: "relative",
                  zIndex: 1001,
                }}
                onMouseDown={(e) => { e.stopPropagation(); setUiLock(true); }}
                onMouseUp={(e) => { e.stopPropagation(); setUiLock(false); }}
                onClick={(e) => { e.stopPropagation(); }}
                onFocus={(e) => { e.stopPropagation(); setUiLock(true); }}
                onBlur={(e) => { e.stopPropagation(); setUiLock(false); }}
                onPointerDown={(e) => { e.stopPropagation(); setUiLock(true); }}
                onPointerUp={(e) => { e.stopPropagation(); setUiLock(false); }}
                onContextMenu={(e) => { e.stopPropagation(); }}
                onWheel={(e) => { e.stopPropagation(); }}
              >
                <option value="translate">Move</option>
                <option value="rotate">Rotate</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, borderLeft: `1px solid ${t?.border || "#e5e7eb"}`, paddingLeft: 12 }}>
              <span style={{ color: t?.muted || "#64748b" }}>W:</span>
              <input type="number" value={obj.dims.w} onChange={(e) => handleDimChange("w", e.target.value)} style={hudInputStyle} />
              <span style={{ color: t?.muted || "#64748b" }}>H:</span>
              <input type="number" value={obj.dims.h} onChange={(e) => handleDimChange("h", e.target.value)} style={hudInputStyle} />
              <span style={{ color: t?.muted || "#64748b" }}>D:</span>
              <input type="number" value={obj.dims.d} onChange={(e) => handleDimChange("d", e.target.value)} style={hudInputStyle} />
            </div>

            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", color: t?.subText || "#334155" }}>
              {/* 如需显示增量可开启：
              Δx:{delta.dx}mm Δy:{delta.dy}mm Δz:{delta.dz}mm | Δα:{delta.rx}° Δβ:{delta.ry}° Δγ:{delta.rz}°
              */}
              <div style={{ fontSize: 11, color: isShiftPressed ? "#10b981" : "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <span>🔗</span>
                <span>{isShiftPressed ? "拖拽对齐已启用" : "按住Shift拖拽对齐"}</span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </>
  );
}
