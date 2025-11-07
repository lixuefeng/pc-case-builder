import { useMemo } from "react";
import { create } from "zustand";

const LOCAL_STORAGE_KEY = "pc-case-builder-scene";

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

const saveSceneToStorage = (scene) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scene));
  } catch (e) {
    console.error("Failed to save to localStorage", e);
  }
};

const getInitialScene = () => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return { objects: parsed, connections: [] };
      }
      if (parsed && Array.isArray(parsed.objects)) {
        return {
          objects: parsed.objects,
          connections: Array.isArray(parsed.connections)
            ? parsed.connections
            : [],
        };
      }
    }
  } catch (e) {
    console.error("Failed to load from localStorage", e);
  }
  return { objects: [], connections: [] };
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

export const useStore = create((set) => {
  const initialScene = getInitialScene();

  return {
    objects: initialScene.objects,
    connections: initialScene.connections,
    frames: [],
    selectedIds: [],
    connectorSelection: [],
    past: [],
    future: [],

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

        if (shouldRecordHistory) {
          const previousSnapshot = {
            objects: cloneScene(state.objects),
            connections: cloneScene(state.connections),
          };

          saveSceneToStorage(nextSnapshot);

          return {
            objects: nextObjectsClone,
            connections: nextConnectionsClone,
            past: [...state.past, previousSnapshot],
            future: [],
          };
        }

        saveSceneToStorage(nextSnapshot);

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

        if (shouldRecordHistory) {
          const previousSnapshot = {
            objects: cloneScene(state.objects),
            connections: cloneScene(state.connections),
          };

          saveSceneToStorage(nextSnapshot);

          return {
            objects: nextObjectsClone,
            connections: nextConnectionsClone,
            past: [...state.past, previousSnapshot],
            future: [],
          };
        }

        saveSceneToStorage(nextSnapshot);

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
          state.past[state.past.length - 1] ?? initialScene;
        const currentSnapshot = {
          objects: cloneScene(state.objects),
          connections: cloneScene(state.connections),
        };

        const nextObjects = cloneScene(previousSnapshot.objects ?? []);
        const nextConnections = cloneScene(previousSnapshot.connections ?? []);

        saveSceneToStorage({
          objects: nextObjects,
          connections: nextConnections,
        });

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

        saveSceneToStorage({
          objects: nextObjects,
          connections: nextConnections,
        });

        return {
          objects: nextObjects,
          connections: nextConnections,
          past: [...state.past, currentSnapshot],
          future: state.future.slice(1),
        };
      }),

    setFrames: (nextFrames) =>
      set((state) => {
        const resolved =
          typeof nextFrames === "function" ? nextFrames(state.frames) : nextFrames;
        if (!Array.isArray(resolved)) {
          console.warn("setFrames expects an array of frame descriptors");
          return {};
        }
        return { frames: cloneScene(resolved) };
      }),
    setSelectedIds: (newSelectedIds) => set({ selectedIds: newSelectedIds }),
    setConnectorSelection: (updater) =>
      set((state) => {
        const nextSelection =
          typeof updater === "function"
            ? updater(state.connectorSelection)
            : updater;
        if (!Array.isArray(nextSelection)) {
          return {};
        }
        if (nextSelection.length > 2) {
          return { connectorSelection: nextSelection.slice(-2) };
        }
        return { connectorSelection: nextSelection };
      }),
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
