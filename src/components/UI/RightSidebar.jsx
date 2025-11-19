import React from "react";
import ConnectorEditor from "./ConnectorEditor";

const RightSidebar = ({
  selectedObject,
  setObjects,
  activeConnectorId,
  setActiveConnectorId,
  onApplyConnectorOrientation,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
}) => {
  if (!selectedObject) {
    return (
      <div
        style={{
          width: 300,
          background: "rgba(255,255,255,0.96)",
          borderLeft: "1px solid #e5e7eb",
          padding: 16,
          color: "#475569",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        未选择对象
      </div>
    );
  }

  const handleChange = (key, value) => {
    setObjects((prev) =>
      prev.map((o) => (o.id === selectedObject.id ? { ...o, [key]: value } : o))
    );
  };

  const handlePosChange = (axis, value) => {
    const newPos = [...selectedObject.pos];
    if (axis === "x") newPos[0] = Number(value);
    if (axis === "y") newPos[1] = Number(value);
    if (axis === "z") newPos[2] = Number(value);
    handleChange("pos", newPos);
  };

  const handleDimChange = (dim, value) => {
    const newDims = { ...selectedObject.dims, [dim]: Number(value) };
    handleChange("dims", newDims);
  };

  const sectionStyle = {
    marginBottom: 20,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 16,
  };

  const labelStyle = {
    fontSize: 12,
    color: "#334155",
    marginBottom: 4,
    display: "block",
    fontWeight: 600,
  };

  const inputStyle = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 8,
    color: "#0f172a",
    background: "#fff",
  };

  const rowStyle = {
    display: "flex",
    gap: 8,
    marginBottom: 8,
  };

  const btnStyle = {
    flex: 1,
    padding: "8px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: "#0f172a",
  };

  return (
    <div
      style={{
        width: 320,
        background: "rgba(255,255,255,0.96)",
        borderLeft: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>
        属性检查器
      </div>

      {/* Basic Info */}
      <div style={sectionStyle}>
        <label style={labelStyle}>名称</label>
        <input
          style={inputStyle}
          value={selectedObject.name || selectedObject.id}
          onChange={(e) => handleChange("name", e.target.value)}
        />
        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>类型</label>
            <div style={{ fontSize: 13, color: "#334155" }}>{selectedObject.type}</div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ID</label>
            <div style={{ fontSize: 13, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedObject.id}
            </div>
          </div>
        </div>
      </div>

      {/* Transform */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>变换 (Transform)</div>
        
        <label style={labelStyle}>位置 (Position)</label>
        <div style={rowStyle}>
          <input
            type="number"
            style={inputStyle}
            value={selectedObject.pos[0]}
            onChange={(e) => handlePosChange("x", e.target.value)}
            placeholder="X"
          />
          <input
            type="number"
            style={inputStyle}
            value={selectedObject.pos[1]}
            onChange={(e) => handlePosChange("y", e.target.value)}
            placeholder="Y"
          />
          <input
            type="number"
            style={inputStyle}
            value={selectedObject.pos[2]}
            onChange={(e) => handlePosChange("z", e.target.value)}
            placeholder="Z"
          />
        </div>

        <label style={labelStyle}>尺寸 (Dimensions)</label>
        <div style={rowStyle}>
          <input
            type="number"
            style={inputStyle}
            value={selectedObject.dims?.w || 0}
            onChange={(e) => handleDimChange("w", e.target.value)}
            placeholder="W"
          />
          <input
            type="number"
            style={inputStyle}
            value={selectedObject.dims?.h || 0}
            onChange={(e) => handleDimChange("h", e.target.value)}
            placeholder="H"
          />
          <input
            type="number"
            style={inputStyle}
            value={selectedObject.dims?.d || 0}
            onChange={(e) => handleDimChange("d", e.target.value)}
            placeholder="D"
          />
        </div>
      </div>

      {/* Actions */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>操作 (Actions)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btnStyle} onClick={onDuplicate}>复制</button>
          <button style={{ ...btnStyle, color: "#ef4444", borderColor: "#fca5a5" }} onClick={onDelete}>删除</button>
          {selectedObject.type === "group" && (
            <button style={btnStyle} onClick={onUngroup}>取消编组</button>
          )}
        </div>
      </div>

      {/* Connectors */}
      <ConnectorEditor
        object={selectedObject}
        activeConnectorId={activeConnectorId}
        onSelectConnector={setActiveConnectorId}
        onApplyOrientation={onApplyConnectorOrientation}
      />
    </div>
  );
};

export default RightSidebar;
