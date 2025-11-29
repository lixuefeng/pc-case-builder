import React, { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

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

// Shared card styling to align Hierarchy items with the Projects tab look.
const CARD_STYLE = {
  background: "#ffffff",
  border: "#e5e7eb",
  radius: 10,
  padding: "10px 12px",
  shadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  hoverShadow: "0 4px 10px rgba(15, 23, 42, 0.08)",
  hoverBg: "#f8fafc",
  activeBorder: "#3b82f6",
};

const BtnGhost = ({ children, onClick, disabled = false }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      padding: "6px 10px",
      borderRadius: 6,
      border: "1px solid #cbd5e1",
      background: "#fff",
      color: disabled ? "#94a3b8" : "#0f172a",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      fontSize: 12,
      fontWeight: 500,
    }}
  >
    {children}
  </button>
);

export default function ObjectsList({
  objects,
  setObjects,
  selectedIds,
  onSelect,
  onGroup,
  onUngroup,
  onDuplicate,
}) {
  const { t } = useLanguage();
  const [hoveredId, setHoveredId] = useState(null);

  const toggleVisible = (id) =>
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, visible: !o.visible } : o)));
  const remove = (id) => setObjects((prev) => prev.filter((o) => o.id !== id));
  const rename = (id, name) =>
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, name } : o)));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
        {t("label.objects")}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <BtnGhost onClick={() => onDuplicate?.(selectedIds)} disabled={selectedIds.length === 0}>
          {t("action.copy")}
        </BtnGhost>
        <BtnGhost onClick={onGroup} disabled={selectedIds.length <= 1}>
          {t("action.group")}
        </BtnGhost>
        <BtnGhost onClick={onUngroup}>{t("action.ungroup")}</BtnGhost>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1 }}>
        {objects.length === 0 && (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("label.noObjects")}</div>
        )}

        {(() => {
          const groups = {
            [t("category.pcParts")]: [],
            [t("category.structures")]: [],
            [t("category.shared")]: [],
            [t("category.groups")]: [],
            [t("category.others")]: [],
          };

          objects.forEach((o) => {
            if (o.meta?.category === "shared") groups[t("category.shared")].push(o);
            else if (o.type === "structure") groups[t("category.structures")].push(o);
            else if (o.type === "group") groups[t("category.groups")].push(o);
            else if (["motherboard", "gpu", "psu", "ram", "cpu-cooler", "reference"].includes(o.type))
              groups[t("category.pcParts")].push(o);
            else groups[t("category.others")].push(o);
          });

          return Object.entries(groups).map(([category, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    marginBottom: 6,
                    paddingLeft: 4,
                  }}
                >
                  {category}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {items.map((o) => {
                    const isSelected = selectedIds.includes(o.id);
                    const isHover = hoveredId === o.id;
                    return (
                      <div
                        key={o.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: CARD_STYLE.padding,
                          borderRadius: CARD_STYLE.radius,
                          border: `1px solid ${isSelected ? CARD_STYLE.activeBorder : CARD_STYLE.border}`,
                          background: isSelected
                            ? "#eef2ff"
                            : isHover
                              ? CARD_STYLE.hoverBg
                              : CARD_STYLE.background,
                          boxShadow: isHover ? CARD_STYLE.hoverShadow : CARD_STYLE.shadow,
                          color: "inherit",
                        }}
                        onMouseEnter={() => setHoveredId(o.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <input
                          type="checkbox"
                          checked={o.visible}
                          onChange={() => toggleVisible(o.id)}
                          title="Show/Hide"
                          style={{ cursor: "pointer" }}
                        />
                        <div
                          onClick={() => onSelect(o.id)}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                            overflow: "hidden",
                          }}
                        >
                          <input
                            style={{
                              ...inputStyle,
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              fontWeight: 500,
                              fontSize: 13,
                              width: "100%",
                              cursor: isSelected ? "text" : "pointer",
                              color: isSelected ? "#2563eb" : "#0f172a",
                            }}
                            value={o.name}
                            onChange={(e) => rename(o.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => onDuplicate?.([o.id])}
                            title={t("action.copy")}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "#64748b",
                            fontSize: 12,
                          }}
                        >
                            📋
                          </button>
                          <button
                            onClick={() => remove(o.id)}
                            title={t("action.delete")}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              color: "#ef4444",
                              fontSize: 12,
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
