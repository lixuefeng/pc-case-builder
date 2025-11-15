const approxEqual = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

export const MOTHERBOARD_DIMENSIONS = {
  itx: { w: 170, d: 170 },
  matx: { w: 244, d: 244 },
  atx: { w: 305, d: 244 },
};

export const MOTHERBOARD_LAYOUT_BUILDERS = {
  // ATX 2.2 https://cdn.instructables.com/ORIG/FS8/5ILB/GU59Z1AT/FS85ILBGU59Z1AT.pdf
  itx: (dims) => {
    const keepoutSize = 77.5;
    const keepoutLeft = 61.3;
    const keepoutTop = 51.3;
    const cpuSocketSize = { w: 45, h: 4.5, d: 37.5 };
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
        size: { w: 127, h: 4, d: 6 },
        fromRight: 14,
        fromTop: 139,
        pitch: 9.5,
        anchor: "right",
        colors: ["#e2e8f0", "#cbd5f5"],
      },
      powerConnectors: [
        {
          key: "eps8",
          size: { w: 10, h: 5, d: 18.75 },
          fromRight: 0,
          fromTop: 42,
          color: "#1e293b",
        },
        {
          key: "atx24",
          size: { w: 52, h: 5, d: 10 },
          fromRight: 11.5,
          fromBottom: 1,
          color: "#334155",
        },
      ],
      pcieSlots: [
        {
          key: "pcie16",
          size: { w: 6, h: 4, d: 89.5 },
          fromLeft: 2.5,
          fromTop: 42,
          color: "#1e293b",
        },
      ],
      chipset: {
        size: { w: 158.75, h: 44.45, d: 19 }, // h includes keepout 2.53mm
        fromLeft: 13.56,
        fromTop: -1.14,
        color: "#475569",
        offsetY: -5,
      },
    };
  },
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
