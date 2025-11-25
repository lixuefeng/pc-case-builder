import * as THREE from "three";
import {
  buildMotherboardLayout,
  getMotherboardIoCutoutBounds,
} from "../config/motherboardPresets";
import { GPU_BRACKET_SPEC } from "./gpuBracketSpec";

const computeCenterFromEdges = (dims, size, feature) => {
  let x = 0;
  if (typeof feature.fromLeft === "number") {
    x = -dims.w / 2 + feature.fromLeft + size.w / 2;
  } else if (typeof feature.fromRight === "number") {
    x = dims.w / 2 - feature.fromRight - size.w / 2;
  } else if (typeof feature.centerX === "number") {
    x = feature.centerX;
  }

  let z = 0;
  if (typeof feature.fromTop === "number") {
    z = -dims.d / 2 + feature.fromTop + size.d / 2;
  } else if (typeof feature.fromBottom === "number") {
    z = dims.d / 2 - feature.fromBottom - size.d / 2;
  } else if (typeof feature.centerZ === "number") {
    z = feature.centerZ;
  }

  return [x, z];
};

const featureToEmbed = (feature, dims, key, label) => {
  if (!feature?.size) return null;
  const [x, z] = computeCenterFromEdges(dims, feature.size, feature);
  const offsetY = feature.offsetY ?? 0;
  const extrudeBelow = Math.max(0, feature.extrudeBelow ?? 0);
  const extrudeAbove = Math.max(0, feature.extrudeAbove ?? 0);
  const height = feature.size.h + extrudeAbove + extrudeBelow;
  const centerY = (feature.size.h + extrudeAbove - extrudeBelow) / 2 + offsetY;

  return {
    key,
    name: label,
    localCenter: [x, centerY, z],
    size: [feature.size.w, height, feature.size.d],
    color: feature.color || "#475569",
  };
};

export const buildMotherboardEmbeddedParts = (obj) => {
  if (!obj?.dims) return [];
  const dims = obj.dims;
  const parts = [];
  const layout = buildMotherboardLayout(obj);

  if (layout?.cpuKeepout) {
    parts.push(featureToEmbed(layout.cpuKeepout, dims, "cpu-keepout", "CPU Keepout"));
  }
  if (layout?.cpuSocket) {
    parts.push(featureToEmbed(layout.cpuSocket, dims, "cpu-socket", "CPU Socket"));
  }
  if (layout?.ramSlots?.size) {
    const { size, anchor = "left", colors = [] } = layout.ramSlots;
    const count = layout.ramSlots.count ?? 2;
    const offsetY = layout.ramSlots.offsetY ?? 0;
    const isRowAlongZ = size.w >= size.d;
    const slotThickness = isRowAlongZ ? size.d : size.w;
    const spacing = slotThickness + 3;

    for (let index = 0; index < count; index += 1) {
      let x = 0;
      if (anchor === "right") {
        const rightBase =
          dims.w / 2 - (layout.ramSlots.fromRight ?? 0) - size.w / 2;
        x = isRowAlongZ ? rightBase : rightBase - index * spacing;
      } else {
        const leftBase =
          -dims.w / 2 + (layout.ramSlots.fromLeft ?? 0) + size.w / 2;
        x = isRowAlongZ ? leftBase : leftBase + index * spacing;
      }

      let z = 0;
      if (typeof layout.ramSlots.fromTop === "number") {
        const topBase =
          -dims.d / 2 + layout.ramSlots.fromTop + size.d / 2;
        z = isRowAlongZ ? topBase + index * spacing : topBase;
      } else if (typeof layout.ramSlots.fromBottom === "number") {
        const bottomBase =
          dims.d / 2 - layout.ramSlots.fromBottom - size.d / 2;
        z = isRowAlongZ ? bottomBase - index * spacing : bottomBase;
      }

      const y = size.h / 2 + offsetY;
      const colorAlt = colors[index % colors.length] || "#cbd5f5";

      parts.push({
        key: `ram-slot-${index}`,
        name: `RAM Slot ${index + 1}`,
        localCenter: [x, y, z],
        size: [size.w, size.h, size.d],
        color: colorAlt,
      });
    }
  }
  if (Array.isArray(layout?.powerConnectors)) {
    layout.powerConnectors.forEach((connector) => {
      parts.push(
        featureToEmbed(connector, dims, connector.key || `power-${connector.key}`, connector.key)
      );
    });
  }
  if (Array.isArray(layout?.pcieSlots)) {
    layout.pcieSlots.forEach((slot, index) => {
      parts.push(featureToEmbed(slot, dims, `${slot.key || "pcie"}-${index}`, `PCIe ${index + 1}`));
    });
  }
  if (layout?.chipset) {
    parts.push(featureToEmbed(layout.chipset, dims, "chipset", "Chipset"));
  }

  const ioCutout = getMotherboardIoCutoutBounds(dims);
  if (ioCutout) {
    parts.push({
      key: "io-cutout",
      name: "IO Cutout",
      localCenter: ioCutout.center,
      size: ioCutout.size,
      color: "#fb923c",
    });
  }

  return parts.filter(Boolean);
};

