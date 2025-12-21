// utils/presets.js presets and hole maps
const deepClone = (value) => JSON.parse(JSON.stringify(value));

import { anchorPoint, addVec } from "./anchors";
import { buildGpuFingerPlacement } from "./gpuPcieSpec";
import { MOTHERBOARD_SPECS, RAM_SPECS, PSU_SPECS, PCIE_SPECS, GPU_SPECS, COOLER_SPECS, REFERENCE_OBJECT_SPECS, COLORS, PSU_HOLE_LAYOUTS } from "../constants";

const requireParam = (value, name) => {
  if (value === undefined || value === null) {
    throw new Error(`Missing preset parameter: ${name}`);
  }
  return value;
};

const PCIE_SLOT_SPEC = Object.freeze({
  slotHeightMm: PCIE_SPECS.SLOT_HEIGHT, // assumed PCIe slot height above motherboard surface
  contactOffsetMm: PCIE_SPECS.CONTACT_OFFSET, // desired insertion depth from slot top
});

const createMotherboardConnectors = (preset) => {
  const { key, dims, meta = {} } = preset;
  if (!dims) return [];

  const connectors = [];
  const holeMap = Array.isArray(meta.holeMap) ? meta.holeMap : [];

  // Use same anchor logic as Meshes.jsx (topRightBack + anchorOffset)
  const topRightBack = anchorPoint(dims, "top-right-back");
  const anchorOffset = MOTHERBOARD_SPECS.ANCHOR || { x: 0, y: 0 };

  const posFromAnchor = (relX, relZ) => addVec(topRightBack, [
    relX + anchorOffset.x,
    -dims.h / 2,  // Position at board surface (same Y as screw holes)
    relZ + anchorOffset.y
  ]);

  holeMap.forEach(([relX, relZ], index) => {
    connectors.push({
      id: `${key}-mount-${index + 1}`,
      label: `Mount Hole ${index + 1}`,
      type: "screw-m3",
      slotType: "mb-mount",
      size: 3,
      pos: posFromAnchor(relX, relZ),
      normal: [0, -1, 0],
      up: [0, 0, 1],
    });
  });

  // Keep topLeftBack for surface connectors (PCIe, RAM slots)
  const topLeftBack = anchorPoint(dims, "top-left-back");
  const posFromTopLeftBack = (offset) => addVec(topLeftBack, offset);

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

  // Standardized ATX PCIe Slot 1 Position
  // ATX Hole F/H is at 6.45" (163.83mm) from Top.
  // Origin (-w/2) is Bottom. Top is (+w/2).
  // So position from Top is w - 163.83.
  const pcieX = dims.w - MOTHERBOARD_SPECS.ATX_HOLE_FH_TOP_OFFSET; // 163.83
  const pcieZ = PCIE_SPECS.FINGER_OFFSET_FROM_BRACKET + (PCIE_SPECS.FINGER_LENGTH / 2); // 45.5 + 44.75

  const slotY = (dims.h / 2) + PCIE_SLOT_SPEC.slotHeightMm - PCIE_SLOT_SPEC.contactOffsetMm;

  // Add primary PCIe x16 slot for all form factors
  addSurfaceConnector({
    id: `${key}-pcie-x16`,
    label: "PCIe x16 Slot",
    x: pcieX,
    z: pcieZ,
    length: PCIE_SPECS.FINGER_LENGTH,
    type: "pcie-slot",
    y: slotY,
  });

  if (key === "itx") {
    const ramFromRight = requireParam(meta?.ramSlots?.fromRight, "meta.ramSlots.fromRight");
    const ramFromTop = requireParam(meta?.ramSlots?.fromTop, "meta.ramSlots.fromTop");

    const ramX = dims.w - ramFromRight - RAM_SPECS.SLOT_LENGTH_ITX / 2;
    const ramZStart = ramFromTop + RAM_SPECS.DIMM.d / 2; // 6/2 = 3? Wait, DIMM.d is 7 in constants but 6 in motherboardPresets. Let's use constant.
    const ramSpacing = RAM_SPECS.SPACING_ITX;

    ["A", "B"].forEach((slot, idx) => {
      addSurfaceConnector({
        id: `${key}-ram-slot-${slot.toLowerCase()}`,
        label: `RAM Slot ${slot}`,
        x: ramX,
        z: ramZStart + idx * ramSpacing,
        length: RAM_SPECS.SLOT_LENGTH_ITX,
        type: "dimm-slot",
      });
    });
  } else {
    const ramCount = key === "atx" ? 4 : 2;
    const ramX = dims.w - 20;
    const ramBase = dims.d - 60;
    const ramSpacing = RAM_SPECS.SPACING_ATX;

    for (let i = 0; i < ramCount; i += 1) {
      addSurfaceConnector({
        id: `${key}-ram-slot-${i + 1}`,
        label: `RAM Slot ${i + 1}`,
        x: ramX,
        z: ramBase - i * ramSpacing,
        length: RAM_SPECS.SLOT_LENGTH_ATX,
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

  // Use holeMap if available, else fallback to calculate generic mounts
  const holeMap = preset.meta?.holeMap;

  if (holeMap) {
    const { w, h, d } = dims;
    // Convert layout (Bottom-Left Origin) to mesh local space (Center Origin)
    // Mesh local: Center is (0,0,0). Width is X (-w/2 to w/2). Height is Y (-h/2 to h/2).
    // Layout X: 0..w -> -w/2..w/2 (x - w/2)
    // Layout Y: 0..h -> -h/2..h/2 (y - h/2)
    // Z: Rear face is -d/2

    return holeMap.map(([lx, ly], index) => {
      return {
        id: `${key}-mount-${index + 1}`,
        label: `PSU Mount ${index + 1}`,
        type: "screw-m3", // Changed to M3 based on user feedback (standard is often #6-32, but M3 is requested)
        size: 3,
        pos: [lx - w / 2, ly - h / 2, d / 2],
        normal: [0, 0, -1],
        up: [0, 1, 0],
      };
    });
  }

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
    type: "screw-m3",
    size: 3,
    pos: [x, y, faceZ],
    normal: [0, 0, -1],
    up: [1, 0, 0],
  }));
};

export const ITX_HOLES_MM = MOTHERBOARD_SPECS.ITX_HOLES;

export const PRESETS = {
  motherboard: [
    (() => {
      const preset = {
        key: "itx",
        label: "ITX 170×170",
        dims: { w: MOTHERBOARD_SPECS.DIMENSIONS.ITX.w, h: 2, d: MOTHERBOARD_SPECS.DIMENSIONS.ITX.d },
        meta: {
          presetKey: "itx",
          holeMap: ITX_HOLES_MM,
          ramSlots: { fromRight: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.RAM_OFFSET_RIGHT, fromTop: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.RAM_OFFSET_TOP },
          // ioCutout removed to use central definition from motherboardPresets.js
        },
      };
      preset.connectors = createMotherboardConnectors(preset);
      return preset;
    })(),
    {
      key: "matx",
      label: "mATX 244×244",
      dims: { w: MOTHERBOARD_SPECS.DIMENSIONS.MATX.w, h: 2, d: MOTHERBOARD_SPECS.DIMENSIONS.MATX.d },
      meta: {
        presetKey: "matx",
        holeMap: MOTHERBOARD_SPECS.MATX_HOLES,
      },
      connectors: [],
    },
    {
      key: "atx",
      label: "ATX 305×244",
      dims: { w: MOTHERBOARD_SPECS.DIMENSIONS.ATX.w, h: 2, d: MOTHERBOARD_SPECS.DIMENSIONS.ATX.d },
      meta: {
        presetKey: "atx",
        holeMap: MOTHERBOARD_SPECS.ATX_HOLES,
      },
      connectors: [],
    },
  ],
  gpu: [
    {
      key: "std",
      label: "GPU 267×112×42",
      type: "gpu", // Changed to gpu to use GPUMesh
      dims: GPU_SPECS.DEFAULT_DIMS, // Body dimensions
      meta: {
        presetKey: "std",
        layoutVersion: 2,
        pcie: {
          fingerLength: PCIE_SPECS.FINGER_LENGTH,
          fingerHeight: PCIE_SPECS.FINGER_HEIGHT,
          fingerThickness: PCIE_SPECS.FINGER_THICKNESS,
          fingerOffsetFromBracket: PCIE_SPECS.FINGER_OFFSET_FROM_BRACKET,
          fingerDrop: PCIE_SPECS.FINGER_DROP, // 7mm offset to raise GPU body 5.5mm above PCB (12.5 - 7 = 5.5 insertion)
          __debugLog: true,
        },
        bracket: {
          slotCount: 2,
          height: GPU_SPECS.BRACKET.HEIGHT,
          thickness: GPU_SPECS.BRACKET.THICKNESS,
          dropBelowBody: GPU_SPECS.BRACKET.DROP_BELOW_BODY,
          xOffset: GPU_SPECS.BRACKET.X_OFFSET
        }
      },
      connectors: [],
    },
  ],


  psu: [
    {
      key: "sfx",
      label: "SFX 125×63.5×100",
      dims: PSU_SPECS.SFX,
      type: "psu",
      meta: { standard: "SFX", holeMap: PSU_HOLE_LAYOUTS.SFX },
      connectors: [],
    },
    {
      key: "atx",
      label: "ATX 150×86×140",
      dims: PSU_SPECS.ATX,
      type: "psu",
      meta: { standard: "ATX", holeMap: PSU_HOLE_LAYOUTS.ATX },
      connectors: [],
    },
  ],
  ram: [
    {
      key: "dimm",
      label: "RAM (1) 133×31×7",
      dims: RAM_SPECS.DIMM,
      meta: { count: 1, fingerThickness: 1, fingerOffset: 0 },
      connectors: [],
    },
    {
      key: "dimm2",
      label: "RAM (2) 133×31×7×2",
      dims: { ...RAM_SPECS.DIMM, d: RAM_SPECS.DIMM.d * 2 },
      meta: { count: 2, fingerThickness: 1, fingerOffset: 0 },
      connectors: [],
    },
  ],
  "cpu-cooler": [
    {
      key: "tower-120",
      label: "Tower Cooler 120mm",
      dims: COOLER_SPECS.TOWER_120,
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
  primitives: [
    {
      key: "cube",
      label: "Cube",
      type: "cube",
      dims: { w: 50, h: 50, d: 50 },
      meta: { shape: "cube" },
      connectors: [],
    },
    {
      key: "cylinder",
      label: "Cylinder",
      type: "cylinder",
      dims: { w: 50, h: 50, d: 50 },
      meta: { shape: "cylinder" },
      connectors: [],
    },
    {
      key: "cone",
      label: "Cone",
      type: "cone",
      dims: { w: 50, h: 50, d: 50 },
      meta: { shape: "cone" },
      connectors: [],
    },
  ],
  reference: [
    {
      key: "coke-can",
      label: "Coke Can (330ml)",
      dims: { w: REFERENCE_OBJECT_SPECS.COKE_CAN_DIAMETER, h: REFERENCE_OBJECT_SPECS.COKE_CAN_HEIGHT, d: REFERENCE_OBJECT_SPECS.COKE_CAN_DIAMETER },
      color: COLORS.DEFAULT.RED_PAINT,
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
