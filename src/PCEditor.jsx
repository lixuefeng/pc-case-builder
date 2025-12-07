import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ToastProvider, useToast } from "./context/ToastContext";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import * as THREE from "three";
import Scene from "./components/Scene";
import TopBar from "./components/UI/TopBar";
import LeftSidebar from "./components/UI/LeftSidebar";
import RightSidebar from "./components/UI/RightSidebar";
import ConnectorToast from "./components/UI/ConnectorToast";
import HUD from "./components/UI/HUD";

import { exportSTLFrom } from "./utils/exportSTL";
import { useStore, useTemporalStore } from "./store";
import { ensureSceneConnectors } from "./utils/connectors";

import { expandObjectsWithEmbedded } from "./utils/embeddedParts";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { adjustCSGOperations } from "./utils/csgUtils";
import { EDITOR_CONFIG } from "./constants";

const DUPLICATE_OFFSET = EDITOR_CONFIG.DUPLICATE_OFFSET;
const alog = () => { };

const deepCloneObject = (value) => JSON.parse(JSON.stringify(value));
const randomSuffix = () => Math.random().toString(36).slice(2, 8);
const generateObjectId = (type = "obj") => {
  const safeType = typeof type === "string" && type.trim().length > 0 ? type.trim() : "obj";
  return `${safeType}_${Date.now().toString(36)}_${randomSuffix()}`;
};

const remapConnectorIds = (connectors, ownerId) => {
  if (!Array.isArray(connectors) || connectors.length === 0) {
    return connectors;
  }
  return connectors.map((connector, index) => ({
    ...connector,
    id: `${ownerId}_conn_${index}_${randomSuffix()}`,
  }));
};

const shiftDuplicatePosition = (pos, offsetIndex = 1) => {
  if (offsetIndex === 0) return Array.isArray(pos) ? [...pos] : [0, 0, 0];
  const offset = DUPLICATE_OFFSET * Math.max(1, offsetIndex);
  const [x = 0, y = 0, z = 0] = Array.isArray(pos) ? pos : [0, 0, 0];
  return [x + offset, y, z + offset];
};

const buildCopyName = (name, type) => {
  if (typeof name === "string" && name.trim().length > 0) {
    return `${name.trim()} 副本`;
  }
  if (typeof type === "string" && type.length > 0) {
    return `${type.toUpperCase()} 副本`;
  }
  return "对象 副本";
};

const duplicateObject = (sourceObject, offsetIndex = 1) => {
  if (!sourceObject) return null;
  const clone = deepCloneObject(sourceObject);

  const assignIds = (node, { applyOffset }) => {
    if (!node || typeof node !== "object") return node;
    const newId = generateObjectId(node.type || "obj");
    node.id = newId;
    node.name = buildCopyName(node.name, node.type);
    if (applyOffset) {
      node.pos = shiftDuplicatePosition(node.pos, offsetIndex);
    } else if (!Array.isArray(node.pos)) {
      node.pos = [0, 0, 0];
    }
    if (node.embeddedParentId) {
      delete node.embeddedParentId;
    }
    if (Array.isArray(node.connectors) && node.connectors.length > 0) {
      node.connectors = remapConnectorIds(node.connectors, newId);
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      node.children = node.children.map((child) => assignIds(child, { applyOffset: false }));
    }
    return node;
  };

  return assignIds(clone, { applyOffset: true });
};

// 计算对象在某个世界方向上的“半投影长度”，用于判断该对象是否与某个平面相交
const getWorldAxesForObject = (obj) => {
  const rot = Array.isArray(obj.rot) ? obj.rot : [0, 0, 0];
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rot[0], rot[1], rot[2], "XYZ")
  );
  const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  return { ax, ay, az };
};

const projectedHalfExtentAlongAxis = (worldAxis, dims, axes) => {
  const { ax, ay, az } = axes;
  const w2 = (dims?.w ?? 0) / 2;
  const h2 = (dims?.h ?? 0) / 2;
  const d2 = (dims?.d ?? 0) / 2;
  const dir = worldAxis.clone().normalize();
  return (
    Math.abs(dir.dot(ax)) * w2 +
    Math.abs(dir.dot(ay)) * h2 +
    Math.abs(dir.dot(az)) * d2
  );
};

