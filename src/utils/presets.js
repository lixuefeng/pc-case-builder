// utils/presets.js presets and hole maps
const deepClone = (value) => JSON.parse(JSON.stringify(value));

import { anchorPoint, addVec } from "./anchors";
import { buildGpuFingerPlacement } from "./gpuPcieSpec";

const requireParam = (value, name) => {
  if (value === undefined || value === null) {
    throw new Error(`Missing preset parameter: ${name}`);
  }
  return value;
};

const PCIE_SLOT_SPEC = Object.freeze({
  slotHeightMm: 11, // assumed PCIe slot height above motherboard surface
  contactOffsetMm: 5, // desired insertion depth from slot top
});

const createMotherboardConnectors = (preset) => {
  const { key, dims, meta = {} } = preset;
  if (!dims) return [];

  const connectors = [];
  const holeMap = Array.isArray(meta.holeMap) ? meta.holeMap : [];
  const topLeftBack = anchorPoint(dims, "top-left-back");

  const posFromTopLeftBack = (offset) => addVec(topLeftBack, offset);

  holeMap.forEach(([x, z], index) => {
    connectors.push({
      id: `${key}-mount-${index + 1}`,
      label: `Mount Hole ${index + 1}`,
      type: "screw-m3",
      slotType: "mb-mount",
      size: 3,
      pos: posFromTopLeftBack([x, -dims.h, z]), // drop to board mid-plane
      normal: [0, -1, 0],
      up: [0, 0, 1],
    });
  });

  const addSurfaceConnector = ({
    id,
    label,
    x,
    y = 0,
    z,
    length,
    type,
  }) => {
    const span = requireParam(length, `${id}.length`);
    const slotType = requireParam(type, `${id}.type`);
    connectors.push({
      id,
      label,
      type: slotType,
      slotType,
      pos: posFromTopLeftBack([x, y, z]),
      normal: [0, 1, 0],
      up: [0, 0, 1],
      span,
    });
  };

  if (key === "itx") {
    const ramFromRight = requireParam(meta?.ramSlots?.fromRight, "meta.ramSlots.fromRight");
    const ramFromTop = requireParam(meta?.ramSlots?.fromTop, "meta.ramSlots.fromTop");
    const slotY = (dims.h / 2) + PCIE_SLOT_SPEC.slotHeightMm - PCIE_SLOT_SPEC.contactOffsetMm;

    addSurfaceConnector({
      id: `${key}-pcie-x16`,
      label: "PCIe x16 Slot",
      x: 6.6, // Aligned with visual slot center (3mm fromLeft + 7.2mm width / 2)
      z: 42 + 89.5 / 2,
      length: 89.5,
      type: "pcie-slot",
      y: slotY,
    });

    const ramX = dims.w - ramFromRight - 127 / 2;
    const ramZStart = ramFromTop + 6 / 2;
    const ramSpacing = 9;

    ["A", "B"].forEach((slot, idx) => {
      addSurfaceConnector({
        id: `${key}-ram-slot-${slot.toLowerCase()}`,
        label: `RAM Slot ${slot}`,
        x: ramX,
        z: ramZStart + idx * ramSpacing,
        length: 127,
        type: "dimm-slot",
      });
    });
  } else {
    const pcieOffsets = {
      matx: { x: 15, z: dims.d * 0.32 },
      atx: { x: 18, z: dims.d * 0.34 },
    };
    const { x, z } = pcieOffsets[key] || {
      x: 15,
      z: 0,
    };
    const slotY = (dims.h / 2) + PCIE_SLOT_SPEC.slotHeightMm - PCIE_SLOT_SPEC.contactOffsetMm;
    addSurfaceConnector({
      id: `${key}-pcie-x16`,
      label: "PCIe x16 Slot",
      x,
      z,
      length: 89.5,
      type: "pcie-slot",
      y: slotY,
    });

    const ramCount = key === "atx" ? 4 : 2;
    const ramX = dims.w - 20;
    const ramBase = dims.d - 60;
    const ramSpacing = 10;

    for (let i = 0; i < ramCount; i += 1) {
      addSurfaceConnector({
        id: `${key}-ram-slot-${i + 1}`,
        label: `RAM Slot ${i + 1}`,
        x: ramX,
        z: ramBase - i * ramSpacing,
        length: 130,
        type: "dimm-slot",
      });
    }
  }

  return connectors;
};

const createGpuConnectors = (preset) => {
  const { key, dims, meta = {} } = preset;
  if (!dims) return [];
  const fingerPlacement = buildGpuFingerPlacement({ dims, pcie: meta.pcie || {} });

  return [
    {
      id: `${key}-pcie-fingers`,
      label: "PCIe Fingers",
      type: "pcie-fingers",
      // Lowered connector point encodes desired insertion depth without moving the mesh
      pos: fingerPlacement.connectorPos,
      normal: [0, -1, 0],
      up: [1, 0, 0],
      span: fingerPlacement.length,
    },
  ];
};

const createRamConnectors = (preset) => {
  const { key, dims, meta = {} } = preset;
  if (!dims) return [];
  const fingerThickness = requireParam(meta.fingerThickness, "meta.fingerThickness");
  const fingerOffset = requireParam(meta.fingerOffset, "meta.fingerOffset");

  return [
    {
      id: `${key}-golden-fingers`,
      label: "Golden Fingers",
      type: "dimm-edge",
      pos: [
        0,
        -dims.h / 2 + fingerThickness / 2,
        fingerOffset,
      ],
      normal: [0, -1, 0],
      up: [0, 0, 1],
      span: dims.w,
    },
  ];
};

