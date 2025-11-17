import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import Scene from "./components/Scene";
import AddObjectForm from "./components/UI/AddObjectForm";
import ObjectsList from "./components/UI/ObjectsList"; // group/ungroup buttons relocated from ControlsPanel
import FrameBuilderPanel from "./components/UI/FrameBuilderPanel";
import ConnectorEditor from "./components/UI/ConnectorEditor";
import ProjectPanel from "./components/UI/ProjectPanel";
import SceneSettingsPanel from "./components/UI/SceneSettingsPanel";
import { exportSTLFrom } from "./utils/exportSTL";
import { useStore, useTemporalStore } from "./store";
import { ensureSceneConnectors } from "./utils/connectors";
import { getMotherboardIoCutoutBounds } from "./config/motherboardPresets";
import { expandObjectsWithEmbedded } from "./utils/motherboardEmbedded";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export default function PCEditor() {
  const {
    objects,
    setObjects,
    selectedIds,
    setSelectedIds,
    connections,
  } = useStore();
  const { undo, redo, future, past } = useTemporalStore((state) => state);
  const [connectorToast, setConnectorToast] = useState(null);
  const [activeConnectorId, setActiveConnectorId] = useState(null);
const [showHorizontalGrid, setShowHorizontalGrid] = useState(true);
const [transformMode, setTransformMode] = useState("translate");
const [pendingAlignFace, setPendingAlignFace] = useState(null);
const [showGizmos, setShowGizmos] = useState(true);
const [pendingConnector, setPendingConnector] = useState(null);
  const expandedObjects = useMemo(() => expandObjectsWithEmbedded(objects), [objects]);
  const baseIdSet = useMemo(() => new Set(objects.map((o) => o.id)), [objects]);

  useEffect(() => {
    if (!connectorToast) {
      return undefined;
    }
    const timer = setTimeout(() => setConnectorToast(null), connectorToast.ttl ?? 2600);
    return () => clearTimeout(timer);
  }, [connectorToast]);

  const alignEnabled = transformMode === "translate" && selectedIds.length > 0;

  useEffect(() => {
    if (!alignEnabled) {
      setPendingAlignFace(null);
    }
  }, [alignEnabled]);

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
    if (!baseIdSet.has(id)) return;
    if (multi) {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          // 如果已选中，则从选择集中移除
          return prev.filter((i) => i !== id);
        } else {
          // 如果未选中，则添加到选择�?
          return [...prev, id];
        }
      });
    } else {
      // 单�?
      setSelectedIds([id]);
    }
  };
  const lastSelectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  const selectedObject = objects.find((o) => o.id === lastSelectedId);

  const handleGroup = () => {
    if (selectedIds.length <= 1) return;

    const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

    // 1. 计算包围盒和中心�?
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
        // 存储相对于组中心的原始位�?
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

    const children = group.children.map((child) => ({
      ...child,
      pos: [child.pos[0] + group.pos[0], child.pos[1] + group.pos[1], child.pos[2] + group.pos[2]],
    }));

    setObjects((prev) => [...prev.filter((o) => o.id !== group.id), ...children]);
    setSelectedIds(children.map((c) => c.id));
  };

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
    const width = obj?.type === "gpu" ? dims.d ?? 0 : dims.w ?? 0;
    const height = dims.h ?? 0;
    const depth = obj?.type === "gpu" ? dims.w ?? 0 : dims.d ?? 0;
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
      if (!alignEnabled || !faceInfo) {
        return;
      }
      if (!pendingAlignFace) {
        setPendingAlignFace(faceInfo);
        setConnectorToast({
          type: "info",
          text: "已选中目标面。再选择另一个面即可完成对齐。",
        });
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

      const anchorObj = expandedObjects.find((obj) => obj.id === pendingAlignFace.partId);
      const movingObj = expandedObjects.find((obj) => obj.id === faceInfo.partId);
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

      const anchorTransform = computeFaceTransform(anchorObj, pendingAlignFace.face);
      const movingTransform = computeFaceTransform(movingObj, faceInfo.face);
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

      const direction = anchorTransform.normal.clone();
      const delta = direction.dot(
        anchorTransform.center.clone().sub(movingTransform.center)
      );
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
          text: `已选中 ${formatPartName(currentObj)} · ${getConnectorLabel(
            currentObj,
            connectorId
          )}`,
          ttl: 2000,
        });
        return;
      }

      if (
        pendingConnector.partId === partId &&
        pendingConnector.connectorId === connectorId
      ) {
        setPendingConnector(null);
        return;
      }

      const anchorObj = objects.find((obj) => obj.id === pendingConnector.partId);
      const movingObj = objects.find((obj) => obj.id === partId);
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

      const anchorTransform = computeConnectorTransform(
        anchorObj,
        pendingConnector.connectorId
      );
      const movingTransform = computeConnectorTransform(movingObj, connectorId);
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

  useEffect(() => {
    if (!selectedObject) {
      setActiveConnectorId(null);
    }
  }, [selectedObject]);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "#0b1020" }}>
      {/* Left Panel */}
      <div style={{ flex: "0 0 420px", width: 420, padding: 16, overflowY: "auto", background: "rgba(255,255,255,0.96)", borderRight: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AddObjectForm onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
          <FrameBuilderPanel onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
          {selectedObject && (
            <ConnectorEditor
              object={selectedObject}
              activeConnectorId={activeConnectorId}
              onSelectConnector={setActiveConnectorId}
              onApplyOrientation={handleApplyConnectorOrientation}
            />
          )}
          {connectorToast && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border:
                  connectorToast.type === "success"
                    ? "1px solid #34d399"
                    : connectorToast.type === "warning"
                    ? "1px solid #fbbf24"
                    : "1px solid #60a5fa",
                background:
                  connectorToast.type === "success"
                    ? "rgba(52, 211, 153, 0.16)"
                    : connectorToast.type === "warning"
                    ? "rgba(251, 191, 36, 0.18)"
                    : "rgba(96, 165, 250, 0.16)",
                color:
                  connectorToast.type === "success"
                    ? "#064e3b"
                    : connectorToast.type === "warning"
                    ? "#78350f"
                    : "#1e3a8a",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {connectorToast.text}
            </div>
          )}
          {alignEnabled && pendingAlignFace && (
            <div style={{ fontSize: 12, color: "#475569" }}>
              目标面：{pendingAlignFace.face} · {pendingAlignFace.partId}
            </div>
          )}
          <button
            onClick={() => setShowGizmos((prev) => !prev)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: showGizmos ? "#0ea5e9" : "#94a3b8",
              color: "#fff",
              fontWeight: 600,
              border: "1px solid transparent",
              cursor: "pointer",
            }}
          >
            {showGizmos ? "关闭变换控件" : "开启变换控件"}
          </button>
          <ProjectPanel onExport={handleExport} onImport={handleImport} />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={undo}
              disabled={past.length === 0}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                background: past.length === 0 ? "#e5e7eb" : "#2563eb",
                color: past.length === 0 ? "#9ca3af" : "#fff",
                border: "1px solid #1d4ed8",
                cursor: past.length === 0 ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              撤销 (Undo)
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                background: future.length === 0 ? "#e5e7eb" : "#2563eb",
                color: future.length === 0 ? "#9ca3af" : "#fff",
                border: "1px solid #1d4ed8",
                cursor: future.length === 0 ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              重做 (Redo)
            </button>
          </div>
          <ObjectsList
            objects={objects}
            setObjects={setObjects}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
          />
          <button onClick={() => exportSTLFrom(window.__lastThreeRoot)} style={{ padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "white", fontWeight: 600 }}>导出 STL</button>
        </div>
      </div>

      {/* Right 3D Area */}
      <div style={{ flex: 1, position: "relative" }}>
        <SceneSettingsPanel
          showHorizontalGrid={showHorizontalGrid}
          onToggleHorizontalGrid={() => setShowHorizontalGrid((prev) => !prev)}
        />
        <Scene
          objects={expandedObjects}
          setObjects={setObjects}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          connections={connections}
          showHorizontalGrid={showHorizontalGrid}
          alignMode={alignEnabled}
          onFacePick={handleFacePick}
          onConnectorPick={handleConnectorPick}
          activeAlignFace={pendingAlignFace}
          transformMode={transformMode}
          onChangeTransformMode={setTransformMode}
          showTransformControls={showGizmos}
        />
      </div>
    </div>
  );
}



