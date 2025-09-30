// components/UI/PositionPanel.jsx — 坐标编辑
import React from "react";

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

export default function PositionPanel({ selectedObject, onPositionChange }) {
  if (!selectedObject) return null;

  const pos = selectedObject.pos;

  const handleChange = (axisIndex, value) => {
    const newPos = [...pos];
    newPos[axisIndex] = Number(value) || 0;
    onPositionChange(newPos);
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
        位置 (mm)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <div style={labelSm}>X</div>
          <input type="number" value={pos[0]} onChange={(e) => handleChange(0, e.target.value)} style={input} />
        </div>
        <div>
          <div style={labelSm}>Y</div>
          <input type="number" value={pos[1]} onChange={(e) => handleChange(1, e.target.value)} style={input} />
        </div>
        <div>
          <div style={labelSm}>Z</div>
          <input type="number" value={pos[2]} onChange={(e) => handleChange(2, e.target.value)} style={input} />
        </div>
      </div>
    </div>
  );
}