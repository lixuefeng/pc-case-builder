import React, { useState, useEffect } from "react";
import { PRESETS } from "../../utils/presets";



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

const instantiateConnectors = (type, preset) => {
  if (!preset) return [];

  if (Array.isArray(preset.connectors)) {
    return preset.connectors.map((connector) => {
      const clone = JSON.parse(JSON.stringify(connector));
      if (!clone.slotType) {
        clone.slotType = clone.type || "generic-slot";
      }
      return clone;
    });
  }

  if (typeof preset.buildConnectors === "function") {
    return preset.buildConnectors();
  }

  if (type === "motherboard") {
    const holeMap = Array.isArray(preset.meta?.holeMap)
      ? preset.meta.holeMap
      : [];
    const { w, h, d } = preset.dims || {};
    if (!holeMap.length || !w || !h || !d) {
      return [];
    }
    return holeMap.map(([x, z], index) => ({
      id: `${preset.key}-hole-${index}`,
      label: `MB Hole ${index + 1}`,
      type: "screw-m3",
      size: 3,
      pos: [x - w / 2, -h / 2, z - d / 2],
      normal: [0, -1, 0],
    }));
  }

  return [];
};

export default function AddObjectForm({ onAdd }) {
  const [type, setType] = useState("motherboard");
  const [presetKey, setPresetKey] = useState("itx");
  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState("horizontal");

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

    const meta = preset.meta ? JSON.parse(JSON.stringify(preset.meta)) : {};
    if (type === "motherboard") {
      meta.orientation = orientation;
    }

    const obj = {
      id,
      type,
      name: name || preset.label,
      dims: { ...preset.dims },
      pos: [0, preset.dims.h / 2, 0], // place on the ground plane by default
      rot: [0, 0, 0],
      color: undefined,
      visible: true,
      includeInExport: true,
      meta,
      connectors: instantiateConnectors(type, preset),
    };
    onAdd(obj);
    setName("");
  };

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
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

        {type === "motherboard" && (
          <>
            <label style={labelSm}>摆放方式</label>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={input}>
              <option value="horizontal">水平</option>
              <option value="vertical">竖直</option>
            </select>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10, alignItems: "center", marginTop: 8 }}>
        <label style={labelSm}>名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="可选：自定义名称"
          style={input}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn onClick={handleAdd}>添加</Btn>
      </div>
    </div>
  );
}
