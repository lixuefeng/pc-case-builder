import React from "react";
import { useToast } from "../../context/ToastContext";

const ConnectorToast = () => {
  const { toast } = useToast();

  if (!toast) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderRadius: 20,
          border:
            toast.type === "success"
              ? "1px solid #34d399"
              : toast.type === "warning"
              ? "1px solid #fbbf24"
              : toast.type === "error"
              ? "1px solid #ef4444"
              : "1px solid #60a5fa",
          background: "rgba(255, 255, 255, 0.9)",
          color:
            toast.type === "success"
              ? "#064e3b"
              : toast.type === "warning"
              ? "#78350f"
              : toast.type === "error"
              ? "#7f1d1d"
              : "#1e3a8a",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          backdropFilter: "blur(4px)",
        }}
      >
        {toast.text}
      </div>
    </div>
  );
};

export default ConnectorToast;
