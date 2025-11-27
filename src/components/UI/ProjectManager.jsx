import React, { useState } from "react";
import { useStore } from "../../store";
import { useLanguage } from "../../i18n/LanguageContext";

export default function ProjectManager({ onClose }) {
  const { t } = useLanguage();
  const {
    projects,
    currentProjectId,
    createProject,
    loadProject,
    deleteProject,
    updateProjectMeta,
  } = useStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const handleCreate = (e) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      createProject(newProjectName.trim());
      setNewProjectName("");
      setIsCreating(false);
    }
  };

  const handleRename = (id) => {
    if (editName.trim()) {
      updateProjectMeta(id, { name: editName.trim() });
      setEditingId(null);
      setEditName("");
    }
  };

  const startEditing = (project) => {
    setEditingId(project.id);
    setEditName(project.name);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm(t("confirmDeleteProject") || "Are you sure you want to delete this project?")) {
      deleteProject(id);
    }
  };

  const handleSwitch = (id) => {
    if (id !== currentProjectId) {
      loadProject(id);
    }
    if (onClose) onClose();
  };

  // Simple formatting for date
  const formatDate = (ts) => new Date(ts).toLocaleDateString();

  // Inline Styles
  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    color: "#0f172a", // Dark slate for text
  };

  const createButtonStyle = {
    width: "100%",
    padding: "8px 0",
    border: "2px dashed #cbd5e1",
    borderRadius: 8,
    color: "#475569",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 16,
  };

  const formStyle = {
    background: "#fff",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    marginBottom: 16,
  };

  const inputStyle = {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    padding: "6px 8px",
    fontSize: 14,
    marginBottom: 8,
    color: "#0f172a",
    background: "#fff",
    outline: "none",
  };

  const projectItemStyle = (isActive) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    border: isActive ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
    background: isActive ? "#eff6ff" : "#fff",
    cursor: "pointer",
    marginBottom: 8,
    transition: "all 0.2s",
  });

  const projectNameStyle = (isActive) => ({
    fontWeight: 500,
    fontSize: 14,
    color: isActive ? "#2563eb" : "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  return (
    <div style={containerStyle}>
      {/* Create New Section */}
      <div>
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            style={createButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#2563eb";
              e.currentTarget.style.color = "#2563eb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.color = "#475569";
            }}
          >
            <span>+</span> {t("createNewProject") || "Create New Project"}
          </button>
        ) : (
          <form onSubmit={handleCreate} style={formStyle}>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder={t("projectNamePlaceholder") || "Enter project name..."}
              style={inputStyle}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                style={{
                  padding: "4px 8px",
                  fontSize: 12,
                  color: "#64748b",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {t("cancel") || "Cancel"}
              </button>
              <button
                type="submit"
                style={{
                  padding: "4px 8px",
                  fontSize: 12,
                  background: "#2563eb",
                  color: "#fff",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {t("create") || "Create"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Project List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {projects.map((project) => {
          const isActive = currentProjectId === project.id;
          return (
            <div
              key={project.id}
              onClick={() => editingId !== project.id && handleSwitch(project.id)}
              style={projectItemStyle(isActive)}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = "#94a3b8";
                // Show actions on hover (simple visibility toggle via opacity is hard with inline styles without state, 
                // so we'll just keep them visible or use a simple trick if needed. 
                // For now, let's make them always visible but subtle, or just rely on the user knowing they are there.
                // Actually, let's make them visible.
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === project.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0, padding: "2px 4px" }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(project.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      onClick={() => handleRename(project.id)}
                      style={{ color: "#16a34a", background: "none", border: "none", cursor: "pointer" }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={projectNameStyle(isActive)}>
                        {project.name}
                      </h3>
                    </div>
                    <p style={{ fontSize: 10, color: "#64748b", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {formatDate(project.updatedAt)}
                    </p>
                  </>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(project);
                  }}
                  style={{ padding: 4, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}
                  title={t("rename") || "Rename"}
                >
                  ✎
                </button>
                {projects.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    style={{ padding: 4, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}
                    title={t("delete") || "Delete"}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "#94a3b8"}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

