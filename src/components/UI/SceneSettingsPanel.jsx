import React from "react";

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 25px rgba(0,0,0,.08)",
  padding: 16,
};

export default function SceneSettingsPanel({
  showHorizontalGrid,
  onToggleHorizontalGrid,
}) {
  return (
    <div style={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
          场景设置
        </div>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showHorizontalGrid}
            onChange={onToggleHorizontalGrid}
            style={{ marginRight: 8 }}
          />
          显示水平网格
        </label>
      </div>
    </div>
  );
}
