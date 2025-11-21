// utils/presets.js presets and hole maps
const deepClone = (value) => JSON.parse(JSON.stringify(value));

const createMotherboardConnectors = (preset) => {
  const { key, dims, meta = {} } = preset;
  if (!dims) return [];

  const connectors = [];
  const holeMap = Array.isArray(meta.holeMap) ? meta.holeMap : [];

  holeMap.forEach(([x, z], index) => {
    connectors.push({
      id: `${key}-mount-${index + 1}`,
      label: `Mount Hole ${index + 1}`,
      type: "screw-m3",
      slotType: "mb-mount",
      size: 3,
      pos: [x - dims.w / 2, -dims.h / 2, z - dims.d / 2],
      normal: [0, -1, 0],
      up: [0, 0, 1],
    });
  });

  const addSurfaceConnector = ({
    id,
    label,
    x,
    z,
    length = 90,
    type = "pcie-slot",
  }) => {
    connectors.push({
      id,
      label,
      type,
      slotType: type,
      pos: [x, dims.h / 2, z],
      normal: [0, 1, 0],
      up: [0, 0, 1],
      span: length,
    });
  };

  if (key === "itx") {
    const pcieCenter = [
      -dims.w / 2 + 2.5 + 3,
      dims.h / 2,
      -dims.d / 2 + 42 + 89.5 / 2,
    ];
    addSurfaceConnector({
      id: `${key}-pcie-x16`,
      label: "PCIe x16 Slot",
      x: pcieCenter[0],
      z: pcieCenter[2],
      length: 89.5,
    });

    const ramX =
      dims.w / 2 - (meta?.ramSlots?.fromRight ?? 14) - 127 / 2;
    const ramZStart = -dims.d / 2 + (meta?.ramSlots?.fromTop ?? 139) + 6 / 2;
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
      matx: { x: -dims.w / 2 + 15, z: -dims.d / 2 + dims.d * 0.32 },
      atx: { x: -dims.w / 2 + 18, z: -dims.d / 2 + dims.d * 0.34 },
    };
    const { x, z } = pcieOffsets[key] || {
      x: -dims.w / 2 + 15,
      z: 0,
    };
    addSurfaceConnector({
      id: `${key}-pcie-x16`,
      label: "PCIe x16 Slot",
      x,
      z,
    });

    const ramCount = key === "atx" ? 4 : 2;
    const ramX = dims.w / 2 - 20;
    const ramBase = dims.d / 2 - 60;
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
  const pcie = meta.pcie || {};

  const fingerLength = pcie.fingerLength ?? 89;
  const fingerThickness = pcie.fingerThickness ?? 1.6;
  const fingerDepth = pcie.fingerDepth ?? 5;
  const fingerOffsetFromBracket = pcie.fingerOffsetFromBracket ?? 11;
  const fingerDrop = pcie.fingerDrop ?? 0;

  const connectors = [
    {
      id: `${key}-pcie-fingers`,
      label: "PCIe Fingers",
      type: "pcie-fingers",
      pos: [
        dims.d / 2 - fingerDepth / 2,
        -dims.h / 2 + fingerThickness / 2 + fingerDrop,
        dims.w / 2 - fingerLength / 2 - fingerOffsetFromBracket,
      ],
      normal: [1, 0, 0],
      up: [0, 0, -1],
      span: fingerLength,
    },
  ];

  const bracketHoleOffsetY = Math.min(dims.h / 2 - 5, 15);
  const bracketHoleZ = -dims.w / 2 + 10;

  connectors.push(
    {
      id: `${key}-bracket-upper`,
      label: "Bracket Tab Upper",
      type: "bracket-tab",
      pos: [-dims.d / 2, bracketHoleOffsetY, bracketHoleZ],
      normal: [1, 0, 0],
      up: [0, 0, -1],
    },
    {
      id: `${key}-bracket-lower`,
      label: "Bracket Tab Lower",
      type: "bracket-tab",
      pos: [-dims.d / 2, -bracketHoleOffsetY, bracketHoleZ],
      normal: [-1, 0, 0],
      up: [0, 1, 0],
    }
  );

  return connectors;
};

const createRamConnectors = (preset) => {
  const { key, dims, meta = {} } = preset;
  if (!dims) return [];
  const fingerThickness = meta.fingerThickness ?? 1;
  const fingerOffset = meta.fingerOffset ?? 0;

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
      dims: { w: 267, h: 42, d: 112 },
      meta: {
        presetKey: "std",
        layoutVersion: 1,
        pcie: {
          fingerLength: 89,
          fingerThickness: 1.6,
          fingerDepth: 5,
          fingerOffsetFromBracket: 11,
          fingerDrop: 1.2,
        },
        bracket: {
          width: 19.05,
          height: 120,
          thickness: 2,
        },
        pcb: {
          thickness: 1.6,
          clearanceAbove: 10,
          insetFromBottom: 7,
        },
      },
      connectors: [],
    },
    {
      key: "large",
      label: "GPU 313×140×62",
      dims: { w: 313, h: 62, d: 140 },
      meta: {
        presetKey: "large",
        layoutVersion: 1,
        pcie: {
          fingerLength: 89,
          fingerThickness: 1.6,
          fingerDepth: 5.5,
          fingerOffsetFromBracket: 11,
          fingerDrop: 1.4,
        },
        bracket: {
          width: 19.05,
          height: 120,
          thickness: 2,
        },
        pcb: {
          thickness: 1.6,
          clearanceAbove: 12,
          insetFromBottom: 8,
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
      meta: { count: 1 },
      connectors: [],
    },
    {
      key: "dimm2",
      label: "RAM (2) 133×31×7×2",
      dims: { w: 133, h: 31, d: 14 },
      meta: { count: 2 },
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
  box: [
    { key: "cube50", label: "Box 50×50×50", dims: { w: 50, h: 50, d: 50 } },
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


