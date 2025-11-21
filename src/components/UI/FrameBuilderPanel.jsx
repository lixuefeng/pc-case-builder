// components/UI/FrameBuilderPanel.jsx — 创建机箱零件
import React, { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

// 从 AddObjectForm 借用样式

const labelSm = { color: "#64748b", fontSize: 12, marginBottom: 6 };
const input = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#fff",
  color: "#0f172a",
  fontSize: 14,
  outline: "none",
};
const Btn = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "10px 14px",
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 600,
      background: "#2563eb",
      color: "#fff",
      border: "1px solid transparent",
      cursor: "pointer",
    }}
  >
    {children}
  </button>
);

export default function FrameBuilderPanel({ onAdd }) {
  const { t } = useLanguage();
  const [dims, setDims] = useState({ w: 100, h: 20, d: 20 });

  const handleAdd = () => {
    const id = `obj_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    const obj = {
      id,
      type: "structure",
      name: `Block ${dims.w}x${dims.h}x${dims.d}`,
      dims: { w: Number(dims.w), h: Number(dims.h), d: Number(dims.d) },
      pos: [0, dims.h / 2, 0], // 默认放在地面上
      rot: [0, 0, 0],
      visible: true,
      includeInExport: true,
      meta: {},
      connectors: [],
    };
    onAdd(obj);
  };

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
        {t("frame.title")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginTop: 6 }}>
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>W</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={dims.w} onChange={(e) => setDims({ ...dims, w: Number(e.target.value) })} />
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>H</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={dims.h} onChange={(e) => setDims({ ...dims, h: Number(e.target.value) })} />
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>D</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={dims.d} onChange={(e) => setDims({ ...dims, d: Number(e.target.value) })} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn onClick={handleAdd}>添加结构块</Btn>
      </div>
    </div>
  );
}
