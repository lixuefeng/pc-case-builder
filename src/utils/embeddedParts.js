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
      console.log(`[EmbeddedParts] PCIe Slot ${index} fromLeft:`, slot.fromLeft);
      console.log(`[EmbeddedParts] PCIe Slot ${index} Calculated Center:`, part.localCenter);
      parts.push(part);
    });
  }
  // Handle IO Shield / Cutout
  // If obj.meta.ioCutout exists, use it. Otherwise fall back to layout.chipset (legacy)
  const ioCutout = obj.meta?.ioCutout;
  if (ioCutout) {
    // Map from our {x, y, z, w, h, depth} to embedded part format
    // x is from left edge of board (assuming board center is 0,0)
    // z is from top edge of board
    // We need to convert to localCenter relative to board center

    // Board dimensions
    const boardW = dims.w;
    const boardH = dims.h; // Thickness
    const boardD = dims.d;

    // Calculate center based on top-left-back anchor
    // Top-Left-Back is at: x = -boardW/2, y = boardH/2, z = -boardD/2
    // Our ioCutout.x/z are offsets from there.
    // However, in our presets, we defined x/z as 0,0 for default.
    // And we want it to be at the "IO area".

    // Let's interpret x/z as offsets from the Top-Left corner of the board.
    // x: positive right
    // z: positive forward (down in 2D)

    const centerX = (-boardW / 2) + ioCutout.x + (ioCutout.w / 2);
    // y is offset from surface?
    // If board is at 0, surface is at boardH/2.
    // So centerY = boardH/2 + ioCutout.y + ioCutout.h/2 ? 
    // Wait, ioCutout.h is the height of the shield (vertical).
    // ioCutout.depth is the thickness (Z-depth in local terms? No, depth usually means thickness).

    // Let's stick to the coordinate system we visualized:
    // w = width (along X)
    // h = height (along Y, vertical)
    // depth = thickness (along Z)

    // But wait, IO shield is usually along the back edge (Z-min).
    // So its "thickness" is along Z. Its "width" is along X. Its "height" is along Y.

    const centerY = (boardH / 2) + ioCutout.y + (ioCutout.h / 2);
    const centerZ = (-boardD / 2) + ioCutout.z + (ioCutout.depth / 2);

    parts.push({
      key: "io-shield",
      name: "IO Shield",
      localCenter: [centerX, centerY, centerZ],
      size: [ioCutout.w, ioCutout.h, ioCutout.depth],
      color: "#a3a3a3",
    });
  } else if (layout?.chipset) {
    parts.push(featureToEmbed(layout.chipset, dims, "chipset", "Chipset"));
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
