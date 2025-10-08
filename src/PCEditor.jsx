import React from "react";
import * as THREE from "three";
import Scene from "./components/Scene";
import AddObjectForm from "./components/UI/AddObjectForm";
import ObjectsList from "./components/UI/ObjectsList"; // 假设 ControlsPanel 的 group/ungroup 按钮移到这里或别处
import FrameBuilderPanel from "./components/UI/FrameBuilderPanel";
import ProjectPanel from "./components/UI/ProjectPanel";
import { exportSTLFrom } from "./utils/exportSTL";
import { useStore, useTemporalStore } from "./store";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export default function PCEditor() {
  const { objects, setObjects, selectedIds, setSelectedIds } = useStore();
  const { undo, redo, future, past } = useTemporalStore((state) => state);

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
            pos: [0, 0, size.y / 2], // 把它放在地面上
            rot: [0, 0, 0],
            dims: { w: size.x, h: size.y, d: size.z },
            visible: true,
            includeInExport: true,
            meta: { geometryBase64: arrayBufferToBase64(contents) },
          };
          setObjects((prev) => [...prev, newObject]);
          setSelectedIds([newObject.id]);
        } catch (error) {
          alert(`STL 文件导入失败: ${error.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("不支持的文件类型。请选择 .json 或 .stl 文件。");
    }
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
  const selectedObject = objects.find((o) => o.id === lastSelectedId);

  const handleGroup = () => {
    if (selectedIds.length <= 1) return;

    const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

    // 1. 计算包围盒和中心点
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
        // 存储相对于组中心的原始位置
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

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "#0b1020" }}>
      {/* Left Panel */}
      <div style={{ flex: "0 0 420px", width: 420, padding: 16, overflowY: "auto", background: "rgba(255,255,255,0.96)", borderRight: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AddObjectForm onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
          <FrameBuilderPanel onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
          <ProjectPanel onExport={handleExport} onImport={handleImport} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={undo} disabled={past.length === 0} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#f3f4f6", border: "1px solid #d1d5db", cursor: "pointer", disabled: { opacity: 0.5 } }}>
              撤销 (Undo)
            </button>
            <button onClick={redo} disabled={future.length === 0} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#f3f4f6", border: "1px solid #d1d5db", cursor: "pointer", disabled: { opacity: 0.5 } }}>
              重做 (Redo)
            </button>
          </div>
          <ObjectsList objects={objects} setObjects={setObjects} selectedIds={selectedIds} onSelect={handleSelect} onGroup={handleGroup} onUngroup={handleUngroup} />
          <button onClick={() => exportSTLFrom(window.__lastThreeRoot)} style={{ padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "white", fontWeight: 600 }}>导出 STL</button>
        </div>
      </div>

      {/* Right 3D Area */}
      <div style={{ flex: 1, position: "relative" }}>
        <Scene objects={objects} setObjects={setObjects} selectedIds={selectedIds} onSelect={handleSelect} />
      </div>
    </div>
  );
}