function EditorContent() {
  const { t } = useLanguage();
  const {
    objects,
    setObjects,
    selectedIds,
    setSelectedIds,
    connections,
    setConnections,
    projects,
    currentProjectId,
    copyToClipboard,
    pasteFromClipboard,
    setHudState,
    rulerPoints,
    setRulerPoints,
    measurements,
    setMeasurements,
    drillParams,
  } = useStore();
  const { undo, redo, future, past } = useTemporalStore((state) => state);
  const { showToast } = useToast();
  const [activeConnectorId, setActiveConnectorId] = useState(null);
  const [showHorizontalGrid, setShowHorizontalGrid] = useState(true);
  const [transformMode, setTransformMode] = useState("translate");
  const [pendingAlignFace, setPendingAlignFace] = useState(null);
  const [showGizmos, setShowGizmos] = useState(true);
  const [pendingConnector, setPendingConnector] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [drillGhost, setDrillGhost] = useState(null);
  const [drillCandidates, setDrillCandidates] = useState([]);
  const rulerStartRef = React.useRef(null);
  const [activeLeftTab, setActiveLeftTab] = useState("library");

  const [cutterFace, setCutterFace] = useState(null);

  // Clear cutterFace when leaving cut mode
  useEffect(() => {
    if (transformMode !== 'cut') {
      setCutterFace(null);
    }
  }, [transformMode]);

  const expandedObjects = useMemo(() => expandObjectsWithEmbedded(objects), [objects]);
  const baseIdSet = useMemo(() => new Set(objects.map((o) => o.id)), [objects]);

  const selectedObject = useMemo(
    () => objects.find((o) => o.id === selectedIds[selectedIds.length - 1]),
    [objects, selectedIds]
  );

  const currentProjectName = useMemo(() => {
    const p = projects.find(p => p.id === currentProjectId);
    return p ? p.name : "";
  }, [projects, currentProjectId]);



  const alignEnabled = transformMode === "translate" || transformMode === "scale" || transformMode === "rotate" || transformMode === "ruler" || transformMode === "drill";

  const handleTransformModeChange = (mode) => {
    setTransformMode(mode);

    if (mode === 'ruler') {
      setHudState({ type: 'ruler', data: { distance: 0 } });
    } else if (mode === 'drill') {
      setHudState({ type: 'drill', data: {} });
    } else {
      // For translate/rotate/scale, try to use selected object data, otherwise empty
      if (mode === 'translate') {
        setHudState({
          type: 'move', data: selectedObject ? {
            x: selectedObject.pos[0], y: selectedObject.pos[1], z: selectedObject.pos[2]
          } : {}
        });
      } else if (mode === 'rotate') {
        setHudState({
          type: 'rotate', data: selectedObject ? {
            rx: THREE.MathUtils.radToDeg(selectedObject.rot[0]),
            ry: THREE.MathUtils.radToDeg(selectedObject.rot[1]),
            rz: THREE.MathUtils.radToDeg(selectedObject.rot[2])
          } : {}
        });
      } else if (mode === 'scale') {
        const s = selectedObject?.scale || [1, 1, 1];
        setHudState({
          type: 'scale', data: selectedObject ? {
            sx: s[0], sy: s[1], sz: s[2]
          } : {}
        });
      }
    }

  };

  useEffect(() => {
    if (!alignEnabled) {
      setPendingAlignFace(null);
    }

    if (transformMode !== "ruler" && transformMode !== "drill") {
      setRulerPoints([]);
      setDrillCandidates([]);
      setDrillGhost(null);
    }
  }, [alignEnabled, transformMode]);

  // Sync Ruler Points to HUD
  useEffect(() => {
    if (transformMode === 'ruler') {
      let distance = 0;
      if (rulerPoints.length === 2) {
        distance = new THREE.Vector3(...rulerPoints[0]).distanceTo(new THREE.Vector3(...rulerPoints[1]));
      }
      setHudState({
        type: 'ruler',
        data: { distance, pointsCount: rulerPoints.length }
      });
    }
  }, [transformMode, rulerPoints, setHudState]);

  // Sync Drill State to HUD
  useEffect(() => {
    if (transformMode === 'drill') {
      setHudState({
        type: 'drill',
        data: {
          snapped: drillGhost?.snapped,
          position: drillGhost?.position
        }
      });
    }
  }, [transformMode, drillGhost, setHudState]);

  const snapThreshold = EDITOR_CONFIG.SNAP_THRESHOLD; // mm

  const handleDrillHover = useCallback(
    (info) => {
      if (transformMode !== "drill" || !info?.point || !info?.normal) {
        setDrillGhost(null);
        setDrillCandidates([]);
        return;
      }

      // Helper to flatten objects and calculate world transforms
      const flattenObjectsWithTransforms = (objs, parentWorldPos = null, parentWorldQuat = null) => {
        let results = [];
        objs.forEach(obj => {
          if (obj.visible === false) return;

          // Calculate World Transform
          const localPos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
          const localEuler = new THREE.Euler(...(obj.rot || [0, 0, 0]));
          const localQuat = new THREE.Quaternion().setFromEuler(localEuler);

          let worldPos, worldQuat;

          if (parentWorldPos && parentWorldQuat) {
            worldPos = parentWorldPos.clone().add(localPos.clone().applyQuaternion(parentWorldQuat));
            worldQuat = parentWorldQuat.clone().multiply(localQuat);
          } else {
            worldPos = localPos;
            worldQuat = localQuat;
          }

          // Add current object
          results.push({
            ...obj,
            worldPos,
            worldQuat
          });

          // Recurse children
          if (Array.isArray(obj.children) && obj.children.length > 0) {
            results = results.concat(flattenObjectsWithTransforms(obj.children, worldPos, worldQuat));
          }
        });
        return results;
      };

      const flatObjects = flattenObjectsWithTransforms(expandedObjects);

      const { partId, point, normal, face, faceCenter, faceSize } = info;
      const worldPoint = new THREE.Vector3(...point);
      const worldNormalA = new THREE.Vector3(...normal).normalize(); // A 面法线

      // 1️⃣ 找到当前 hover 的对象 X (Use flatObjects to find it!)
      const baseObj = flatObjects.find((o) => o.id === partId);




      if (!baseObj) {
        console.warn("Drill: baseObj not found for partId:", partId);
        setDrillGhost(null);
        setDrillCandidates([]);
        return;
      }

      // ... (existing code) ...

      // 2️⃣ 由 hover 面 A 推出对面 B 作为基准面
      let baseFaceName = face;
      if (face === "+X") baseFaceName = "-X";
      else if (face === "-X") baseFaceName = "+X";
      else if (face === "+Y") baseFaceName = "-Y";
      else if (face === "-Y") baseFaceName = "+Y";
      else if (face === "+Z") baseFaceName = "-Z";
      else if (face === "-Z") baseFaceName = "+Z";
      // 其它特殊面（如 io-cutout）暂时直接用 A 面

      // 用已有工具分别算出 A / B 面的世界中心和法线
      const baseFaceTransform = computeFaceTransform(baseObj, baseFaceName);
      const aFaceTransform = computeFaceTransform(baseObj, face);

      const planeNormalB = baseFaceTransform?.normal || worldNormalA;
      const planePointB =
        baseFaceTransform?.center ||
        (faceCenter ? new THREE.Vector3(...faceCenter) : worldPoint);

      const planeNormalA = aFaceTransform?.normal || worldNormalA;
      const planePointA =
        aFaceTransform?.center ||
        (faceCenter ? new THREE.Vector3(...faceCenter) : worldPoint);

      // 以 B 面构造平面（用于“谁在 B 面后面”的判断）
      const planeB = new THREE.Plane().setFromNormalAndCoplanarPoint(
        planeNormalB.clone().normalize(),
        planePointB
      );
      // 以 A 面构造平面（用于把蓝点放在 A 面上）
      const planeA = new THREE.Plane().setFromNormalAndCoplanarPoint(
        planeNormalA.clone().normalize(),
        planePointA
      );

      const newCandidates = [];

      // 用来限制候选点不要离 B 面中心太远（在面内的“半径”过滤）
      const maxDim = faceSize
        ? Math.max(faceSize[0], faceSize[1], faceSize[2])
        : EDITOR_CONFIG.DRILL_MAX_DIM;
      const faceCenterVecB = planePointB.clone();

      flatObjects.forEach((obj) => {
        if (obj.id === partId) return; // Skip self

        const objCenter = obj.worldPos; // Use pre-calculated World Pos

        // 根据对象自身的旋转和尺寸，估计它在 B 面法线方向上的“半厚度”
        // Use pre-calculated World Quat for axes
        const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(obj.worldQuat);
        const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.worldQuat);
        const az = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.worldQuat);
        const axes = { ax, ay, az };

        const halfDepth = projectedHalfExtentAlongAxis(
          planeNormalB,
          obj.dims || {},
          axes
        );

        if (halfDepth <= 0) return;

        const signedDist = planeB.distanceToPoint(objCenter);

        // 只有当对象的包围盒真正与 B 平面有交集时，才认为是“与 B 面附近相交”
        const margin = EDITOR_CONFIG.DRILL_MARGIN; // 适当放宽一点，避免数值误差
        if (Math.abs(signedDist) > halfDepth + margin) {
          return;
        }

        // 先把对象中心投影到 B 面
        const projectedOnB = new THREE.Vector3();
        planeB.projectPoint(objCenter, projectedOnB);

        // 再把这个点沿着 A 面法线投影到 A 面上
        const projectedOnA = new THREE.Vector3();
        planeA.projectPoint(projectedOnB, projectedOnA);

        // 3️⃣ Calculate Intersection of Face A and Face B (Projected)
        // We need to work in the 2D plane of Face A to find the overlap area.

        // Helper to get 2D dimensions and axes based on face name
        const getFace2DInfo = (faceName, size3D) => {
          if (!faceName || !size3D) return null;
          if (faceName.includes("X")) return { dims: [size3D[1], size3D[2]], axesIndices: [1, 2] }; // Y, Z
          if (faceName.includes("Y")) return { dims: [size3D[0], size3D[2]], axesIndices: [0, 2] }; // X, Z
          if (faceName.includes("Z")) return { dims: [size3D[0], size3D[1]], axesIndices: [0, 1] }; // X, Y
          return null; // Fallback or io-cutout
        };

        const faceAInfo = getFace2DInfo(face, faceSize);
        // If we can't determine axes (e.g. io-cutout), fallback to simple projection
        if (!faceAInfo || !info.quaternion) {
          // Fallback to simple distance check (relaxed)
          const candidateMaxDim = Math.max(obj.dims.w || 0, obj.dims.h || 0, obj.dims.d || 0);
          const threshold = (maxDim / 2) + (candidateMaxDim / 2);
          if (projectedOnB.distanceTo(faceCenterVecB) < threshold) {
            newCandidates.push(projectedOnA);
          }
          return;
        }

        // Construct Basis for Face A
        const qA = new THREE.Quaternion(...info.quaternion);
        const basis = [
          new THREE.Vector3(1, 0, 0).applyQuaternion(qA),
          new THREE.Vector3(0, 1, 0).applyQuaternion(qA),
          new THREE.Vector3(0, 0, 1).applyQuaternion(qA),
        ];
        const rightAxis = basis[faceAInfo.axesIndices[0]];
        const upAxis = basis[faceAInfo.axesIndices[1]];

        // Rect A (Local 2D centered at 0,0)
        const halfWA = faceAInfo.dims[0] / 2;
        const halfHA = faceAInfo.dims[1] / 2;
        const minA = [-halfWA, -halfHA];
        const maxA = [halfWA, halfHA];

        // Rect B (Projected into Face A's 2D space)
        // Calculate 8 corners of obj in World Space
        const dimsB = obj.dims || { w: 10, h: 10, d: 10 };
        const halfWB = (dimsB.w || 0) / 2;
        const halfHB = (dimsB.h || 0) / 2;
        const halfDB = (dimsB.d || 0) / 2;

        const cornersLocal = [
          new THREE.Vector3(halfWB, halfHB, halfDB),
          new THREE.Vector3(halfWB, halfHB, -halfDB),
          new THREE.Vector3(halfWB, -halfHB, halfDB),
          new THREE.Vector3(halfWB, -halfHB, -halfDB),
          new THREE.Vector3(-halfWB, halfHB, halfDB),
          new THREE.Vector3(-halfWB, halfHB, -halfDB),
          new THREE.Vector3(-halfWB, -halfHB, halfDB),
          new THREE.Vector3(-halfWB, -halfHB, -halfDB),
        ];

        // Use pre-calculated World Transforms
        const posB = obj.worldPos;
        const qB = obj.worldQuat;

        let minB = [Infinity, Infinity];
        let maxB = [-Infinity, -Infinity];

        cornersLocal.forEach(p => {
          // Local (relative to center) -> World
          const pWorld = p.clone().applyQuaternion(qB).add(posB);

          // World -> Face A 2D Plane
          const relP = pWorld.sub(planePointA);
          const x = relP.dot(rightAxis);
          const y = relP.dot(upAxis);

          minB[0] = Math.min(minB[0], x);
          minB[1] = Math.min(minB[1], y);
          maxB[0] = Math.max(maxB[0], x);
          maxB[1] = Math.max(maxB[1], y);
        });

        // Intersection
        const overlapMin = [
          Math.max(minA[0], minB[0]),
          Math.max(minA[1], minB[1])
        ];
        const overlapMax = [
          Math.min(maxA[0], maxB[0]),
          Math.min(maxA[1], maxB[1])
        ];

        // Check if overlapping
        if (overlapMin[0] < overlapMax[0] && overlapMin[1] < overlapMax[1]) {
          // Center of overlap
          const centerOverlap2D = [
            (overlapMin[0] + overlapMax[0]) / 2,
            (overlapMin[1] + overlapMax[1]) / 2
          ];

          // Unproject back to World Space (on Plane A)
          const worldOverlap = planePointA.clone()
            .add(rightAxis.clone().multiplyScalar(centerOverlap2D[0]))
            .add(upAxis.clone().multiplyScalar(centerOverlap2D[1]));

          newCandidates.push(worldOverlap);
        }
      });

      setDrillCandidates(newCandidates);

      let bestSnap = null;
      let minDist = snapThreshold;

      newCandidates.forEach((cand) => {
        const d = worldPoint.distanceTo(cand);
        if (d < minDist) {
          minDist = d;
          bestSnap = cand;
        }
      });

      if (bestSnap) {
        setDrillGhost({
          position: bestSnap.toArray(),
          direction: planeNormalA.toArray(),
          snapped: true,
        });
      } else {
        setDrillGhost({
          position: point,
          direction: normal,
          snapped: false,
        });
      }

    },
    [expandedObjects, snapThreshold, transformMode]
  );

  // Keyboard Shortcuts for Clipboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "c") {
          e.preventDefault();
          if (selectedIds.length > 0) {
            copyToClipboard(selectedIds);
            setConnectorToast({ type: "info", text: "Copied to Global Clipboard", ttl: 1500 });
          }
        } else if (e.key === "v") {
          e.preventDefault();
          pasteFromClipboard();
          setConnectorToast({ type: "success", text: "Pasted from Global Clipboard", ttl: 1500 });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, copyToClipboard, pasteFromClipboard]);

  const handleExport = () => {
    const dataStr = JSON.stringify(objects, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `pc-case-design-${new Date().toISOString().slice(0, 10)}.json`; // Keep filename logic
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Base64 转换工具
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleImport = (file) => {
    if (!file) return;

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".json")) {
      reader.onload = (e) => {
        try {
          const importedObjects = JSON.parse(e.target.result);
          if (Array.isArray(importedObjects)) {
            const normalizedObjects = importedObjects.map((obj) => ({
              ...obj,
              connectors: Array.isArray(obj?.connectors) ? obj.connectors : [],
            }));
            setObjects(normalizedObjects);
            setSelectedIds([]);
            alert(`Successfully imported ${importedObjects.length} objects!`);
          } else {
            throw new Error("Invalid file format: not an array.");
          }
        } catch (error) {
          alert(`Import failed: ${error.message}`);
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith(".stl")) {
      reader.onload = (e) => {
        try {
          const contents = e.target.result; // ArrayBuffer
          const loader = new STLLoader();
          const geometry = loader.parse(contents);
          geometry.computeBoundingBox();
          const box = geometry.boundingBox;
          const size = new THREE.Vector3();
          box.getSize(size);

          const newObject = {
            id: `imported_${Date.now()}`,
            type: "imported",
            name: file.name.replace(/\.stl$/i, ""),
            pos: [0, 0, size.y / 2], // place on the ground plane
            rot: [0, 0, 0],
            dims: { w: size.x, h: size.y, d: size.z },
            visible: true,
            includeInExport: true,
            meta: { geometryBase64: arrayBufferToBase64(contents) },
          };
          setObjects((prev) => [...prev, newObject]);
          setSelectedIds([newObject.id]);
        } catch (error) {
          alert(`Failed to import STL file: ${error.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Unsupported file type. Please choose a .json or .stl file.");
    }
  };

  const handleSelect = (id, multi = false) => {
    if (id === null) {
      setSelectedIds([]);
      setPendingAlignFace(null);

      // Only persist HUD for ruler/drill, otherwise clear it
      if (transformMode !== 'ruler' && transformMode !== 'drill') {
        setHudState(null);
      }

      if (transformMode === "ruler") {
        setRulerPoints([]);
      }
      return;
    }
    // Removed baseIdSet check to allow selection even if set is stale
    if (multi) {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          // 如果已选中，则从选择集中移除
          return prev.filter((i) => i !== id);
        } else {
          // 如果未选中，则添加到选择?
          return [...prev, id];
        }
      });
    } else {
      // Single selection
      setSelectedIds([id]);

      // Initialize HUD with object properties
      const obj = objects.find(o => o.id === id);
      if (obj) {
        if (transformMode === 'translate') {
          setHudState({
            type: 'move', data: {
              x: obj.pos[0], y: obj.pos[1], z: obj.pos[2]
            }
          });
        } else if (transformMode === 'rotate') {
          setHudState({
            type: 'rotate', data: {
              rx: THREE.MathUtils.radToDeg(obj.rot[0]),
              ry: THREE.MathUtils.radToDeg(obj.rot[1]),
              rz: THREE.MathUtils.radToDeg(obj.rot[2])
            }
          });
        } else if (transformMode === 'scale') {
          const s = obj.scale || [1, 1, 1];
          setHudState({
            type: 'scale', data: {
              sx: s[0], sy: s[1], sz: s[2], factor: s[0]
            }
          });
        }
      }
    }
  };
  const lastSelectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  const handleGroup = () => {
    if (selectedIds.length <= 1) return;

    const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

    // 1. 计算包围盒和中心?
    const box = new THREE.Box3();
    selectedObjects.forEach((obj) => {
      const { w, d, h } = obj.dims;
      const pos = new THREE.Vector3(...obj.pos);
      const objBox = new THREE.Box3().setFromCenterAndSize(
        pos,
        new THREE.Vector3(w, h, d)
      );
      box.union(objBox);
    });

    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);

    // 2. 创建新的 group 对象
    const newGroup = {
      id: `group_${Date.now()}`,
      type: "group",
      name: "新建编组",
      pos: center.toArray(),
      rot: [0, 0, 0],
      dims: { w: size.x, h: size.y, d: size.z },
      children: selectedObjects.map((obj) => ({
        ...obj,
        // 存储相对于组中心的原始位?
        pos: [obj.pos[0] - center.x, obj.pos[1] - center.y, obj.pos[2] - center.z],
      })),
      visible: true,
      includeInExport: true,
      meta: {},
    };

    // 3. 更新 objects 数组
    setObjects((prev) => [...prev.filter((o) => !selectedIds.includes(o.id)), newGroup]);
    setSelectedIds([newGroup.id]);
  };

  const handleUngroup = () => {
    const group = objects.find((o) => o.id === lastSelectedId && o.type === "group");
    if (!group) return;

    const groupPos = new THREE.Vector3(...group.pos);
    const groupRot = new THREE.Euler(...(group.rot || [0, 0, 0]));
    const groupQuat = new THREE.Quaternion().setFromEuler(groupRot);

    const children = group.children.map((child) => {
      const childPos = new THREE.Vector3(...child.pos);
      const childRot = new THREE.Euler(...(child.rot || [0, 0, 0]));
      const childQuat = new THREE.Quaternion().setFromEuler(childRot);

      // Apply group rotation to child position
      const worldPos = childPos.applyQuaternion(groupQuat).add(groupPos);

      // Combine rotations
      const worldQuat = groupQuat.multiply(childQuat);
      const worldEuler = new THREE.Euler().setFromQuaternion(worldQuat);

      return {
        ...child,
        pos: worldPos.toArray(),
        rot: [worldEuler.x, worldEuler.y, worldEuler.z],
      };
    });

    setObjects((prev) => [...prev.filter((o) => o.id !== group.id), ...children]);
    setSelectedIds(children.map((c) => c.id));
  };

  const handleDuplicate = useCallback(
    (ids) => {
      const targetIds = Array.isArray(ids) && ids.length > 0 ? ids : selectedIds;
      const uniqueIds = Array.from(new Set(targetIds));
      if (uniqueIds.length === 0) {
        return;
      }

      const nextSelection = [];
      setObjects((prev) => {
        const clones = [];
        uniqueIds.forEach((id, index) => {
          const original = prev.find((obj) => obj.id === id);
          if (!original) {
            return;
          }
          const duplicate = duplicateObject(original, index + 1);
          if (!duplicate) {
            return;
          }
          clones.push(duplicate);
          nextSelection.push(duplicate.id);
        });
        if (clones.length === 0) {
          return prev;
        }
        return [...prev, ...clones];
      });

      if (nextSelection.length > 0) {
        setSelectedIds(nextSelection);
        showToast({
          type: "success",
          text: `已复制 ${nextSelection.length} 个零件`,
          ttl: 1500,
        });
      }
    },
    [selectedIds, setObjects, setSelectedIds, showToast]
  );



  const handleToggleCutMode = useCallback(() => {
    if (transformMode === 'cut') {
      // Exit Cut Mode
      setTransformMode('translate');
    } else {
      // Enter Cut Mode
      setTransformMode('cut');
    }
  }, [transformMode]);

  const performSplit = useCallback(() => {
    if (!cutterFace) {
      showToast({ type: "error", text: "Please set a split plane (Shift+Click a face)", ttl: 2000 });
      return;
    }
    if (selectedIds.length === 0) {
      showToast({ type: "error", text: "No objects selected to split", ttl: 2000 });
      return;
    }

    const planePos = new THREE.Vector3(...cutterFace.point);
    const planeNormal = new THREE.Vector3(...cutterFace.normal).normalize();

    // Create a quaternion for the plane rotation (Z axis aligned to normal)
    const defaultUp = new THREE.Vector3(0, 0, 1);
    const planeQuat = new THREE.Quaternion().setFromUnitVectors(defaultUp, planeNormal);
    const planeRot = new THREE.Euler().setFromQuaternion(planeQuat);

    const huge = 10000;

    // Box Right Center (Along Normal)
    const boxRightPos = planePos.clone().add(planeNormal.clone().multiplyScalar(huge / 2));
    // Box Left Center (Opposite to Normal)
    const boxLeftPos = planePos.clone().sub(planeNormal.clone().multiplyScalar(huge / 2));

    const newObjects = [];
    const newSelection = [];

    setObjects(prev => {
      const nextObjects = [...prev];
      const objectsToRemove = [];

      selectedIds.forEach(id => {
        const original = nextObjects.find(o => o.id === id);
        if (!original) return;

        // --- Axis-Aligned Cut Detection ---
        const objPos = new THREE.Vector3(...(original.pos || [0, 0, 0]));
        const objRot = new THREE.Euler(...(original.rot || [0, 0, 0]));
        const objQuat = new THREE.Quaternion().setFromEuler(objRot);
        const invObjQuat = objQuat.clone().invert();

        // Transform plane normal to local space
        const localNormal = planeNormal.clone().applyQuaternion(invObjQuat);
        const localPoint = planePos.clone().sub(objPos).applyQuaternion(invObjQuat);

        // Check for axis alignment (tolerance 0.01)
        const isX = Math.abs(Math.abs(localNormal.x) - 1) < 0.01;
        const isY = Math.abs(Math.abs(localNormal.y) - 1) < 0.01;
        const isZ = Math.abs(Math.abs(localNormal.z) - 1) < 0.01;

        if (isX || isY || isZ) {
          // --- Perform Actual Geometry Split ---
          console.log("Axis Aligned Split Detected:", { isX, isY, isZ });

          const dims = original.dims || { w: 10, h: 10, d: 10 };
          let axis = 'w'; // Default w (x)
          let splitPos = localPoint.x;
          let size = dims.w;

          if (isY) { axis = 'h'; splitPos = localPoint.y; size = dims.h; }
          if (isZ) { axis = 'd'; splitPos = localPoint.z; size = dims.d; }

          // Validate split position is inside object
          if (Math.abs(splitPos) >= size / 2) {
            console.warn("Split plane is outside object bounds");
            return; // Skip this object
          }

          // Part A: Negative Side
          // New Size = splitPos - (-size/2) = splitPos + size/2
          // New Center = -size/2 + newSize/2 = -size/2 + (splitPos + size/2)/2 = (splitPos - size/2) / 2 ??
          // Let's re-derive:
          // Range: [-size/2, splitPos]
          // Length: splitPos - (-size/2) = splitPos + size/2
          // Midpoint: (splitPos + -size/2) / 2

          const sizeA = splitPos + size / 2;
          const centerA_Local = (splitPos - size / 2) / 2;

          // Part B: Positive Side
          // Range: [splitPos, size/2]
          // Length: size/2 - splitPos
          // Midpoint: (size/2 + splitPos) / 2

          const sizeB = size / 2 - splitPos;
          const centerB_Local = (size / 2 + splitPos) / 2;

          // Helper to adjust CSG operations for center shift
          // (Now using imported utility)

          // Create Part A
          const partA = duplicateObject(original, 0);
          partA.id = generateObjectId(original.type);
          partA.name = `${original.name || original.type} (A)`;
          partA.dims = { ...dims, [axis]: sizeA };

          // Transform local center back to world
          const localCenterVecA = new THREE.Vector3();
          if (isX) localCenterVecA.set(centerA_Local, 0, 0);
          if (isY) localCenterVecA.set(0, centerA_Local, 0);
          if (isZ) localCenterVecA.set(0, 0, centerA_Local);

          const worldCenterA = localCenterVecA.applyQuaternion(objQuat).add(objPos);
          partA.pos = worldCenterA.toArray();

          // Adjust CSG for Part A
          partA.csgOperations = adjustCSGOperations(partA, objPos, objQuat);

          // Create Part B
          const partB = duplicateObject(original, 0);
          partB.id = generateObjectId(original.type);
          partB.name = `${original.name || original.type} (B)`;
          partB.dims = { ...dims, [axis]: sizeB };

          const localCenterVecB = new THREE.Vector3();
          if (isX) localCenterVecB.set(centerB_Local, 0, 0);
          if (isY) localCenterVecB.set(0, centerB_Local, 0);
          if (isZ) localCenterVecB.set(0, 0, centerB_Local);

          const worldCenterB = localCenterVecB.applyQuaternion(objQuat).add(objPos);
          partB.pos = worldCenterB.toArray();

          // Adjust CSG for Part B
          partB.csgOperations = adjustCSGOperations(partB, objPos, objQuat);

          newObjects.push(partA, partB);
          newSelection.push(partA.id, partB.id);
          objectsToRemove.push(id);

        } else {
          // --- Fallback to CSG Split (Non-Axis Aligned) ---
          console.log("Non-Axis Aligned Split - Using CSG");

          // Helper to get relative transform
          const getRelTransform = (targetObj, cutterWorldPos, cutterWorldRot) => {
            const targetPos = new THREE.Vector3(...(targetObj.pos || [0, 0, 0]));
            const targetRot = new THREE.Euler(...(targetObj.rot || [0, 0, 0]));
            const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);
            const invTargetQuat = targetQuat.clone().invert();

            const relPos = cutterWorldPos.clone().sub(targetPos).applyQuaternion(invTargetQuat);

            const cutterQuat = new THREE.Quaternion().setFromEuler(cutterWorldRot);
            const relQuat = invTargetQuat.clone().multiply(cutterQuat);
            const relEuler = new THREE.Euler().setFromQuaternion(relQuat);

            return { pos: relPos.toArray(), rot: [relEuler.x, relEuler.y, relEuler.z] };
          };

          // Part A (Keep "Left" / Negative Side) -> Subtract "Right" Box
          const partA = duplicateObject(original, 0);
          partA.id = generateObjectId(original.type);
          partA.name = `${original.name || original.type} (A)`;

          const boxRightRel = getRelTransform(partA, boxRightPos, planeRot);
          if (!partA.csgOperations) partA.csgOperations = [];
          partA.csgOperations.push({
            type: 'box',
            dims: { w: huge, h: huge, d: huge },
            relativeTransform: boxRightRel,
            operation: 'subtract',
            id: generateObjectId('cut_r')
          });

          // Part B (Keep "Right" / Positive Side) -> Subtract "Left" Box
          const partB = duplicateObject(original, 0);
          partB.id = generateObjectId(original.type);
          partB.name = `${original.name || original.type} (B)`;

          const boxLeftRel = getRelTransform(partB, boxLeftPos, planeRot);
          if (!partB.csgOperations) partB.csgOperations = [];
          partB.csgOperations.push({
            type: 'box',
            dims: { w: huge, h: huge, d: huge },
            relativeTransform: boxLeftRel,
            operation: 'subtract',
            id: generateObjectId('cut_l')
          });

          newObjects.push(partA, partB);
          newSelection.push(partA.id, partB.id);
          objectsToRemove.push(id);
        }
      });

      return nextObjects.filter(o => !objectsToRemove.includes(o.id)).concat(newObjects);
    });

    setSelectedIds(newSelection);
    setTransformMode('translate'); // Exit cut mode after split
    setCutterFace(null);
    showToast({ type: "success", text: "Split applied", ttl: 2000 });

  }, [cutterFace, selectedIds, setObjects, setSelectedIds, showToast]);

  const formatPartName = useCallback((part) => {
    if (!part) return "对象";
    if (part.name) return part.name;
    if (part.type) return part.type.toUpperCase();
    return part.id;
  }, []);

  const computeFaceTransform = useCallback((obj, faceName) => {
    if (!obj || !faceName) return null;
    const pos = Array.isArray(obj.pos) ? obj.pos : [0, 0, 0];
    const rot = Array.isArray(obj.rot) ? obj.rot : [0, 0, 0];
    const dims = obj.dims || {};
    const width = dims.w ?? 0;
    const height = dims.h ?? 0;
    const depth = dims.d ?? 0;
    const position = new THREE.Vector3(pos[0], pos[1], pos[2]);
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rot[0], rot[1], rot[2], "XYZ")
    );

    if (faceName === "io-cutout" && obj.type === "motherboard") {
      const spec = getMotherboardIoCutoutBounds(dims);
      if (!spec) return null;
      const localCenter = new THREE.Vector3(...spec.center);
      const localNormal = new THREE.Vector3(...spec.normal);
      const worldCenter = position.clone().add(localCenter.applyQuaternion(quaternion.clone()));
      const worldNormal = localNormal.applyQuaternion(quaternion.clone()).normalize();
      return { center: worldCenter, normal: worldNormal };
    }

    let localOffset;
    let localNormal;
    switch (faceName) {
      case "+X":
        localOffset = new THREE.Vector3(width / 2, 0, 0);
        localNormal = new THREE.Vector3(1, 0, 0);
        break;
      case "-X":
        localOffset = new THREE.Vector3(-width / 2, 0, 0);
        localNormal = new THREE.Vector3(-1, 0, 0);
        break;
      case "+Y":
        localOffset = new THREE.Vector3(0, height / 2, 0);
        localNormal = new THREE.Vector3(0, 1, 0);
        break;
      case "-Y":
        localOffset = new THREE.Vector3(0, -height / 2, 0);
        localNormal = new THREE.Vector3(0, -1, 0);
        break;
      case "+Z":
        localOffset = new THREE.Vector3(0, 0, depth / 2);
        localNormal = new THREE.Vector3(0, 0, 1);
        break;
      case "-Z":
        localOffset = new THREE.Vector3(0, 0, -depth / 2);
        localNormal = new THREE.Vector3(0, 0, -1);
        break;
      default:
        return null;
    }

    const worldCenter = position.clone().add(localOffset.applyQuaternion(quaternion));
    const worldNormal = localNormal.applyQuaternion(quaternion).normalize();
    if (obj.type === "gpu" || obj.type === "gpu-bracket") {
      alog("face-transform:gpu", {
        id: obj.id,
        type: obj.type,
        face: faceName,
        pos,
        rot,
        dims,
        width,
        height,
        depth,
        center: worldCenter.toArray(),
        normal: worldNormal.toArray(),
      });
    }
    return { center: worldCenter, normal: worldNormal };
  }, []);

  const getConnectorLabel = useCallback((part, connectorId) => {
    if (!part || !connectorId) return connectorId || "Unknown connector";
    const connector = (part.connectors || []).find((item) => item?.id === connectorId);
    if (connector?.label) return connector.label;
    return connectorId;
  }, []);

  const computeConnectorTransform = useCallback((obj, connectorId) => {
    if (!obj || !connectorId) return null;
    const connector = (obj.connectors || []).find((item) => item?.id === connectorId);
    if (!connector) return null;
    const localPos = new THREE.Vector3(
      ...(Array.isArray(connector.pos) ? connector.pos : [0, 0, 0])
    );
    const localNormal = new THREE.Vector3(
      ...(Array.isArray(connector.normal) ? connector.normal : [0, 1, 0])
    ).normalize();
    const localUp = new THREE.Vector3(
      ...(Array.isArray(connector.up) ? connector.up : [0, 0, 1])
    ).normalize();
    const position = new THREE.Vector3(
      ...(Array.isArray(obj.pos) ? obj.pos : [0, 0, 0])
    );
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        ...(Array.isArray(obj.rot) ? obj.rot : [0, 0, 0]),
        "XYZ"
      )
    );
    return {
      connector,
      localPos,
      localNormal,
      localUp,
      worldCenter: position.clone().add(localPos.clone().applyQuaternion(quaternion)),
      worldNormal: localNormal.clone().applyQuaternion(quaternion).normalize(),
      worldUp: localUp.clone().applyQuaternion(quaternion).normalize(),
      quaternion,
    };
  }, []);

  const handleFacePick = useCallback(
    (faceInfo) => {
      alog("pick", { faceInfo, pending: pendingAlignFace, mode: transformMode });

      if (transformMode === 'cut') {
        if (faceInfo.event.shiftKey) {
          // faceInfo.point is already an array [x,y,z] from MovablePart
          // faceInfo.normal might be an array or Vector3
          const localNormal = faceInfo.normal.isVector3 ? faceInfo.normal.clone() : new THREE.Vector3(...faceInfo.normal);
          const worldNormal = localNormal.transformDirection(faceInfo.object.matrixWorld).normalize();

          setCutterFace({
            point: faceInfo.point,
            normal: worldNormal.toArray()
          });
          showToast({ type: "info", text: "Split plane set", ttl: 1500 });
        }
        return;
      }

      if (!alignEnabled || !faceInfo) {
        return;
      }
      // Drill and ruler modes don't use the two-step pending face selection
      if (!pendingAlignFace && transformMode !== "ruler" && transformMode !== "drill") {
        alog("pick:first", faceInfo);
        setPendingAlignFace(faceInfo);
        showToast({
          type: "info",
          text: "已选中要移动/调整的面。再选择对齐目标面。",
        });
        return;
      }

      if (transformMode === "drill") {
        // Use ghost position if available (snapped), otherwise click point
        const targetPoint = drillGhost?.snapped ? drillGhost.position : (faceInfo.point || [0, 0, 0]);

        if (!targetPoint) return;

        const obj = expandedObjects.find((o) => o.id === faceInfo.partId);
        if (!obj) return;

        // Convert World Point to Local Point
        // We need the inverse transform of the object.
        // Since we don't have the object's matrix here, we can approximate if rotation is simple,
        // OR we can rely on the fact that 'faceInfo.point' was World, and we need to transform it.
        // Wait, 'faceInfo.localPoint' was passed from MovablePart!
        // But if we snapped, we have a new World Point. We need to convert it to local.
        // This is tricky without the matrix.
        // ALTERNATIVE: Pass the snap calculation DOWN to MovablePart? 
        // Or pass the matrix UP?
        // Let's assume for now we can't easily convert back without the matrix.
        // Let's use the 'localPoint' from faceInfo if not snapped.
        // If snapped, we might be slightly off if we don't convert correctly.

        // BETTER APPROACH:
        // In MovablePart, we have the ref. We can expose a method or use the existing 'onFacePick' 
        // to handle the conversion if we pass the snapped world point back?
        // No, 'onFacePick' is called by MovablePart.

        // Let's try to compute local from world here using the object's pos/rot/dims.
        // It's a bit manual but possible for simple transforms.
        // Local = (World - Pos).applyQuaternion(InverseRot)

        const worldP = new THREE.Vector3(...targetPoint);
        const pos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));

        // Use the World Quaternion passed from MovablePart if available (handles groups/parents)
        // Otherwise fall back to object rotation (only works for top-level objects)
        let invQ;
        if (faceInfo.quaternion) {
          const worldQ = new THREE.Quaternion(...faceInfo.quaternion);
          invQ = worldQ.clone().invert();
        } else {
          const rot = new THREE.Euler(...(obj.rot || [0, 0, 0]));
          const q = new THREE.Quaternion().setFromEuler(rot);
          invQ = q.clone().invert();
        }

        const localP = worldP.clone().sub(pos).applyQuaternion(invQ);

        // Convert World Normal to Local Normal
        const worldNormal = new THREE.Vector3(...(faceInfo.normal || [0, 0, 1]));
        const localNormal = worldNormal.clone().applyQuaternion(invQ).normalize();

        // Create a new hole
        const newHole = {
          id: `hole_${Date.now()}`,
          type: drillParams.drillType === 'nut' ? 'nut' : 'counterbore',
          diameter: drillParams.drillType === 'nut' ? (drillParams.nutDiameter || 6) : drillParams.holeDiameter,
          position: localP.toArray(),
          direction: localNormal.toArray(),
          depth: drillParams.drillType === 'nut' ? (drillParams.nutDepth || 2.5) : drillParams.holeDepth,
          headDiameter: drillParams.headDiameter,
          headDepth: drillParams.headDepth,
        };

        setObjects((prev) =>
          prev.map((o) => {
            if (o.id === obj.id) {
              return {
                ...o,
                holes: [...(o.holes || []), newHole],
              };
            }
            return o;
          })
        );

        showToast({
          type: "success",
          text: "Hole drilled!",
          ttl: 2000,
        });
        return;
      }

      if (transformMode === "ruler") {
        const obj = expandedObjects.find((o) => o.id === faceInfo.partId);
        if (!obj) return;
        const transform = computeFaceTransform(obj, faceInfo.face);
        if (!transform) return;

        const newPoint = { ...transform, partId: faceInfo.partId, face: faceInfo.face };

        if (rulerPoints.length === 0) {
          if (!faceInfo.shiftKey) {
            showToast({
              type: "info",
              text: "Hold Shift + Click to select start face.",
              ttl: 3000,
            });
            return;
          }

          rulerStartRef.current = newPoint;
          setRulerPoints([newPoint.center]);

          showToast({
            type: "info",
            text: "Start face selected. Click target face to measure.",
            ttl: 3000,
          });
        } else {
          const p1 = rulerStartRef.current;
          if (!p1) {
            setRulerPoints([]);
            return;
          }
          const p2 = newPoint;

          const n1 = p1.normal.clone();
          const n2 = p2.normal.clone();
          const parallel = Math.abs(n1.dot(n2));
          let dist, p2Final, label;

          if (parallel > 0.99) {
            const v = p2.center.clone().sub(p1.center);
            dist = Math.abs(v.dot(n1));

            if (dist > 0.1) {
              const sign = Math.sign(v.dot(n1));
              p2Final = p1.center.clone().add(n1.clone().multiplyScalar(dist * sign));
              label = "Perpendicular Distance";
            } else {
              dist = p1.center.distanceTo(p2.center);
              p2Final = p2.center;
              label = "Center to Center";
            }
          } else {
            dist = p1.center.distanceTo(p2.center);
            p2Final = p2.center;
            label = "Center to Center";
          }

          setRulerPoints([p1.center, p2Final]);

          const dx = Math.abs(p1.center.x - p2.center.x);
          const dy = Math.abs(p1.center.y - p2.center.y);
          const dz = Math.abs(p1.center.z - p2.center.z);

          setMeasurements((prev) => [
            ...prev,
            {
              p1: p1.center.toArray(),
              p2: p2Final.toArray(),
              distance: dist,
              label,
            },
          ]);

          showToast({
            type: "success",
            text: `${label}: ${dist.toFixed(2)}mm (X: ${dx.toFixed(2)}, Y: ${dy.toFixed(2)}, Z: ${dz.toFixed(2)})`,
            ttl: 5000,
          });

          // setRulerPoints([]); // Removed to keep points selected until manual clear
          rulerStartRef.current = null;
        }
        return;
      }

      if (pendingAlignFace.partId === faceInfo.partId) {
        showToast({
          type: "warning",
          text: "请选择不同零件的面进行对齐。",
        });
        setPendingAlignFace(null);
        return;
      }

      const movingObj = expandedObjects.find((obj) => obj.id === pendingAlignFace.partId);
      const anchorObj = expandedObjects.find((obj) => obj.id === faceInfo.partId);
      if (!anchorObj || !movingObj) {
        setPendingAlignFace(null);
        return;
      }
      if (movingObj.embeddedParentId) {
        showToast({
          type: "warning",
          text: "嵌入式部件无法移动，请选择其它零件。",
        });
        setPendingAlignFace(null);
        return;
      }
      const movingBaseObj = objects.find((obj) => obj.id === movingObj.id);
      if (!movingBaseObj) {
        setPendingAlignFace(null);
        return;
      }

      const movingTransform = computeFaceTransform(movingObj, pendingAlignFace.face);
      const anchorTransform = computeFaceTransform(anchorObj, faceInfo.face);
      if (!anchorTransform || !movingTransform) {
        setPendingAlignFace(null);
        return;
      }

      if (transformMode === "rotate") {
        // Rotation Alignment Logic
        // Rotate movingObj so that movingTransform.normal aligns with anchorTransform.normal
        const startNormal = movingTransform.normal.clone();
        const targetNormal = anchorTransform.normal.clone();

        // Calculate the rotation needed to align the normals
        const alignQuat = new THREE.Quaternion().setFromUnitVectors(startNormal, targetNormal);

        // Apply this rotation to the object's current rotation
        const currentQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            movingObj.rot?.[0] ?? 0,
            movingObj.rot?.[1] ?? 0,
            movingObj.rot?.[2] ?? 0,
            "XYZ"
          )
        );

        // Pre-multiply because we are rotating the object in world space?
        // If we want to rotate the vector N by Q, and N is attached to the object...
        // NewOrientation = Q * OldOrientation
        const newQuat = alignQuat.multiply(currentQuat);
        const newEuler = new THREE.Euler().setFromQuaternion(newQuat, "XYZ");

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === movingObj.id
              ? {
                ...obj,
                rot: [newEuler.x, newEuler.y, newEuler.z],
              }
              : obj
          )
        );

        setSelectedIds([movingObj.id]);
        setPendingAlignFace(null);
        showToast({
          type: "success",
          text: `已将 ${formatPartName(movingObj)} 旋转对齐到 ${formatPartName(anchorObj)}`,
        });
        return;
      }

      const parallel = Math.abs(anchorTransform.normal.dot(movingTransform.normal));
      if (parallel < 0.999) {
        showToast({
          type: "warning",
          text: "两个面的法线不平行，无法对齐。",
        });
        setPendingAlignFace(null);
        return;
      }

      const direction = movingTransform.normal.clone();
      const delta = direction.dot(
        anchorTransform.center.clone().sub(movingTransform.center)
      );
      alog("pick:align", {
        movingId: movingObj.id,
        anchorId: anchorObj.id,
        movingFace: pendingAlignFace.face,
        anchorFace: faceInfo.face,
        movingCenter: movingTransform.center.toArray(),
        anchorCenter: anchorTransform.center.toArray(),
        direction: direction.toArray(),
        delta,
        parallel,
      });

      if (transformMode === "scale") {
        // Stretch Alignment Logic
        const getStretchAxisInfo = (obj, faceName) => {
          if (!faceName || faceName.length < 2) return null;
          const axis = faceName[1];
          const dimKey = obj?.type === "gpu"
            ? (axis === "X" ? "d" : axis === "Z" ? "w" : "h")
            : (axis === "X" ? "w" : axis === "Y" ? "h" : "d");
          return { dimKey };
        };

        const axisInfo = getStretchAxisInfo(movingObj, pendingAlignFace.face);
        if (!axisInfo) {
          showToast({ type: "warning", text: "无法调整该方向的尺寸。" });
          setPendingAlignFace(null);
          return;
        }

        const currentSize = movingObj.dims[axisInfo.dimKey];
        let newSize = currentSize + delta;
        if (newSize < 1) newSize = 1;
        const appliedDelta = newSize - currentSize;

        const offset = direction.clone().multiplyScalar(appliedDelta / 2);
        const newPos = new THREE.Vector3(...movingObj.pos).add(offset);

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === movingObj.id
              ? {
                ...obj,
                pos: [newPos.x, newPos.y, newPos.z],
                dims: { ...obj.dims, [axisInfo.dimKey]: newSize },
              }
              : obj
          )
        );
      } else {
        // Translate Alignment Logic
        const newPos = new THREE.Vector3(
          movingObj.pos?.[0] ?? 0,
          movingObj.pos?.[1] ?? 0,
          movingObj.pos?.[2] ?? 0
        ).add(direction.multiplyScalar(delta));

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === movingObj.id ? { ...obj, pos: [newPos.x, newPos.y, newPos.z] } : obj
          )
        );
      }
      setSelectedIds([movingObj.id]);
      setPendingAlignFace(null);
      showToast({
        type: "success",
        text: `已将 ${formatPartName(movingObj)} 对齐到 ${formatPartName(anchorObj)}`,
      });
    },
    [
      alignEnabled,
      pendingAlignFace,
      objects,
      setObjects,
      setSelectedIds,
      formatPartName,
      showToast,
      computeFaceTransform,
      transformMode,
      rulerPoints,
      drillGhost,
      expandedObjects,
      transformMode,
      setCutterFace,
    ]
  );

  const handleConnectorPick = useCallback(
    ({ partId, connectorId }) => {
      if (!partId || !connectorId) {
        return;
      }
      const currentObj = objects.find((obj) => obj.id === partId);
      if (!currentObj) {
        return;
      }

      if (!pendingConnector) {
        setPendingConnector({ partId, connectorId });
        setSelectedIds([partId]);
        showToast({
          type: "info",
          text: `已选中 ${formatPartName(currentObj)} (移动部件)。请选择目标连接点。`,
          ttl: 4000,
        });
        return;
      }

      if (
        pendingConnector.partId === partId &&
        pendingConnector.connectorId === connectorId
      ) {
        setPendingConnector(null);
        showToast(null);
        return;
      }

      // Logic Swapped: 
      // pendingConnector = Source (Moving Part)
      // current selection (partId) = Target (Anchor Part)
      const movingObj = objects.find((obj) => obj.id === pendingConnector.partId);
      const anchorObj = objects.find((obj) => obj.id === partId);

      if (!anchorObj || !movingObj) {
        setPendingConnector(null);
        return;
      }
      if (anchorObj.id === movingObj.id) {
        showToast({
          type: "warning",
          text: "请选择不同零件的连接点。",
          ttl: 2000,
        });
        setPendingConnector(null);
        return;
      }

      const movingTransform = computeConnectorTransform(
        movingObj,
        pendingConnector.connectorId
      );
      const anchorTransform = computeConnectorTransform(anchorObj, connectorId);

      if (!anchorTransform || !movingTransform) {
        setPendingConnector(null);
        return;
      }

      const targetNormal = anchorTransform.worldNormal.clone().multiplyScalar(-1);
      const normalRotation = new THREE.Quaternion().setFromUnitVectors(
        movingTransform.worldNormal.clone(),
        targetNormal
      );
      const rotatedUp = movingTransform.worldUp.clone().applyQuaternion(normalRotation);
      const anchorUpProjected = anchorTransform.worldUp
        .clone()
        .projectOnPlane(anchorTransform.worldNormal);
      const rotatedUpProjected = rotatedUp
        .clone()
        .projectOnPlane(anchorTransform.worldNormal);
      if (anchorUpProjected.lengthSq() < 1e-6) {
        anchorUpProjected.copy(anchorTransform.worldUp);
      }
      if (rotatedUpProjected.lengthSq() < 1e-6) {
        rotatedUpProjected.copy(rotatedUp);
      }
      anchorUpProjected.normalize();
      rotatedUpProjected.normalize();

      const twistNumerator = anchorTransform.worldNormal
        .clone()
        .dot(rotatedUpProjected.clone().cross(anchorUpProjected));
      const twistDenominator = rotatedUpProjected.dot(anchorUpProjected);
      const twistAngle = Math.atan2(twistNumerator, twistDenominator);
      const twistQuat = new THREE.Quaternion().setFromAxisAngle(
        anchorTransform.worldNormal,
        twistAngle
      );
      const totalRotation = twistQuat.multiply(normalRotation);
      const nextQuat = totalRotation.clone().multiply(movingTransform.quaternion);
      const nextEuler = new THREE.Euler().setFromQuaternion(nextQuat, "XYZ");

      const rotatedLocalPos = movingTransform.localPos.clone().applyQuaternion(nextQuat);
      const targetPos = anchorTransform.worldCenter.clone().sub(rotatedLocalPos);

      setObjects((prev) =>
        prev.map((obj) =>
          obj.id === movingObj.id
            ? {
              ...obj,
              pos: [targetPos.x, targetPos.y, targetPos.z],
              rot: [nextEuler.x, nextEuler.y, nextEuler.z],
            }
            : obj
        )
      );
      setSelectedIds([movingObj.id]);
      setPendingConnector(null);
      showToast({
        type: "success",
        text: `已将 ${formatPartName(movingObj)} 连接到 ${formatPartName(anchorObj)}`,
      });
    },
    [
      objects,
      pendingConnector,
      computeConnectorTransform,
      formatPartName,
      getConnectorLabel,
      showToast,
      setObjects,
      setSelectedIds,
    ]
  );

  const handleApplyConnectorOrientation = useCallback(
    (connectorId, normal, up) => {
      if (!selectedObject) {
        return;
      }
      setObjects((prev) =>
        prev.map((obj) => {
          if (obj.id !== selectedObject.id) {
            return obj;
          }
          const nextConnectors = (obj.connectors || []).map((connector) =>
            connector?.id === connectorId ? { ...connector, normal, up } : connector
          );
          return { ...obj, connectors: nextConnectors };
        })
      );
      showToast({
        type: "info",
        text: `Updated ${getConnectorLabel(selectedObject, connectorId)} orientation.`,
        ttl: 2000,
      });
    },
    [getConnectorLabel, selectedObject, showToast, setObjects]
  );

  useEffect(() => {
    const { objects: hydratedObjects, changed } = ensureSceneConnectors(objects);
    if (changed) {
      setObjects(hydratedObjects, { recordHistory: false });
    }
  }, [objects, setObjects]);

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    setObjects((prev) => prev.filter((o) => !selectedIds.includes(o.id)));
    setSelectedIds([]);
  }, [selectedIds, setObjects, setSelectedIds]);

  const handleHoleDelete = useCallback((partId, holeId) => {
    setObjects((prev) =>
      prev.map((obj) => {
        if (obj.id !== partId) return obj;
        const updatedHoles = (obj.holes || []).filter((h) => h.id !== holeId);
        return { ...obj, holes: updatedHoles };
      })
    );
    showToast({
      type: "success",
      text: "Hole deleted",
      ttl: 1500,
    });
  }, [setObjects, showToast]);

  const clearMeasurements = useCallback(() => {
    setMeasurements([]);
    setRulerPoints([]);
    showToast({ type: "info", text: "Measurements cleared.", ttl: 2000 });
  }, []);



  const handleGenerateStandoffs = useCallback(() => {
    if (!selectedObject) return;

    const holes = selectedObject.connectors?.filter(c => c.type === 'screw-m3' || c.type === 'mb-mount') || [];
    if (holes.length === 0) {
      showToast({ type: "error", text: "No suitable holes found.", ttl: 2000 });
      return;
    }

    // Helper to flatten objects (duplicated for now)
    const flattenObjectsWithTransforms = (objs, parentWorldPos = null, parentWorldQuat = null) => {
      let results = [];
      objs.forEach(obj => {
        if (!obj.visible) return;
        const localPos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
        const localEuler = new THREE.Euler(...(obj.rot || [0, 0, 0]));
        const localQuat = new THREE.Quaternion().setFromEuler(localEuler);
        let worldPos, worldQuat;
        if (parentWorldPos && parentWorldQuat) {
          worldPos = parentWorldPos.clone().add(localPos.clone().applyQuaternion(parentWorldQuat));
          worldQuat = parentWorldQuat.clone().multiply(localQuat);
        } else {
          worldPos = localPos;
          worldQuat = localQuat;
        }
        results.push({ ...obj, worldPos, worldQuat });
        if (Array.isArray(obj.children) && obj.children.length > 0) {
          results = results.concat(flattenObjectsWithTransforms(obj.children, worldPos, worldQuat));
        }
      });
      return results;
    };

    const flatObjects = flattenObjectsWithTransforms(expandedObjects);
    const sourceObjFlat = flatObjects.find(o => o.id === selectedObject.id);
    if (!sourceObjFlat) return;

    const newStandoffs = [];
    const raycaster = new THREE.Raycaster();

    holes.forEach(hole => {
      // Calculate hole world position and direction
      const holeLocalPos = new THREE.Vector3(...hole.pos);
      const holeLocalNormal = new THREE.Vector3(...(hole.normal || [0, -1, 0]));

      const holeWorldPos = holeLocalPos.clone().applyQuaternion(sourceObjFlat.worldQuat).add(sourceObjFlat.worldPos);
      const holeWorldNormal = holeLocalNormal.clone().applyQuaternion(sourceObjFlat.worldQuat).normalize();

      // Raycast down (direction of normal)
      raycaster.set(holeWorldPos, holeWorldNormal);

      let bestHit = null;
      let minDistance = Infinity;

      flatObjects.forEach(target => {
        if (target.id === selectedObject.id) return; // Skip self

        // Create OBB for target
        const invTargetQuat = target.worldQuat.clone().invert();
        const rayOriginLocal = holeWorldPos.clone().sub(target.worldPos).applyQuaternion(invTargetQuat);
        const rayDirLocal = holeWorldNormal.clone().applyQuaternion(invTargetQuat).normalize();
        const localRay = new THREE.Ray(rayOriginLocal, rayDirLocal);

        const halfW = (target.dims?.w || 0) / 2;
        const halfH = (target.dims?.h || 0) / 2;
        const halfD = (target.dims?.d || 0) / 2;
        const box = new THREE.Box3(
          new THREE.Vector3(-halfW, -halfH, -halfD),
          new THREE.Vector3(halfW, halfH, halfD)
        );

        const intersection = localRay.intersectBox(box, new THREE.Vector3());
        if (intersection) {
          const dist = rayOriginLocal.distanceTo(intersection);
          if (dist < minDistance && dist > 0.1) { // 0.1 tolerance
            minDistance = dist;
            bestHit = { target, point: intersection, dist };
          }
        }
      });

      if (bestHit) {
        // Calculate World Hit Point
        const worldHit = bestHit.point.clone().applyQuaternion(bestHit.target.worldQuat).add(bestHit.target.worldPos);

        // Standoff up is opposite to hole normal (which points down)
        const up = new THREE.Vector3(0, 1, 0);
        const targetUp = holeWorldNormal.clone().negate();
        const q = new THREE.Quaternion().setFromUnitVectors(up, targetUp);
        const euler = new THREE.Euler().setFromQuaternion(q);

        newStandoffs.push({
          id: generateObjectId("standoff"),
          type: "standoff",
          name: "Standoff",
          pos: worldHit.toArray(),
          rot: [euler.x, euler.y, euler.z],
          height: minDistance,
          outerDiameter: 6,
          holeDiameter: 3,
          baseHeight: 3,
          baseDiameter: 10,
          dims: { w: 6, h: minDistance, d: 6 }
        });
      }
    });

    if (newStandoffs.length > 0) {
      setObjects(prev => [...prev, ...newStandoffs]);
      // Select the last generated standoff
      setSelectedIds([newStandoffs[newStandoffs.length - 1].id]);
      showToast({ type: "success", text: `Generated ${newStandoffs.length} standoffs.`, ttl: 2000 });
    } else {
      showToast({ type: "warning", text: "No target parts found below holes.", ttl: 2000 });
    }

  }, [selectedObject, expandedObjects, setObjects, showToast, setSelectedIds]);

  const handleConnect = useCallback((typeArg) => {
    if (selectedIds.length !== 2) {
      return;
    }
    const partA = objects.find(o => o.id === selectedIds[0]);
    const partB = objects.find(o => o.id === selectedIds[1]);
    if (!partA || !partB) {
      return;
    }

    let type = typeArg;
    if (!type) {
      // Fallback to prompt if no type provided (e.g. from TopBar if we kept it)
      type = window.prompt("Enter connection type (half-lap, external-plate, blind-joint, cross-lap, shear-boss):", "half-lap");
    }
    if (!type) return;

    const newConnection = {
      id: generateObjectId("conn"),
      type: type,
      partA: partA.id,
      partB: partB.id,
      params: {}
    };

    setConnections(prev => {
      const next = [...prev, newConnection];
      return next;
    });
    showToast({ type: "success", text: `Created ${type} connection.`, ttl: 2000 });

  }, [selectedIds, objects, setConnections, showToast]);



  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", overflow: "hidden", background: "#0b1020" }}>
      {/* Top Bar */}
      <TopBar
        onImport={handleImport}
        onExport={handleExport}
        undo={undo}
        redo={redo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        transformMode={transformMode}
        setTransformMode={handleTransformModeChange}
        showGrid={showHorizontalGrid}
        setShowGrid={setShowHorizontalGrid}
        showGizmos={showGizmos}
        setShowGizmos={setShowGizmos}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        measurements={measurements}
        onClearMeasurements={clearMeasurements}
        onOpenProjectManager={() => setActiveLeftTab("projects")}
        currentProjectName={currentProjectName}
        onGenerateStandoffs={handleGenerateStandoffs}
        onConnect={() => {
          if (activeConnectorId) {
            setActiveConnectorId(null);
          }
        }}
        onToggleCut={handleToggleCutMode}
        isCutting={transformMode === 'cut'}
        selectedObject={selectedObject}
        selectedIds={selectedIds}
      />
      <HUD transformMode={transformMode} onApplyCut={performSplit} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Left Sidebar */}
        <LeftSidebar
          objects={objects}
          setObjects={setObjects}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onDuplicate={handleDuplicate}
          activeTab={activeLeftTab}
          onTabChange={setActiveLeftTab}
        />

        {/* Main Viewport */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <Scene
            objects={expandedObjects}
            setObjects={setObjects}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            connections={connections}
            showHorizontalGrid={showHorizontalGrid}
            alignMode={alignEnabled}
            onFacePick={handleFacePick}
            onDrillHover={handleDrillHover}
            onConnectorPick={handleConnectorPick}
            activeAlignFace={pendingAlignFace}
            transformMode={transformMode}
            onChangeTransformMode={handleTransformModeChange}
            showTransformControls={showGizmos}
            snapEnabled={snapEnabled}
            measurements={measurements}
            drillGhost={drillGhost}
            drillCandidates={drillCandidates}
            onHoleDelete={handleHoleDelete}
            rulerPoints={rulerPoints}
            cutterFace={cutterFace}
            isCutting={transformMode === 'cut'}
          />
        </div>

        {/* Right Sidebar */}
        {selectedObject && (
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 10, height: "100%" }}>
            <RightSidebar
              selectedObject={selectedObject}
              selectedIds={selectedIds}
              objects={objects}
              setObjects={setObjects}
              connections={connections}
              activeConnectorId={activeConnectorId}
              setActiveConnectorId={setActiveConnectorId}
              onApplyConnectorOrientation={handleApplyConnectorOrientation}
              onGroup={handleGroup}
              onUngroup={handleUngroup}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onConnect={handleConnect}
            />
          </div>
        )}

        <ConnectorToast />
      </div>
    </div>
  );
}





export default function PCEditor() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <EditorContent />
      </ToastProvider>
    </LanguageProvider>
  );
}
