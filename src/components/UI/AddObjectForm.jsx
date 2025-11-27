import React, { useState, useEffect } from "react";
import { PRESETS } from "../../utils/presets";
import { useLanguage } from "../../i18n/LanguageContext";

const instantiateConnectors = (type, preset) => {
  if (!preset) return [];

  if (Array.isArray(preset.connectors)) {
    return preset.connectors.map((connector) => {
      const clone = JSON.parse(JSON.stringify(connector));
      if (!clone.slotType) {
        clone.slotType = clone.type || "generic-slot";
      }
      return clone;
    });
  }

  if (typeof preset.buildConnectors === "function") {
    return preset.buildConnectors();
  }

  if (type === "motherboard") {
    const holeMap = Array.isArray(preset.meta?.holeMap)
      ? preset.meta.holeMap
      : [];
    const { w, h, d } = preset.dims || {};
    if (!holeMap.length || !w || !h || !d) {
      return [];
    }
    return holeMap.map(([x, z], index) => ({
      id: `${preset.key}-hole-${index}`,
      label: `MB Hole ${index + 1}`,
      type: "screw-m3",
      size: 3,
      pos: [x - w / 2, -h / 2, z - d / 2],
      normal: [0, -1, 0],
    }));
  }

  return [];
};

export default function AddObjectForm({ onAdd }) {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState("pcParts");
  const [type, setType] = useState("motherboard");
  const [presetKey, setPresetKey] = useState("itx");
  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState("horizontal");

  // Map categories to preset types
  const CATEGORY_MAP = {
    pcParts: ["motherboard", "gpu", "psu", "ram", "cpu-cooler", "reference"],
    structures: ["structure"],
    shared: ["shared"],
  };

  // Update type when category changes
  useEffect(() => {
    const types = CATEGORY_MAP[activeCategory];
    if (types && types.length > 0) {
      setType(types[0]);
    }
  }, [activeCategory]);

  // Update preset when type changes
  useEffect(() => {
    const presets = PRESETS[type] || [];
    if (presets.length > 0) {
      setPresetKey(presets[0].key);
    }
  }, [type]);

  const presets = PRESETS[type] || [];

  const handleAdd = () => {
    const id = `obj_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    const preset = presets.find((p) => p.key === presetKey);
    if (!preset) return;

    const meta = preset.meta ? JSON.parse(JSON.stringify(preset.meta)) : {};
    if (type === "motherboard") {
      meta.orientation = orientation;
    }

    const generateChildIds = (children, parentId) => {
      if (!Array.isArray(children)) return undefined;
      return children.map((child, index) => ({
        ...child,
        id: `${parentId}_child_${index}_${Math.floor(Math.random() * 1e5)}`,
        children: generateChildIds(child.children, parentId),
      }));
    };

    const obj = {
      id,
      key: preset.key,
      type: preset.type || type,
      name: name || preset.label,
      dims: { ...preset.dims },
      pos: [0, preset.dims.h / 2, 0],
      rot: [0, 0, 0],
      color: preset.color || undefined,
      visible: true,
      includeInExport: true,
      meta,
      connectors: instantiateConnectors(type, preset),
      children: generateChildIds(preset.children, id),
    };
    onAdd(obj);
    setName("");
  };

  // Styles
  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    color: "#0f172a",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    marginBottom: 4,
    display: "block",
  };

  const inputStyle = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    fontSize: 13,
    color: "#0f172a",
    background: "#fff",
    outline: "none",
  };

  const btnStyle = {
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  };

  const categoryTabStyle = (isActive) => ({
    flex: 1,
    padding: "6px 0",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    background: isActive ? "#eff6ff" : "transparent",
    color: isActive ? "#2563eb" : "#64748b",
    borderBottom: isActive ? "2px solid #2563eb" : "1px solid #e2e8f0",
    transition: "all 0.2s",
  });

  return (
    <div style={containerStyle}>
      {/* Category Tabs */}
      <div style={{ display: "flex", marginBottom: 4 }}>
        <div
          style={categoryTabStyle(activeCategory === "pcParts")}
          onClick={() => setActiveCategory("pcParts")}
        >
          {t("category.pcParts")}
        </div>
        <div
          style={categoryTabStyle(activeCategory === "structures")}
          onClick={() => setActiveCategory("structures")}
        >
          {t("category.structures")}
        </div>
        <div
          style={categoryTabStyle(activeCategory === "shared")}
          onClick={() => setActiveCategory("shared")}
        >
          {t("category.shared")}
        </div>
      </div>

      {/* Type Selector */}
      <div>
        <label style={labelStyle}>{t("form.type")}</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={inputStyle}
        >
          {CATEGORY_MAP[activeCategory].map((tKey) => (
            <option key={tKey} value={tKey}>
              {t(`type.${tKey}`) || tKey.charAt(0).toUpperCase() + tKey.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Preset Selector */}
      <div>
        <label style={labelStyle}>{t("form.preset")}</label>
        <select
          value={presetKey}
          onChange={(e) => setPresetKey(e.target.value)}
          style={inputStyle}
        >
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Orientation (Motherboard only) */}
      {type === "motherboard" && (
        <div>
          <label style={labelStyle}>{t("form.orientation")}</label>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
            style={inputStyle}
          >
            <option value="horizontal">{t("form.orientation.horizontal")}</option>
            <option value="vertical">{t("form.orientation.vertical")}</option>
          </select>
        </div>
      )}

      {/* Name Input */}
      <div>
        <label style={labelStyle}>{t("prop.name")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.namePlaceholder")}
          style={inputStyle}
        />
      </div>

      {/* Add Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={handleAdd} style={btnStyle}>
          {t("action.add")}
        </button>
      </div>
    </div>
  );
}
