// components/UI/ControlsPanel.jsx — 面对齐（MVP）+ Transform Snap
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

export default function ControlsPanel({
  objects,
  selectedId,
  setObjects,
  align,
  setAlign,
  snap,
  setSnap,
}) {
  const doAlign = () => {
    if (!align.targetId || !selectedId) return;
    const self = objects.find((o) => o.id === selectedId);
    const target = objects.find((o) => o.id === align.targetId);
    if (!self || !target) return;

    const selfHalf = { x: self.dims.w / 2, y: self.dims.h / 2, z: self.dims.d / 2 };
    const tgtHalf = { x: target.dims.w / 2, y: target.dims.h / 2, z: target.dims.d / 2 };
    const selfPos = { x: self.pos[0], y: self.pos[1], z: self.pos[2] };
    const tgtPos = { x: target.pos[0], y: target.pos[1], z: target.pos[2] };

    const faceCoord = (pos, half, face) => {
      switch (face) {
        case "+X": return pos.x + half.x;
        case "-X": return pos.x - half.x;
        case "+Y": return pos.y + half.y;
        case "-Y": return pos.y - half.y;
        case "+Z": return pos.z + half.z;
        case "-Z": return pos.z - half.z;
        default: return pos.x;
      }
    };
    const axisOf = (face) => face[1];
    const signOf = (face) => (face[0] === "+" ? 1 : -1);

    const selfAxis = axisOf(align.selfFace);
    const tgtFaceCoord = faceCoord(tgtPos, tgtHalf, align.targetFace);
    const half = selfHalf[selfAxis.toLowerCase()];

    const targetCoordWithOffset = tgtFaceCoord + signOf(align.targetFace) * (Number(align.offset) || 0);
    const desiredCenter = targetCoordWithOffset - signOf(align.selfFace) * half;

    const newPos = { ...selfPos };
    if (selfAxis === "X") newPos.x = desiredCenter;
    if (selfAxis === "Y") newPos.y = desiredCenter;
    if (selfAxis === "Z") newPos.z = desiredCenter;

    setObjects((prev) =>
      prev.map((o) => (o.id === self.id ? { ...o, pos: [newPos.x, newPos.y, newPos.z] } : o))
    );
  };

  return (
    <>
      {/* 面对齐 */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>🎯 面对齐（MVP）</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 14 }}>
          <div>
            <div style={labelSm}>自身面</div>
            <select
              value={align.selfFace}
              onChange={(e) => setAlign({ ...align, selfFace: e.target.value })}
              style={input}
            >
              {["+X", "-X", "+Y", "-Y", "+Z", "-Z"].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={labelSm}>目标物体</div>
            <select
              value={align.targetId}
              onChange={(e) => setAlign({ ...align, targetId: e.target.value })}
              style={input}
            >
              <option value="">(选择)</option>
              {objects
                .filter((o) => o.id !== selectedId)
                .map((o) => (
                  <option key={o.id} value={o.id}>{o.name || o.id}</option>
                ))}
            </select>
          </div>
          <div>
            <div style={labelSm}>目标面</div>
            <select
              value={align.targetFace}
              onChange={(e) => setAlign({ ...align, targetFace: e.target.value })}
              style={input}
            >
              {["+X", "-X", "+Y", "-Y", "+Z", "-Z"].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={labelSm}>偏移 (mm)</div>
            <input
              type="number"
              value={align.offset}
              onChange={(e) => setAlign({ ...align, offset: Number(e.target.value) })}
              style={input}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <Btn onClick={doAlign}>对齐</Btn>
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
          当前为包围盒对齐，适合 0/90° 姿态；后续可升级面拾取/OBB。
        </div>
      </div>

      {/* Transform Snap */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>🎛️ Transform Snap</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <input
            id="snap-enabled"
            type="checkbox"
            checked={snap.enabled}
            onChange={(e) => setSnap({ ...snap, enabled: e.target.checked })}
          />
          <label htmlFor="snap-enabled" style={{ fontSize: 14, color: "#334155" }}>
            启用吸附
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={labelSm}>移动步长 (mm)</div>
            <input
              type="number"
              value={snap.translate}
              min={0.1}
              step={0.1}
              onChange={(e) => setSnap({ ...snap, translate: Number(e.target.value) })}
              style={input}
            />
          </div>
          <div>
            <div style={labelSm}>旋转步长 (°)</div>
            <input
              type="number"
              value={snap.rotate}
              min={1}
              step={1}
              onChange={(e) => setSnap({ ...snap, rotate: Number(e.target.value) })}
              style={input}
            />
          </div>
        </div>
      </div>
    </>
  );
}
