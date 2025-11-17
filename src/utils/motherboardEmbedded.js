import * as THREE from "three";
import {
  buildMotherboardLayout,
  getMotherboardIoCutoutBounds,
} from "../config/motherboardPresets";

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

export const expandObjectsWithEmbedded = (objects) => {
  const expanded = [];
  objects.forEach((obj) => {
    expanded.push(obj);
    if (obj?.type !== "motherboard" || !obj?.dims) return;

    const embeds = buildMotherboardEmbeddedParts(obj);
    const parentPos = new THREE.Vector3(
      ...(Array.isArray(obj.pos) ? obj.pos : [0, 0, 0])
    );
    const parentEuler = new THREE.Euler(
      ...(Array.isArray(obj.rot) ? obj.rot : [0, 0, 0]),
      "XYZ"
    );
    const parentQuat = new THREE.Quaternion().setFromEuler(parentEuler);

    embeds.forEach((embed, index) => {
      const localCenter = new THREE.Vector3(...embed.localCenter);
      const worldCenter = parentPos.clone().add(localCenter.clone().applyQuaternion(parentQuat));

      expanded.push({
        id: `${obj.id}__embed_${embed.key}_${index}`,
        name: embed.name,
        type: "embedded",
        embeddedParentId: obj.id,
        dims: { w: embed.size[0], h: embed.size[1], d: embed.size[2] },
        pos: worldCenter.toArray(),
        rot: Array.isArray(obj.rot) ? [...obj.rot] : [0, 0, 0],
        color: embed.color || "#94a3b8",
        visible: obj.visible,
        includeInExport: false,
      });
    });
  });

  return expanded;
};

export { computeCenterFromEdges };
