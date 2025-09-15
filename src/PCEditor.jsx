import React, { useState } from "react";
import Scene from "./components/Scene";
import AddObjectForm from "./components/UI/AddObjectForm";
import ObjectsList from "./components/UI/ObjectsList";
import ControlsPanel from "./components/UI/ControlsPanel";
import { exportSTLFrom } from "./utils/exportSTL";

export default function PCEditor() {
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [snap, setSnap] = useState({ enabled: true, translate: 1, rotate: 15 });
  const [align, setAlign] = useState({ selfFace: "+Y", targetId: "", targetFace: "-Y", offset: 0 });

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "#0b1020" }}>
      {/* Left Panel */}
      <div style={{ flex: "0 0 420px", width: 420, padding: 16, overflowY: "auto", background: "rgba(255,255,255,0.96)", borderRight: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AddObjectForm onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
          <ObjectsList objects={objects} setObjects={setObjects} selectedId={selectedId} setSelectedId={setSelectedId} />
          <ControlsPanel objects={objects} selectedId={selectedId} setObjects={setObjects} align={align} setAlign={setAlign} snap={snap} setSnap={setSnap} />
          <button onClick={() => exportSTLFrom(window.__lastThreeRoot)} style={{ padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "white", fontWeight: 600 }}>导出 STL</button>
        </div>
      </div>

      {/* Right 3D Area */}
      <div style={{ flex: 1, position: "relative" }}>
        <Scene objects={objects} setObjects={setObjects} selectedId={selectedId} setSelectedId={setSelectedId} snap={snap} />
      </div>
    </div>
  );
}