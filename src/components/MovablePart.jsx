
// components/MovablePart.jsx — 选中/移动/旋转 + HUD（旋转安全的高亮/吸附 + 调试日志）
import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { TransformControls, Html } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import {
  MotherboardMesh, GPUMesh, GPUBracketMesh, PartBox, GroupMesh,
  ImportedMesh,
  ReferenceMesh,
  CPUCoolerMesh,
} from "./Meshes.jsx";
import { getMotherboardIoCutoutBounds } from "../config/motherboardPresets";

const dlog = (...args) => console.log("[MovablePart]", ...args);

const CONNECTOR_TYPE_COLORS = {
  "screw-m3": "#38bdf8",
  "screw-m4": "#f97316",
  "pcie-slot": "#f87171",
  "pcie-fingers": "#22d3ee",
  "dimm-slot": "#facc15",
  "dimm-edge": "#fbbf24",
  "bracket-tab": "#a855f7",
};

const getConnectorBaseColor = (connector) => {
  if (!connector?.type) return "#facc15";
  return CONNECTOR_TYPE_COLORS[connector.type] || "#facc15";
};

const buildConnectorQuaternion = (connector) => {
  const normal = Array.isArray(connector?.normal)
    ? new THREE.Vector3(connector.normal[0], connector.normal[1], connector.normal[2])
    : new THREE.Vector3(0, 1, 0);

  if (normal.lengthSq() === 0) {
    normal.set(0, 1, 0);
  }
  normal.normalize();

  let up = Array.isArray(connector?.up)
    ? new THREE.Vector3(connector.up[0], connector.up[1], connector.up[2])
    : new THREE.Vector3(0, 0, 1);

  if (up.lengthSq() === 0 || Math.abs(up.dot(normal)) > 0.999) {
    up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  }

  const projected = normal.clone().multiplyScalar(up.dot(normal));
  up.sub(projected);
  if (up.lengthSq() === 0) {
    up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    up.sub(normal.clone().multiplyScalar(up.dot(normal)));
  }
  up.normalize();

  const xAxis = new THREE.Vector3().crossVectors(up, normal);
  if (xAxis.lengthSq() === 0) {
    xAxis.set(1, 0, 0).cross(normal).normalize();
  } else {
    xAxis.normalize();
  }

  const rotation = new THREE.Matrix4().makeBasis(xAxis, up, normal);
  return new THREE.Quaternion().setFromRotationMatrix(rotation);
};

const IO_CUTOUT_FACE = "io-cutout";
const ROTATION_SNAP_DEG = 45;
const ROTATION_SNAP_TOL_DEG = 3;

const pointInsideIoCutout = (obj, localPoint, tolerance = 1) => {
  if (obj?.type !== "motherboard") return false;
  const spec = getMotherboardIoCutoutBounds(obj.dims);
  if (!spec) return false;
  const [cx, cy, cz] = spec.center;
  const [w, h, d] = spec.size;
  return (
    Math.abs(localPoint.x - cx) <= w / 2 + tolerance &&
    Math.abs(localPoint.y - cy) <= h / 2 + tolerance &&
    Math.abs(localPoint.z - cz) <= d / 2 + tolerance
  );
};

