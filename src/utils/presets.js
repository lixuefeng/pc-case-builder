// utils/presets.js — 预设与孔位
export const ITX_HOLES_MM = [
  [6.5, 6.5],
  [163.5, 6.5],
  [163.5, 163.5],
  [6.5, 163.5],
];

export const PRESETS = {
  motherboard: [
    {
      key: "itx",
      label: "ITX 170×170",
      dims: { w: 170, h: 2, d: 170 },
      meta: { presetKey: "itx", holeMap: ITX_HOLES_MM },
    },
    {
      key: "matx",
      label: "mATX 244×244",
      dims: { w: 244, h: 2, d: 244 },
      meta: { presetKey: "matx", holeMap: [] },
    },
    {
      key: "atx",
      label: "ATX 305×244",
      dims: { w: 305, h: 2, d: 244 },
      meta: { presetKey: "atx", holeMap: [] },
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
    },
  ],
  psu: [
    { key: "sfx", label: "SFX 125×63.5×100", dims: { w: 125, h: 63.5, d: 100 }, meta: { standard: "SFX" } },
    { key: "atx", label: "ATX 150×86×140",   dims: { w: 150, h: 86, d: 140 }, meta: { standard: "ATX" } },
  ],
  ram: [
    { key: "dimm",  label: "RAM (1) 133×31×7",   dims: { w: 133, h: 31, d: 7 },  meta: { count: 1 } },
    { key: "dimm2", label: "RAM (2) 133×31×7×2", dims: { w: 133, h: 31, d: 14 }, meta: { count: 2 } },
  ],
  box: [
    { key: "cube50", label: "Box 50×50×50", dims: { w: 50, h: 50, d: 50 } },
  ],
};
