import React from "react";

const ViewportHUD = ({ connectorToast, pendingAlignFace }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Top Center: Toasts */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {connectorToast && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 20,
              border:
                connectorToast.type === "success"
                  ? "1px solid #34d399"
                  : connectorToast.type === "warning"
                  ? "1px solid #fbbf24"
                  : "1px solid #60a5fa",
              background:
                connectorToast.type === "success"
                  ? "rgba(255, 255, 255, 0.9)"
                  : connectorToast.type === "warning"
                  ? "rgba(255, 255, 255, 0.9)"
                  : "rgba(255, 255, 255, 0.9)",
              color:
                connectorToast.type === "success"
                  ? "#064e3b"
                  : connectorToast.type === "warning"
                  ? "#78350f"
                  : "#1e3a8a",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              backdropFilter: "blur(4px)",
            }}
          >
            {connectorToast.text}
          </div>
        )}
      </div>

      {/* Bottom Right: Info */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
        {pendingAlignFace && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(0, 0, 0, 0.6)",
              color: "#fff",
              fontSize: 12,
              backdropFilter: "blur(4px)",
            }}
          >
            目标面：{pendingAlignFace.face} · {pendingAlignFace.partId}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewportHUD;
