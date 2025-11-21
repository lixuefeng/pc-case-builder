import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useLanguage } from "../../i18n/LanguageContext";

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 25px rgba(0,0,0,.08)",
  padding: 16,
};

const labelStyle = { color: "#64748b", fontSize: 12, marginBottom: 6 };
const inputStyle = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#fff",
  color: "#0f172a",
  fontSize: 13,
  outline: "none",
};

const btnStyle = {
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
  background: "#2563eb",
  color: "#fff",
};

const pickPerpendicular = (normal) => {
  const candidates = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];
  let best = candidates[0];
  let bestDot = Math.abs(best.dot(normal));
  for (let i = 1; i < candidates.length; i += 1) {
    const dot = Math.abs(candidates[i].dot(normal));
    if (dot < bestDot) {
      bestDot = dot;
      best = candidates[i];
    }
  }
  return best.clone();
};

const toVector = (values) => values.map((value) => Number(value) || 0);

const formatVector = (values) =>
  values.map((value) => Number.isFinite(value) ? value.toFixed(3) : "0.000");

const EPS = 1e-6;

const buildOrthonormalBasis = (normalInput, upInput) => {
  const normalVec = new THREE.Vector3(...normalInput);
  if (normalVec.lengthSq() < EPS) {
    throw new Error("Normal vector length must be greater than zero.");
  }
  normalVec.normalize();

  let upVec = new THREE.Vector3(...upInput);
  if (upVec.lengthSq() < EPS) {
    upVec = pickPerpendicular(normalVec);
  }

  const projection = normalVec.clone().multiplyScalar(upVec.dot(normalVec));
  upVec.sub(projection);
  if (upVec.lengthSq() < EPS) {
    upVec = pickPerpendicular(normalVec);
    upVec.sub(normalVec.clone().multiplyScalar(upVec.dot(normalVec)));
  }
  upVec.normalize();

  return {
    normal: [normalVec.x, normalVec.y, normalVec.z],
    up: [upVec.x, upVec.y, upVec.z],
  };
};

export default function ConnectorEditor({
  object,
  activeConnectorId,
  onSelectConnector,
  onApplyOrientation,
}) {
  const { t } = useLanguage();
  const connectors = useMemo(
    () => (object?.connectors || []).filter((connector) => connector && connector.id),
    [object?.connectors]
  );

  useEffect(() => {
    if (!object) {
      onSelectConnector?.(null);
      return;
    }
    if (connectors.length === 0) {
      onSelectConnector?.(null);
      return;
    }
    if (!connectors.some((connector) => connector.id === activeConnectorId)) {
      onSelectConnector?.(connectors[0].id);
    }
  }, [object, connectors, activeConnectorId, onSelectConnector]);

  const activeConnector = connectors.find((connector) => connector.id === activeConnectorId) || null;

  const [normalFields, setNormalFields] = useState(["0", "0", "1"]);
  const [upFields, setUpFields] = useState(["0", "1", "0"]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeConnector) {
      setNormalFields(["0", "0", "1"]);
      setUpFields(["0", "1", "0"]);
      setError(null);
      return;
    }
    setNormalFields(activeConnector.normal ? activeConnector.normal.map((value) => `${value}`) : ["0", "0", "1"]);
    setUpFields(activeConnector.up ? activeConnector.up.map((value) => `${value}`) : ["0", "1", "0"]);
    setError(null);
  }, [activeConnector?.id]);

  const handleApply = () => {
    if (!activeConnector) {
      setError("请选择一个连接点。");
      return;
    }
    try {
      const normalInput = toVector(normalFields);
      const upInput = toVector(upFields);
      const { normal, up } = buildOrthonormalBasis(normalInput, upInput);
      onApplyOrientation?.(activeConnector.id, normal, up);
      setNormalFields(normal.map((value) => `${value}`));
      setUpFields(up.map((value) => `${value}`));
      setError(null);
    } catch (err) {
      setError(err.message || "无法更新方向，请检查输入值。");
    }
  };

  return (
    <>
      {object && ( // ConnectorEditor panel only shows when an object is selected
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
            {object.name || t("label.part")} {t("label.settings")}
          </div>
          
      {connectors.length === 0 && (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {t("label.noConnectors")}
        </div>
      )}

      {connectors.length > 0 && (
      <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {connectors.map((connector) => (
          <button
            key={connector.id}
            onClick={() => onSelectConnector?.(connector.id)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: connector.id === activeConnectorId ? "1px solid #2563eb" : "1px solid #e5e7eb",
              background: connector.id === activeConnectorId ? "rgba(37,99,235,0.12)" : "#fff",
              color: "#0f172a",
              textAlign: "left",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {connector.label || connector.id}
          </button>
        ))}
      </div>

      {activeConnector && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "60px repeat(3, 1fr)", gap: 8 }}>
            <div style={{ gridColumn: "span 4", fontWeight: 600, fontSize: 13, color: "#1f2937" }}>
              {activeConnector.label || activeConnector.id}
            </div>

            <label style={labelStyle}>Normal</label>
            {normalFields.map((value, index) => (
              <input
                key={`normal-${index}`}
                style={inputStyle}
                value={value}
                onChange={(e) => {
                  const next = [...normalFields];
                  next[index] = e.target.value;
                  setNormalFields(next);
                }}
              />
            ))}

            <label style={labelStyle}>Up</label>
            {upFields.map((value, index) => (
              <input
                key={`up-${index}`}
                style={inputStyle}
                value={value}
                onChange={(e) => {
                  const next = [...upFields];
                  next[index] = e.target.value;
                  setUpFields(next);
                }}
              />
            ))}
          </div>

          {error && (
            <div style={{ marginTop: 8, color: "#ef4444", fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button style={btnStyle} onClick={handleApply}>
              {t("action.updateOrientation")}
            </button>
          </div>
        </>
      )}
      </>)}
        </div>
      )}
    </>
  );
}
