import React from "react";

const ConnectorToast = ({ toast }) => {
  if (!toast) return null;

  const bgColor =
    toast.type === "error"
      ? "#ef4444"
      : toast.type === "warning"
      ? "#f59e0b"
      : toast.type === "success"
      ? "#10b981"
      : "#3b82f6";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1e293b",
        borderTop: `1px solid ${bgColor}`,
        borderRight: `1px solid ${bgColor}`,
        borderBottom: `1px solid ${bgColor}`,
        borderLeft: `4px solid ${bgColor}`,
        padding: "12px 20px",
        borderRadius: 8,
        color: "#f8fafc",
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 12,
        animation: "fadeIn 0.2s ease-out",
        maxWidth: "90vw",
      }}
    >
      {toast.text}
    </div>
  );
};

export default ConnectorToast;
