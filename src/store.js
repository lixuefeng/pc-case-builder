import { useMemo } from "react";
import { create } from "zustand";

const STORAGE_PREFIX = "pc-case-builder-";
const SCENE_KEY_PREFIX = `${STORAGE_PREFIX}project_`;
const PROJECTS_LIST_KEY = `${STORAGE_PREFIX}projects`;
const CLIPBOARD_KEY = `${STORAGE_PREFIX}clipboard`;
const LEGACY_STORAGE_KEY = "pc-case-builder-scene";

// --- Helper Functions ---

const cloneScene = (value) => {
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch (e) {
    // structuredClone failed, fall back to JSON strategy below
  }
  return JSON.parse(JSON.stringify(value));
};

const generateId = () => Math.random().toString(36).slice(2, 9);

const ProjectStorage = {
  getProjects: () => {
    try {
      const stored = localStorage.getItem(PROJECTS_LIST_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load projects list", e);
      return [];
    }
  },
  saveProjects: (projects) => {
    try {
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error("Failed to save projects list", e);
    }
  },
  getProjectScene: (projectId) => {
    try {
      const stored = localStorage.getItem(`${SCENE_KEY_PREFIX}${projectId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error(`Failed to load project ${projectId}`, e);
      return null;
    }
  },
  saveProjectScene: (projectId, scene) => {
    try {
      localStorage.setItem(`${SCENE_KEY_PREFIX}${projectId}`, JSON.stringify(scene));
    } catch (e) {
      console.error(`Failed to save project ${projectId}`, e);
    }
  },
  deleteProjectScene: (projectId) => {
    try {
      localStorage.removeItem(`${SCENE_KEY_PREFIX}${projectId}`);
    } catch (e) {
      console.error(`Failed to delete project ${projectId}`, e);
    }
  },
  getLegacyScene: () => {
    try {
      const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  },
  clearLegacyScene: () => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  },
  saveClipboard: (data) => {
    try {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save clipboard", e);
    }
  },
  getClipboard: () => {
    try {
      const stored = localStorage.getItem(CLIPBOARD_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }
};

const sanitizeConnections = (connections, objects) => {
  if (!Array.isArray(connections) || connections.length === 0) {
    return [];
  }

  const connectorMap = new Map();
  for (const obj of objects) {
    if (!obj || !obj.id) continue;
    const connectors = Array.isArray(obj.connectors) ? obj.connectors : [];
    connectorMap.set(
      obj.id,
      new Set(connectors.map((connector) => connector?.id).filter(Boolean))
    );
  }

  return connections.filter((connection) => {
    // Support new schema: partA, partB
    if (connection.partA && connection.partB) {
      const hasPartA = connectorMap.has(connection.partA);
      const hasPartB = connectorMap.has(connection.partB);
      return hasPartA && hasPartB;
    }

    // Support legacy schema: from, to
    if (!connection?.from || !connection?.to) {
      return false;
    }

    const fromSet = connectorMap.get(connection.from.partId);
    const toSet = connectorMap.get(connection.to.partId);

    if (!fromSet || !toSet) {
      return false;
    }

    if (
      connection.from.connectorId &&
      fromSet.size > 0 &&
      !fromSet.has(connection.from.connectorId)
    ) {
      return false;
    }

    if (
      connection.to.connectorId &&
      toSet.size > 0 &&
      !toSet.has(connection.to.connectorId)
    ) {
      return false;
    }

    return true;
  });
};

const getInitialState = () => {
  const emptyScene = { objects: [], connections: [] };
  let projects = ProjectStorage.getProjects();
  let currentProjectId = null;
  let currentScene = emptyScene;

  // Migration Logic
  if (projects.length === 0) {
    const legacyData = ProjectStorage.getLegacyScene();
    if (legacyData) {
      const newId = generateId();
      const newProject = {
        id: newId,
        name: "Default Project",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      let legacyScene = emptyScene;
      if (Array.isArray(legacyData)) {
        legacyScene = { ...emptyScene, objects: legacyData };
      } else if (legacyData && Array.isArray(legacyData.objects)) {
        legacyScene = {
          objects: legacyData.objects,
          connections: Array.isArray(legacyData.connections) ? legacyData.connections : [],
        };
      }

      ProjectStorage.saveProjects([newProject]);
      ProjectStorage.saveProjectScene(newId, legacyScene);
      // Optional: ProjectStorage.clearLegacyScene(); // Keep for safety for now

      projects = [newProject];
      currentProjectId = newId;
      currentScene = legacyScene;
    } else {
      // Brand new user
      const newId = generateId();
      const newProject = {
        id: newId,
        name: "My First Project",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      ProjectStorage.saveProjects([newProject]);
      ProjectStorage.saveProjectScene(newId, emptyScene);
      projects = [newProject];
      currentProjectId = newId;
    }
  } else {
    // Load last active or first project
    // For now, just load the first one. Ideally we store 'lastActiveProjectId'
    currentProjectId = projects[0].id;
    const storedScene = ProjectStorage.getProjectScene(currentProjectId);
    if (storedScene) {
      currentScene = storedScene;
    }
  }

  return {
    projects,
    currentProjectId,
    objects: currentScene.objects,
    connections: currentScene.connections,
  };
};

// --- Store Implementation ---

export const useStore = create((set, get) => {
  const initialState = getInitialState();

  return {
    // State
    projects: initialState.projects,
    currentProjectId: initialState.currentProjectId,
    objects: initialState.objects,
    connections: initialState.connections,
    selectedIds: [],
    past: [],
    future: [],

    // Actions
    createProject: (name) => {
      const newId = generateId();
      const newProject = {
        id: newId,
        name: name || "New Project",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const emptyScene = { objects: [], connections: [] };

      const updatedProjects = [...get().projects, newProject];
      ProjectStorage.saveProjects(updatedProjects);
      ProjectStorage.saveProjectScene(newId, emptyScene);

      set({
        projects: updatedProjects,
        currentProjectId: newId,
        objects: [],
        connections: [],
        selectedIds: [],
        past: [],
        future: [],
      });
    },

    loadProject: (projectId) => {
      const project = get().projects.find(p => p.id === projectId);
      if (!project) return;

      const scene = ProjectStorage.getProjectScene(projectId) || { objects: [], connections: [] };

      set({
        currentProjectId: projectId,
        objects: scene.objects,
        connections: scene.connections,
        selectedIds: [],
        past: [],
        future: [],
      });
    },

    deleteProject: (projectId) => {
      const { projects, currentProjectId } = get();
      if (projects.length <= 1) {
        console.warn("Cannot delete the last project");
        return;
      }

      const updatedProjects = projects.filter(p => p.id !== projectId);
      ProjectStorage.saveProjects(updatedProjects);
      ProjectStorage.deleteProjectScene(projectId);

      // If we deleted the current project, switch to another one
      if (projectId === currentProjectId) {
        const nextProject = updatedProjects[0];
        const scene = ProjectStorage.getProjectScene(nextProject.id) || { objects: [], connections: [] };
        set({
          projects: updatedProjects,
          currentProjectId: nextProject.id,
          objects: scene.objects,
          connections: scene.connections,
          selectedIds: [],
          past: [],
          future: [],
        });
      } else {
        set({ projects: updatedProjects });
      }
    },

    updateProjectMeta: (projectId, updates) => {
      const updatedProjects = get().projects.map(p =>
        p.id === projectId ? { ...p, ...updates, updatedAt: Date.now() } : p
      );
      ProjectStorage.saveProjects(updatedProjects);
      set({ projects: updatedProjects });
    },

    // Scene Actions
    setObjects: (newObjects, options = {}) =>
      set((state) => {
        const workingObjects = cloneScene(state.objects);
        const nextObjects =
          typeof newObjects === "function"
            ? newObjects(workingObjects)
            : newObjects;

        if (!Array.isArray(nextObjects)) {
          console.warn("setObjects expects an array of objects");
          return {};
        }

        const sanitizedConnections = sanitizeConnections(
          state.connections,
          nextObjects
        );

        const nextObjectsClone = cloneScene(nextObjects);
        const nextConnectionsClone = cloneScene(sanitizedConnections);

        const nextSnapshot = {
          objects: nextObjectsClone,
          connections: nextConnectionsClone,
        };

        const shouldRecordHistory = options.recordHistory ?? true;

        // Save to current project storage
        if (state.currentProjectId) {
          ProjectStorage.saveProjectScene(state.currentProjectId, nextSnapshot);
          // Update timestamp
          const updatedProjects = state.projects.map(p =>
            p.id === state.currentProjectId ? { ...p, updatedAt: Date.now() } : p
          );
          ProjectStorage.saveProjects(updatedProjects);
          // Note: We are not updating state.projects here to avoid re-renders on every object change
          // But we should probably do it if we display "Last Updated" in real-time.
          // For now, let's skip updating state.projects for perf, unless needed.
        }

        if (shouldRecordHistory) {
          const previousSnapshot = {
            objects: cloneScene(state.objects),
            connections: cloneScene(state.connections),
          };

          return {
            objects: nextObjectsClone,
            connections: nextConnectionsClone,
            past: [...state.past, previousSnapshot],
            future: [],
          };
        }

        return {
          objects: nextObjectsClone,
          connections: nextConnectionsClone,
        };
      }),

    setConnections: (updater, options = {}) =>
      set((state) => {
        const workingConnections = cloneScene(state.connections);
        const updatedConnections =
          typeof updater === "function"
            ? updater(workingConnections)
            : updater;

        if (!Array.isArray(updatedConnections)) {
          console.warn("setConnections expects an array of connections");
          return {};
        }

        const sanitizedConnections = sanitizeConnections(
          updatedConnections,
          state.objects
        );

        const nextObjectsClone = cloneScene(state.objects);
        const nextConnectionsClone = cloneScene(sanitizedConnections);

        const nextSnapshot = {
          objects: nextObjectsClone,
          connections: nextConnectionsClone,
        };

        const shouldRecordHistory = options.recordHistory ?? true;

        if (state.currentProjectId) {
          ProjectStorage.saveProjectScene(state.currentProjectId, nextSnapshot);
        }

        if (shouldRecordHistory) {
          const previousSnapshot = {
            objects: cloneScene(state.objects),
            connections: cloneScene(state.connections),
          };

          return {
            objects: nextObjectsClone,
            connections: nextConnectionsClone,
            past: [...state.past, previousSnapshot],
            future: [],
          };
        }

        return {
          connections: nextConnectionsClone,
        };
      }),

    undo: () =>
      set((state) => {
        if (state.past.length === 0) {
          return {};
        }

        const previousSnapshot =
          state.past[state.past.length - 1];
        const currentSnapshot = {
          objects: cloneScene(state.objects),
          connections: cloneScene(state.connections),
        };

        const nextObjects = cloneScene(previousSnapshot.objects ?? []);
        const nextConnections = cloneScene(previousSnapshot.connections ?? []);

        if (state.currentProjectId) {
          ProjectStorage.saveProjectScene(state.currentProjectId, {
            objects: nextObjects,
            connections: nextConnections,
          });
        }

        return {
          objects: nextObjects,
          connections: nextConnections,
          past: state.past.slice(0, -1),
          future: [currentSnapshot, ...state.future],
        };
      }),

    redo: () =>
      set((state) => {
        if (state.future.length === 0) {
          return {};
        }

        const nextSnapshot = state.future[0];
        const currentSnapshot = {
          objects: cloneScene(state.objects),
          connections: cloneScene(state.connections),
        };

        const nextObjects = cloneScene(nextSnapshot.objects ?? []);
        const nextConnections = cloneScene(nextSnapshot.connections ?? []);

        if (state.currentProjectId) {
          ProjectStorage.saveProjectScene(state.currentProjectId, {
            objects: nextObjects,
            connections: nextConnections,
          });
        }

        return {
          objects: nextObjects,
          connections: nextConnections,
          past: [...state.past, currentSnapshot],
          future: state.future.slice(1),
        };
      }),

    setSelectedIds: (updater) =>
      set((state) => ({
        selectedIds:
          typeof updater === "function"
            ? updater(state.selectedIds)
            : updater,
      })),

    // Clipboard Actions
    copyToClipboard: (objectIds) => {
      const state = get();
      const objectsToCopy = state.objects.filter(o => objectIds.includes(o.id));
      if (objectsToCopy.length === 0) return;

      const clipboardData = {
        objects: cloneScene(objectsToCopy),
        timestamp: Date.now()
      };
      ProjectStorage.saveClipboard(clipboardData);
    },

    pasteFromClipboard: () => {
      const clipboardData = ProjectStorage.getClipboard();
      if (!clipboardData || !Array.isArray(clipboardData.objects)) return;

      const state = get();
      const newObjects = [];
      const idMap = new Map();

      // Regenerate IDs
      clipboardData.objects.forEach(obj => {
        const newId = `${obj.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        idMap.set(obj.id, newId);

        // Offset position slightly to avoid perfect overlap
        const newPos = [
          (obj.pos[0] || 0) + 20,
          (obj.pos[1] || 0) + 20,
          (obj.pos[2] || 0) + 20
        ];

        newObjects.push({
          ...obj,
          id: newId,
          pos: newPos,
          name: `${obj.name} (Copy)`
        });
      });

      // Remap children/parent IDs if necessary (for groups)
      // Simple remapping for now. If we have complex hierarchies, we need a recursive approach similar to duplicateObject
      // For now, let's assume flat copy or simple groups.

      // We should reuse the duplicate logic ideally, but for now let's just add them.
      // If we want to be robust, we should use a similar logic to 'duplicateObject' in PCEditor
      // but adapted for store. 
      // Since 'duplicateObject' is in PCEditor, we might want to move it to utils or store.
      // For this iteration, let's stick to simple ID regeneration.

      const nextObjects = [...state.objects, ...newObjects];

      // Save and update state
      if (state.currentProjectId) {
        ProjectStorage.saveProjectScene(state.currentProjectId, {
          objects: nextObjects,
          connections: state.connections
        });
      }

      set({
        objects: nextObjects,
        selectedIds: newObjects.map(o => o.id),
        // Add to history
        past: [...state.past, {
          objects: cloneScene(state.objects),
          connections: cloneScene(state.connections)
        }]
      });
    }
  };
});

export const useTemporalStore = (selector = (state) => state) => {
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const past = useStore((state) => state.past);
  const future = useStore((state) => state.future);

  const slice = useMemo(
    () => ({ undo, redo, past, future }),
    [undo, redo, past, future]
  );

  return selector(slice);
};
