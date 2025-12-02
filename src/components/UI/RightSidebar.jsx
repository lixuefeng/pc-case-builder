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
  const [connectionType, setConnectionType] = React.useState("mortise-tenon");

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
                         const worldShift = shift.clone().applyQuaternion(quat);
                         
                         // Fix: Update CSG Operations (Holes) to stay in place
                         // Since we are shifting the object center, we must shift the holes in the opposite direction
                         // to keep them in the same world position.
                         const newCsgOperations = (o.csgOperations || []).map(op => {
                           if (op.relativeTransform && op.relativeTransform.pos) {
                             const oldPos = new THREE.Vector3(...op.relativeTransform.pos);
                             const newPos = oldPos.clone().sub(shift); // shift is already in local space
                             return {
                               ...op,
                               relativeTransform: {
                                 ...op.relativeTransform,
                                 pos: newPos.toArray()
                               }
                             };
                           }
                           return op;
                         });

                         return {
                           ...o,
                           dims: newDims,
                           pos: [o.pos[0] + worldShift.x, o.pos[1] + worldShift.y, o.pos[2] + worldShift.z],
                           csgOperations: newCsgOperations
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

                      const intersectMin = new THREE.Vector3().maxVectors(bA.min, bB.min);
                      const intersectMax = new THREE.Vector3().minVectors(bA.max, bB.max);

                      // Check if there is a positive intersection volume
                      const sizeX = intersectMax.x - intersectMin.x;
                      const sizeY = intersectMax.y - intersectMin.y;
                      const sizeZ = intersectMax.z - intersectMin.z;

                      // Use a small epsilon to avoid floating point issues, but ensure it's > 0
                      const epsilon = 1.0; // Require at least 1mm intersection
                      if (sizeX < epsilon || sizeY < epsilon || sizeZ < epsilon) {
                         showToast({
                           type: "error",
                           text: "Parts must intersect to create a Cross-Lap Joint.",
                           ttl: 3000
                         });
                         return;
                      }

                      // 1. Determine Stack Axis (the axis along which they are stacked/crossing)
                      // Usually the smallest dimension of the intersection box, OR the axis where they overlap the least relative to their own size?
                      // Actually, for a cross-lap, the cut is usually along the "thickness" direction.
                      // Let's pick the axis with the SMALLEST intersection dimension as the "thickness" to cut through?
                      // No, we want to cut halfway through the "thickness".
                      // Let's look at the parts' local dimensions.
                      // Simplified: Use the axis with the smallest intersection extent.
                      const dims = { x: sizeX, y: sizeY, z: sizeZ };
                      // Prioritize Y (vertical) if it's small, as that's common for stacking.
                      let stackAxis = 'y';
                      if (dims.x < dims.y && dims.x < dims.z) stackAxis = 'x';
                      if (dims.z < dims.x && dims.z < dims.y) stackAxis = 'z';
                      
                      console.log("[CrossLap] Intersection Box:", dims, "Selected Stack Axis:", stackAxis);

                      // 2. Calculate Cut Plane (Center of Intersection)
                      const center = new THREE.Vector3().addVectors(intersectMin, intersectMax).multiplyScalar(0.5);
                      const splitPlane = center[stackAxis];
                      
                      console.log("[CrossLap] Split Plane (World):", splitPlane);

                      setObjects(prev => prev.map(o => {
                        // Modify Top Part (Part A): Cut from Bottom (remove bottom half of intersection)
                        // We use Part B as the cutter. We want to keep the Top half of A.
                        // So we need to remove the volume BELOW the split plane.
                        // We shift Part B so its TOP face (in World Space) aligns with the split plane.
                        if (o.id === partA.id) {
                           const cutter = partB;
                           // Use World Bounds of the cutter (Part B) to find its current Top
                           const cutterCurrentTop = bB.max[stackAxis];
                           
                           // We want Cutter Top = Split Plane
                           // Shift = Target - Current
                           // But wait, if we move the cutter, we change the intersection.
                           // We are creating a "virtual" cutter based on Part B.
                           
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
                        if (o.id === partB.id) {
                           const cutter = partA;
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
