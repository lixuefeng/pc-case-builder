import { PRESETS } from "./presets";

const deepCloneConnectors = (connectors) =>
  Array.isArray(connectors)
    ? connectors.map((connector) => JSON.parse(JSON.stringify(connector)))
    : [];

const sortById = (arr = []) =>
  [...arr].sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")));

const connectorsEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const norm = (list) => sortById(list).map((item) => JSON.parse(JSON.stringify(item)));
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
};

const findPresetForObject = (obj) => {
  const family = PRESETS[obj?.type];
  if (!Array.isArray(family)) {
    return null;
  }

  if (obj?.meta?.presetKey) {
    const presetByKey = family.find((candidate) => candidate.key === obj.meta.presetKey);
    if (presetByKey) {
      return presetByKey;
    }
  }

  const tolerance = 0.5;
  const dims = obj?.dims;
  if (!dims) {
    return null;
  }

  return family.find((candidate) => {
    const candidateDims = candidate.dims || {};
    const compare = (axis) =>
      typeof dims[axis] === "number" &&
      typeof candidateDims[axis] === "number" &&
      Math.abs(dims[axis] - candidateDims[axis]) <= tolerance;
    const axes = ["w", "h", "d"];
    return axes.every((axis) => {
      if (typeof dims[axis] !== "number" || typeof candidateDims[axis] !== "number") {
        return true;
      }
      return compare(axis);
    });
  });
};

export const ensureObjectConnectors = (obj) => {
  if (!obj) {
    return obj;
  }

  const preset = findPresetForObject(obj);
  const presetConnectors = preset?.connectors || [];
  const hasConnectors =
    Array.isArray(obj.connectors) && obj.connectors.length > 0;

  // Nothing to hydrate from preset; leave unchanged
  if (!presetConnectors.length) return obj;

  // If object already has connectors, assume they are correct/customized.
  // Only hydrate if missing.
  if (hasConnectors) return obj;

  const shouldReplace = !hasConnectors;

  if (shouldReplace) {
    return {
      ...obj,
      connectors: deepCloneConnectors(presetConnectors),
    };
  }

  // Already has connectors; keep as-is
  return obj;
};

export const ensureSceneConnectors = (objects) => {
  let changed = false;
  const nextObjects = objects.map((obj) => {
    if (!obj) return obj;
    const hydrated = ensureObjectConnectors(obj);
    if (hydrated !== obj) {
      changed = true;
    }
    return hydrated;
  });
  return { objects: nextObjects, changed };
};
