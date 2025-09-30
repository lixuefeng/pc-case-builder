// components/MovablePart.jsx — 选中/移动/旋转 + HUD（修复下拉被吞事件）
import React, { useRef, useEffect, useState } from "react";
import { TransformControls, Html } from "@react-three/drei";
import { MotherboardMesh, PartBox, GroupMesh } from "./Meshes.jsx";

const toMeters = (mm) => mm / 1000;

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

  // 拖拽对齐相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredFace, setHoveredFace] = useState(null);
  const [alignPreview, setAlignPreview] = useState(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [dragAxis, setDragAxis] = useState(null); // 记录用户拖拽的轴

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

  // ... (省略了面检测和对齐计算函数)

  // 面检测函数 - 只检测用户拖拽轴上的面, 优化距离计算
  const detectNearbyFaces = (currentPos) => {
    if (!dragAxis) return []; // 如果没有拖拽轴，不检测
    
    const threshold = 100; // 100mm 检测距离
    const nearbyFaces = [];
    
    allObjects.forEach(targetObj => {
      if (targetObj.id === obj.id || !targetObj.visible) return;
      
      const targetPos = targetObj.pos;
      const targetDims = targetObj.dims;
      const selfPos = currentPos;
      const selfDims = obj.dims;
      
      // 计算两个物体中心点距离
      const centerDistanceSq = (
        Math.pow(selfPos[0] - targetPos[0], 2) +
        Math.pow(selfPos[1] - targetPos[1], 2) +
        Math.pow(selfPos[2] - targetPos[2], 2)
      );
      
      if (centerDistanceSq < threshold * threshold) {
        // 只检测拖拽轴上的面
        const axisFaces = {
          'X': [
            { name: '+X', pos: [selfPos[0] + selfDims.w/2, selfPos[1], selfPos[2]] },
            { name: '-X', pos: [selfPos[0] - selfDims.w/2, selfPos[1], selfPos[2]] }
          ],
          'Y': [
            { name: '+Y', pos: [selfPos[0], selfPos[1] + selfDims.h/2, selfPos[2]] },
            { name: '-Y', pos: [selfPos[0], selfPos[1] - selfDims.h/2, selfPos[2]] }
          ],
          'Z': [
            { name: '+Z', pos: [selfPos[0], selfPos[1], selfPos[2] + selfDims.d/2] },
            { name: '-Z', pos: [selfPos[0], selfPos[1], selfPos[2] - selfDims.d/2] }
          ]
        };
        
        const targetAxisFaces = {
          'X': [
            { name: '+X', pos: [targetPos[0] + targetDims.w/2, targetPos[1], targetPos[2]] },
            { name: '-X', pos: [targetPos[0] - targetDims.w/2, targetPos[1], targetPos[2]] }
          ],
          'Y': [
            { name: '+Y', pos: [targetPos[0], targetPos[1] + targetDims.h/2, targetPos[2]] },
            { name: '-Y', pos: [targetPos[0], targetPos[1] - targetDims.h/2, targetPos[2]] }
          ],
          'Z': [
            { name: '+Z', pos: [targetPos[0], targetPos[1], targetPos[2] + targetDims.d/2] },
            { name: '-Z', pos: [targetPos[0], targetPos[1], targetPos[2] - targetDims.d/2] }
          ]
        };
        
        // 只检测拖拽轴上的面
        const selfFaces = axisFaces[dragAxis] || [];
        const targetFaces = targetAxisFaces[dragAxis] || [];
        
        // 计算面组合的距离，找到最近的一对
        let minDistance = Infinity;
        let bestPair = null;
        
        selfFaces.forEach(selfFace =>{
          targetFaces.forEach(targetFace => {
            // 计算两个面之间的距离
            const distanceSq = (
              Math.pow(selfFace.pos[0] - targetFace.pos[0], 2) +
              Math.pow(selfFace.pos[1] - targetFace.pos[1], 2) +
              Math.pow(selfFace.pos[2] - targetFace.pos[2], 2)
            );
            
            // 只考虑距离在阈值内的面
            if (distanceSq < threshold * threshold) {
              const distance = Math.sqrt(distanceSq);
              if (distanceSq < minDistance) {
                minDistance = distance;
                bestPair = {
                  selfFace: selfFace.name,
                  targetFace: targetFace.name,
                  distance: distance,
                  targetObj,
                  targetPosition: targetFace.pos
                };
              }
            }
          });
        });
        
        if (bestPair && minDistance < threshold) {
          nearbyFaces.push(bestPair);
        }
      }
    });
    
    // 添加调试信息
    if (nearbyFaces.length > 0) {
      console.log(`检测到${dragAxis}轴最近面对:`, nearbyFaces);
    }
    
    return nearbyFaces.sort((a, b) => a.distance - b.distance);
  };

  // 计算对齐位置 - 让物体的面贴到目标物体的面
  const calculateAlignPosition = (facePair) => {
    const { selfFace, targetFace, targetObj } = facePair;
    const selfHalf = { x: obj.dims.w / 2, y: obj.dims.h / 2, z: obj.dims.d / 2 };
    const tgtHalf = { x: targetObj.dims.w / 2, y: targetObj.dims.h / 2, z: targetObj.dims.d / 2 };
    const tgtPos = { x: targetObj.pos[0], y: targetObj.pos[1], z: targetObj.pos[2] };
    const currentPos = { x: obj.pos[0], y: obj.pos[1], z: obj.pos[2] };

    const faceCoord = (pos, half, face) => {
      switch (face) {
        case "+X": return pos.x + half.x;
        case "-X": return pos.x - half.x;
        case "+Y": return pos.y + half.y;
        case "-Y": return pos.y - half.y;
        case "+Z": return pos.z + half.z;
        case "-Z": return pos.z - half.z;
        default: return pos.x;
      }
    };
    
    const axisOf = (face) => face[1];
    const signOf = (face) => (face[0] === "+" ? 1 : -1);

    // 获取目标面的坐标
    const targetAxis = axisOf(targetFace);
    const tgtFaceCoord = faceCoord(tgtPos, tgtHalf, targetFace);
    
    // 计算物体中心应该移动到的位置
    // 让物体的selfFace贴到目标物体的targetFace，但不相交
    const selfHalfSize = selfHalf[targetAxis.toLowerCase()];
    const tgtHalfSize = tgtHalf[targetAxis.toLowerCase()];
    
    // 计算两个物体中心之间的距离，确保它们相邻而不相交
    const totalHalfSize = selfHalfSize + tgtHalfSize;
    const desiredCenter = tgtFaceCoord - signOf(selfFace) * totalHalfSize;

    // 只修改拖拽轴，保持其他轴不变
    const newPos = { ...currentPos };
    if (targetAxis === "X") newPos.x = desiredCenter;
    if (targetAxis === "Y") newPos.y = desiredCenter;
    if (targetAxis === "Z") newPos.z = desiredCenter;

    console.log(`对齐: ${selfFace} -> ${targetFace}`);
    console.log(`  目标面坐标: ${tgtFaceCoord.toFixed(2)}`);
    console.log(`  自身半尺寸: ${selfHalfSize.toFixed(2)}, 目标半尺寸: ${tgtHalfSize.toFixed(2)}`);
    console.log(`  总距离: ${totalHalfSize.toFixed(2)}, 新中心: ${desiredCenter.toFixed(2)}`);

    return [newPos.x, newPos.y, newPos.z];
  };

  const startDrag = () => {
    if (!groupRef.current) return;
    const p = groupRef.current.position.clone().multiplyScalar(1000).toArray();
    const r = [
      groupRef.current.rotation.x,
      groupRef.current.rotation.y,
      groupRef.current.rotation.z,
    ];
    dragStartRef.current = { pos: p, rot: r };
    setDelta({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });
    setIsDragging(true);
    setDragging?.(true);
  };

  const updateDuringDrag = () => {
    if (!groupRef.current) return;
    const p = groupRef.current.position.clone().multiplyScalar(1000).toArray();
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

    // 检测用户拖拽的轴
    if (isDragging && !dragAxis) {
      // 找到移动最大的轴
      if (absDx > absDy && absDx > absDz) {
        setDragAxis('X');
      } else if (absDy > absDx && absDy > absDz) {
        setDragAxis('Y');
      } else if (absDz > absDx && absDz > absDy) {
        setDragAxis('Z');
      }
    }

    // 如果 dragAxis 已经确定，并且移动的距离小于某个阈值，则清除 dragAxis
    const minMovementThreshold = 1; // 1mm
    if (dragAxis && absDx < minMovementThreshold && absDy < minMovementThreshold && absDz < minMovementThreshold) {
        setDragAxis(null);
        setHoveredFace(null);
        setAlignPreview(null);
        return; // 提前退出，避免不必要的计算
    }

    // 拖拽时检测附近的面（仅在按住Shift键时）
    if (isDragging && isShiftPressed && dragAxis) {
      const nearbyFaces = detectNearbyFaces(p);
      if (nearbyFaces.length > 0) {
        const closestFacePair = nearbyFaces[0];
        console.log(`设置${dragAxis}轴高亮面对:`, closestFacePair);
        setHoveredFace(closestFacePair);
        
        // 计算对齐预览位置
        const alignPos = calculateAlignPosition(closestFacePair);
        setAlignPreview({
          facePair: closestFacePair,
          position: alignPos
        });
      } else {
        setHoveredFace(null);
        setAlignPreview(null);
      }
    } else if (isDragging && !isShiftPressed) {
      // 松开Shift键时清除对齐预览
      setHoveredFace(null);
      setAlignPreview(null);
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
        position={obj.pos.map(toMeters)}
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
          <PartBox obj={{ ...obj, pos: [0, 0, 0] }} selected={selected} />
        )}
      </group>

      {selected && (
        <TransformControls
          ref={controlsRef}
          object={groupRef.current}
          mode={mode}
          // ✅ Drei 自带的 prop；也会被上面的 effect 再兜底控制
          enabled={!uiLock}
          translationSnap={snap?.enabled ? toMeters(snap.translate) : undefined}
          rotationSnap={snap?.enabled ? (snap.rotate * Math.PI) / 180 : undefined} 
          onObjectChange={() => {
            // 拖拽过程中持续更新
            updateDuringDrag();
            const p = groupRef.current.position.clone().multiplyScalar(1000).toArray();
            const r = [
              groupRef.current.rotation.x,
              groupRef.current.rotation.y,
              groupRef.current.rotation.z,
            ];
            setObj((prev) => ({ ...prev, pos: p, rot: r }));
          }}
          onMouseDown={(e) => {
            // 拖拽开始的瞬间
            e.stopPropagation();
            startDrag();
          }}
          // ✅ 正确的修复方式：使用 onDraggingChange 来控制轨道控制器
          onDraggingChange={(dragging) => {
            setIsDragging(dragging);
            setDragging?.(dragging);
          }}
          onMouseUp={() => {
            // 拖拽结束时检查是否需要自动对齐
            if (isDragging && isShiftPressed && alignPreview) {
              // 执行自动对齐
              const newPos = alignPreview.position;
              setObj((prev) => ({ ...prev, pos: newPos })); // 应用新位置
              
              // 调用对齐回调
              if (onAlign) {
                onAlign({
                  sourceObj: obj,
                  targetObj: alignPreview.facePair.targetObj,
                  selfFace: alignPreview.facePair.selfFace,
                  targetFace: alignPreview.facePair.targetFace,
                  newPosition: newPos
                });
              }
            }
            
            // 清理状态
            setHoveredFace(null);
            setAlignPreview(null);
            setDragAxis(null);
            setDragging?.(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}

      {/* 面高亮效果 */}
      {hoveredFace && isDragging && (
        <group>
          {/* 目标面中心点高亮 */}
          <mesh
            position={hoveredFace.targetPosition.map(toMeters)}
          >
            <sphereGeometry args={[0.02]} />
            <meshBasicMaterial 
              color="#00ff00" 
              transparent 
              opacity={1}
            />
          </mesh>
          
          {/* 面标识文字 */}
          <Html position={hoveredFace.targetPosition.map(toMeters)}>
            <div style={{
              background: 'rgba(0, 255, 0, 0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              pointerEvents: 'none'
            }}>
              {hoveredFace.selfFace} → {hoveredFace.targetFace}
            </div>
          </Html>
        </group>
      )}

      {/* 对齐预览线 */}
      {alignPreview && isDragging && (
        <group>
          {/* 从当前位置到对齐位置的预览线 */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  ...groupRef.current?.position.clone().multiplyScalar(1000).toArray() || [0,0,0],
                  ...alignPreview.position.map(toMeters)
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#00ff00" linewidth={2} />
          </line>
          
          {/* 对齐目标位置预览 */}
          <mesh position={alignPreview.position.map(toMeters)}>
            <boxGeometry args={[obj.dims.w / 1000, obj.dims.h / 1000, obj.dims.d / 1000]} />
            <meshBasicMaterial 
              color="#00ff00" 
              transparent 
              opacity={0.2}
              wireframe={true}
            />
          </mesh>
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
              */}
            </div>
          </div>
        </Html>
      )}
    </>
  );
}
