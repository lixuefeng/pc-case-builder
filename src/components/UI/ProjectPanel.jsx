import React, { useRef } from "react";

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 25px rgba(0,0,0,.08)",
  padding: 16,
};

const Btn = ({ children, onClick, variant = "primary" }) => {
  const base = {
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid transparent",
    flex: 1,
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

export default function ProjectPanel({ onExport, onImport }) {
  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
    }
    // Reset input to allow importing the same file again
    if (event.target) {
      event.target.value = null;
    }
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
        💾 项目管理
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        场景会自动保存到浏览器。您也可以手动导入/导出文件。
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={handleImportClick} variant="secondary">
          导入 (.json)
        </Btn>
        <Btn onClick={onExport}>导出 (.json)</Btn>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
          accept=".json,application/json"
        />
      </div>
    </div>
  );
}