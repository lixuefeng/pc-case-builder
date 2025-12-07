import * as THREE from "three";
import {
  buildMotherboardLayout,
  getMotherboardIoCutoutBounds,
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

  console.log("DEBUG: buildMotherboardEmbeddedParts called", {
    id: obj.id,
    hasIoCutout: !!obj.meta?.ioCutout,
    hasLayoutIoShield: !!layout?.ioShield,
    layoutKeys: layout ? Object.keys(layout) : 'null'
  });

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
    // RESTORED VARIABLES
    // Original centerY calculation (might be unused for body Y, but kept for safety if needed later or just removed if truly unused, but centerZ IS needed)
    // const centerY = (dims.h / 2) + ioCutout.y + (ioCutout.h / 2); // Replaced by bodyCenterY later
    const centerZ = (-dims.d / 2) + ioCutout.z + (ioCutout.depth / 2);

    const recess = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_SHIELD_RECESS_DEPTH || 2.0;
    const keepout = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_KEEPOUT || 2.54;
    const verticalOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_VERTICAL_OFFSET || 40.64;
    const horizontalOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_HORIZONTAL_OFFSET || 2.44;
    const zOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_Z_OFFSET || 3.43;

    // SWAPPED DIMENSIONS for correct orientation on -X face (YZ Plane Alignment)
    // Size X = bodyD (Thickness)
    // Size Y = ioCutout.h
    // Size Z = ioCutout.w (Length along Z)

    // Calculate X based on correct ATX Rear placement (Left/-X side)
    // Motherboard -x = -dims.w / 2
    // IO Body -x (Right side of part relative to center) = centerX - (bodyD / 2)?
    // The part is centered at centerX. Its X-extent is [centerX - bodyD/2, centerX + bodyD/2].
    // We want the OUTER face (-x local? or +x local?) relative to motherboards -x face.
    // Let's assume user wants the OUTER face of the shield (facing away from board center) to be 2.44mm from Mobo Edge.
    // Mobo Edge = -dims.w/2.
    // If shield is inside, its MIN X is > Mobo Min X.
    // Shield Min X = centerX - bodyD/2.
    // (centerX - bodyD/2) - (-dims.w/2) = horizontalOffset.
    // Calculate X based on request: Distance between IO-Body +x face and Motherboard +x face is 2.44mm
    // Motherboard +x = dims.w / 2
    // IO Body Width is X (ioCutout.w)
    // Body Min X (Outer Face? No, X is width, usually center aligned?)
    // Wait, if it's on the RIGHT (+X) side, the OUTER face is +X.
    // Body Max X = centerX + Width/2.
    // Body Max X = Mobo Max X + horizontalOffset.
    // centerX + Width/2 = dims.w/2 + horizontalOffset.
    // centerX = dims.w/2 + horizontalOffset - ioCutout.w / 2
    const centerX = (dims.w / 2) + horizontalOffset - (ioCutout.w / 2);

    // Calculate Y based on vertical offset (from top surface of motherboard)
    // Target: Top edge of IO Body = Top Surface + verticalOffset
    // centerY = (Top Surface) + verticalOffset - (BodyHeight / 2)
    const bodyCenterY = (dims.h / 2) + verticalOffset - (ioCutout.h / 2);

    // Calculate Z based on request: Distance between IO-Body -z face and Motherboard -z face is 3.43mm
    // Motherboard -z = -dims.d / 2
    // IO Body Thickness is Z (bodyD)
    // Body Min Z (Rear Face) = bodyZ - bodyD / 2.
    // Body Min Z = Mobo Min Z - zOffset. (Protruding backwards)
    // bodyZ - bodyD / 2 = -dims.d / 2 - zOffset.
    // bodyZ = -dims.d / 2 - zOffset + bodyD / 2.
    const bodyZ = -zOffset - (dims.d / 2) + (bodyD / 2);

    console.log("DEBUG: IO Body (Cutout Path)", {
      dims,
      ioCutout,
      offsets: { verticalOffset, horizontalOffset, zOffset },
      calculated: { centerX, bodyCenterY, bodyZ },
      raw: {
        minX: centerX - bodyD / 2,
        maxX: centerX + bodyD / 2,
        minZ: bodyZ - ioCutout.w / 2,
        maxZ: bodyZ + ioCutout.w / 2,
      }
    });

    parts.push({
      key: "io-body",
      name: "IO Ports Body",
      type: "box",
      localCenter: [centerX, bodyCenterY, bodyZ],
      size: [bodyD, ioCutout.h, ioCutout.w], // Swapped W/D
      color: "#555",
    });

    parts.push({
      key: "io-flange",
      name: "IO Shield Flange",
      type: "box",
      // Shift Flange inwards (+X direction)
      localCenter: [centerX + (bodyD + flangeD) / 2, bodyCenterY, bodyZ],
      size: [flangeD, ioCutout.h + keepout * 2, ioCutout.w + keepout * 2],
      color: "#a3a3a3",
    });

  } else if (layoutIoShield) {
    // Standard Layout Path
    // RESTORED VARIABLES
    // Use originalX to avoid name collision with new 'x'
    const [originalX, z] = computeCenterFromEdges(dims, layoutIoShield.size, layoutIoShield);
    const offsetY = layoutIoShield.offsetY ?? 0;

    const recess = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_SHIELD_RECESS_DEPTH || 2.0;
    const keepout = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_KEEPOUT || 2.54;
    const verticalOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_VERTICAL_OFFSET || 40.64;
    const horizontalOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_HORIZONTAL_OFFSET || 2.44;
    const zOffset = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_BODY_Z_OFFSET || 3.43;

    const depth = layoutIoShield.size.d || 19;
    const bodyD = recess;
    const flangeD = depth - recess;
    // REVERTED to Z-Face Alignment (Standard ATX Orientation)
    // Size X = Width (layoutIoShield.size.w)
    // Size Y = Height
    // Size Z = Thickness (bodyD)

    // Calculate Z based on request: Distance between IO-Body -z face and Motherboard -z face is 3.43mm
    // Motherboard -z = -dims.d / 2
    // IO Body Thickness is Z (bodyD)
    // Body Min Z (Rear Face) = bodyZ - bodyD/2
    // Body Min Z = Mobo Min Z - zOffset (Protruding backwards/outside)
    // bodyZ - bodyD/2 = -dims.d/2 - zOffset
    // bodyZ = -dims.d/2 - zOffset + bodyD/2
    const bodyZ = -zOffset - (dims.d / 2) + (bodyD / 2);

    // Calculate X based on request: Distance between IO-Body +x face and Motherboard +x face is 2.44mm
    // Motherboard +x = dims.w / 2
    // Body Width is X (layoutIoShield.size.w)
    // Body Max X (Right/Outer Face) = x + Width/2
    // Body Max X = Mobo Max X + horizontalOffset (Protruding right/outside)
    // x + width/2 = dims.w/2 + horizontalOffset
    // x = dims.w/2 + horizontalOffset - layoutIoShield.size.w/2
    const x = (dims.w / 2) + horizontalOffset - (layoutIoShield.size.w / 2);

    // Calculate Y based on vertical offset (from top surface of motherboard)
    // Target: Top edge of IO Body = Top Surface + verticalOffset
    const bodyCenterY = (dims.h / 2) + verticalOffset - (layoutIoShield.size.h / 2);

    console.log("DEBUG: IO Body (Standard Layout Path)", {
      dims,
      layoutIoShield,
      offsets: { verticalOffset, horizontalOffset, zOffset },
      calculated: { x, bodyCenterY, bodyZ },
      raw: {
        minX: x - layoutIoShield.size.w / 2,
        maxX: x + layoutIoShield.size.w / 2,
        minZ: bodyZ - bodyD / 2,
        maxZ: bodyZ + bodyD / 2,
      }
    });

    parts.push({
      key: "io-body",
      name: "IO Ports Body",
      type: "box",
      localCenter: [x, bodyCenterY, bodyZ],
      size: [layoutIoShield.size.w, layoutIoShield.size.h, bodyD], // Standard [W, H, D]
      color: "#555",
    });

    parts.push({
      key: "io-flange",
      name: "IO Shield Flange",
      type: "box",
      // Shift Flange INWARDS (+Z) to sit behind the Body faceplate
      // Body Center = bodyZ. Body Max Z = bodyZ + bodyD/2.
      // Flange Min Z = Body Max Z.
      // Flange Center = Flange Min Z + flangeD/2 = bodyZ + bodyD/2 + flangeD/2
      localCenter: [x, bodyCenterY, bodyZ + (bodyD + flangeD) / 2],
      size: [layoutIoShield.size.w + keepout * 2, layoutIoShield.size.h + keepout * 2, flangeD], // Swapped W/D
      color: "#a3a3a3",
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
