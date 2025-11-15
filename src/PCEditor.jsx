import React, { useCallback, useEffect, useState } from "react";
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
import { alignObjectsByConnectors, ensureSceneConnectors } from "./utils/connectors";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export default function PCEditor() {
  const {
    objects,
    setObjects,
    selectedIds,
    setSelectedIds,
    connections,
    setConnections,
    connectorSelection,
    setConnectorSelection,
  } = useStore();
  const { undo, redo, future, past } = useTemporalStore((state) => state);
  const [connectorToast, setConnectorToast] = useState(null);
  const [activeConnectorId, setActiveConnectorId] = useState(null);
  const [showHorizontalGrid, setShowHorizontalGrid] = useState(true);

  useEffect(() => {
    if (!connectorToast) {
      return undefined;
    }
    const timer = setTimeout(() => setConnectorToast(null), connectorToast.ttl ?? 2600);
    return () => clearTimeout(timer);
  }, [connectorToast]);

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
    if (!part) return "Unknown part";
    if (part.name) return part.name;
    if (part.type) return part.type.toUpperCase();
    return part.id;
  }, []);

  const getConnectorLabel = useCallback((part, connectorId) => {
    if (!part || !connectorId) return connectorId || "Unknown connector";
    const connector = (part.connectors || []).find((item) => item?.id === connectorId);
    if (connector?.label) return connector.label;
    return connectorId;
  }, []);

  const handleConnectorToggle = useCallback(
    (partId, connectorId) => {
      if (!partId || !connectorId) return;

      const existingIndex = connectorSelection.findIndex(
        (entry) => entry.partId === partId && entry.connectorId === connectorId
      );

      if (existingIndex >= 0) {
        const removedEntry = connectorSelection[existingIndex];
        const removedPart = objects.find((obj) => obj.id === removedEntry.partId);
        const nextSelection = connectorSelection.filter((_, idx) => idx !== existingIndex);
        setConnectorSelection(nextSelection);
        setConnectorToast({
          type: "info",
          text: `Cleared ${formatPartName(removedPart)} · ${getConnectorLabel(
            removedPart,
            removedEntry.connectorId
          )}`,
        });
        return;
      }

      const currentPart = objects.find((obj) => obj.id === partId);

      if (
        connectorSelection.length === 1 &&
        connectorSelection[0]?.partId === partId
      ) {
        setConnectorSelection([{ partId, connectorId }]);
        setConnectorToast({
          type: "warning",
          text: `Pick a connector on a different part. Anchor switched to ${formatPartName(
            currentPart
          )} · ${getConnectorLabel(currentPart, connectorId)}`,
        });
        return;
      }

      let nextSelection;
      if (connectorSelection.length === 1) {
        nextSelection = [...connectorSelection, { partId, connectorId }];
      } else {
        nextSelection = [{ partId, connectorId }];
      }

      if (nextSelection.length < 2) {
        setConnectorSelection(nextSelection);
        setConnectorToast({
          type: "info",
          text: `Selected ${formatPartName(currentPart)} · ${getConnectorLabel(
            currentPart,
            connectorId
          )}. Choose a connector on another part.`,
        });
        return;
      }

      const anchorSelection = nextSelection[0];
      const movingSelection = nextSelection[1];
      const anchorPart = objects.find((obj) => obj.id === anchorSelection.partId);
      const movingPart = objects.find((obj) => obj.id === movingSelection.partId);

      const connectionAlreadyExists = connections.some((connection) => {
        const from = connection.from || {};
        const to = connection.to || {};
        const sameDirection =
          from.partId === anchorSelection.partId &&
          from.connectorId === anchorSelection.connectorId &&
          to.partId === movingSelection.partId &&
          to.connectorId === movingSelection.connectorId;
        const oppositeDirection =
          from.partId === movingSelection.partId &&
          from.connectorId === movingSelection.connectorId &&
          to.partId === anchorSelection.partId &&
          to.connectorId === anchorSelection.connectorId;
        return sameDirection || oppositeDirection;
      });

      const alignment = alignObjectsByConnectors(objects, nextSelection);

      if (alignment) {
        setObjects(alignment.objects);
        setConnections((prev) => {
          if (connectionAlreadyExists) {
            return prev;
          }
          return [...prev, alignment.connection];
        });

        if (alignment.movedPartId) {
          setSelectedIds([alignment.movedPartId]);
        }
        setConnectorSelection([]);
        setConnectorToast({
          type: connectionAlreadyExists ? "info" : "success",
          text: connectionAlreadyExists
            ? `Connection already exists. Repositioned ${formatPartName(movingPart)}.`
            : `Snapped ${formatPartName(movingPart)} · ${getConnectorLabel(
                movingPart,
                movingSelection.connectorId
              )} to ${formatPartName(anchorPart)} · ${getConnectorLabel(
                anchorPart,
                anchorSelection.connectorId
              )}`,
        });
      } else {
        setConnectorSelection([{ partId, connectorId }]);
        setConnectorToast({
          type: "warning",
          text: "Unable to snap: pick two connectors from different parts.",
        });
      }
    },
    [
      connections,
      connectorSelection,
      formatPartName,
      getConnectorLabel,
      objects,
      setConnectorSelection,
      setConnectorToast,
      setConnections,
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
          objects={objects}
          setObjects={setObjects}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          connections={connections}
          connectorSelection={connectorSelection}
          onConnectorToggle={handleConnectorToggle}
          showHorizontalGrid={showHorizontalGrid}
        />
      </div>
    </div>
  );
}



