import { MOTHERBOARD_SPECS } from "../constants";

const approxEqual = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;



export const MOTHERBOARD_DIMENSIONS = {
  itx: MOTHERBOARD_SPECS.DIMENSIONS.ITX,
  matx: MOTHERBOARD_SPECS.DIMENSIONS.MATX,
  atx: MOTHERBOARD_SPECS.DIMENSIONS.ATX,
};

const buildStandardAtxLayout = (dims) => {
  const keepoutSize = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.KEEPOUT_SIZE;
  const keepoutLeft = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.KEEPOUT_LEFT;
  const keepoutTop = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.KEEPOUT_TOP;
  const cpuSocketSize = MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.CPU_SOCKET;
  const cpuSocketLeft = keepoutLeft + (keepoutSize - cpuSocketSize.w) / 2;
  const cpuSocketTop = keepoutTop + (keepoutSize - cpuSocketSize.d) / 2;

  return {
    cpuKeepout: {
      size: { w: keepoutSize, h: 1.5, d: keepoutSize },
      fromLeft: keepoutLeft,
      fromTop: keepoutTop,
      color: "#111827",
      opacity: 0.35,
    },
    cpuSocket: {
      size: cpuSocketSize,
      fromLeft: cpuSocketLeft,
      fromTop: cpuSocketTop,
      color: "#475569",
    },
    ramSlots: {
      count: 2,
      size: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.RAM_SLOT,
      fromRight: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.RAM_OFFSET_RIGHT,
      fromTop: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.RAM_OFFSET_TOP,
      pitch: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.RAM_PITCH,
      anchor: "right",
      colors: ["#e2e8f0", "#cbd5f5"],
    },
    powerConnectors: [
      {
        key: "eps8",
        size: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.EPS8,
        fromRight: 0,
        fromTop: 42,
        color: "#1e293b",
      },
      {
        key: "atx24",
        size: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.ATX24,
        fromRight: 11.5,
        fromBottom: 1,
        color: "#334155",
      },
    ],
    pcieSlots: [
      {
        key: "pcie16",
        size: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.PCIE_X16,
        fromLeft: dims.w - MOTHERBOARD_SPECS.ATX_HOLE_FH_TOP_OFFSET - 3.6,
        fromTop: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.PCIE_OFFSET_TOP,
        color: "#1e293b",
        offsetY: dims.h / 2,
      },
    ],
    ioShield: {
      size: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_APERTURE,
      fromLeft: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_APERTURE_OFFSET_LEFT,
      fromTop: MOTHERBOARD_SPECS.LAYOUT_ATX_2_2.IO_APERTURE_OFFSET_TOP,
      color: "#475569",
      offsetY: -5,
    },
  };
};

export const MOTHERBOARD_LAYOUT_BUILDERS = {
  // ATX 2.2 https://cdn.instructables.com/ORIG/FS8/5ILB/GU59Z1AT/FS85ILBGU59Z1AT.pdf
  itx: buildStandardAtxLayout,
  matx: buildStandardAtxLayout,
  atx: buildStandardAtxLayout,
};

export const resolveMotherboardPresetKey = (input) => {
  const dims = input?.dims ? input.dims : input;
  if (!dims?.w || !dims?.d) {
    return null;
  }

  const { w, d } = dims;
  return (
    Object.entries(MOTHERBOARD_DIMENSIONS).find(
      ([, target]) => approxEqual(w, target.w) && approxEqual(d, target.d)
    )?.[0] ?? null
  );
};

export const buildMotherboardLayout = (obj) => {
  if (!obj?.dims) return null;
  if (obj.meta?.layout) return obj.meta.layout;
  const presetKey = obj.meta?.presetKey || resolveMotherboardPresetKey(obj.dims);
  const builder = presetKey ? MOTHERBOARD_LAYOUT_BUILDERS[presetKey] : null;
  return builder ? builder(obj.dims) : null;
};
