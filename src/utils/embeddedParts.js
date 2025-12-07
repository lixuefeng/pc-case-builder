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
  // centerY is relative to the board's center (y=0).
  // If offsetY is provided, it shifts the center.
  // To place on top surface (y = dims.h/2), offsetY should be dims.h/2 + size.h/2.
  // Current logic: (size.h / 2) + offsetY.
  // If offsetY = dims.h/2 (as set in motherboardPresets), then y = size.h/2 + dims.h/2.
  // This places the BOTTOM of the part at y = dims.h/2 (Surface).
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
      const part = featureToEmbed(slot, dims, `${slot.key || "pcie"}-${index}`, `PCIe ${index + 1}`);
      parts.push(part);
    });
  }
  // Handle IO Shield / Cutout
  // If obj.meta.ioCutout exists, use it. Otherwise fall back to layout.chipset (legacy)
  // Handle IO Shield / Cutout
  // STRICT: Either meta.ioCutout OR layout.ioShield must be present.
  const ioCutout = obj.meta?.ioCutout;
  const layoutIoShield = layout?.ioShield;

  if (ioCutout) {
    // ... [Same ioCutout logic as before, calculating from absolute meta params] ...
    const centerX = (-dims.w / 2) + ioCutout.x + (ioCutout.w / 2);
    const centerY = (dims.h / 2) + ioCutout.y + (ioCutout.h / 2);
    const centerZ = (-dims.d / 2) + ioCutout.z + (ioCutout.depth / 2);

    // Split into Base (Wide/Front) and Protrusion (Narrow/Back)
    // Based on user feedback: Protrusion is towards "Outside".
    // Assuming +Z is Front/Outside? Or -Z?
    // Step 372 Implementation:
    // Body (Narrow) at -Z side (Back).
    // Flange (Wide) at +Z side (Front).
    // Let's replicate this geometry with two independent objects.

    // Total Depth D = ioCutout.depth
    // Recess R = 2.0
    // Base Depth = D - R (Thick)
    // Proto Depth = R (Thin)

    // Original Center Z = centerZ
    // Z Extent: [centerZ - D/2, centerZ + D/2]

    // Part 1: Protrusion (Body/Narrow)
    // Size: [W, H, R]
    // Z Position: Back (Z-min end).
    // Center Z_p = (centerZ - D/2) + R/2

    // Part 2: Base (Flange/Wide)
    // Size: [W + 2K, H + 2K, D - R]
    // Z Position: Front (Z-max end).
    // Center Z_b = (centerZ + D/2) - (D - R)/2 = centerZ + D/2 - D/2 + R/2 = centerZ + R/2 ?
    // Wait: (centerZ - D/2) is back edge.
    // Flange starts at (centerZ - D/2 + R) and ends at (centerZ + D/2).
    // Midpoint = (Start + End) / 2 = (centerZ - D/2 + R + centerZ + D/2) / 2 = (2*centerZ + R) / 2 = centerZ + R/2. Correct.

    const recess = 2.0;
    const keepout = 2.54;

    const protoZ = centerZ - (ioCutout.depth / 2) + (recess / 2);
    const baseZ = centerZ + (recess / 2);

    parts.push({
      key: "io-shield-protrusion",
      name: "IO Shield Protrusion",
      type: "cube", // Use standard box
      localCenter: [centerX, centerY, protoZ],
      size: [ioCutout.w, ioCutout.h, recess],
      color: "#a3a3a3",
    });

    parts.push({
      key: "io-shield-base",
      name: "IO Shield Base",
      type: "cube",
      localCenter: [centerX, centerY, baseZ],
      size: [ioCutout.w + keepout * 2, ioCutout.h + keepout * 2, ioCutout.depth - recess],
      color: "#9ca3af", // Slightly darker
    });
  } else if (layoutIoShield) {
    // ... [Standard layout-based generation] ...
    const part = featureToEmbed(layoutIoShield, dims, "io-shield", "IO Shield");
    const recess = 2.0;
    const keepout = 2.54;
    const { w, h, d } = part.size; // These are array refs? No featureToEmbed returns object with size array
    // part.size is [w, h, d]
    const [W, H, D] = part.size;
    const [cX, cY, cZ] = part.localCenter;

    const protoZ = cZ - (D / 2) + (recess / 2);
    const baseZ = cZ + (recess / 2);

    // Push Protrusion
    parts.push({
      key: "io-shield-protrusion",
      name: "IO Shield Protrusion",
      type: "cube",
      localCenter: [cX, cY, protoZ],
      size: [W, H, recess],
      color: "#a3a3a3"
    });

    // Push Base
    parts.push({
      key: "io-shield-base",
      name: "IO Shield Base",
      type: "cube",
      localCenter: [cX, cY, baseZ],
      size: [W + keepout * 2, H + keepout * 2, D - recess],
      color: "#9ca3af"
    });
  }

  const finalParts = parts.filter(Boolean);
  return finalParts;
};

export const buildGpuEmbeddedParts = (obj) => {
  if (!obj?.dims) return [];
  const dims = obj.dims;
  const parts = [];

  // 1. Bracket
  // The bracket is usually at the back (Z-min or Z-max depending on orientation, but here we assume standard)
  // In presets.js, bracket holes are at bracketHoleZ = -dims.w / 2 + 10.
  // So the bracket is at the -dims.w / 2 end.

  const bracketSpec = obj.meta?.bracket || GPU_BRACKET_SPEC;
  const xOffset = bracketSpec.xOffset ?? GPU_BRACKET_SPEC.xOffset;
  const dropBelowBody = bracketSpec.dropBelowBody ?? GPU_BRACKET_SPEC.dropBelowBody;
  const height = bracketSpec.height ?? GPU_BRACKET_SPEC.height;
  const thickness = bracketSpec.thickness ?? GPU_BRACKET_SPEC.thickness;
  const width = bracketSpec.slotCount
    ? (bracketSpec.slotCount * 20.32) - 2.5
    : (bracketSpec.width || GPU_BRACKET_SPEC.width);

  const bracketCenterX = -(dims.w / 2) + xOffset;
  const bracketCenterY = -dims.h / 2 - dropBelowBody + height / 2;

  parts.push({
    key: "bracket",
    name: "PCIe Bracket",
    type: "gpu-bracket",
    localCenter: [bracketCenterX, bracketCenterY, 0],
    size: [
      thickness,
      height,
      width,
    ],
    color: "#e2e8f0",
    meta: obj.meta, // Pass parent meta so GPUBracketMesh can read config
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
      meta: embed.meta, // Pass meta from embed definition
      // Pass through any other props needed for rendering
      parentDims: obj.dims, // Useful for bracket to know full size?
    });
  });
};

export { computeCenterFromEdges };
