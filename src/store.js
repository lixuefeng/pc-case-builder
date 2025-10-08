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

const saveObjectsToStorage = (objects) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(objects));
  } catch (e) {
    console.error("Failed to save to localStorage", e);
  }
};

const getInitialObjects = () => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load from localStorage", e);
  }
  return [];
};

export const useStore = create((set) => ({
  objects: getInitialObjects(),
  selectedIds: [],
  past: [],
  future: [],

  setObjects: (newObjects, options = {}) =>
    set((state) => {
      const workingCopy = cloneScene(state.objects);
      const nextObjects =
        typeof newObjects === "function" ? newObjects(workingCopy) : newObjects;

      if (!Array.isArray(nextObjects)) {
        console.warn("setObjects expects an array of objects");
        return {};
      }

      const nextSnapshot = cloneScene(nextObjects);
      const shouldRecordHistory = options.recordHistory ?? true;

      if (shouldRecordHistory) {
        const previousSnapshot = cloneScene(state.objects);
        saveObjectsToStorage(nextSnapshot);
        return {
          objects: nextSnapshot,
          past: [...state.past, previousSnapshot],
          future: [],
        };
      }

      saveObjectsToStorage(nextSnapshot);
      return {
        objects: nextSnapshot,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) {
        return {};
      }

      const previousSnapshot = state.past[state.past.length - 1];
      const currentSnapshot = cloneScene(state.objects);
      const nextObjects = cloneScene(previousSnapshot);

      saveObjectsToStorage(nextObjects);

      return {
        objects: nextObjects,
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
      const currentSnapshot = cloneScene(state.objects);
      const nextObjects = cloneScene(nextSnapshot);

      saveObjectsToStorage(nextObjects);

      return {
        objects: nextObjects,
        past: [...state.past, currentSnapshot],
        future: state.future.slice(1),
      };
    }),

  setSelectedIds: (newSelectedIds) => set({ selectedIds: newSelectedIds }),
}));

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
