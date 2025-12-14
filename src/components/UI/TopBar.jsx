import React from "react";
import { useLanguage } from "../../i18n/LanguageContext";

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
  measurements = [],
  onClearMeasurements,
  onGenerateStandoffs,
  onConnect,
  onApplyCut,
  isCutting,
  onToggleCut,
  selectedObject,
  selectedIds,
}) => {
  const { language, setLanguage, t } = useLanguage();

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
    border: "1px solid #3b82f6",
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
        {t("app.title")}
      </div>



      {/* File Operations */}
      <button style={btnStyle} onClick={onImport}>
        {t("action.import")}
      </button>
      <button style={btnStyle} onClick={onExport}>
        {t("action.export")}
      </button>

      <div style={dividerStyle} />

      {/* History */}
      <button
        style={canUndo ? btnStyle : disabledBtnStyle}
        onClick={undo}
        disabled={!canUndo}
      >
        {t("action.undo")}
      </button>
      <button
        style={canRedo ? btnStyle : disabledBtnStyle}
        onClick={redo}
        disabled={!canRedo}
      >
        {t("action.redo")}
      </button>

      <div style={dividerStyle} />

      {/* Transform Tools */}
      <div style={{ display: "flex", gap: 4, background: "#1f2937", padding: 2, borderRadius: 6, border: "1px solid #374151" }}>
        <button
          style={transformMode === "translate" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("translate")}
          title={t("mode.translate")}
        >
          ✥ {t("mode.translate")}
        </button>
        <button
          style={transformMode === "rotate" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("rotate")}
          title={t("mode.rotate")}
        >
          🔄 {t("mode.rotate")}
        </button>
        <button
          style={transformMode === "scale" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("scale")}
          title={t("mode.scale")}
        >
          ↔️ {t("mode.scale")}
        </button>
        <button
          style={transformMode === "ruler" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("ruler")}
          title="Ruler"
        >
          📏 Ruler
        </button>
        <button
          style={transformMode === "drill" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("drill")}
          title="Drill Tool"
        >
          🔩 Drill
        </button>
        <button
          style={transformMode === "modify" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("modify")}
          title="Modify (Fillet/Chamfer)"
        >
          ✏️ Modify
        </button>
        <button
          style={isCutting ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={onToggleCut}
          title="Split Object"
        >
          ✂️ Split
        </button>

        <div style={dividerStyle} />

        {/* Logic Tools */}
        <button
          style={transformMode === 'connect' ? activeBtnStyle : btnStyle}
          onClick={() => setTransformMode('connect')}
          title="Connect Parts"
        >
          🔗 {t("mode.connect") || "Connect"}
        </button>
        <button
          style={transformMode === 'subtract' ? activeBtnStyle : btnStyle}
          onClick={() => setTransformMode('subtract')}
          title="Subtract Parts"
        >
          ➖ {t("mode.subtract") || "Subtract"}
        </button>
        <button
          style={transformMode === 'union' ? activeBtnStyle : btnStyle}
          onClick={() => setTransformMode('union')}
          title="Merge Parts"
        >
          ➕ {t("mode.merge") || "Merge"}
        </button>
        {selectedObject && (selectedObject.type === 'motherboard' || (selectedObject.connectors && selectedObject.connectors.some(c => c.type === 'screw-m3' || c.type === 'mb-mount'))) && (
           <button
             style={{ ...btnStyle, border: "none", background: "transparent", color: "#fbbf24" }}
             onClick={onGenerateStandoffs}
             title="Generate Standoffs"
           >
             🏗️ Standoffs
           </button>
        )}


      </div>
      


      <div style={dividerStyle} />

      {/* View Settings */}
      <button
        style={showGrid ? activeBtnStyle : btnStyle}
        onClick={() => setShowGrid(!showGrid)}
      >
        {t("action.grid")}
      </button>
      <button
        style={showGizmos ? activeBtnStyle : btnStyle}
        onClick={() => setShowGizmos(!showGizmos)}
      >
        {t("action.gizmos")}
      </button>
      <button
        style={snapEnabled ? activeBtnStyle : btnStyle}
        onClick={() => setSnapEnabled(!snapEnabled)}
        title={t("action.snap")}
      >
        🧲 {t("action.snap")}
      </button>

      <div style={{ flex: 1 }} />

      {/* Language Selector */}
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        style={{
          ...btnStyle,
          outline: "none",
          appearance: "none", // Remove default arrow in some browsers if desired, or keep it
          paddingRight: 24, // Space for arrow
          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23e5e7eb%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
          backgroundSize: "8px auto",
        }}
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </div>
  );
};

export default TopBar;
