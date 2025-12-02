import React from "react";
import ConnectorEditor from "./ConnectorEditor";
import * as THREE from "three";

import { useLanguage } from "../../i18n/LanguageContext";
import { getRelativeTransform } from "../../utils/mathUtils";
import { calculateMortiseTenon, calculateCrossLap } from "../../utils/connectionUtils";
import { useToast } from "../../context/ToastContext";

const RightSidebar = ({
  selectedIds,
  objects,
  onConnect,
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
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [connectionType, setConnectionType] = React.useState("mortise-tenon");
  const [connectionDepth, setConnectionDepth] = React.useState(5);

  // Multi-selection Logic
  if (selectedIds && selectedIds.length === 2) {
    const partA = objects.find(o => o.id === selectedIds[0]);
    const partB = objects.find(o => o.id === selectedIds[1]);
    
    if (partA && partB) {
      const cardStyle = {
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
      };

      const labelStyle = {
        fontSize: 12,
        color: "#64748b",
        marginBottom: 4,
        display: "block",
        fontWeight: 600,
      };

      const typeBtnStyle = (isActive) => ({
        flex: 1,
        padding: "10px",
        borderRadius: 6,
        border: isActive ? "1px solid #3b82f6" : "1px solid #cbd5e1",
        background: isActive ? "#eff6ff" : "#fff",
        color: isActive ? "#1d4ed8" : "#64748b",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 13,
        transition: "all 0.2s"
      });

      return (
        <div style={{
          width: 320,
          background: "rgba(255,255,255,0.96)",
          borderLeft: "1px solid #e5e7eb",
          padding: 16,
          height: "100%",
          overflowY: "auto",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column"
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>
            Connection
          </h3>
          
          {/* Part A Card */}
          <div style={cardStyle}>
            <label style={labelStyle}>First Selected</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ 
                width: 12, 
                height: 12, 
                borderRadius: "50%", 
                background: "#ef4444", // Red (Selection Highlight)
                border: "1px solid rgba(0,0,0,0.1)"
              }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>{partA.name || partA.type}</div>
            </div>
          </div>

          {/* Part B Card */}
          <div style={cardStyle}>
            <label style={labelStyle}>Second Selected</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ 
                width: 12, 
                height: 12, 
                borderRadius: "50%", 
                background: "#eab308", // Yellow (Selection Highlight)
                border: "1px solid rgba(0,0,0,0.1)"
              }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>{partB.name || partB.type}</div>
            </div>
          </div>

          {/* Connection Type Selection */}
          <div style={cardStyle}>
            <label style={labelStyle}>Connection Type</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button 
                style={typeBtnStyle(connectionType === "mortise-tenon")}
                onClick={() => setConnectionType("mortise-tenon")}
              >
                Mortise & Tenon
              </button>
              <button 
                style={typeBtnStyle(connectionType === "cross-lap")}
                onClick={() => setConnectionType("cross-lap")}
              >
                Cross-Lap
              </button>
            </div>

            {/* Depth Input (Only for Mortise & Tenon for now) */}
            {connectionType === "mortise-tenon" && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Depth (mm)</label>
                <input
                  type="number"
                  value={connectionDepth}
                  onChange={(e) => { e.stopPropagation(); setConnectionDepth(Number(e.target.value)); }}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onInput={(e) => e.stopPropagation()}
                  autoComplete="off"
                  data-lpignore="true"
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
              </div>
            )}

            {/* Dynamic Explanation */}
            <div style={{ fontSize: 12, color: "#64748b", padding: "8px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0", lineHeight: 1.5, marginBottom: 16 }}>
              {connectionType === "mortise-tenon" ? (
                <>
                  <strong>Selection Order:</strong><br/>
                  1. <span style={{color: "#ef4444", fontWeight: "bold"}}>First Selected</span> inserts into Second Selected.<br/>
                  2. <span style={{color: "#eab308", fontWeight: "bold"}}>Second Selected</span> receives the hole.
                </>
              ) : (
                <>
                  <strong>Selection Order:</strong><br/>
                  1. <span style={{color: "#ef4444", fontWeight: "bold"}}>First Selected</span>: Top Part (Cut from Bottom).<br/>
                  2. <span style={{color: "#eab308", fontWeight: "bold"}}>Second Selected</span>: Bottom Part (Cut from Top).
                </>
              )}
            </div>

            {/* Create Button */}
            <button
              style={{
                width: "100%",
                padding: "12px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
              }}
              onClick={() => {
                 const type = connectionType;
                 
                   // Logic for Mortise & Tenon
                   if (type === 'mortise-tenon') {
                     // Use partA and partB from outer scope
                     if (partA && partB) {
                         const tenon = partA;
                         const mortise = partB;
                     
                         const insertionDepth = connectionDepth; // Use configured depth

                         const result = calculateMortiseTenon(tenon, mortise, insertionDepth);
                         
                         if (result) {
                           setObjects(prev => prev.map(o => {
                             if (o.id === result.tenon.id) return result.tenon;
                             if (o.id === result.mortise.id) return result.mortise;
                             return o;
                           }));
                         }
                     }
                   }

                 // Logic for Cross-Lap Joint
                 if (type === 'cross-lap') {
                    console.log("[CrossLap] Starting creation...");
                    // Use partA and partB from outer scope (First/Second selected)
                    
                    if (partA && partB) {
                      console.log("[CrossLap] Parts found:", partA.name, partB.name);

                      try {
                        const result = calculateCrossLap(partA, partB);
                        if (result) {
                           setObjects(prev => prev.map(o => {
                             if (o.id === result.partA.id) return result.partA;
                             if (o.id === result.partB.id) return result.partB;
                             return o;
                           }));
                        }
                      } catch (error) {
                         console.warn("[CrossLap] Error:", error.message);
                         showToast({
                           type: "error",
                           text: error.message,
                           ttl: 3000
                         });
                      }
                    }
                 }

                 if (onConnect) {
                   onConnect(type);
                 }
              }}
            >
              Create Connection
            </button>
          </div>
          
          {/* Subtraction Section Header */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 24, color: "#0f172a" }}>
            Subtraction
          </h3>

          {/* Subtraction Button (Separate Card) */}
          <div style={cardStyle}>
            <label style={labelStyle}>Subtraction</label>
            
            <div style={{ fontSize: 12, color: "#64748b", padding: "8px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0", lineHeight: 1.5, marginBottom: 16 }}>
               <strong>Effect:</strong><br/>
               Removes <span style={{color: "#eab308", fontWeight: "bold"}}>Second Selected</span> from <span style={{color: "#ef4444", fontWeight: "bold"}}>First Selected</span>.
            </div>

               <button
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#ef4444", // Red for destructive/subtractive
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
                onClick={() => {
                   // Static Subtraction Logic
                   if (partA && partB) {
                      const modifier = {
                        ...partB,
                        id: `sub_${partB.id}_${Date.now()}`, // Generate unique ID for the modifier
                        sourceId: partB.id, // Keep reference to original ID
                        operation: 'subtract',
                        relativeTransform: getRelativeTransform(partB, partA),
                        scale: partB.scale || [1, 1, 1] // Capture scale
                      };

                      setObjects(prev => {
                        const next = prev.map(o => {
                          if (o.id === partA.id) {
                            return {
                              ...o,
                              csgOperations: [...(o.csgOperations || []), modifier]
                            };
                          }
                          return o;
                        });
                        return next;
                      });
                   }
                }}
              >
                Subtract
              </button>
          </div>
        </div>
      );
    }
  }

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
        {t("prop.noSelection")}
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

  const handleRotChange = (axis, value) => {
    const newRot = [...(selectedObject.rot || [0, 0, 0])];
    const rad = THREE.MathUtils.degToRad(Number(value));
    if (axis === "x") newRot[0] = rad;
    if (axis === "y") newRot[1] = rad;
    if (axis === "z") newRot[2] = rad;
    handleChange("rot", newRot);
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  };

  const sectionStyle = {
    marginBottom: 0, // Removed margin as card handles it
    borderBottom: "none", // Removed border as card handles it
    paddingBottom: 0,
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
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>
        {t("label.inspector")}
      </div>

      {/* Basic Info */}
      <div style={cardStyle}>
        <div style={{...sectionStyle, marginBottom: 12}}>
          <label style={labelStyle}>{t("prop.name")}</label>
          <input
            style={inputStyle}
            value={selectedObject.name || selectedObject.id}
            onChange={(e) => handleChange("name", e.target.value)}
          />
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("prop.type")}</label>
              <div style={{ fontSize: 13, color: "#334155" }}>{selectedObject.type}</div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("prop.id")}</label>
              <div style={{ fontSize: 13, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedObject.id}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transform */}
      <div style={cardStyle}>
        <div style={{...sectionStyle, marginBottom: 12}}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>{t("prop.transform")}</div>
          
          <label style={labelStyle}>{t("prop.position")}</label>
          <div style={rowStyle}>
            <input
              type="number"
              style={inputStyle}
              value={selectedObject.pos?.[0] ?? 0}
              onChange={(e) => handlePosChange("x", e.target.value)}
              placeholder="X"
            />
            <input
              type="number"
              style={inputStyle}
              value={selectedObject.pos?.[1] ?? 0}
              onChange={(e) => handlePosChange("y", e.target.value)}
              placeholder="Y"
            />
            <input
              type="number"
              style={inputStyle}
              value={selectedObject.pos?.[2] ?? 0}
              onChange={(e) => handlePosChange("z", e.target.value)}
              placeholder="Z"
            />
          </div>

          <label style={labelStyle}>{t("prop.rotation") || "Rotation (Deg)"}</label>
          <div style={rowStyle}>
            <input
              type="number"
              style={inputStyle}
              value={Math.round(THREE.MathUtils.radToDeg(selectedObject.rot?.[0] ?? 0))}
              onChange={(e) => handleRotChange("x", e.target.value)}
              placeholder="X"
            />
            <input
              type="number"
              style={inputStyle}
              value={Math.round(THREE.MathUtils.radToDeg(selectedObject.rot?.[1] ?? 0))}
              onChange={(e) => handleRotChange("y", e.target.value)}
              placeholder="Y"
            />
            <input
              type="number"
              style={inputStyle}
              value={Math.round(THREE.MathUtils.radToDeg(selectedObject.rot?.[2] ?? 0))}
              onChange={(e) => handleRotChange("z", e.target.value)}
              placeholder="Z"
            />
          </div>

          <label style={labelStyle}>{t("prop.dimensions")}</label>
          <div style={rowStyle}>
            <input
              type="number"
              style={inputStyle}
              value={selectedObject.dims?.w ?? 0}
              onChange={(e) => handleDimChange("w", e.target.value)}
              placeholder="W"
            />
            <input
              type="number"
              style={inputStyle}
              value={selectedObject.dims?.h ?? 0}
              onChange={(e) => handleDimChange("h", e.target.value)}
              placeholder="H"
            />
            <input
              type="number"
              style={inputStyle}
              value={selectedObject.dims?.d ?? 0}
              onChange={(e) => handleDimChange("d", e.target.value)}
              placeholder="D"
            />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div style={cardStyle}>
        <div style={{...sectionStyle, marginBottom: 12}}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>{t("prop.appearance") || "Appearance"}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", background: "#fff" }}>
               <input
                type="color"
                value={selectedObject.color || "#d1d5db"}
                onChange={(e) => handleChange("color", e.target.value)}
                style={{
                  width: 24,
                  height: 24,
                  padding: 0,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: "none"
                }}
              />
              <span style={{ fontSize: 13, color: "#334155", fontFamily: "monospace" }}>
                {selectedObject.color || "#d1d5db"}
              </span>
            </div>
            <button
              style={btnStyle}
              onClick={() => {
                const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                handleChange("color", randomColor);
              }}
            >
              {t("action.randomColor") || "Random"}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={cardStyle}>
        <div style={{...sectionStyle, marginBottom: 12}}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>{t("prop.actions")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnStyle} onClick={onDuplicate}>{t("action.copy")}</button>
            <button style={{ ...btnStyle, color: "#ef4444", borderColor: "#fca5a5" }} onClick={onDelete}>{t("action.delete")}</button>
            <button style={btnStyle} onClick={() => handleChange("visible", !selectedObject.visible)}>
              {selectedObject.visible === false ? "Show" : "Hide"}
            </button>
            {selectedObject.type === "group" && (
              <button style={btnStyle} onClick={onUngroup}>{t("action.ungroup")}</button>
            )}
          </div>
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
