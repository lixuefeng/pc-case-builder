import * as THREE from "three";
import {
  buildMotherboardLayout,
} from "../config/motherboardPresets";
import { GPU_BRACKET_SPEC } from "./gpuBracketSpec";
import { MOTHERBOARD_SPECS, GPU_SPECS } from "../constants";
import { buildGpuFingerPlacement } from "./gpuPcieSpec";

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
  // Use layout preset or fallback to standard ATX specs (custom meta.ioCutout removed)
  const standardIo = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_APERTURE;
  const sourceSpec = layout?.ioShield || standardIo;

  const width = sourceSpec.w || sourceSpec.width || standardIo.w;
  const height = sourceSpec.h || sourceSpec.height || standardIo.h;
  // Custom cutouts might define 'depth', standard calls it 'd'. 
  // For the BODY thickness, we use the recess depth (2mm usually).
  const recess = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_SHIELD_RECESS_DEPTH || 2.0;
  const keepout = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_KEEPOUT || 2.54;

  // 2. Determine Offsets (Anchors)
  // Standard ATX defines these relative to specific board edges
  const verticalOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_VERTICAL_OFFSET || 40.64;     // From Board Top Surface
  const horizontalOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_HORIZONTAL_OFFSET || 2.44; // From Board Right Edge (+X)
  const zOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_Z_OFFSET || 3.43;                  // From Board Back Edge (-Z)

  // 3. Calculate Body Position (Center)
  // X: Anchored to Right Edge (+X) of Motherboard
  const ioCenterX = (dims.w / 2) + horizontalOffset - (width / 2);

  // Y: Anchored to Top Surface (+Y) of Motherboard PCB
  const ioCenterY = (dims.h / 2) + verticalOffset - (height / 2);

  // Z: Anchored to Back Edge (-Z) of Motherboard
  // IO Rear Face = -dims.d/2 - zOffset. Center is + recess/2 from there.
  const ioCenterZ = (-dims.d / 2) - zOffset + (recess / 2);

  parts.push({
    key: "io-body",
    name: "IO Ports Body",
    type: "box",
    localCenter: [ioCenterX, ioCenterY, ioCenterZ],
    size: [width, height, recess],
    color: "#555",
  });

  // 4. Generate Flange (The Inner Keepout/Rim)
  // Flange sits *behind* the plate (+Z relative to plate)
  const totalDepth = sourceSpec.d || sourceSpec.depth || 19;
  const flangeDepth = Math.max(1, totalDepth - recess);

  // Flange starts where Body ends (Z max of body)
  const flangeCenterZ = (ioCenterZ + (recess / 2)) + (flangeDepth / 2);

  parts.push({
    key: "io-flange",
    name: "IO Shield Flange",
    type: "box",
    localCenter: [ioCenterX, ioCenterY, flangeCenterZ],
    size: [width + keepout * 2, height + keepout * 2, flangeDepth],
    color: "#a3a3a3",
  });

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

  // Calculate Z Offset (moved from GpuMeshes.jsx to ensure logical/visual sync)
  const fingerPlacement = buildGpuFingerPlacement({ dims: obj.dims, pcie: obj.meta?.pcie || {} });
  const fingerZ = fingerPlacement.center[2];
  const bracketBaseZ = fingerZ + GPU_SPECS.ALIGNMENT_OFFSET;
  const slotCount = bracketSpec.slotCount || 1;
  // GroupZ + LocalSlot0 = bracketBaseZ => GroupZ = bracketBaseZ + Offset.
  const zOffset = (slotCount > 1 ? +((slotCount - 1) * GPU_SPECS.SLOT_PITCH) / 2 : 0) + bracketBaseZ;

  parts.push({
    key: "bracket",
    name: "PCIe Bracket",
    type: "gpu-bracket",
    localCenter: [bracketCenterX, bracketCenterY, zOffset],
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