export const buildGpuEmbeddedParts = (obj) => {
  if (!obj?.dims) return [];
  const dims = obj.dims;
  const parts = [];

  // 1. Bracket
  // The bracket is usually at the back (Z-min or Z-max depending on orientation, but here we assume standard)
  // In presets.js, bracket holes are at bracketHoleZ = -dims.w / 2 + 10.
  // So the bracket is at the -dims.w / 2 end.

  const bracketCenterX = -(dims.w / 2) + GPU_BRACKET_SPEC.xOffset;
  const bracketCenterY =
    -dims.h / 2 - GPU_BRACKET_SPEC.dropBelowBody + GPU_BRACKET_SPEC.height / 2;

  parts.push({
    key: "bracket",
    name: "PCIe Bracket",
    type: "gpu-bracket",
    localCenter: [bracketCenterX, bracketCenterY, 0],
    size: [
      GPU_BRACKET_SPEC.thickness,
      GPU_BRACKET_SPEC.height,
      GPU_BRACKET_SPEC.width,
    ],
    color: "#e2e8f0",
  });

  return parts;
};

export const expandObjectsWithEmbedded = (objects) => {
  const expanded = [];
  const embedCounters = new Map();
  const existingIds = new Set(objects.map((obj) => obj?.id).filter(Boolean));

  objects.forEach((obj) => {
    expanded.push(obj);

    if (obj?.type === "motherboard" && obj?.dims) {
      const embeds = buildMotherboardEmbeddedParts(obj);
      processEmbeds(embeds, obj, expanded, embedCounters, existingIds);
    } else if (obj?.type === "gpu" && obj?.dims) {
      const embeds = buildGpuEmbeddedParts(obj);
      processEmbeds(embeds, obj, expanded, embedCounters, existingIds);
    }
  });

  return expanded;
};

const processEmbeds = (embeds, obj, expanded, embedCounters, existingIds) => {
  const parentPos = new THREE.Vector3(
    ...(Array.isArray(obj.pos) ? obj.pos : [0, 0, 0])
  );
  const parentEuler = new THREE.Euler(
    ...(Array.isArray(obj.rot) ? obj.rot : [0, 0, 0]),
    "XYZ"
  );
  const parentQuat = new THREE.Quaternion().setFromEuler(parentEuler);

  embeds.forEach((embed) => {
    const localCenter = new THREE.Vector3(...embed.localCenter);
    const worldCenter = parentPos.clone().add(localCenter.clone().applyQuaternion(parentQuat));

    const baseKey = `${obj.id}__embed_${embed.key}`;
    const embedIndex = embedCounters.get(baseKey) ?? 0;
    embedCounters.set(baseKey, embedIndex + 1);

    const embedId = `${baseKey}_${embedIndex}`;
    if (existingIds.has(embedId)) {
      return;
    }
    existingIds.add(embedId);

    expanded.push({
      id: embedId,
      name: embed.name,
      type: embed.type || "embedded", // Use specific type if provided
      embeddedParentId: obj.id,
      dims: { w: embed.size[0], h: embed.size[1], d: embed.size[2] },
      pos: worldCenter.toArray(),
      rot: Array.isArray(obj.rot) ? [...obj.rot] : [0, 0, 0],
      color: embed.color || "#94a3b8",
      visible: obj.visible,
      includeInExport: false,
      // Pass through any other props needed for rendering
      parentDims: obj.dims, // Useful for bracket to know full size?
    });
  });
};

export { computeCenterFromEdges };
