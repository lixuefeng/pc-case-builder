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
          {t("mode.translate")}
        </button>
        <button
          style={transformMode === "rotate" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("rotate")}
          title={t("mode.rotate")}
        >
          {t("mode.rotate")}
        </button>
        <button
          style={transformMode === "scale" ? activeBtnStyle : { ...btnStyle, border: "none", background: "transparent" }}
          onClick={() => setTransformMode("scale")}
          title={t("mode.scale")}
        >
          {t("mode.scale")}
        </button>
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
      <button
        style={btnStyle}
        onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
      >
        {language === "zh" ? "English" : "中文"}
      </button>
    </div>
  );
};

export default TopBar;
