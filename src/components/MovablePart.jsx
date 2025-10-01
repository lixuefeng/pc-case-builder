// components/MovablePart.jsx — 选中/移动/旋转 + HUD（修复下拉被吞事件）
import React, { useRef, useEffect, useState } from "react";
import { TransformControls, Html } from "@react-three/drei";
import { MotherboardMesh, PartBox, GroupMesh } from "./Meshes.jsx";

export default function MovablePart({
  obj,
  selected,
  setObj,
  onSelect,
  snap,
  palette,
  allObjects = [], // 添加所有对象用于面检测
  onAlign, // 添加对齐回调
  setDragging, // 从父级传入，用于控制 OrbitControls 启用逻辑
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
      // 如果是 group，需要重新计算子对象的位置
      if (prev.type === "group") {
        // 这是一个简化的处理，理想情况下可能需要更复杂的逻辑
        // 来根据尺寸变化调整子对象，但目前我们先更新包围盒尺寸
      }
      return { ...prev, dims: newDims };
    });
  };


  const dragStartRef = useRef({ pos: [0, 0, 0], rot: [0, 0, 0] });
  const [delta, setDelta] = useState({
    dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0
  });

  // ✅ 新的智能对齐状态
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [bestAlignCandidate, setBestAlignCandidate] = useState(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!controlsRef.current || !groupRef.current) return;
    if (selected) controlsRef.current.attach(groupRef.current);
    else controlsRef.current.detach();
  }, [selected]);

  // 键盘和UI锁事件监听（仅处理 Shift）
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
        setBestAlignCandidate(null); // 松开 Shift 时，清除对齐候选
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 视角控制逻辑迁移到 Scene 中统一处理，这里不直接改 OrbitControls.enabled

  // 获取一个物体在某个轴向上的两个面的世界坐标和中心点
  const getObjectFaces = (object, position) => {
    const { w, h, d } = object.dims;
    const [x, y, z] = position;
    return {
      X: [
        { name: '+X', coord: x + w / 2, center: [x + w / 2, y, z] },
        { name: '-X', coord: x - w / 2, center: [x - w / 2, y, z] },
      ],
      Y: [
        { name: '+Y', coord: y + h / 2, center: [x, y + h / 2, z] },
        { name: '-Y', coord: y - h / 2, center: [x, y - h / 2, z] },
      ],
      Z: [
        { name: '+Z', coord: z + d / 2, center: [x, y, z + d / 2] },
        { name: '-Z', coord: z - d / 2, center: [x, y, z - d / 2] },
      ],
    };
  };

  // 查找最佳对齐候选
  const findBestAlignCandidate = (currentPos, axis) => {
    const threshold = 50; // 50mm 检测距离
    let bestCandidate = null;
    let minDistance = Infinity;

    // ✅ 修复：获取被拖动物体的相关面
    const selfFaces = getObjectFaces(obj, currentPos)[axis];

    for (const targetObj of allObjects) {
      if (targetObj.id === obj.id || !targetObj.visible) continue;

      const targetFaces = getObjectFaces(targetObj, targetObj.pos)[axis];

      // ✅ 修复：遍历所有“面对面”组合，找到距离最近的一对
      for (const selfFace of selfFaces) {
        for (const targetFace of targetFaces) {
          const distance = Math.abs(selfFace.coord - targetFace.coord);
          if (distance < minDistance && distance < threshold) {
            minDistance = distance;
            bestCandidate = {
              selfFace: selfFace.name,
              targetFace: targetFace.name,
              targetObj: targetObj,
              distance: distance,
            };
          }
        }
      }
    }

    setBestAlignCandidate(bestCandidate);
  };

  // ✅ 修复：重新添加缺失的对齐位置计算函数
  const calculateAlignPosition = (candidate) => {
    const { selfFace, targetFace, targetObj } = candidate;
    const offset = 0; // 未来可以配置的吸附偏移量
    const axis = selfFace[1]; // 'X', 'Y', or 'Z'
    const axisIndex = { X: 0, Y: 1, Z: 2 }[axis];

    const selfSign = selfFace[0] === '+' ? 1 : -1;
    const selfHalfSize = obj.dims[{ X: 'w', Y: 'h', Z: 'd' }[axis]] / 2;

    // 获取目标面的世界坐标
    const targetFaces = getObjectFaces(targetObj, targetObj.pos)[axis];
    const targetFaceCoord = targetFaces.find(f => f.name === targetFace).coord;

    // 计算被拖动物体中心点的新坐标，使其表面与目标表面贴合
    const newCenterCoord = targetFaceCoord - (selfSign * selfHalfSize);

    // ✅ 修复：必须基于物体拖拽结束时的实时位置来计算，而不是用 obj.pos (拖拽开始前的位置)
    // 只修改主轴坐标，保持其他轴不变
    const newPos = groupRef.current.position.clone().toArray();
    newPos[axisIndex] = newCenterCoord;

    return newPos;
  };

  // 获取一个物体某个面的中心点和尺寸，用于高亮
  const getFaceDetails = (object, faceName, position) => {
    const axis = faceName[1];
    const faces = getObjectFaces(object, position);
    const face = faces[axis].find(f => f.name === faceName);
    if (!face || !face.center) return null;

    const { w, h, d } = object.dims;
    const [x, y, z] = position; // 使用物体的中心点作为基准
    const sign = faceName[0] === '+' ? 1 : -1;
    const thickness = 0.2;
    // ✅ 修复 Z-fighting：在半个厚度的基础上再增加一个微小的偏移量 (epsilon)，
    // 避免高亮面与物体表面完全重合导致闪烁。
    const offset = thickness / 2 + 0.1;

    // ✅ 修复：所有轴的计算逻辑都基于物体中心点(position)和其半尺寸，而不是依赖 face.center
    // 这样可以避免坐标重复计算导致的偏移错误。
    switch (faceName) {
      case '+X': case '-X': return { center: [x + sign * (w / 2 + offset), y, z], size: [thickness, h, d] };
      case '+Y': case '-Y': return { center: [x, y + sign * (h / 2 + offset), z], size: [w, thickness, d] };
      case '+Z': case '-Z': return { center: [x, y, z + sign * (d / 2 + offset)], size: [w, h, thickness] };
      default: return null;
    }
  };

  // 计算高亮面的细节
  const targetHighlightDetails = bestAlignCandidate
    ? getFaceDetails(bestAlignCandidate.targetObj, bestAlignCandidate.targetFace, bestAlignCandidate.targetObj.pos)
    : null;
  // ✅ 修复：计算自身高亮时，应使用物体当前在世界中的位置
  const selfHighlightDetails = bestAlignCandidate
    // groupRef.current.position 是物体在拖拽过程中的实时世界坐标
    ? getFaceDetails(obj, bestAlignCandidate.selfFace, groupRef.current.position.toArray())
    : null;

  const startDrag = () => {
    if (!groupRef.current) return;
    const p = groupRef.current.position.clone().toArray();
    const r = [
      groupRef.current.rotation.x,
      groupRef.current.rotation.y,
      groupRef.current.rotation.z,
    ];
    dragStartRef.current = { pos: p, rot: r };
    setDelta({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });
    isDraggingRef.current = true;
  };

  const updateDuringDrag = () => {
    if (!groupRef.current) return;
    const p = groupRef.current.position.clone().toArray();
    const r = [
      groupRef.current.rotation.x,
      groupRef.current.rotation.y,
      groupRef.current.rotation.z,
    ];
    const s = dragStartRef.current;
    const delta = {
      dx: +(p[0] - s.pos[0]).toFixed(3),
      dy: +(p[1] - s.pos[1]).toFixed(3),
      dz: +(p[2] - s.pos[2]).toFixed(3),
      rx: +(((r[0] - s.rot[0]) * 180) / Math.PI).toFixed(2),
      ry: +(((r[1] - s.rot[1]) * 180) / Math.PI).toFixed(2),
      rz: +(((r[2] - s.rot[2]) * 180) / Math.PI).toFixed(2),
    };
    setDelta(delta);

    // 计算位移绝对值（供后续判断复用）
    const absDx = Math.abs(delta.dx);
    const absDy = Math.abs(delta.dy);
    const absDz = Math.abs(delta.dz);

    // ✅ 修复：在每一帧都重新确定拖拽主轴，而不是只在开始时确定一次
    let currentDragAxis = null;
    if (absDx > absDy && absDx > absDz) {
      currentDragAxis = 'X';
    } else if (absDy > absDx && absDy > absDz) {
      currentDragAxis = 'Y';
    } else if (absDz > absDx && absDz > absDy) {
      currentDragAxis = 'Z';
    }

    // 2. 如果按住 Shift 且已确定主轴，则开始检测
    if (isShiftPressed && currentDragAxis) {
      findBestAlignCandidate(p, currentDragAxis);
    } else {
      setBestAlignCandidate(null); // 没按 Shift 或没确定主轴，则清除候选
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

  // ✅ 工具函数：把事件彻底拦下
  const eat = (e) => {
    e.stopPropagation();
    e.preventDefault();
    // 有些浏览器需要原生事件也阻止
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
      e.nativeEvent.stopPropagation?.();
      e.nativeEvent.preventDefault?.();
    }
  };

  // ✅ HUD 聚焦期间上锁；失焦/关闭时解锁
  const lock = (e) => { eat(e); setUiLock(true); };
  const unlock = (e) => { eat(e); setUiLock(false); };

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
          // ✅ Drei 自带的 prop；也会被上面的 effect 再兜底控制
          enabled={!uiLock}
          translationSnap={snap?.enabled ? snap.translate : undefined}
          rotationSnap={snap?.enabled ? (snap.rotate * Math.PI) / 180 : undefined} 
          onObjectChange={() => {
            // 拖拽过程中持续更新
            updateDuringDrag();
            const p = groupRef.current.position.clone().toArray();
            const r = [
              groupRef.current.rotation.x,
              groupRef.current.rotation.y,
              groupRef.current.rotation.z,
            ];
            setObj((prev) => ({ ...prev, pos: p, rot: r }));
          }}
          onMouseDown={(e) => {
            // 拖拽开始的瞬间
            startDrag();
          }}
          // ✅ 正确的修复方式：使用 onDraggingChange 来控制轨道控制器
          onDraggingChange={(dragging) => {
            isDraggingRef.current = dragging;
            setDragging?.(dragging);
            if (!dragging) {
              // 拖拽结束
              if (isShiftPressed && bestAlignCandidate) {
                // ✅ 执行吸附
                const newPos = calculateAlignPosition(bestAlignCandidate);
                setObj((prev) => ({ ...prev, pos: newPos }));
              } else {
                // ✅ 如果不吸附，则应用 TransformControls 的最终位置
                const p = groupRef.current.position.clone().toArray();
                const r = [
                  groupRef.current.rotation.x,
                  groupRef.current.rotation.y,
                  groupRef.current.rotation.z,
                ];
                setObj((prev) => ({ ...prev, pos: p, rot: r }));
              }
              // 清理状态
              setBestAlignCandidate(null);
            }
          }}
          onMouseUp={() => {
            // onDraggingChange 已经处理了主要逻辑，这里可以留空或做补充清理
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}

      {/* ✅ 新的、正确的面高亮效果 */}
      {bestAlignCandidate && (
        <group>
          {/* 目标面高亮 (渲染在世界坐标系中，因为它在 MovablePart 外部) */}
          {targetHighlightDetails && (
            <mesh position={targetHighlightDetails.center}>
              <boxGeometry args={targetHighlightDetails.size} />
              <meshBasicMaterial color="#00ff00" transparent opacity={0.5} />
            </mesh>
          )}
          {/* ✅ 修复：自身高亮面也必须在世界坐标系中渲染 */}
          {selfHighlightDetails && (
            <mesh position={selfHighlightDetails.center}>
              <boxGeometry args={selfHighlightDetails.size} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
            </mesh>
          )}
          {/* 面标识文字 */}
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
        <Html
          // 使用 fullscreen 将 HUD 渲染到屏幕空间
          fullscreen
          // 容器本身不接收事件，以免遮挡3D场景交互
          style={{ pointerEvents: "none" }}
          zIndexRange={[1000, 0]} // 提高层级，防止被 Canvas 吞
        >
          <div
            style={{
              // 定位到右下角
              position: "absolute",
              right: 20,
              bottom: 20,
              // 内容区域接收事件
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
            // ✅ 整个 HUD 容器都拦截事件，避免冒泡到 Canvas
            onPointerDown={lock}
            onPointerUp={unlock}
            onWheel={eat}
            onContextMenu={eat}
            onPointerMove={eat}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: t?.muted || "#64748b" }}>Mode:</span>

              {/* ✅ 修复：简化事件处理，只拦截必要的事件 */}
              <select
                value={mode}
                onChange={(e) => { 
                  e.stopPropagation(); 
                  setMode(e.target.value); 
                }}
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
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setUiLock(true);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  setUiLock(false);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onFocus={(e) => {
                  e.stopPropagation();
                  setUiLock(true);
                }}
                onBlur={(e) => {
                  e.stopPropagation();
                  setUiLock(false);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setUiLock(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  setUiLock(false);
                }}
                onContextMenu={(e) => {
                  e.stopPropagation();
                }}
                onWheel={(e) => {
                  e.stopPropagation();
                }}
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

            <div
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                color: t?.subText || "#334155",
              }}
            >
              {/* 移动和旋转的增量显示 */}
              {/* 
              Δx:{delta.dx}mm Δy:{delta.dy}mm Δz:{delta.dz}mm | Δα:{delta.rx}° Δβ:{delta.ry}° Δγ:{delta.rz}°
            </div>
            
              {/* 对齐提示 */}
              <div
                style={{
                  fontSize: 11,
                  color: isShiftPressed ? "#10b981" : "#94a3b8",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
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
