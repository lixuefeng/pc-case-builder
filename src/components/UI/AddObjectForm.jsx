// components/UI/AddObjectForm.jsx — 添加物体表单
import React, { useState, useEffect } from "react";
import { PRESETS } from "../../utils/presets";

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 25px rgba(0,0,0,.08)",
  padding: 16,
};

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

const Btn = ({ children, onClick, variant = "primary" }) => {
  const base = {
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid transparent",
  };
  const styles =
    variant === "secondary"
      ? { background: "#eef2ff", color: "#0f172a", border: "1px solid #c7d2fe" }
      : { background: "#2563eb", color: "#fff" };
  return (
    <button style={{ ...base, ...styles }} onClick={onClick}>
      {children}
    </button>
  );
};

export default function AddObjectForm({ onAdd }) {
  const [type, setType] = useState("motherboard");
  const [presetKey, setPresetKey] = useState("itx");
  const [name, setName] = useState("");

  // 切换类型时更新状态
  useEffect(() => {
    const firstPreset = (PRESETS[type] || [])[0];
    if (firstPreset) {
      setPresetKey(firstPreset.key);
    }
  }, [type]);

  const presets = PRESETS[type] || [];

  const handleAdd = () => {
    const id = `obj_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    const preset = presets.find((p) => p.key === presetKey);
    if (!preset) return;

    const obj = {
      id,
      type: type,
      name: name || preset.label,
      dims: { ...preset.dims },
      pos: [0, preset.dims.h / 2, 0], // 默认放在地面上
      rot: [0, 0, 0],
      color: undefined,
      visible: true,
      includeInExport: true,
      meta: preset.meta ? JSON.parse(JSON.stringify(preset.meta)) : {},
    };
    onAdd(obj);
    setName("");
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
        添加装机零件
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10, alignItems: "center" }}>
        <label style={labelSm}>类型</label>
        <select value={type} onChange={(e) => setType(e.target.value)} style={input}>
          <option value="motherboard">Motherboard</option>
          <option value="gpu">GPU</option>
          <option value="psu">PSU</option>
          <option value="ram">RAM</option>
          <option value="box">Box</option>
        </select>

        <label style={labelSm}>预设</label>
        <select value={presetKey} onChange={(e) => setPresetKey(e.target.value)} style={input}>
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10, alignItems: "center", marginTop: 8 }}>
        <label style={labelSm}>名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="可选：自定义名称" style={input} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn onClick={handleAdd}>添加</Btn>
      </div>
    </div>
  );
}
