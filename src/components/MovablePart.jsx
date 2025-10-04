// components/MovablePart.jsx — 选中/移动/旋转 + HUD（旋转安全的高亮/吸附 + 调试日志）
import React, { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { TransformControls, Html } from "@react-three/drei";
import { MotherboardMesh, PartBox, GroupMesh } from "./Meshes.jsx";

// === Debug helpers ===
const DEBUG_ALIGN = true; // 控制调试日志；需要时改为 false 关闭
const dlog = (...args) => { if (DEBUG_ALIGN) console.log("[align]", ...args); };

export default function MovablePart({
  obj,
  selected,
  setObj,
  onSelect,
  palette,
  allObjects = [], // 用于面检测
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
      return { ...prev, dims: newDims };
    });
  };

  const handlePosChange = (axisIndex, value) => {
    const newPosValue = Number(value) || 0;
    setObj((prev) => {
      const newPos = [...prev.pos];
      newPos[axisIndex] = newPosValue;
      return { ...prev, pos: newPos };
    });
  };

  const handleRotChange = (axisIndex, value) => {
    const newRotValueDeg = Number(value) || 0;
    const newRotValueRad = THREE.MathUtils.degToRad(newRotValueDeg);
    setObj((prev) => {
      const newRot = [...prev.rot];
      newRot[axisIndex] = newRotValueRad;
      return { ...prev, rot: newRot };
    });
  };

  const dragStartRef = useRef({ pos: [0, 0, 0], rot: [0, 0, 0] });
  const prevPosRef = useRef(null); // 上一帧世界位置，用来推断真实拖拽轴
  const [delta, setDelta] = useState({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });

  // ✅ 智能对齐状态
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [bestAlignCandidate, setBestAlignCandidate] = useState(null);
  // 记录拖拽过程中的最后一个可用候选，用于松手时吸附
  const lastAlignCandidateRef = useRef(null);
  const isDraggingRef = useRef(false);
  const noHitFramesRef = useRef(0); // 连续无候选的帧数（用于宽限）
  const upListenerRef = useRef(null); // 全局 pointerup 兜底监听

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

  // === 吸附并行性容差（仅当两面近似平行才高亮/吸附） ===
  const ALIGN_ANG_TOL_DEG = 5; // 允许 5° 以内的夹角误差
  const PARALLEL_COS = Math.cos(THREE.MathUtils.degToRad(ALIGN_ANG_TOL_DEG));
  const DIST_THRESHOLD = 50; // 50mm 检测距离
  const MIN_MOVE_EPS = 0.25; // 本帧最小移动阈值，避免第一帧 axis 误判
  // ——— 抗抖/粘滞参数（抑制高亮闪烁） ———
  const HYST_MM = 3;           // 候选切换的最小改进（小于3mm不切）
  const IMPROVE_MM = 2;        // 新候选需要至少优于上一个2mm才替换
  const GRACE_FRAMES = 6;      // 丢失候选后，保留旧候选的宽限帧数

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
    const w2 = (dims?.w ?? 0) / 2, h2 = (dims?.h ?? 0) / 2, d2 = (dims?.d ?? 0) / 2;
    return (
      Math.abs(worldAxis.dot(ax)) * w2 +
      Math.abs(worldAxis.dot(ay)) * h2 +
      Math.abs(worldAxis.dot(az)) * d2
    );
  }

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

  // 根据移动向量在本地基上的投影，推断最可能的拖拽轴
  function inferAxisFromMovement(mv, tf) {
    if (!mv) return { axis: null, proj: { X: 0, Y: 0, Z: 0 }, len: 0 };
    const { ax, ay, az } = tf.axes;
    const len = mv.length();
    const px = Math.abs(mv.dot(ax));
    const py = Math.abs(mv.dot(ay));
    const pz = Math.abs(mv.dot(az));
    let axis = 'X';
    if (py >= px && py >= pz) axis = 'Y';
    else if (pz >= px && pz >= py) axis = 'Z';
    return { axis, proj: { X: px, Y: py, Z: pz }, len };
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
    const dirN = worldDir.clone().normalize();
    dlog("findBestAlignCandidate:start", { axisLabel, worldDir: dirN.toArray() });

    const selfFaces = getFacesAlongDir({ obj, ref: groupRef, dir: dirN });
    let bestCandidate = null;
    let minDistance = Infinity;

    for (const targetObj of allObjects) {
      if (targetObj.id === obj.id || !targetObj.visible) continue;
      const targetTF = getWorldTransform({ ref: null, obj: targetObj });
      const picked = pickTargetBasis(targetTF, dirN);
      const targetDir = picked.dir; // 已归一化
      const targetAxisLabel = picked.label; // 'X' | 'Y' | 'Z'

      // ⛔ 角度不平行则跳过（仅当 |cosθ| >= cos(tol) 才认为可对齐）
      const parallelCos = Math.abs(dirN.dot(targetDir));
      if (parallelCos < PARALLEL_COS) {
        dlog("skip:not-parallel", { targetId: targetObj.id, parallelCos, need: PARALLEL_COS });
        continue;
      }

      const targetFaces = getFacesAlongDir({ obj: targetObj, ref: null, dir: targetDir });

      for (const selfFace of selfFaces) {
        for (const targetFace of targetFaces) {
          // 统一标量方向：若 targetDir 与 selfDir 反向，则把目标侧标量翻转到同一坐标系
          const sameOrientation = Math.sign(targetDir.dot(dirN)) || 1;
          const targetCoordAligned = sameOrientation * targetFace.coord;
          const distance = Math.abs(selfFace.coord - targetCoordAligned);
          if (distance < minDistance && distance < DIST_THRESHOLD) {
            minDistance = distance;
            bestCandidate = {
              axisLabel,
              selfFace: selfFace.name,
              targetFace: targetFace.name,
              targetObj,
              distance,
              selfDir: dirN.clone(),
              targetDir: targetDir.clone(),
              targetAxisLabel,
            };
            dlog("candidate:update", { targetId: targetObj.id, distance, axisLabel, targetAxisLabel });
          }
        }
      }
    }

    // —— 粘滞/抗抖：没有新候选时，短时间保留旧候选；有新候选时，只有明显更好才替换 ——
    let finalCandidate = bestAlignCandidate;
    const prev = lastAlignCandidateRef.current;

    if (!bestCandidate) {
      if (prev && noHitFramesRef.current < GRACE_FRAMES) {
        finalCandidate = prev; // 宽限期内沿用上一个
        noHitFramesRef.current += 1;
        dlog('candidate:stick(prev)', { noHitFrames: noHitFramesRef.current });
      } else {
        finalCandidate = null;
        noHitFramesRef.current = 0;
      }
    } else {
      noHitFramesRef.current = 0;
      if (prev && prev.targetObj?.id === bestCandidate.targetObj?.id && prev.targetAxisLabel === bestCandidate.targetAxisLabel) {
        // 若新候选没有“显著更好”（小于 IMPROVE_MM），继续沿用旧候选，避免来回跳
        if (bestCandidate.distance > prev.distance - IMPROVE_MM) {
          finalCandidate = prev;
          dlog('candidate:keep(prev)', { prevDist: prev.distance, newDist: bestCandidate.distance });
        } else {
          finalCandidate = bestCandidate;
        }
      } else {
        finalCandidate = bestCandidate;
      }
    }

    setBestAlignCandidate(finalCandidate);
    dlog("candidate:final", finalCandidate);
    if (finalCandidate) lastAlignCandidateRef.current = finalCandidate;
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

    // 若目标法线与当前拖拽方向反向，统一到 selfDir 的标量系
    const sameOrientation = Math.sign(targetDir.dot(dir)) || 1;
    const targetFaceCoordRaw = targetTF.p.dot(targetDir) + targetSign * targetHalf;
    const targetFaceCoord = sameOrientation * targetFaceCoordRaw;

    const cur = groupRef.current.position.clone();
    const s = cur.dot(dir);
    const newCenterCoord = targetFaceCoord - selfSign * selfHalf;
    const newPos = cur.add(dir.multiplyScalar(newCenterCoord - s));
    const out = newPos.toArray();
    dlog("calculateAlignPosition", { selfFace, targetFace, selfHalf, targetHalf, targetFaceCoord, newPos: out });
    return out;
  };

  // 平滑吸附动画，避免瞬移（120ms 线性插值）
  const snapToCandidate = (candidate) => {
    const targetPos = calculateAlignPosition(candidate);
    const ctrl = controlsRef.current;
    const from = groupRef.current.position.clone();
    const to = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]);
    const start = performance.now();
    const dur = 120; // ms

    const prevEnabled = ctrl?.enabled;
    if (ctrl) ctrl.enabled = false;

    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const cur = from.clone().lerp(to, t);
      groupRef.current.position.copy(cur);
      groupRef.current.updateMatrixWorld(true);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        const p = groupRef.current.position.clone().toArray();
        setObj((prev) => ({ ...prev, pos: p }));
        if (ctrl) {
          ctrl.detach();
          ctrl.attach(groupRef.current);
          ctrl.enabled = prevEnabled ?? true;
        }
      }
    }

    requestAnimationFrame(step);
  };

  // 统一的“拖拽结束”处理：onDraggingChange(false) 与全局 pointerup 都会调用
  const handleDragEnd = () => {
    const candidate = bestAlignCandidate || lastAlignCandidateRef.current;
    dlog("onDragEnd", {
      hasCandidate: !!candidate,
      best: !!bestAlignCandidate,
      cached: !!lastAlignCandidateRef.current,
      isShiftPressed,
    });

    if (candidate) {
      // 只要当前/最近存在高亮候选，就吸附（不再强制要求 Shift）
      snapToCandidate(candidate);
    } else {
      const p = groupRef.current.position.clone().toArray();
      const r = [
        groupRef.current.rotation.x,
        groupRef.current.rotation.y,
        groupRef.current.rotation.z,
      ];
      setObj((prev) => ({ ...prev, pos: p, rot: r }));
      dlog("onDragEnd:no-snap", { pos: p });
    }
    setBestAlignCandidate(null);
    lastAlignCandidateRef.current = null;
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
    prevPosRef.current = p; // 初始化上一帧位置
    setDelta({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });
    isDraggingRef.current = true;
    dlog("startDrag", { pos: p, rot: r });
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
    const d = {
      dx: +(p[0] - s.pos[0]).toFixed(3),
      dy: +(p[1] - s.pos[1]).toFixed(3),
      dz: +(p[2] - s.pos[2]).toFixed(3),
      rx: +(((r[0] - s.rot[0]) * 180) / Math.PI).toFixed(2),
      ry: +(((r[1] - s.rot[1]) * 180) / Math.PI).toFixed(2),
      rz: +(((r[2] - s.rot[2]) * 180) / Math.PI).toFixed(2),
    };
    setDelta(d);

    // 计算当前帧移动向量（上一帧 -> 当前帧）
    let mv = null;
    if (prevPosRef.current) {
      mv = new THREE.Vector3(
        p[0] - prevPosRef.current[0],
        p[1] - prevPosRef.current[1],
        p[2] - prevPosRef.current[2]
      );
    }
    prevPosRef.current = p;

    // 未按住 Shift：不对齐
    if (!isShiftPressed) { setBestAlignCandidate(null); return; }

    // 备用：世界轴主导判断（退化用）
    const absDx = Math.abs(d.dx), absDy = Math.abs(d.dy), absDz = Math.abs(d.dz);
    let currentDragAxis = null;
    if (absDx > absDy && absDx > absDz) currentDragAxis = 'X';
    else if (absDy > absDx && absDy > absDz) currentDragAxis = 'Y';
    else if (absDz > absDx && absDz > absDy) currentDragAxis = 'Z';

    // 等移动超过阈值再解析轴，避免第一帧误判
    const selfTF = getWorldTransform({ ref: groupRef, obj });
    const mvLen = mv ? mv.length() : 0;
    if (mvLen < MIN_MOVE_EPS) {
      dlog('axis:wait-move', { mvLen });
      // 保持现有候选，避免低速/停顿帧导致的闪烁
      return;
    }

    // 解析轴：控件轴优先，必要时用移动向量纠错
    const axisFromCtrlRaw = controlsRef.current?.axis || null; // 'X'|'Y'|'Z'|'XY'|'YZ'|'XZ'|null
    let resolvedAxis = (axisFromCtrlRaw === 'X' || axisFromCtrlRaw === 'Y' || axisFromCtrlRaw === 'Z') ? axisFromCtrlRaw : null;

    const { axis: inferred, proj } = inferAxisFromMovement(mv, selfTF);
    dlog('axis:mv-proj', { mv: mv?.toArray?.(), len: +mvLen.toFixed(3), proj });

    if (!resolvedAxis) {
      resolvedAxis = inferred || currentDragAxis;
    } else {
      // 仅当推断轴投影显著更大时才覆盖控件轴
      const margin = 1.25; // 25%
      const ctrlProj = proj[resolvedAxis] ?? 0;
      const infProj = inferred ? (proj[inferred] ?? 0) : 0;
      if (inferred && inferred !== resolvedAxis && infProj > ctrlProj * margin) {
        dlog('axis:override', { from: resolvedAxis, to: inferred, ctrlProj, infProj });
        resolvedAxis = inferred;
      } else {
        dlog('axis:keep', { kept: resolvedAxis, ctrlProj, infProj, mvLen });
      }
    }

    // 根据解析的轴找候选（不平行/超距会被过滤）
    if (resolvedAxis === 'X' || resolvedAxis === 'Y' || resolvedAxis === 'Z') {
      const worldDir = getLocalAxisDir(selfTF, resolvedAxis);
      dlog('axis:resolved', { axisFromCtrlRaw, resolvedAxis, mv: mv?.toArray?.() });
      if (worldDir) findBestAlignCandidate(worldDir, resolvedAxis);
    } else if (currentDragAxis) {
      const worldDir =
        currentDragAxis === 'X'
          ? new THREE.Vector3(1, 0, 0)
          : currentDragAxis === 'Y'
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
      dlog('axis:fallback-world', { currentDragAxis });
      findBestAlignCandidate(worldDir, currentDragAxis);
    } else {
      // 解析不到轴时，保留上一候选，避免短促抖动造成的熄灭
      // （findBestAlignCandidate 内部也有粘滞/宽限控制）
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
          onObjectChange={() => {
            updateDuringDrag();
            const p = groupRef.current.position.clone().toArray();
            const r = [
              groupRef.current.rotation.x,
              groupRef.current.rotation.y,
              groupRef.current.rotation.z,
            ];
            setObj((prev) => ({ ...prev, pos: p, rot: r }));
          }}
          onMouseDown={() => {
            startDrag();
            lastAlignCandidateRef.current = null;
            // 添加全局 pointerup 兜底：某些平台 TransformControls 不总是触发 dragging=false
            if (upListenerRef.current) {
              window.removeEventListener('pointerup', upListenerRef.current);
              upListenerRef.current = null;
            }
            upListenerRef.current = () => {
              if (isDraggingRef.current) handleDragEnd();
              window.removeEventListener('pointerup', upListenerRef.current);
              upListenerRef.current = null;
            };
            window.addEventListener('pointerup', upListenerRef.current, { once: true });
          }}
          onDraggingChange={(dragging) => {
            isDraggingRef.current = dragging;
            setDragging?.(dragging);
            if (!dragging) {
              // 优先用控件回调触发一次结束逻辑
              handleDragEnd();
              // 清理全局 pointerup 监听
              if (upListenerRef.current) {
                window.removeEventListener('pointerup', upListenerRef.current);
                upListenerRef.current = null;
              }
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}

      {/* ✅ 面高亮（世界坐标 & 继承物体旋转） */}
      {bestAlignCandidate && (
        <group>
          {targetHighlightDetails && (
            <mesh
              position={targetHighlightDetails.center}
              quaternion={targetHighlightDetails.quaternion}
              renderOrder={9998}
              frustumCulled={false}
            >
              <boxGeometry args={targetHighlightDetails.size} />
              <meshBasicMaterial
                color="#00ff00"
                transparent
                opacity={0.5}
                depthTest={false}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                toneMapped={false}
              />
            </mesh>
          )}
          {selfHighlightDetails && (
            <mesh
              position={selfHighlightDetails.center}
              quaternion={selfHighlightDetails.quaternion}
              renderOrder={9999}
              frustumCulled={false}
            >
              <boxGeometry args={selfHighlightDetails.size} />
              <meshBasicMaterial
                color="#3b82f6"
                transparent
                opacity={0.5}
                depthTest={false}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-4}
                toneMapped={false}
              />
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
              <span style={{ color: t?.muted || "#64748b" }}>X:</span>
              <input type="number" value={Number(obj.pos[0].toFixed(1))} onChange={(e) => handlePosChange(0, e.target.value)} style={hudInputStyle} />
              <span style={{ color: t?.muted || "#64748b" }}>Y:</span>
              <input type="number" value={Number(obj.pos[1].toFixed(1))} onChange={(e) => handlePosChange(1, e.target.value)} style={hudInputStyle} />
              <span style={{ color: t?.muted || "#64748b" }}>Z:</span>
              <input type="number" value={Number(obj.pos[2].toFixed(1))} onChange={(e) => handlePosChange(2, e.target.value)} style={hudInputStyle} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, borderLeft: `1px solid ${t?.border || "#e5e7eb"}`, paddingLeft: 12 }}>
              <span style={{ color: t?.muted || "#64748b" }}>Rx:</span>
              <input type="number" value={Number(THREE.MathUtils.radToDeg(obj.rot[0]).toFixed(1))} onChange={(e) => handleRotChange(0, e.target.value)} style={hudInputStyle} />
              <span style={{ color: t?.muted || "#64748b" }}>Ry:</span>
              <input type="number" value={Number(THREE.MathUtils.radToDeg(obj.rot[1]).toFixed(1))} onChange={(e) => handleRotChange(1, e.target.value)} style={hudInputStyle} />
              <span style={{ color: t?.muted || "#64748b" }}>Rz:</span>
              <input type="number" value={Number(THREE.MathUtils.radToDeg(obj.rot[2]).toFixed(1))} onChange={(e) => handleRotChange(2, e.target.value)} style={hudInputStyle} />
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
