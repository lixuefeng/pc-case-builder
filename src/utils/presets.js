// utils/presets.js — 预设与孔位
export const ITX_HOLES_MM = [
  [6.35, 10.16],
  [163.83, 33.02],
  [163.83, 165.10],
  [6.35, 165.10],
];

export const PRESETS = {
  motherboard: [
    { key: "itx",  label: "ITX 170×170",    dims: { w: 170, h: 2, d: 170 }, meta: { holeMap: ITX_HOLES_MM } },
    { key: "matx", label: "mATX 244×244",   dims: { w: 244, h: 2, d: 244 }, meta: { holeMap: [] } },
    { key: "atx",  label: "ATX 305×244",    dims: { w: 305, h: 2, d: 244 }, meta: { holeMap: [] } },
  ],
  gpu: [
    { key: "std",   label: "GPU 270×112×40", dims: { w: 270, h: 40, d: 112 } },
    { key: "large", label: "GPU 310×140×60", dims: { w: 310, h: 60, d: 140 } },
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
