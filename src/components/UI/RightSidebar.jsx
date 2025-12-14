import React from "react";
import ConnectorEditor from "./ConnectorEditor";
import * as THREE from "three";

import { useLanguage } from "../../i18n/LanguageContext";
import { getRelativeTransform, normalizeDegree } from "../../utils/mathUtils";

import { useToast } from "../../context/ToastContext";
import { buildGpuFingerPlacement } from "../../utils/gpuPcieSpec";
import { buildMotherboardLayout } from "../../config/motherboardPresets";
import { Vector3Input, DimensionsInput, SectionLabel, NumberInput } from "./InputComponents";

const RightSidebar = ({
  selectedIds,
  objects,

  selectedObject,
  setObjects,
  activeConnectorId,
  setActiveConnectorId,
  onApplyConnectorOrientation,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  connections,
}) => {
  const { t } = useLanguage();
  const { showToast } = useToast();


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

  const actionBtnStyle = {
    ...btnStyle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const destructiveBtnStyle = {
    ...btnStyle,
    color: "#ef4444",
    borderColor: "#fca5a5"
  };

  const handleHideOthers = () => {
    setObjects(prev => prev.map(o => {
      if (selectedIds.includes(o.id)) return { ...o, visible: true };
      return { ...o, visible: false };
    }));
    showToast({ type: "info", text: "Hid other objects", ttl: 1500 });
  };

  const handleShowOthers = () => {
    setObjects(prev => prev.map(o => {
      if (selectedIds.includes(o.id)) return o;
      return { ...o, visible: true };
    }));
    showToast({ type: "info", text: "Showed other objects", ttl: 1500 });
  };

  const handleHideSelected = () => {
    setObjects(prev => prev.map(o => {
      if (selectedIds.includes(o.id)) return { ...o, visible: false };
      return o;
    }));
  };

  const handleShowSelected = () => {
    setObjects(prev => prev.map(o => {
      if (selectedIds.includes(o.id)) return { ...o, visible: true };
      return o;
    }));
  };

  // Helper to check visibility states
  const areAllSelectedHidden = selectedIds && selectedIds.length > 0 && selectedIds.every(id => {
    const obj = objects.find(o => o.id === id);
    return obj && obj.visible === false;
  });

  const areAllOthersHidden = objects && objects.length > selectedIds.length && objects
    .filter(o => !selectedIds.includes(o.id))
    .every(o => o.visible === false);


  const handleMultiColorChange = (color) => {
    setObjects(prev => prev.map(o => {
      if (selectedIds.includes(o.id)) return { ...o, color };
      return o;
    }));
  };

  const renderCommonActions = ({
    canCopy = false,
    canUngroup = false,
    isHidden,
    onToggleHide,
    areOthersHidden,
    onToggleHideOthers
  }) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {canCopy && <button style={btnStyle} onClick={onDuplicate}>{t("action.copy")}</button>}
      <button style={destructiveBtnStyle} onClick={onDelete}>{t("action.delete")}</button>
      <button style={btnStyle} onClick={onToggleHide}>
        {isHidden ? t("action.show") : t("action.hide")}
      </button>
      <button style={btnStyle} onClick={onToggleHideOthers}>
        {areOthersHidden ? t("action.showOthers") : t("action.hideOthers")}
      </button>
      {canUngroup && <button style={btnStyle} onClick={onUngroup}>{t("action.ungroup")}</button>}
    </div>
  );

  // --- Case 0: No Selection ---
  if (!selectedIds || selectedIds.length === 0) {
    return (
      <div
        style={{
          width: 320,
          background: "rgba(255,255,255,0.96)",
          borderLeft: "1px solid #e5e7eb",
          padding: 16,
          color: "#475569",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        {t("prop.noSelection")}
      </div>
    );
  }

  // --- Case 2: Two Parts Selected ---
  if (selectedIds.length === 2) {
    const partA = objects.find(o => o.id === selectedIds[0]);
    const partB = objects.find(o => o.id === selectedIds[1]);

    if (partA && partB) {
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
            Multi-Selection (2)
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

          {/* Appearance */}
          <div style={cardStyle}>
            <label style={labelStyle}>{t("prop.appearance")}</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", background: "#fff" }}>
                <input
                  type="color"
                  // Use color of first selected item as representative, or default
                  value={partA.color || "#d1d5db"}
                  onChange={(e) => handleMultiColorChange(e.target.value)}
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
                  {partA.color || "#d1d5db"}
                </span>
              </div>
              <button
                style={btnStyle}
                onClick={() => {
                  const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                  handleMultiColorChange(randomColor);
                }}
              >
                {t("action.randomColor")}
              </button>
            </div>
          </div>

          {/* Group Action */}
          <div style={cardStyle}>
            <label style={labelStyle}>Group</label>
            <button style={{ ...btnStyle, width: "100%" }} onClick={onGroup}>Group Selected</button>
          </div>

          {/* Actions */}
          <div style={cardStyle}>
            <label style={labelStyle}>Actions</label>
            {renderCommonActions({
              canCopy: true,
              isHidden: areAllSelectedHidden,
              onToggleHide: areAllSelectedHidden ? handleShowSelected : handleHideSelected,
              areOthersHidden: areAllOthersHidden,
              onToggleHideOthers: areAllOthersHidden ? handleShowOthers : handleHideOthers
            })}
          </div>
        </div>
      );
    }
  }

  // --- Case 3: More than 2 Parts Selected ---
  if (selectedIds.length > 2) {
    const selectedParts = objects.filter(o => selectedIds.includes(o.id));

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
          Multi-Selection ({selectedIds.length})
        </h3>

        {/* Item List */}
        <div style={cardStyle}>
          <label style={labelStyle}>Selected Items</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selectedParts.map((part, index) => (
              <div key={part.id} style={{
                fontSize: 13,
                padding: "4px 8px",
                background: "#f1f5f9",
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#ef4444"
                }} />
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {part.name || part.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Appearance */}
        <div style={cardStyle}>
          <label style={labelStyle}>{t("prop.appearance")}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 8px", background: "#fff" }}>
              <input
                type="color"
                // Use color of first selected item as representative
                value={selectedParts[0]?.color || "#d1d5db"}
                onChange={(e) => handleMultiColorChange(e.target.value)}
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
                {selectedParts[0]?.color || "#d1d5db"}
              </span>
            </div>
            <button
              style={btnStyle}
              onClick={() => {
                const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                handleMultiColorChange(randomColor);
              }}
            >
              {t("action.randomColor")}
            </button>
          </div>
        </div>

        {/* Group Action */}
        <div style={cardStyle}>
          <label style={labelStyle}>Group</label>
          <button style={{ ...btnStyle, width: "100%" }} onClick={onGroup}>Group Selected</button>
        </div>

        {/* Actions */}
        <div style={cardStyle}>
          {renderCommonActions({
            canCopy: true,
            isHidden: areAllSelectedHidden,
            onToggleHide: areAllSelectedHidden ? handleShowSelected : handleHideSelected,
            areOthersHidden: areAllOthersHidden,
            onToggleHideOthers: areAllOthersHidden ? handleShowOthers : handleHideOthers
          })}
        </div>


      </div>
    );
  }

  // --- Case 1: Single Part Selected (Default Fallback) ---
  // Ensure selectedObject is valid
  if (!selectedObject) return null;

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

    // If GPU, recalculate connectors (fingers)
    let newConnectors = selectedObject.connectors;
    let newPos = selectedObject.pos;

    if (selectedObject.type === "gpu") {
      console.log("[RightSidebar] Updating GPU dims:", newDims);
      try {
        const fingerPlacement = buildGpuFingerPlacement({
          dims: newDims,
          pcie: selectedObject.meta?.pcie || {}
        });

        // Find existing fingers connector or create new list if needed
        // Assuming single connector for now as per presets
        newConnectors = [
          {
            id: `${selectedObject.key || selectedObject.id}-pcie-fingers`,
            label: "PCIe Fingers",
            type: "pcie-fingers",
            pos: fingerPlacement.connectorPos,
            normal: [0, -1, 0],
            up: [1, 0, 0],
            span: fingerPlacement.length,
          },
        ];

      } catch (e) {
        console.error("[RightSidebar] Failed to update GPU fingers:", e);
      }
    }

    setObjects((prev) =>
      prev.map((o) => (o.id === selectedObject.id ? { ...o, dims: newDims, connectors: newConnectors } : o))
    );
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
    marginBottom: 0, // Removed margin as card handles it
    borderBottom: "none", // Removed border as card handles it
    paddingBottom: 0,
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
        <div style={{ ...sectionStyle, marginBottom: 12 }}>
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
        <div style={{ ...sectionStyle, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>{t("prop.transform")}</div>

          <SectionLabel>{t("prop.position")}</SectionLabel>
          <Vector3Input
            values={selectedObject.pos || [0, 0, 0]}
            onChange={(axis, val) => handlePosChange(axis, val)}
            keys={["x", "y", "z"]}
          />

          <SectionLabel>{t("prop.rotation")}</SectionLabel>
          <Vector3Input
            values={[
              Math.round(normalizeDegree(THREE.MathUtils.radToDeg(selectedObject.rot?.[0] ?? 0))),
              Math.round(normalizeDegree(THREE.MathUtils.radToDeg(selectedObject.rot?.[1] ?? 0))),
              Math.round(normalizeDegree(THREE.MathUtils.radToDeg(selectedObject.rot?.[2] ?? 0)))
            ]}
            onChange={(axis, val) => handleRotChange(axis, val)}
            keys={["x", "y", "z"]}
          />

          <SectionLabel>{t("prop.dimensions")}</SectionLabel>
          <DimensionsInput
            values={selectedObject.dims}
            onChange={(axis, val) => handleDimChange(axis, val)}
          />
        </div>
      </div>


      {/* GPU Bracket Config */}
      {(selectedObject.type === "gpu" || selectedObject.meta?.bracket) && (
        <div style={cardStyle}>
          <div style={{ ...sectionStyle, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>{t("label.gpuBracket")}</div>

            <SectionLabel>{t("label.slotCount")}</SectionLabel>
            <NumberInput
              value={selectedObject.meta?.bracket?.slotCount ?? 2}
              onChange={(val) => {
                const currentBracket = selectedObject.meta?.bracket || { slotCount: 2, height: 120, thickness: 2, dropBelowBody: 30, xOffset: -0.8 };
                const newMeta = { ...selectedObject.meta, bracket: { ...currentBracket, slotCount: Number(val) } };
                handleChange("meta", newMeta);
              }}
              placeholder="Slots"
            />

            <SectionLabel>{t("label.bracketDimensions")}</SectionLabel>
            <Vector3Input
              values={selectedObject.meta?.bracket || { height: 120, thickness: 2 }}
              onChange={(key, val) => {
                const currentBracket = selectedObject.meta?.bracket || { slotCount: 2, height: 120, thickness: 2, dropBelowBody: 30, xOffset: -0.8 };
                const newMeta = { ...selectedObject.meta, bracket: { ...currentBracket, [key]: Number(val) } };
                handleChange("meta", newMeta);
              }}
              keys={["height", "thickness"]}
              labels={["H", "Thick"]}
              placeholders={["Height", "Thick"]}
            />

            <SectionLabel>{t("label.bracketPosition")}</SectionLabel>
            <Vector3Input
              values={selectedObject.meta?.bracket || { dropBelowBody: 30, xOffset: -0.8 }}
              onChange={(key, val) => {
                const currentBracket = selectedObject.meta?.bracket || { slotCount: 2, height: 120, thickness: 2, dropBelowBody: 30, xOffset: -0.8 };
                const newMeta = { ...selectedObject.meta, bracket: { ...currentBracket, [key]: Number(val) } };
                handleChange("meta", newMeta);
              }}
              keys={["dropBelowBody", "xOffset"]}
              labels={["Drop", "Offset"]}
              placeholders={["Drop", "Offset"]}
            />
          </div>
        </div>
      )}

      {/* Appearance */}
      <div style={cardStyle}>
        <div style={{ ...sectionStyle, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>{t("prop.appearance")}</div>
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
                const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                handleChange("color", randomColor);
              }}
            >
              {t("action.randomColor")}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={cardStyle}>
        <div style={{ ...sectionStyle, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>{t("prop.actions")}</div>
          {renderCommonActions({
            canCopy: true,
            canUngroup: selectedObject.type === "group",
            isHidden: selectedObject.visible === false,
            onToggleHide: () => handleChange("visible", !selectedObject.visible),
            areOthersHidden: areAllOthersHidden,
            onToggleHideOthers: areAllOthersHidden ? handleShowOthers : handleHideOthers
          })}
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