const createPsuConnectors = (preset) => {
  const { key, dims } = preset;
  if (!dims) return [];

  const mountWidth = Math.min(dims.w - 20, dims.w * 0.8);
  const mountHeight = Math.min(dims.h - 12, dims.h * 0.75);
  const halfWidth = mountWidth / 2;
  const halfHeight = mountHeight / 2;
  const faceZ = -dims.d / 2;

  const positions = [
    [-halfWidth, halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
  ];

  return positions.map(([x, y], index) => ({
    id: `${key}-mount-${index + 1}`,
    label: `PSU Mount ${index + 1}`,
    type: "screw-m4",
    size: 4,
    pos: [x, y, faceZ],
    normal: [0, 0, -1],
    up: [1, 0, 0],
  }));
};

export const ITX_HOLES_MM = [
  [163.83, 33.02], // top left
  [6.35, 10.16],
  [6.35, 165.1],
  [163.5, 165.1],
];

export const PRESETS = {
  motherboard: [
    (() => {
      const preset = {
        key: "itx",
        label: "ITX 170×170",
        dims: { w: 170, h: 2, d: 170 },
        meta: {
          presetKey: "itx",
          holeMap: ITX_HOLES_MM,
          ramSlots: { fromRight: 14, fromTop: 139 },
        },
      };
      preset.connectors = createMotherboardConnectors(preset);
      return preset;
    })(),
    {
      key: "matx",
      label: "mATX 244×244",
      dims: { w: 244, h: 2, d: 244 },
      meta: { presetKey: "matx", holeMap: [] },
      connectors: [],
    },
    {
      key: "atx",
      label: "ATX 305×244",
      dims: { w: 305, h: 2, d: 244 },
      meta: { presetKey: "atx", holeMap: [] },
      connectors: [],
    },
  ],
  gpu: [
    {
      key: "std",
      label: "GPU 267×112×42",
      type: "gpu", // Changed to gpu to use GPUMesh
      dims: { w: 267, h: 112, d: 42 }, // Body dimensions
      meta: {
        presetKey: "std",
        layoutVersion: 2,
        pcie: {
          fingerLength: 89,
          fingerHeight: 12.5,
          fingerThickness: 1.6,
          fingerOffsetFromBracket: 42,
          fingerDrop: -5, // 7mm offset to raise GPU body 5.5mm above PCB (12.5 - 7 = 5.5 insertion)
          __debugLog: true,
        },
      },
      connectors: [],
    },
  ],
  psu: [
    {
      key: "sfx",
      label: "SFX 125×63.5×100",
      dims: { w: 125, h: 63.5, d: 100 },
      meta: { standard: "SFX" },
      connectors: [],
    },
    {
      key: "atx",
      label: "ATX 150×86×140",
      dims: { w: 150, h: 86, d: 140 },
      meta: { standard: "ATX" },
      connectors: [],
    },
  ],
  ram: [
    {
      key: "dimm",
      label: "RAM (1) 133×31×7",
      dims: { w: 133, h: 31, d: 7 },
      meta: { count: 1, fingerThickness: 1, fingerOffset: 0 },
      connectors: [],
    },
    {
      key: "dimm2",
      label: "RAM (2) 133×31×7×2",
      dims: { w: 133, h: 31, d: 14 },
      meta: { count: 2, fingerThickness: 1, fingerOffset: 0 },
      connectors: [],
    },
  ],
  "cpu-cooler": [
    {
      key: "tower-120",
      label: "Tower Cooler 120mm",
      dims: { w: 125, h: 160, d: 80 },
      meta: { type: "tower" },
      connectors: [],
    },
    {
      key: "custom-160",
      label: "Custom Cooler 160x120x8",
      dims: { w: 120, h: 160, d: 8 }, // User specified 160mm(H?) 120mm(W?) 8mm(D?) - assuming H=160, W=120, D=8 based on request, though D=8 is very thin.
      meta: { type: "custom" },
      connectors: [],
    },
  ],
  structure: [
    {
      key: "cube-50",
      label: "Cube 50mm",
      type: "structure",
      dims: { w: 50, h: 50, d: 50 },
      meta: { shape: "cube" },
      connectors: [],
    },
    {
      key: "custom-block",
      label: "Custom Block",
      type: "structure",
      dims: { w: 100, h: 20, d: 20 }, // Default dims, will be overridden by form
      meta: { shape: "cube", isCustom: true },
      connectors: [],
    },
  ],
  reference: [
    {
      key: "coke-can",
      label: "Coke Can (330ml)",
      dims: { w: 66, h: 115, d: 66 },
      color: "#ef4444",
      meta: { type: "reference" },
      connectors: [],
    },
  ],
};

PRESETS.motherboard.forEach((preset) => {
  if (!preset.connectors || preset.connectors.length === 0) {
    preset.connectors = createMotherboardConnectors(preset);
  } else {
    preset.connectors = deepClone(preset.connectors);
  }
});

PRESETS.gpu.forEach((preset) => {
  if (!preset.connectors || preset.connectors.length === 0) {
    preset.connectors = createGpuConnectors(preset);
  } else {
    preset.connectors = deepClone(preset.connectors);
  }
});

PRESETS.ram.forEach((preset) => {
  if (!preset.connectors || preset.connectors.length === 0) {
    preset.connectors = createRamConnectors(preset);
  } else {
    preset.connectors = deepClone(preset.connectors);
  }
});

PRESETS.psu.forEach((preset) => {
  if (!preset.connectors || preset.connectors.length === 0) {
    preset.connectors = createPsuConnectors(preset);
  } else {
    preset.connectors = deepClone(preset.connectors);
  }
});
