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
  const [dims, setDims] = useState({ w: 170, h: 2, d: 170 });
  const [pos, setPos] = useState({ x: 85, y: 1, z: 85 });
  const [name, setName] = useState("");

  // 切换类型时带出第一项预设
  useEffect(() => {
    const p = (PRESETS[type] || [])[0];
    if (p) {
      setPresetKey(p.key);
      setDims(p.dims);
    }
  }, [type]);

  // 切换预设时更新尺寸
  useEffect(() => {
    const list = PRESETS[type] || [];
    const p = list.find((x) => x.key === presetKey) || list[0];
    if (p) setDims(p.dims);
  }, [type, presetKey]);

  const presets = PRESETS[type] || [];

  const handleAdd = () => {
    const id = `obj_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    const preset = presets.find((p) => p.key === presetKey);
    const obj = {
      id,
      type,
      name: name || `${type}-${preset?.key || "custom"}`,
      dims: { w: Number(dims.w), h: Number(dims.h), d: Number(dims.d) },
      pos: [Number(pos.x), Number(pos.y), Number(pos.z)],
      rot: [0, 0, 0],
      color: undefined,
      visible: true,
      includeInExport: true,
      meta: preset?.meta || {},
    };
    onAdd(obj);
    setName("");
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
        添加物体
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginTop: 6 }}>
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>W</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={dims.w} onChange={(e) => setDims({ ...dims, w: Number(e.target.value) })} />
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>H</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={dims.h} onChange={(e) => setDims({ ...dims, h: Number(e.target.value) })} />
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>D</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={dims.d} onChange={(e) => setDims({ ...dims, d: Number(e.target.value) })} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginTop: 6 }}>
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>X</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={pos.x} onChange={(e) => setPos({ ...pos, x: Number(e.target.value) })} />
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>Y</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={pos.y} onChange={(e) => setPos({ ...pos, y: Number(e.target.value) })} />
        <div style={{ gridColumn: "span 1", alignSelf: "center", ...labelSm }}>Z</div>
        <input type="number" style={{ ...input, gridColumn: "span 2" }} value={pos.z} onChange={(e) => setPos({ ...pos, z: Number(e.target.value) })} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10, alignItems: "center", marginTop: 8 }}>
        <label style={labelSm}>名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="可选：自定义名称" style={input} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn
          variant="secondary"
          onClick={() => {
            const p = presets.find((p) => p.key === presetKey);
            if (p) setDims(p.dims);
          }}
        >
          重置尺寸
        </Btn>
        <Btn onClick={handleAdd}>添加</Btn>
      </div>
    </div>
  );
}
