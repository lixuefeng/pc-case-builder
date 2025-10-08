// components/UI/ObjectsList.jsx — 物体列表
import React from "react";

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 25px rgba(0,0,0,.08)",
  padding: 16,
};

const input = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#fff",
  color: "#0f172a",
  fontSize: 14,
  outline: "none",
};

const BtnGhost = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid #e5e7eb",
      background: "#fff",
      color: "#0f172a",
      cursor: "pointer",
    }}
  >
    {children}
  </button>
);

export default function ObjectsList({ objects, setObjects, selectedIds, onSelect, onGroup, onUngroup }) {
  const toggleVisible = (id) =>
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, visible: !o.visible } : o)));
  const remove = (id) => setObjects((prev) => prev.filter((o) => o.id !== id));
  const rename = (id, name) =>
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, name } : o)));

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>物体列表</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <BtnGhost onClick={onGroup} disabled={selectedIds.length <= 1}>
          编组
        </BtnGhost>
        <BtnGhost onClick={onUngroup}>解散编组</BtnGhost>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 210, overflow: "auto", paddingRight: 4 }}>
        {objects.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>暂无物体</div>}

        {objects.map((o) => (
          <div
            key={o.id}
            style={{
              display: "grid",
              gridTemplateColumns: "22px 22px 80px 1fr auto",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              border: `1px solid ${selectedIds.includes(o.id) ? "#3b82f680" : "#e5e7eb"}`,
              background: selectedIds.includes(o.id) ? "#eff6ff" : "#fff",
              color: "inherit",
            }}
          >
            <input
              type="checkbox"
              checked={o.visible}
              onChange={() => toggleVisible(o.id)}
              title="显示/隐藏"
            />
            <button
              onClick={() => onSelect(o.id)}
              title="选中"
              style={{
                width: 22,
                height: 22,
                borderRadius: 8,
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                cursor: "pointer",
              }}
            >
              ●
            </button>
            <span style={{ color: "#64748b", fontSize: 13 }}>{o.type}</span>
            <input
              style={input}
              value={o.name}
              onChange={(e) => rename(o.id, e.target.value)}
            />
            <BtnGhost onClick={() => remove(o.id)}>删除</BtnGhost>
          </div>
        ))}
      </div>
    </div>
  );
}
