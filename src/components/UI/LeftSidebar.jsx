import React from "react";
import AddObjectForm from "./AddObjectForm";
import FrameBuilderPanel from "./FrameBuilderPanel";
import ObjectsList from "./ObjectsList";
import ProjectManager from "./ProjectManager";

import { useLanguage } from "../../i18n/LanguageContext";

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

  const tabStyle = (isActive) => ({
    flex: 1,
    padding: "10px 0",
    textAlign: "center",
    cursor: "pointer",
    borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
    color: isActive ? "#2563eb" : "#64748b",
    fontWeight: 600,
    fontSize: 14,
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
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
        <div
          style={tabStyle(activeTab === "library")}
          onClick={() => onTabChange("library")}
        >
          {t("label.library")}
        </div>
        <div
          style={tabStyle(activeTab === "hierarchy")}
          onClick={() => onTabChange("hierarchy")}
        >
          {t("label.hierarchy")}
        </div>
        <div
          style={tabStyle(activeTab === "projects")}
          onClick={() => onTabChange("projects")}
        >
          {t("label.projects") || "Projects"}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {activeTab === "library" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AddObjectForm onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
            <FrameBuilderPanel onAdd={(obj) => setObjects((prev) => [...prev, obj])} />
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
