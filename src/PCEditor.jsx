import React, { useState, useEffect } from "react";
import Scene from "./components/Scene";
import AddObjectForm from "./components/UI/AddObjectForm";
import ObjectsList from "./components/UI/ObjectsList";
import ControlsPanel from "./components/UI/ControlsPanel";
import FrameBuilderPanel from "./components/UI/FrameBuilderPanel";
import ProjectPanel from "./components/UI/ProjectPanel";
import { exportSTLFrom } from "./utils/exportSTL";

const LOCAL_STORAGE_KEY = "pc-case-builder-scene";

export default function PCEditor() {
  const [objects, setObjects] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load from localStorage", e);
    }
    return [];
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [snap, setSnap] = useState({ enabled: true, translate: 1, rotate: 15 });
  const [align, setAlign] = useState({ selfFace: "+Y", targetId: "", targetFace: "-Y", offset: 0 });

  useEffect(() => {
    try {
      const data = JSON.stringify(objects);
      localStorage.setItem(LOCAL_STORAGE_KEY, data);
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }
  }, [objects]);

  const handleExport = () => {
    const dataStr = JSON.stringify(objects, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `pc-case-design-${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedObjects = JSON.parse(e.target.result);
        if (Array.isArray(importedObjects)) {
          setObjects(importedObjects);
          setSelectedIds([]);
          alert(`成功导入 ${importedObjects.length} 个物体！`);
        } else {
          throw new Error("Invalid file format: not an array.");
        }
      } catch (error) {
        alert(`导入失败: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleSelect = (id, multi = false) => {
    if (multi) {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          // 如果已选中，则从选择集中移除
          return prev.filter((i) => i !== id);
        } else {
          // 如果未选中，则添加到选择集
          return [...prev, id];
        }
      });
    } else {
      // 单选
      setSelectedIds([id]);
    }
  };
  const lastSelectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "#0b1020" }}>
      {/* Left Panel */}
      <div style={{ flex: "0 0 420px", width: 420, padding: 16, overflowY: "auto", background: "rgba(255,255,255,0.96)", borderRight: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AddObjectForm onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
          <FrameBuilderPanel onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
          <ProjectPanel onExport={handleExport} onImport={handleImport} />
          <ObjectsList objects={objects} setObjects={setObjects} selectedIds={selectedIds} onSelect={handleSelect} />
          <ControlsPanel objects={objects} selectedId={lastSelectedId} setObjects={setObjects} align={align} setAlign={setAlign} snap={snap} setSnap={setSnap} />
          <button onClick={() => exportSTLFrom(window.__lastThreeRoot)} style={{ padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "white", fontWeight: 600 }}>导出 STL</button>
        </div>
      </div>

      {/* Right 3D Area */}
      <div style={{ flex: 1, position: "relative" }}>
        <Scene objects={objects} setObjects={setObjects} selectedIds={selectedIds} onSelect={handleSelect} snap={snap} />
      </div>
    </div>
  );
}