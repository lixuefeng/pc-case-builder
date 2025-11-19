import React from "react";

const TopBar = ({
  onImport,
  onExport,
  undo,
  redo,
  canUndo,
  canRedo,
  transformMode,
  setTransformMode,
  showGrid,
  setShowGrid,
  showGizmos,
  setShowGizmos,
  snapEnabled,
  setSnapEnabled,
}) => {
  const btnStyle = {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #374151",
    background: "#1f2937",
    color: "#e5e7eb",
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const activeBtnStyle = {
    ...btnStyle,
    background: "#2563eb",
    borderColor: "#3b82f6",
    color: "#fff",
  };

  const disabledBtnStyle = {
    ...btnStyle,
    opacity: 0.5,
    cursor: "not-allowed",
  };

  const dividerStyle = {
    width: 1,
    height: 24,
    background: "#374151",
    margin: "0 8px",
  };

  return (
    <div
      style={{
        height: 50,
        background: "#111827",
        borderBottom: "1px solid #374151",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 8,
        color: "#e5e7eb",
        userSelect: "none",
      }}
    >
      <div style={{ fontWeight: 700, marginRight: 16, color: "#fff" }}>
        PC Case Builder
      </div>

      {/* File Operations */}
      <button style={btnStyle} onClick={onImport}>
        导入
      </button>
      <button style={btnStyle} onClick={onExport}>
        导出
      </button>

      <div style={dividerStyle} />

      {/* History */}
      <button
        style={canUndo ? btnStyle : disabledBtnStyle}
        onClick={undo}
        disabled={!canUndo}
      >
        撤销
      </button>
      <button
        style={canRedo ? btnStyle : disabledBtnStyle}
        onClick={redo}
        disabled={!canRedo}
      >
        重做
      </button>

      <div style={dividerStyle} />

      {/* Transform Tools */}
      <div style={{ display: "flex", gap: 4, background: "#1f2937", padding: 2, borderRadius: 6, border: "1px solid #374151" }}>
        <button
          style={transformMode === "translate" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("translate")}
          title="移动 (Translate)"
        >
          移动
        </button>
        <button
          style={transformMode === "rotate" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("rotate")}
          title="旋转 (Rotate)"
        >
          旋转
        </button>
        <button
          style={transformMode === "scale" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("scale")}
          title="缩放 (Scale)"
        >
          缩放
        </button>
      </div>

      <div style={dividerStyle} />

      {/* View Settings */}
      <button
        style={showGrid ? activeBtnStyle : btnStyle}
        onClick={() => setShowGrid(!showGrid)}
      >
        网格
      </button>
      <button
        style={showGizmos ? activeBtnStyle : btnStyle}
        onClick={() => setShowGizmos(!showGizmos)}
      >
        控件
      </button>
      <button
        style={snapEnabled ? activeBtnStyle : btnStyle}
        onClick={() => setSnapEnabled(!snapEnabled)}
        title="开启吸附 (Snap)"
      >
        🧲 吸附
      </button>
    </div>
  );
};

export default TopBar;