const ConnectorMarker = ({ connector, isUsed, onPick }) => {
  const [hovered, setHovered] = useState(false);

  const quaternion = useMemo(() => buildConnectorQuaternion(connector), [connector]);
  const position = Array.isArray(connector?.pos) && connector.pos.length === 3
    ? connector.pos
    : [0, 0, 0];

  const radius = connector.visualRadius ?? 4;
  const stemLength = connector.visualStem ?? 10;

  const baseColor = getConnectorBaseColor(connector);
  const color = hovered ? "#60a5fa" : baseColor;
  const opacity = isUsed ? 0.35 : hovered ? 1 : 0.85;

  const handlePointerEnter = (event) => {
    event.stopPropagation();
    setHovered(true);
  };

  const handlePointerLeave = (event) => {
    event.stopPropagation();
    setHovered(false);
  };

  const handlePointerDown = (event) => {
    event.stopPropagation();
    if (typeof onPick === "function") {
      onPick(connector);
    }
  };

  return (
    <group position={position} quaternion={quaternion} frustumCulled={false}>
      <mesh
        position={[0, 0, stemLength / 2]}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        renderOrder={1000}
        frustumCulled={false}
      >
        <cylinderGeometry args={[radius * 0.25, radius * 0.25, stemLength, 10]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        position={[0, 0, stemLength]}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        renderOrder={1001}
        frustumCulled={false}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={Math.min(1, opacity + 0.25)}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      {hovered && connector?.label && (
        <Html
          center
          distanceFactor={14}
          position={[0, stemLength + radius * 1.6, 0]}
          zIndexRange={[1000, 2000]}
        >
          <div
            style={{
              padding: "2px 6px",
              borderRadius: 6,
              background: "rgba(15, 23, 42, 0.85)",
              color: "#e2e8f0",
              fontSize: 11,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {connector.label}
          </div>
        </Html>
      )}
    </group>
  );
};

export default function MovablePart({
  obj,
  selected,
  setObj,
  onSelect,
  palette,
  allObjects = [], // 用于面检测
  setDragging, // 告知父组件控制 OrbitControls
  connections = [],
  alignMode = false,
  onFacePick,
  onConnectorPick,
  activeAlignFace,
  mode = "translate",
  onModeChange,
  showTransformControls = false,
}) {
  const t = palette;
  const groupRef = useRef();
  const controlsRef = useRef();
  const hoverFaceMeshRef = useRef(null);
  const [hoveredFace, setHoveredFace] = useState(null);
  const stretchStateRef = useRef(null);
  const { gl, camera } = useThree();

  useEffect(() => {
    if (obj.type === 'gpu-bracket') {
      console.log("[MovablePart] GPU Bracket Update:", { id: obj.id, pos: obj.pos, rot: obj.rot });
    }
  }, [obj]);

  // Fix: Stabilize setObj to prevent handleStretchPointerMove from changing and triggering useEffect cleanup
  const setObjRef = useRef(setObj);
  useEffect(() => {
    setObjRef.current = setObj;
  }, [setObj]);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const finishStretchRef = useRef(null);

  const requestFinish = useCallback((reason) => {
    console.log("[stretch/finish-request]", reason);
    finishStretchRef.current?.();
  }, []);

  const handleWindowPointerUp = useCallback((event) => {
    console.log("[stretch/window-pointerup]", {
      pointerId: event.pointerId,
      buttons: event.buttons,
    });
    requestFinish("pointerup");
  }, [requestFinish]);

  const handleWindowPointerCancel = useCallback((event) => {
    console.log("[stretch/window-pointercancel]", {
      pointerId: event.pointerId,
    });
    requestFinish("pointercancel");
  }, [requestFinish]);

  const handleWindowBlur = useCallback(() => {
    console.log("[stretch/window-blur]");
    requestFinish("window-blur");
  }, [requestFinish]);
  const computeAxisOffsetFromRay = useCallback((ray, axisOrigin, axisDirection) => {
    if (!ray || !axisOrigin || !axisDirection) {
      return null;
    }
    const w0 = axisOrigin.clone().sub(ray.origin);
    const rayDir = ray.direction.clone().normalize();
    const b = axisDirection.dot(rayDir);
    const d = axisDirection.dot(w0);
    const e = rayDir.dot(w0);
    const denom = 1 - b * b;
    let result;
    if (Math.abs(denom) < 0.05) {
      console.log("[stretch/axisOffset] denom too small (parallel view)", denom);
      return null;
    } else {
      result = (b * e - d) / denom;
    }
    console.log("[stretch/axisOffset]", {
      rayOrigin: ray.origin.toArray?.() ?? null,
      rayDir: rayDir.toArray?.() ?? null,
      axisOrigin: axisOrigin.toArray?.() ?? null,
      axisDir: axisDirection.toArray?.() ?? null,
      denom,
      result,
    });
    return result;
  }, []);
  const isEmbedded = !!obj?.embeddedParentId || obj?.type === "embedded";

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.traverse?.((child) => {
      if (!child) return;
      if (child.name === 'XYZ' || child.name === 'XYZE') {
        child.visible = false;
      }
    });
  }, [showTransformControls, selected]);

  // ✅ UI 锁：当在 HUD 上交互时，禁用 TransformControls + OrbitControls
  const [uiLock, setUiLock] = useState(false);

  const connectedConnectorIds = useMemo(() => {
    if (!Array.isArray(connections)) return new Set();
    const set = new Set();
    connections.forEach((connection) => {
      if (connection?.from?.partId === obj.id && connection.from.connectorId) {
        set.add(connection.from.connectorId);
      }
      if (connection?.to?.partId === obj.id && connection.to.connectorId) {
        set.add(connection.to.connectorId);
      }
    });
    return set;
  }, [connections, obj.id]);

  const handleDimChange = (axis, value) => {
    if (isEmbedded) return;
    const newDimValue = Number(value) || 0;
    setObj((prev) => {
      const newDims = { ...prev.dims, [axis]: newDimValue };
      return { ...prev, dims: newDims };
    });
  };

  const handlePosChange = (axisIndex, value) => {
    if (isEmbedded) return;
    const newPosValue = Number(value) || 0;
    setObj((prev) => {
      const newPos = [...prev.pos];
      newPos[axisIndex] = newPosValue;
      return { ...prev, pos: newPos };
    });
  };

  const handleRotChange = (axisIndex, value) => {
    if (isEmbedded) return;
    const newRotValueDeg = Number(value) || 0;
    const newRotValueRad = THREE.MathUtils.degToRad(newRotValueDeg);
    setObj((prev) => {
      const newRot = [...prev.rot];
      newRot[axisIndex] = newRotValueRad;
      return { ...prev, rot: newRot };
    });
  };

  const applyRotationSnap = useCallback(
    (rotationArray) => {
      if (mode !== "rotate" || !controlsRef.current || !groupRef.current) {
        return rotationArray;
      }
      const activeAxis = controlsRef.current.axis;
      if (!activeAxis) {
        return rotationArray;
      }
      const axisLetters = ["X", "Y", "Z"].filter((letter) =>
        activeAxis.includes(letter)
      );
      if (!axisLetters.length) {
        return rotationArray;
      }
      const snapped = [...rotationArray];
      let didSnap = false;
      axisLetters.forEach((letter) => {
        const index = letter === "X" ? 0 : letter === "Y" ? 1 : 2;
        const prop = letter.toLowerCase();
        const deg = THREE.MathUtils.radToDeg(snapped[index]);
        const nearest = Math.round(deg / ROTATION_SNAP_DEG) * ROTATION_SNAP_DEG;
        if (Math.abs(deg - nearest) <= ROTATION_SNAP_TOL_DEG) {
          const rad = THREE.MathUtils.degToRad(nearest);
          snapped[index] = rad;
          groupRef.current.rotation[prop] = rad;
          didSnap = true;
        }
      });
      return didSnap ? snapped : rotationArray;
    },
    [mode]
  );

  const applyStretchDelta = useCallback(
    (delta) => {
      const state = stretchStateRef.current;
      if (!state || !groupRef.current) return;
      const { axisInfo, startDims, startPosVec, axisDirection, objectId } = state;
      if (!axisInfo?.dimKey || !axisDirection || !startPosVec) return;
      const startSize = Number(startDims[axisInfo.dimKey]) || 0;
      let appliedDelta = delta;
      let nextSize = startSize + appliedDelta;
      const minSize = 1;
      if (nextSize < minSize) {
        nextSize = minSize;
        appliedDelta = nextSize - startSize;
      }
      const newDims = { ...startDims, [axisInfo.dimKey]: nextSize };
      const centerOffset = axisDirection.clone().multiplyScalar(appliedDelta / 2);
      const newPosVec = startPosVec.clone().add(centerOffset);

      groupRef.current.position.copy(newPosVec);

      // Use ref to avoid dependency change
      setObjRef.current((prev) => ({
        ...prev,
        dims: newDims,
        pos: [newPosVec.x, newPosVec.y, newPosVec.z],
      }));
      state.lastDelta = appliedDelta;
      console.log("[stretch/applyDelta]", {
        part: objectId,
        face: state.faceName,
        dimKey: axisInfo.dimKey,
        startSize,
        nextSize,
        appliedDelta,
        centerOffset: centerOffset.toArray(),
        startPos: startPosVec.toArray(),
        newPos: newPosVec.toArray(),
      });
    },
    [] // Removed setObj dependency
  );

  const handleStretchPointerMove = useCallback(
    (event) => {
      console.log("[stretch/pointerMove:raw]", {
        type: event.type,
        buttons: event.buttons,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
      });
      const state = stretchStateRef.current;
      if (!state || !state.axisDirection || !state.axisOrigin) return;
      if (event.buttons === 0) {
        // Relaxed check: just ignore this event, don't kill the drag
        // requestFinish("pointermove-buttons-zero");
        return;
      }
      const rect = gl.domElement.getBoundingClientRect();
      pointerNdc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointerNdc, camera);
      const { axisDirection: axisDir, axisOrigin, objectId, pointerId } = state;
      if (pointerId !== undefined && pointerId !== event.pointerId) {
        console.log("[stretch/pointerMove] pointerId mismatch (ignoring)", {
          expected: pointerId,
          received: event.pointerId,
        });
        // Relaxed check: just ignore other pointers
        // requestFinish("pointer-id-mismatch");
        return;
      }
      const axisOffset = computeAxisOffsetFromRay(
        raycaster.ray,
        axisOrigin,
        axisDir
      );
      if (typeof axisOffset !== "number" || Number.isNaN(axisOffset)) {
        return;
      }
      const delta = axisOffset - state.startAxisOffset;
      console.log("[stretch/pointerMove] details", {
        buttons: event.buttons,
        pointerId: event.pointerId,
        axisOffset,
        startAxisOffset: state.startAxisOffset,
        delta,
        axisDir: axisDir.toArray(),
        axisOrigin: axisOrigin.toArray(),
      });
      // Check for drag threshold to distinguish click from drag
      if (!state.hasTriggeredDrag) {
        const dist = Math.sqrt(
          Math.pow(event.clientX - state.startScreenPos.x, 2) +
          Math.pow(event.clientY - state.startScreenPos.y, 2)
        );
        if (dist < 5) {
          // Hasn't moved enough to count as drag
          return;
        }
        state.hasTriggeredDrag = true;
      }

      applyStretchDelta(delta);
    },
    [
      applyStretchDelta,
      computeAxisOffsetFromRay,
      gl,
      pointerNdc,
      raycaster,
      requestFinish,
    ]
  );

  const finishStretch = useCallback(() => {
    if (!stretchStateRef.current) return;
    window.removeEventListener("pointermove", handleStretchPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
    window.removeEventListener("pointercancel", handleWindowPointerCancel);
    window.removeEventListener("blur", handleWindowBlur);
    console.log("[stretch/finish]", {
      part: stretchStateRef.current?.objectId,
      face: stretchStateRef.current?.faceName,
    });
    const captureTarget = stretchStateRef.current?.pointerCaptureTarget;
    const pointerId = stretchStateRef.current?.pointerId;
    if (captureTarget && typeof captureTarget.releasePointerCapture === "function" && pointerId !== undefined) {
      try {
        captureTarget.releasePointerCapture(pointerId);
        console.log("[stretch/finish] releasePointerCapture", { pointerId });
      } catch (releaseError) {
        console.warn("[stretch/finish] failed to release pointer capture", releaseError);
      }
    }
    const wasDrag = stretchStateRef.current?.hasTriggeredDrag;
    const faceName = stretchStateRef.current?.faceName;
    const objectId = stretchStateRef.current?.objectId;

    stretchStateRef.current = null;
    setUiLock(false);

    // If it wasn't a drag, treat it as a click (pick face)
    if (!wasDrag && onFacePick && faceName && objectId) {
      console.log("[stretch/finish] treated as click", { objectId, faceName });
      onFacePick({ partId: objectId, face: faceName, shiftKey: isShiftPressed });
    }

    setObj((prev) => {
      if (!Array.isArray(prev.connectors) || prev.connectors.length === 0) {
        return prev;
      }
      return { ...prev, connectors: [] };
    });
  }, [handleStretchPointerMove, handleWindowBlur, handleWindowPointerCancel, handleWindowPointerUp, setObj]);

  useEffect(() => {
    finishStretchRef.current = finishStretch;
  }, [finishStretch]);

  useEffect(() => {
    return () => {
      console.log("[stretch/cleanup] removing listeners");
      window.removeEventListener("pointermove", handleStretchPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [handleStretchPointerMove, handleWindowBlur, handleWindowPointerCancel, handleWindowPointerUp]);

  const beginStretch = useCallback(
    (faceName, faceDetails, event) => {
      if (stretchStateRef.current) {
        console.log("[stretch/begin] aborted: existing session, forcing finish");
        requestFinish("begin-stale-session");
        if (stretchStateRef.current) {
          return;
        }
      }
      if (!faceDetails) {
        console.log("[stretch/begin] aborted: no faceDetails");
        return;
      }
      if (isEmbedded) {
        console.log("[stretch/begin] aborted: embedded part");
        return;
      }
      const axisInfo = getStretchAxisInfo(obj, faceName);
      if (!axisInfo) {
        console.log("[stretch/begin] aborted: axisInfo missing");
        return;
      }
      const axisDirection = new THREE.Vector3(...(faceDetails.normal || [0, 0, 1])).normalize();
      const axisOrigin = new THREE.Vector3(...(faceDetails.center || [0, 0, 0]));
      const startPosVec = new THREE.Vector3(
        ...(Array.isArray(obj.pos) ? obj.pos : [0, 0, 0])
      );
      const startAxisOffset = computeAxisOffsetFromRay(
        event.ray,
        axisOrigin,
        axisDirection
      );
      if (typeof startAxisOffset !== "number" || Number.isNaN(startAxisOffset)) {
        console.log("[stretch/begin] aborted: invalid axis offset", {
          rayOrigin: event.ray.origin.toArray(),
          rayDir: event.ray.direction.toArray(),
          axisOrigin: axisOrigin.toArray(),
          axisDir: axisDirection.toArray(),
        });
        return;
      }
      stretchStateRef.current = {
        faceName,
        axisDirection,
        axisOrigin,
        objectId: obj?.id ?? obj?.name ?? "unknown",
        axisInfo,
        startAxisOffset,
        startDims: { ...(obj.dims || {}) },
        startPosVec,
        lastDelta: 0,
        pointerId: event.pointerId,
        pointerCaptureTarget:
          event.target && typeof event.target.setPointerCapture === "function"
            ? event.target
            : null,
        hasTriggeredDrag: false, // New flag to track if actual drag occurred
        startScreenPos: { x: event.clientX, y: event.clientY }, // Track start screen pos
      };
      if (stretchStateRef.current.pointerCaptureTarget) {
        try {
          stretchStateRef.current.pointerCaptureTarget.setPointerCapture(event.pointerId);
          console.log("[stretch/begin] setPointerCapture", {
            pointerId: event.pointerId,
            target: stretchStateRef.current.pointerCaptureTarget,
          });
        } catch (captureError) {
          console.warn("[stretch/begin] failed to capture pointer", captureError);
          stretchStateRef.current.pointerCaptureTarget = null;
        }
      }
      console.log("[stretch/begin] started", {
        part: obj?.id,
        face: faceName,
        axisOrigin: axisOrigin.toArray(),
        axisDir: axisDirection.toArray(),
        startAxisOffset,
        pointerId: event.pointerId,
      });
      setHoveredFace(faceName);
      setUiLock(true);
      window.addEventListener("pointermove", handleStretchPointerMove);
      window.addEventListener("pointerup", handleWindowPointerUp);
      window.addEventListener("pointercancel", handleWindowPointerCancel);
      window.addEventListener("blur", handleWindowBlur);
    },
    [
      computeAxisOffsetFromRay,
      handleStretchPointerMove,
      handleWindowBlur,
      handleWindowPointerCancel,
      handleWindowPointerUp,
      isEmbedded,
      obj,
      setHoveredFace,
      requestFinish,
    ]
  );


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
  const lastHoverSampleRef = useRef({ local: null, world: null });

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
    let targetObj = obj;
    let targetFace = faceName;
    let isChild = false;

    if (faceName && faceName.includes("#")) {
      const [childId, face] = faceName.split("#");
      targetFace = face;
      // Find child in obj.children (assuming flat structure for now)
      const child = obj.children?.find((c) => c.id === childId);
      if (child) {
        targetObj = child;
        isChild = true;
      }
    }

    const { p, q } = getWorldTransform({ ref, obj }); // Group Transform

    if (isChild) {
      // Compose Child Transform
      const childPos = new THREE.Vector3(...(targetObj.pos || [0, 0, 0]));
      const childEuler = new THREE.Euler(...(targetObj.rot || [0, 0, 0]));
      const childQuat = new THREE.Quaternion().setFromEuler(childEuler);

      // WorldPos = GroupPos + GroupQuat * ChildPos
      p.add(childPos.applyQuaternion(q));
      // WorldQuat = GroupQuat * ChildQuat
      q.multiply(childQuat);
    }

    const dims = targetObj?.dims || {};
    // For gpu-body, it's a standard box, so w=width, d=depth.
    // Only keep the swap for 'gpu' if that was intended for the group box (though it seems odd if group box is w,h,d).
    // Let's assume 'gpu' group also follows w,h,d.
    const width = dims.w ?? 0;
    const height = dims.h ?? 0;
    const depth = dims.d ?? 0;
    const thickness = 0.2;
    const surfacePadding = 0.02; // 沿面法线轻微外移，避免闪烁

    // Use targetFace instead of faceName for the switch
    const currentFaceName = targetFace;

    let localOffset;
    let size;
    let localNormal;

    if (currentFaceName === IO_CUTOUT_FACE && obj?.type === "motherboard") {
      const spec = getMotherboardIoCutoutBounds(dims);
      if (!spec) return null;
      localOffset = new THREE.Vector3(
        spec.center?.[0] ?? 0,
        spec.center?.[1] ?? 0,
        spec.center?.[2] ?? 0
      );
      localNormal = new THREE.Vector3(
        spec.normal?.[0] ?? 0,
        spec.normal?.[1] ?? 0,
        spec.normal?.[2] ?? 1
      ).normalize();
      localOffset.add(localNormal.clone().setLength(surfacePadding));
      size = [
        spec.size?.[0] ?? width,
        spec.size?.[1] ?? height,
        thickness,
      ];
    } else {
      const sign = currentFaceName[0] === "+" ? 1 : -1;
      switch (currentFaceName) {
        case "+X":
        case "-X":
          localOffset = new THREE.Vector3(sign * (width / 2 + surfacePadding), 0, 0);
          size = [thickness, height, depth];
          localNormal = new THREE.Vector3(sign, 0, 0);
          break;
        case "+Y":
        case "-Y":
          localOffset = new THREE.Vector3(0, sign * (height / 2 + surfacePadding), 0);
          size = [width, thickness, depth];
          localNormal = new THREE.Vector3(0, sign, 0);
          break;
        case "+Z":
        case "-Z":
          localOffset = new THREE.Vector3(0, 0, sign * (depth / 2 + surfacePadding));
          size = [width, height, thickness];
          localNormal = new THREE.Vector3(0, 0, sign);
          break;
        default:
          return null;
      }
    }

    const localCenter = localOffset.clone();
    const worldOffset = localOffset.clone().applyQuaternion(q);
    const center = new THREE.Vector3().copy(p).add(worldOffset);
    const worldNormal = localNormal.applyQuaternion(q).normalize();
    return {
      center: center.toArray(),
      localCenter: localCenter.toArray(),
      size,
      quaternion: q.clone(),
      normal: worldNormal.toArray(),
    };
  };

  const getStretchAxisInfo = (obj, faceName) => {
    if (!faceName || faceName.length < 2) return null;
    const axis = faceName[1];
    const sign = faceName[0] === "+" ? 1 : -1;
    let dimKey = null;
    if (axis === "X") {
      dimKey = "w";
    } else if (axis === "Y") {
      dimKey = "h";
    } else if (axis === "Z") {
      dimKey = "d";
    }
    if (!dimKey) return null;
    return { axis, dimKey, sign };
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
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#fff",
    color: "#111827",
    fontSize: 12,
    outline: "none",
    textAlign: "center",
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

  useEffect(() => {
    if (!alignMode && mode !== "scale") {
      setHoveredFace(null);
    }
  }, [alignMode, mode]);

  const selfHighlightDetails = useMemo(() => {
    if (!bestAlignCandidate) return null;
    const axis = bestAlignCandidate.axisLabel;
    const face = bestAlignCandidate.selfFace[0] + axis; // '+X' / '-Y' / ...
    return getFaceDetails({ obj, ref: groupRef, faceName: face });
  }, [bestAlignCandidate, obj]);

  const hoveredFaceDetails = useMemo(() => {
    if (!hoveredFace) return null;
    return getFaceDetails({ obj, ref: groupRef, faceName: hoveredFace });
  }, [hoveredFace, obj]);

  useEffect(() => {
    if (!hoveredFace || !hoveredFaceDetails) return;
    const sample = lastHoverSampleRef.current;
    const worldCenter = (() => {
      if (!groupRef.current) return null;
      const v = new THREE.Vector3();
      groupRef.current.getWorldPosition(v);
      return v.toArray();
    })();
    const rotDeg = (() => {
      if (!groupRef.current) return null;
      const e = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion, "XYZ");
      return [
        THREE.MathUtils.radToDeg(e.x).toFixed(2),
        THREE.MathUtils.radToDeg(e.y).toFixed(2),
        THREE.MathUtils.radToDeg(e.z).toFixed(2),
      ];
    })();
    const localFaceCenter = hoveredFaceDetails?.localCenter || (() => {
      if (!hoveredFaceDetails?.center || !groupRef.current) return null;
      const worldV = new THREE.Vector3(...hoveredFaceDetails.center);
      const invQuat = groupRef.current.quaternion.clone().invert();
      return worldV
        .sub(groupRef.current.position.clone())
        .applyQuaternion(invQuat)
        .toArray();
    })();
    console.log("[face-hover]", {
      part: obj?.name || obj.id,
      face: hoveredFace,
      hoverLocal: sample.local ? sample.local.toArray() : null,
      objectWorldCenter: worldCenter,
      objectRotationDeg: rotDeg,
      hoverWorldBase: sample.world ? sample.world.toArray() : null,
      faceCenterLocal: localFaceCenter,
      faceCenter: hoveredFaceDetails.center,
      faceSize: hoveredFaceDetails.size,
    });
    if (hoverFaceMeshRef.current) {
      const meshPos = new THREE.Vector3();
      const meshQuat = new THREE.Quaternion();
      hoverFaceMeshRef.current.getWorldPosition(meshPos);
      hoverFaceMeshRef.current.getWorldQuaternion(meshQuat);
      const meshEuler = new THREE.Euler().setFromQuaternion(meshQuat, "XYZ");
      console.log("[face-mesh]", {
        part: obj?.name || obj.id,
        face: hoveredFace,
        meshWorldCenter: meshPos.toArray(),
        meshRotationDeg: [
          THREE.MathUtils.radToDeg(meshEuler.x).toFixed(2),
          THREE.MathUtils.radToDeg(meshEuler.y).toFixed(2),
          THREE.MathUtils.radToDeg(meshEuler.z).toFixed(2),
        ],
      });
    }
  }, [hoveredFace, hoveredFaceDetails, obj]);
 
  const activeFaceDetails = useMemo(() => {
    if (!activeAlignFace || activeAlignFace.partId !== obj.id) return null;
    return getFaceDetails({ obj, ref: groupRef, faceName: activeAlignFace.face });
  }, [activeAlignFace, obj]);

  const resolveHoveredFace = useCallback(
    (event) => {
      if ((!alignMode && mode !== "scale") || !groupRef.current) return;
      const dims = obj.dims || {};
      const width = dims.w ?? 0;
      const height = dims.h ?? 0;
      const depth = dims.d ?? 0;
      if (width === 0 || height === 0 || depth === 0) {
        setHoveredFace(null);
        return;
      }

      // Handle Group Objects (Composite Faces)
      if (obj.type === "group") {
        const hit = event; // R3F event contains intersection info
        if (!hit.object || !hit.face) return;

        // Find the child object ID
        return;
      }

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      groupRef.current.getWorldPosition(worldPos);
      groupRef.current.getWorldQuaternion(worldQuat);

      const halfW = width / 2;
      const halfH = height / 2;
      const halfD = depth / 2;

      const invQuat = worldQuat.clone().invert();
      const localOrigin = event.ray.origin
        .clone()
        .sub(worldPos)
        .applyQuaternion(invQuat);
      const localDir = event.ray.direction.clone().applyQuaternion(invQuat).normalize();
      const localRay = new THREE.Ray(localOrigin, localDir);
      const hitPoint = new THREE.Vector3();
      const localBox = new THREE.Box3(
        new THREE.Vector3(-halfW, -halfH, -halfD),
        new THREE.Vector3(halfW, halfH, halfD)
      );
      const localPoint =
        localRay.intersectBox(localBox, hitPoint) ||
        event.point.clone().sub(worldPos).applyQuaternion(invQuat);
      lastHoverSampleRef.current = {
        local: localPoint.clone(),
        world: worldPos.clone(),
      };

      const clamped = {
        x: THREE.MathUtils.clamp(localPoint.x, -halfW, halfW),
        y: THREE.MathUtils.clamp(localPoint.y, -halfH, halfH),
        z: THREE.MathUtils.clamp(localPoint.z, -halfD, halfD),
      };

      const candidates = [
        { face: "+X", value: Math.abs(clamped.x - halfW) },
        { face: "-X", value: Math.abs(clamped.x + halfW) },
        { face: "+Y", value: Math.abs(clamped.y - halfH) },
        { face: "-Y", value: Math.abs(clamped.y + halfH) },
        { face: "+Z", value: Math.abs(clamped.z - halfD) },
        { face: "-Z", value: Math.abs(clamped.z + halfD) },
      ];

      let resolvedFace = candidates.reduce((prev, cur) =>
        cur.value < prev.value ? cur : prev
      ).face;

      if (pointInsideIoCutout(obj, localPoint)) {
        resolvedFace = IO_CUTOUT_FACE;
      }

      setHoveredFace(resolvedFace);
    },
    [alignMode, mode, obj]
  );


  return (
    <>
      <group
        ref={groupRef}
        position={obj.pos}
        rotation={obj.rot}
        userData={{ objectId: obj.id }}
        onPointerMove={(e) => {
          e.stopPropagation();
          const faceSelectionActive =
            (alignMode && (e.shiftKey || e?.nativeEvent?.shiftKey)) ||
            (mode === "scale" && (e.shiftKey || e?.nativeEvent?.shiftKey));
          if (faceSelectionActive) {
            resolveHoveredFace(e);
          } else if (!stretchStateRef.current && (alignMode || mode === "scale") && hoveredFace) {
            setHoveredFace(null);
          }
        }}
        onPointerLeave={() => {
          if (stretchStateRef.current) {
            return;
          }
          if (alignMode || mode === "scale") {
            setHoveredFace(null);
          }
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (isEmbedded && !alignMode) {
            return;
          }
          if (
            !alignMode &&
            mode === "scale" &&
            (e.shiftKey || e?.nativeEvent?.shiftKey) &&
            hoveredFace &&
            hoveredFaceDetails
          ) {
            beginStretch(hoveredFace, hoveredFaceDetails, e);
            return;
          }
          if (alignMode && hoveredFace && (e.shiftKey || e?.nativeEvent?.shiftKey)) {
            // onFacePick?.({ partId: obj.id, face: hoveredFace });
            // onSelect?.(obj.id, false);
            // return;
            // In scale mode, we let beginStretch handle the click-vs-drag decision
            if (mode === "scale") {
              beginStretch(hoveredFace, hoveredFaceDetails, e);
              return;
            }
            onFacePick?.({ partId: obj.id, face: hoveredFace, shiftKey: true });
            onSelect?.(obj.id, false);
            return;
          }
          const multi = e.ctrlKey || e.metaKey;
          onSelect?.(obj.id, multi);
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {obj.type === "motherboard" ? (
          <MotherboardMesh obj={obj} selected={selected} />
        ) : obj.type === "gpu" ? (
          <GPUMesh obj={obj} selected={selected} />
        ) : obj.type === "group" ? (
          <GroupMesh obj={obj} selected={selected} />
        ) : obj.type === "imported" ? (
          <ImportedMesh obj={obj} selected={selected} />
        ) : obj.type === "reference" ? (
          <ReferenceMesh obj={obj} selected={selected} />
        ) : obj.type === "cpu-cooler" ? (
          <CPUCoolerMesh obj={obj} selected={selected} />
        ) : obj.type === "gpu-bracket" ? (
          <GPUBracketMesh obj={obj} selected={selected} />
        ) : (
          <PartBox obj={obj} selected={selected} />
        )}
        {Array.isArray(obj.connectors) && obj.connectors
          .filter((connector) => connector && connector.id)
          .map((connector) => {
            const isUsed = connectedConnectorIds.has(connector.id);
            return (
              <ConnectorMarker
                key={connector.id}
                connector={connector}
                isUsed={isUsed}
                onPick={(picked) => {
                  onConnectorPick?.({ partId: obj.id, connectorId: picked?.id });
                }}
              />
            );
          })}
      </group>

      {selected && !isEmbedded && showTransformControls && mode !== "scale" && mode !== "ruler" && (
        <TransformControls
          ref={controlsRef}
          object={groupRef.current}
          mode={mode}
          space="local"
          enabled={!uiLock}
          onObjectChange={() => {
            if (!groupRef.current) return;
            const p = groupRef.current.position.clone().toArray();
            let r = [
              groupRef.current.rotation.x,
              groupRef.current.rotation.y,
              groupRef.current.rotation.z,
            ];
            r = applyRotationSnap(r);
            updateDuringDrag();
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
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* ✅ Hover Highlight (World Space) */}
      {(alignMode || mode === "scale") && hoveredFaceDetails && (
        <mesh
          ref={hoverFaceMeshRef}
          position={hoveredFaceDetails.center}
          quaternion={hoveredFaceDetails.quaternion}
          frustumCulled={false}
        >
          <boxGeometry args={hoveredFaceDetails.size} />
          <meshStandardMaterial
            color="#67e8f9"
            transparent
            opacity={0.3}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* ✅ Active Highlight (World Space) */}
      {(alignMode || mode === "scale") && activeFaceDetails && (
        <mesh
          position={activeFaceDetails.center}
          quaternion={activeFaceDetails.quaternion}
          frustumCulled={false}
        >
          <boxGeometry args={activeFaceDetails.size} />
          <meshStandardMaterial
            color="#facc15"
            transparent
            opacity={0.35}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* ✅ Alignment Candidate Highlights (World Space) */}
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
    </>
  );
}
