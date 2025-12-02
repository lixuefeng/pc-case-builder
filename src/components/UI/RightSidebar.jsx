import React from "react";
import ConnectorEditor from "./ConnectorEditor";
import * as THREE from "three";

import { useLanguage } from "../../i18n/LanguageContext";
import { getRelativeTransform } from "../../hooks/usePartModifiers";
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

  // Multi-selection Logic
  if (selectedIds && selectedIds.length === 2) {
    const partA = objects.find(o => o.id === selectedIds[0]);
    const partB = objects.find(o => o.id === selectedIds[1]);
    
    if (partA && partB) {
      return (
        <div style={{
          width: 300,
          background: "rgba(255,255,255,0.96)",
          borderLeft: "1px solid #e5e7eb",
          padding: 16,
          height: "100%",
          overflowY: "auto",
          color: "#0f172a"
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>
            Connection
          </h3>
          
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#64748b" }}>Part A</div>
            <div style={{ padding: 8, background: "#f1f5f9", borderRadius: 6, fontSize: 14 }}>
               {partA.name || partA.type}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#64748b" }}>Part B</div>
            <div style={{ padding: 8, background: "#f1f5f9", borderRadius: 6, fontSize: 14 }}>
               {partB.name || partB.type}
            </div>
          </div>

          <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Connection Type</div>
            <select style={{
              width: "100%",
              padding: "8px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              marginBottom: 16,
              fontSize: 14
            }} id="conn-type-select">
              <option value="mortise-tenon">Mortise & Tenon</option>
              <option value="external-plate">External Plate</option>
              <option value="blind-joint">Blind Joint</option>
              <option value="cross-lap">Cross-Lap Joint</option>
              <option value="shear-boss">Shear Boss</option>
            </select>
            
            <button
              style={{
                width: "100%",
                padding: "10px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer"
              }}
              onClick={() => {
                 const type = document.getElementById("conn-type-select").value;
                 
                 // Logic for Mortise & Tenon
                 if (type === 'mortise-tenon') {
                   // Simplified Logic: 
                   // Part A (First Selected) = Tenon (Red)
                   // Part B (Second Selected) = Mortise (Yellow)
                   const tenon = partA;
                   const mortise = partB;

                   console.log(`[Mortise & Tenon] Tenon: ${tenon.name} (Red), Mortise: ${mortise.name} (Yellow)`);
                   
                   const insertionDepth = 5; // mm

                   // Determine dominant axis
                   const diff = new THREE.Vector3().subVectors(
                     new THREE.Vector3(...tenon.pos),
                     new THREE.Vector3(...mortise.pos)
                   );
                   const absDiff = new THREE.Vector3(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));
                   let axis = 'y'; // default
                   if (absDiff.x > absDiff.y && absDiff.x > absDiff.z) axis = 'x';
                   if (absDiff.z > absDiff.x && absDiff.z > absDiff.y) axis = 'z';

                   setObjects(prev => {
                     return prev.map(o => {
                       // Modify Tenon: Extend Length
                       if (o.id === tenon.id) {
                         // Determine direction based on relative position to mortise
                         let tenonEnd = 0;
                         let newDims = { ...o.dims };
                         let shift = new THREE.Vector3();

                         if (axis === 'x') {
                            const isRight = diff.x > 0;
                            tenonEnd = isRight ? -1 : 1;
                            newDims.w = o.dims.w + insertionDepth;
                            shift.set((insertionDepth / 2) * tenonEnd, 0, 0);
                         } else if (axis === 'y') {
                            const isTop = diff.y > 0;
                            tenonEnd = isTop ? -1 : 1;
                            newDims.h = o.dims.h + insertionDepth;
                            shift.set(0, (insertionDepth / 2) * tenonEnd, 0);
                         } else { // z
                            const isFront = diff.z > 0;
                            tenonEnd = isFront ? -1 : 1;
                            newDims.d = o.dims.d + insertionDepth;
                            shift.set(0, 0, (insertionDepth / 2) * tenonEnd);
                         }

                         const rot = new THREE.Euler(...o.rot);
                         const quat = new THREE.Quaternion().setFromEuler(rot);
                         const worldShift = shift.applyQuaternion(quat);
                         
                         return {
                           ...o,
                           dims: newDims,
                           pos: [o.pos[0] + worldShift.x, o.pos[1] + worldShift.y, o.pos[2] + worldShift.z]
                         };
                       }
                       // Modify Mortise: Subtract Tenon (using NEW dimensions)
                       if (o.id === mortise.id) {
                          // Calculate Tenon's New World Position for the subtraction
                          let tenonEnd = 0;
                          let shift = new THREE.Vector3();
                          let newTenonDims = { ...tenon.dims };

                          if (axis === 'x') {
                             const isRight = diff.x > 0;
                             tenonEnd = isRight ? -1 : 1;
                             shift.set((insertionDepth / 2) * tenonEnd, 0, 0);
                             newTenonDims.w += insertionDepth;
                          } else if (axis === 'y') {
                             const isTop = diff.y > 0;
                             tenonEnd = isTop ? -1 : 1;
                             shift.set(0, (insertionDepth / 2) * tenonEnd, 0);
                             newTenonDims.h += insertionDepth;
                          } else { // z
                             const isFront = diff.z > 0;
                             tenonEnd = isFront ? -1 : 1;
                             shift.set(0, 0, (insertionDepth / 2) * tenonEnd);
                             newTenonDims.d += insertionDepth;
                          }

                          const tenonRot = new THREE.Euler(...tenon.rot);
                          const tenonQuat = new THREE.Quaternion().setFromEuler(tenonRot);
                          const worldShift = shift.applyQuaternion(tenonQuat);
                          const newTenonPos = [tenon.pos[0] + worldShift.x, tenon.pos[1] + worldShift.y, tenon.pos[2] + worldShift.z];
                          
                          const tenonObjForCalc = {
                            ...tenon,
                            pos: newTenonPos,
                            dims: newTenonDims
                          };

                          const relTransform = getRelativeTransform(tenonObjForCalc, o);
                          
                          if (relTransform) {
                            const modifier = {
                              id: `sub_${tenon.id}_${Date.now()}`,
                              type: tenon.type,
                              dims: tenonObjForCalc.dims,
                              relativeTransform: relTransform,
                              scale: tenon.scale || [1, 1, 1]
                            };
                            return {
                              ...o,
                              csgOperations: [...(o.csgOperations || []), modifier]
                            };
                          }
                       }
                       return o;
                     });
                   });
                 }

                 // Logic for Cross-Lap Joint
                 if (type === 'cross-lap') {
                    const partA = objects.find(o => o.id === selectedIds[0]);
                    const partB = objects.find(o => o.id === selectedIds[1]);
                    
                    if (partA && partB) {
                      // 0. Check Intersection (Robust World AABB)
                      const getWorldBounds = (p) => {
                         const { w, h, d } = p.dims;
                         const hw = w / 2, hh = h / 2, hd = d / 2;
                         // 8 corners of local box
                         const corners = [
                           new THREE.Vector3(hw, hh, hd), new THREE.Vector3(hw, hh, -hd),
                           new THREE.Vector3(hw, -hh, hd), new THREE.Vector3(hw, -hh, -hd),
                           new THREE.Vector3(-hw, hh, hd), new THREE.Vector3(-hw, hh, -hd),
                           new THREE.Vector3(-hw, -hh, hd), new THREE.Vector3(-hw, -hh, -hd)
                         ];
                         
                         const rot = new THREE.Euler(...(p.rot || [0, 0, 0]));
                         const quat = new THREE.Quaternion().setFromEuler(rot);
                         const pos = new THREE.Vector3(...p.pos);
                         
                         const min = new THREE.Vector3(Infinity, Infinity, Infinity);
                         const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
                         
                         corners.forEach(c => {
                           c.applyQuaternion(quat).add(pos);
                           min.min(c);
                           max.max(c);
                         });
                         
                         return { min, max };
                      };

                      const bA = getWorldBounds(partA);
                      const bB = getWorldBounds(partB);
                      
                      console.log("[CrossLap] Part A Bounds:", bA);
                      console.log("[CrossLap] Part B Bounds:", bB);

                      const intersects = (
                        bA.min.x < bB.max.x && bA.max.x > bB.min.x &&
                        bA.min.y < bB.max.y && bA.max.y > bB.min.y &&
                        bA.min.z < bB.max.z && bA.max.z > bB.min.z
                      );
                      
                      // Calculate Intersection Box
                      const intersectMin = {
                        x: Math.max(bA.min.x, bB.min.x),
                        y: Math.max(bA.min.y, bB.min.y),
                        z: Math.max(bA.min.z, bB.min.z)
                      };
                      const intersectMax = {
                        x: Math.min(bA.max.x, bB.max.x),
                        y: Math.min(bA.max.y, bB.max.y),
                        z: Math.min(bA.max.z, bB.max.z)
                      };
                      
                      const volume = 
                        Math.max(0, intersectMax.x - intersectMin.x) * 
                        Math.max(0, intersectMax.y - intersectMin.y) * 
                        Math.max(0, intersectMax.z - intersectMin.z);

                      if (!intersects || volume < 1.0) {
                        showToast({
                          type: "error",
                          text: "Parts do not intersect significantly! Please move them closer.",
                          ttl: 3000
                        });
                        return;
                      }
                      

                      
                      console.log("[CrossLap] Intersection Box:", { min: intersectMin, max: intersectMax });

                      // Determine Stack Axis (Thickness Axis)
                      // We want to cut along the "thickness" of the parts.
                      // 1. Find the smallest dimension for each part.
                      const getMinAxis = (dims) => {
                         const min = Math.min(dims.w, dims.h, dims.d);
                         if (min === dims.h) return 'y'; // Prioritize Y (Vertical) for ties
                         if (min === dims.w) return 'x';
                         return 'z';
                      };
                      const axisA = getMinAxis(partA.dims);
                      const axisB = getMinAxis(partB.dims);
                      
                      let stackAxis = 'y'; // Default to Y
                      if (axisA === axisB) {
                        stackAxis = axisA;
                      } else {
                        // If they disagree, check if one matches Y.
                        if (axisA === 'y' || axisB === 'y') stackAxis = 'y';
                        else stackAxis = axisA; // Fallback
                      }
                      
                      console.log("[CrossLap] Stack Axis (Derived from Parts):", stackAxis, "AxisA:", axisA, "AxisB:", axisB);

                      // Calculate Intersection Center (Split Plane)
                      const intersectCenter = {
                        x: (intersectMin.x + intersectMax.x) / 2,
                        y: (intersectMin.y + intersectMax.y) / 2,
                        z: (intersectMin.z + intersectMax.z) / 2
                      };
                      const splitPlane = intersectCenter[stackAxis];
                      console.log("[CrossLap] Split Plane:", splitPlane);

                      // 2. Determine Top/Bottom based on SELECTION ORDER
                      // Part A (First Selected) = "Top" Role (Keeps Top Half, Cuts Bottom)
                      // Part B (Second Selected) = "Bottom" Role (Keeps Bottom Half, Cuts Top)
                      const topPart = partA; 
                      const bottomPart = partB;
                      
                      // 3. Apply Modifiers
                      setObjects(prev => prev.map(o => {
                        // Modify Top Part (Part A): Cut from Bottom (remove bottom half of intersection)
                        // We use Part B as the cutter. We want to keep the Top half of A.
                        // So we need to remove the volume BELOW the split plane.
                        // We shift Part B so its TOP face (in World Space) aligns with the split plane.
                        if (o.id === topPart.id) {
                           const cutter = bottomPart;
                           // Use World Bounds of the cutter (Part B) to find its current Top
                           const cutterCurrentTop = bB.max[stackAxis];
                           
                           // We want Cutter Top = Split Plane
                           // Shift = Target - Current
                           const shiftVal = splitPlane - cutterCurrentTop;
                           
                           console.log("[CrossLap] Cutting Top Part (A). Cutter (B) Current Top:", cutterCurrentTop, "Target:", splitPlane, "Shift:", shiftVal);

                           const newCutterPos = [...cutter.pos];
                           if (stackAxis === 'x') newCutterPos[0] += shiftVal;
                           if (stackAxis === 'y') newCutterPos[1] += shiftVal;
                           if (stackAxis === 'z') newCutterPos[2] += shiftVal;
                           
                           const cutterObj = { ...cutter, pos: newCutterPos };
                           const relTransform = getRelativeTransform(cutterObj, o);
                           
                           if (relTransform) {
                             return {
                               ...o,
                               csgOperations: [...(o.csgOperations || []), {
                                 id: `cross_${cutter.id}_${Date.now()}`,
                                 type: cutter.type,
                                 dims: cutter.dims,
                                 relativeTransform: relTransform,
                                 scale: cutter.scale || [1, 1, 1],
                                 operation: 'subtract'
                               }]
                             };
                           }
                        }
                        
                        // Modify Bottom Part (Part B): Cut from Top (remove top half of intersection)
                        // We use Part A as the cutter. We want to keep the Bottom half of B.
                        // So we need to remove the volume ABOVE the split plane.
                        // We shift Part A so its BOTTOM face (in World Space) aligns with the split plane.
                        if (o.id === bottomPart.id) {
                           const cutter = topPart;
                           // Use World Bounds of the cutter (Part A) to find its current Bottom
                           const cutterCurrentBottom = bA.min[stackAxis];
                           
                           // We want Cutter Bottom = Split Plane
                           // Shift = Target - Current
                           const shiftVal = splitPlane - cutterCurrentBottom;
                           
                           console.log("[CrossLap] Cutting Bottom Part (B). Cutter (A) Current Bottom:", cutterCurrentBottom, "Target:", splitPlane, "Shift:", shiftVal);

                           const newCutterPos = [...cutter.pos];
                           if (stackAxis === 'x') newCutterPos[0] += shiftVal;
                           if (stackAxis === 'y') newCutterPos[1] += shiftVal;
                           if (stackAxis === 'z') newCutterPos[2] += shiftVal;
                           
                           const cutterObj = { ...cutter, pos: newCutterPos };
                           const relTransform = getRelativeTransform(cutterObj, o);
                           
                           if (relTransform) {
                             return {
                               ...o,
                               csgOperations: [...(o.csgOperations || []), {
                                 id: `cross_${cutter.id}_${Date.now()}`,
                                 type: cutter.type,
                                 dims: cutter.dims,
                                 relativeTransform: relTransform,
                                 scale: cutter.scale || [1, 1, 1],
                                 operation: 'subtract'
                               }]
                             };
                           }
                        }
                        
                        return o;
                      }));
                    }
                 }

                 if (onConnect) {
                   onConnect(type);
                 }
              }}
            >
              Create Connection
            </button>
            
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, padding: "8px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                <strong>Selection Order:</strong><br/>
                1. <span style={{color: "#ef4444", fontWeight: "bold"}}>Red (Tenon)</span>: The part that inserts.<br/>
                2. <span style={{color: "#eab308", fontWeight: "bold"}}>Yellow (Mortise)</span>: The part receiving the cut.
            </div>

            <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
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
                  Subtract (A - B)
                </button>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, textAlign: "center" }}>
                    Subtracts Part B from Part A
                </div>
            </div>
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
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>
        {t("label.inspector")}
      </div>

      {/* Basic Info */}
      <div style={sectionStyle}>
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

      {/* Transform */}
      <div style={sectionStyle}>
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

      {/* Actions */}
      <div style={sectionStyle}>
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
