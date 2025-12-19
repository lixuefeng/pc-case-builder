import React from "react";
import AddObjectForm from "./AddObjectForm";
import ObjectsList from "./ObjectsList";
import ProjectManager from "./ProjectManager";

import { useLanguage } from "../../i18n/LanguageContext";

// Centralized tab theming keeps all three tabs visually aligned to the "Projects" look.
const TAB_THEME = {
  padding: "10px 0",
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
  activeColor: "#1d4ed8",
  background: "#f8fafc",
  hoverBackground: "#eef2ff",
  activeBackground: "#e5edff",
  borderColor: "#e5e7eb",
  radius: 10,
};

const TABS = [
  { key: "projects", labelKey: "label.projects", fallback: "Projects" },
  { key: "library", labelKey: "label.library" },
  { key: "hierarchy", labelKey: "label.hierarchy" },
];

const LeftSidebar = ({
  objects,
  setObjects,
  selectedIds,
  onSelect,
  onGroup,
  onUngroup,
  onDuplicate,
  activeTab,
  onTabChange,
}) => {
  const { t } = useLanguage();

  const [hoveredTab, setHoveredTab] = React.useState(null);

  const tabStyle = (isActive, isHover) => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: TAB_THEME.padding,
    borderRadius: TAB_THEME.radius,
    background: isActive
      ? TAB_THEME.activeBackground
      : isHover
        ? TAB_THEME.hoverBackground
        : TAB_THEME.background,
    color: isActive ? TAB_THEME.activeColor : TAB_THEME.color,
    border: `1px solid ${TAB_THEME.borderColor}`,
    boxShadow: isActive ? `inset 0 -2px 0 ${TAB_THEME.activeColor}` : "none",
    fontWeight: TAB_THEME.fontWeight,
    fontSize: TAB_THEME.fontSize,
    cursor: "pointer",
    transition: "background 120ms ease, color 120ms ease, box-shadow 120ms ease",
  });

  return (
    <div
      style={{
        width: 320,
        background: "rgba(255,255,255,0.96)",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
      }}
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: 8, borderBottom: "1px solid #e5e7eb" }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isHover = hoveredTab === tab.key;
          const label = t(tab.labelKey) || tab.fallback || tab.labelKey;
          return (
            <div
              key={tab.key}
              style={tabStyle(isActive, isHover)}
              onClick={() => onTabChange(tab.key)}
              onMouseEnter={() => setHoveredTab(tab.key)}
              onMouseLeave={() => setHoveredTab(null)}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {/* Tab Content: Library */}
        {/* Guard: Ensure content only shows when activeTab is 'library' */}
        {activeTab === "library" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AddObjectForm onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
          </div>
        )}

        {activeTab === "hierarchy" && (
          <ObjectsList
            objects={objects}
            setObjects={setObjects}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onGroup={onGroup}
            onUngroup={onUngroup}
            onDuplicate={onDuplicate}
          />
        )}

        {activeTab === "projects" && (
          <ProjectManager onClose={() => {}} />
        )}
      </div>
    </div>
  );
};

export default LeftSidebar;
