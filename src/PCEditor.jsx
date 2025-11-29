import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import * as THREE from "three";
import Scene from "./components/Scene";
import TopBar from "./components/UI/TopBar";
import LeftSidebar from "./components/UI/LeftSidebar";
import RightSidebar from "./components/UI/RightSidebar";
import ConnectorToast from "./components/UI/ConnectorToast";

import { exportSTLFrom } from "./utils/exportSTL";
import { useStore, useTemporalStore } from "./store";
import { ensureSceneConnectors } from "./utils/connectors";
import { getMotherboardIoCutoutBounds } from "./config/motherboardPresets";
import { expandObjectsWithEmbedded } from "./utils/embeddedParts";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

const DUPLICATE_OFFSET = 25;
const alog = () => {};

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
    projects,
    currentProjectId,
    copyToClipboard,
    pasteFromClipboard,
  } = useStore();
  const { undo, redo, future, past } = useTemporalStore((state) => state);
  const [connectorToast, setConnectorToast] = useState(null);
  const [activeConnectorId, setActiveConnectorId] = useState(null);
  const [showHorizontalGrid, setShowHorizontalGrid] = useState(true);
  const [transformMode, setTransformMode] = useState("translate");
  const [pendingAlignFace, setPendingAlignFace] = useState(null);
  const [showGizmos, setShowGizmos] = useState(true);
  const [pendingConnector, setPendingConnector] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(false); // New snap state
  const [rulerPoints, setRulerPoints] = useState([]); // Ruler state
  const [measurements, setMeasurements] = useState([]); // Persistent measurements
  
  // Lifted state for LeftSidebar tabs
  const [activeLeftTab, setActiveLeftTab] = useState("library");

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

  useEffect(() => {
    if (!connectorToast) {
      return undefined;
    }
    const timer = setTimeout(() => setConnectorToast(null), connectorToast.ttl ?? 2600);
    return () => clearTimeout(timer);
  }, [connectorToast]);

  const alignEnabled = transformMode === "translate" || transformMode === "scale" || transformMode === "ruler" || transformMode === "drill";

  useEffect(() => {
    if (!alignEnabled) {
      setPendingAlignFace(null);
    } else if (selectedIds.length === 0 && transformMode !== "ruler" && !pendingAlignFace) {
      // Only clear if we are not in ruler mode and have no pending face, 
      // OR if we want to enforce selection-clearing behavior.
      // Actually, if we want to allow starting without selection, we shouldn't auto-clear here just because selectedIds is empty.
      // But we SHOULD clear if the user explicitly deselected everything (which usually sets selectedIds to []).
      // Let's rely on handleSelect(null) to clear things if needed, or just keep it simple:
      // If we are in a mode that allows it, we don't strictly need selectedIds to be non-empty to hold a pending face.
      // However, if the user clicks empty space, handleSelect(null) is called.
    }
    if (transformMode !== "ruler" && transformMode !== "drill") {
      setRulerPoints([]);
      setDrillGhost(null);
      setDrillCandidates([]);
    }
  }, [alignEnabled, transformMode]);

  const [drillGhost, setDrillGhost] = useState(null);
  const [drillCandidates, setDrillCandidates] = useState([]);
  const snapThreshold = 10; // mm

  const handleDrillHover = useCallback(
    (info) => {
      if (transformMode !== "drill" || !info?.point || !info?.normal) {
        setDrillGhost(null);
        setDrillCandidates([]);
        return;
      }

      const { partId, point, normal, face, faceCenter, faceSize } = info;
      const worldPoint = new THREE.Vector3(...point);
      const worldNormalA = new THREE.Vector3(...normal).normalize(); // A 面法线

      // 1️⃣ 找到当前 hover 的对象 X
      const baseObj = expandedObjects.find((o) => o.id === partId);
      if (!baseObj) {
        setDrillGhost(null);
        setDrillCandidates([]);
        return;
      }

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
        : 1000;
      const faceCenterVecB = planePointB.clone();

      expandedObjects.forEach((obj) => {
        if (obj.id === partId || obj.visible === false) return;

        const objCenter = new THREE.Vector3(...(obj.pos || [0, 0, 0]));

        // 根据对象自身的旋转和尺寸，估计它在 B 面法线方向上的“半厚度”
        const axes = getWorldAxesForObject(obj);
        const halfDepth = projectedHalfExtentAlongAxis(
          planeNormalB,
          obj.dims || {},
          axes
        );

        if (halfDepth <= 0) return;

        const signedDist = planeB.distanceToPoint(objCenter);

        // 只有当对象的包围盒真正与 B 平面有交集时，才认为是“与 B 面附近相交”
        const margin = 0.5; // 适当放宽一点，避免数值误差
        if (Math.abs(signedDist) > halfDepth + margin) {
          return;
        }

        // 先把对象中心投影到 B 面
        const projectedOnB = new THREE.Vector3();
        planeB.projectPoint(objCenter, projectedOnB);

        // 再把这个点沿着 A 面法线投影到 A 面上
        const projectedOnA = new THREE.Vector3();
        planeA.projectPoint(projectedOnB, projectedOnA);

        // 用 B 面上的中心做“半径过滤”，防止太远的物体也算进去
        if (projectedOnB.distanceTo(faceCenterVecB) < maxDim / 1.5) {
          // 真正的蓝点画在 A 面上
          newCandidates.push(projectedOnA);
        }
      });

      setDrillCandidates(newCandidates);

      // Snap Logic：如果鼠标点靠近某个候选点，就把 ghost 吸附到该中心
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
      // 单?
      setSelectedIds([id]);
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
        setConnectorToast({
          type: "success",
          text: `已复制 ${nextSelection.length} 个零件`,
          ttl: 1500,
        });
      }
    },
    [selectedIds, setObjects, setSelectedIds, setConnectorToast]
  );

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
      if (!alignEnabled || !faceInfo) {
        return;
      }
      // Drill and ruler modes don't use the two-step pending face selection
      if (!pendingAlignFace && transformMode !== "ruler" && transformMode !== "drill") {
        alog("pick:first", faceInfo);
        setPendingAlignFace(faceInfo);
        setConnectorToast({
          type: "info",
          text: "已选中要移动/调整的面。再选择对齐目标面。",
        });
        return;
      }

      if (transformMode === "drill") {
        // Use ghost position if available (snapped), otherwise click point
        const targetPoint = drillGhost?.snapped ? drillGhost.position : (faceInfo.point || [0,0,0]);
        
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
        const pos = new THREE.Vector3(...(obj.pos || [0,0,0]));
        const rot = new THREE.Euler(...(obj.rot || [0,0,0]));
        const q = new THREE.Quaternion().setFromEuler(rot);
        const invQ = q.invert();
        const localP = worldP.clone().sub(pos).applyQuaternion(invQ);

        // Create a new hole
        const newHole = {
          id: `hole_${Date.now()}`,
          type: "counterbore", // Updated type
          diameter: 3.2, 
          position: localP.toArray(),
          direction: faceInfo.normal || [0,0,1],
          depth: 20, // Default depth
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
        
        setConnectorToast({
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
            setConnectorToast({
              type: "info",
              text: "Hold Shift + Click to select start face.",
              ttl: 3000,
            });
            return;
          }
          setRulerPoints([newPoint]);
          setConnectorToast({
            type: "info",
            text: "Start face selected. Click target face to measure.",
            ttl: 3000,
          });
        } else {
          const p1 = rulerPoints[0];
          const p2 = newPoint;

          const n1 = p1.normal.clone();
          const n2 = p2.normal.clone();
          const parallel = Math.abs(n1.dot(n2));
          let dist, p2Final, label;

          if (parallel > 0.99) {
            // Parallel faces: Calculate perpendicular distance
            const v = p2.center.clone().sub(p1.center);
            dist = Math.abs(v.dot(n1));

            if (dist > 0.1) {
              // Project p2 onto the line starting at p1 along n1
              // actually we want a line from p1 to the plane of p2
              // The closest point on plane 2 from p1 is p1 + n1 * dist (if n1 points to p2)
              // Let's just visualize the perpendicular drop.
              // We can keep p1 as is, and move p2 to be p1 + n * dist * sign
              const sign = Math.sign(v.dot(n1));
              p2Final = p1.center.clone().add(n1.clone().multiplyScalar(dist * sign));
              label = "Perpendicular Distance";
            } else {
              // Coplanar (or very close): Use center-to-center
              dist = p1.center.distanceTo(p2.center);
              p2Final = p2.center;
              label = "Center-to-Center Distance";
            }
          } else {
            // Non-parallel: Use Euclidean distance
            dist = p1.center.distanceTo(p2.center);
            p2Final = p2.center;
            label = "Distance";
          }

          const dx = Math.abs(p1.center.x - p2.center.x);
          const dy = Math.abs(p1.center.y - p2.center.y);
          const dz = Math.abs(p1.center.z - p2.center.z);

          const newMeasurement = {
            p1: p1.center.toArray(),
            p2: p2Final.toArray(),
            distance: dist,
          };
          setMeasurements((prev) => [...prev, newMeasurement]);

          setConnectorToast({
            type: "success",
            text: `${label}: ${dist.toFixed(2)}mm (X: ${dx.toFixed(2)}, Y: ${dy.toFixed(2)}, Z: ${dz.toFixed(2)})`,
            ttl: 5000,
          });
          setRulerPoints([]); // Reset for next measurement
        }
        return;
      }

      if (pendingAlignFace.partId === faceInfo.partId) {
        setConnectorToast({
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
        setConnectorToast({
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

      const parallel = Math.abs(anchorTransform.normal.dot(movingTransform.normal));
      if (parallel < 0.999) {
        setConnectorToast({
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
          setConnectorToast({ type: "warning", text: "无法调整该方向的尺寸。" });
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
      setConnectorToast({
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
      setConnectorToast,
      computeFaceTransform,
      transformMode,
      rulerPoints,
      drillGhost,
      expandedObjects,
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
        setConnectorToast({
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
        setConnectorToast(null);
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
        setConnectorToast({
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
      setConnectorToast({
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
      setConnectorToast,
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
      setConnectorToast({
        type: "info",
        text: `Updated ${getConnectorLabel(selectedObject, connectorId)} orientation.`,
        ttl: 2000,
      });
    },
    [getConnectorLabel, selectedObject, setConnectorToast, setObjects]
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
    setConnectorToast({
      type: "success",
      text: "Hole deleted",
      ttl: 1500,
    });
  }, [setObjects, setConnectorToast]);

  const clearMeasurements = useCallback(() => {
    setMeasurements([]);
    setRulerPoints([]);
    setConnectorToast({ type: "info", text: "Measurements cleared.", ttl: 2000 });
  }, []);



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
        setTransformMode={setTransformMode}
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
      />

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
            onChangeTransformMode={setTransformMode}
            showTransformControls={showGizmos}
            snapEnabled={snapEnabled}
            measurements={measurements}
            drillGhost={drillGhost}
            drillCandidates={drillCandidates}
            onHoleDelete={handleHoleDelete}
          />

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

        </div>

        {/* Right Sidebar */}
        {selectedObject && (
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 10, height: "100%" }}>
            <RightSidebar
              selectedObject={selectedObject}
              setObjects={setObjects}
              activeConnectorId={activeConnectorId}
              setActiveConnectorId={setActiveConnectorId}
              onApplyConnectorOrientation={handleApplyConnectorOrientation}
              onGroup={handleGroup}
              onUngroup={handleUngroup}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          </div>
        )}

        <ConnectorToast toast={connectorToast} />
      </div>
    </div>
  );
}

export default function PCEditor() {
  return (
    <LanguageProvider>
      <EditorContent />
    </LanguageProvider>
  );
}
