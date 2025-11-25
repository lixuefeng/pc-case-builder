import { anchorPoint, addVec } from "./anchors";

const requireParam = (value, name) => {
  if (value === undefined || value === null) {
    throw new Error(`Missing GPU PCIe parameter: ${name}`);
  }
  return value;
};

export const GPU_PCIE_FINGER_DEFAULTS = Object.freeze({
  height: 12.5, // mm finger height
  visualDrop: 0, // mm; 0 keeps finger top flush with GPU bottom face
  insertionDepth: 5, // mm; intended slot engagement depth (does not move mesh center)
  zOffsetFromBack: 3, // mm from back face (PCB side) to finger center along Z
  connectorEpsUp: 0.1, // mm; lift connector slightly above bottom edge to avoid being under geometry
});

/**
 * Derive a unified finger placement spec to keep mesh, connectors, and logic aligned.
 * @param {Object} opts
 * @param {Object} opts.dims - GPU body dimensions { w, h, d }
 * @param {Object} opts.pcie - meta.pcie config from preset/object
 * @returns {Object} spec with geometry + center in parent space
 */
export const buildGpuFingerPlacement = ({ dims, pcie }) => {
  if (!dims) throw new Error("Missing GPU dims for PCIe finger placement");
  if (!pcie) throw new Error("Missing GPU pcie meta for finger placement");

  const length = requireParam(pcie.fingerLength, "pcie.fingerLength");
  const height = pcie.fingerHeight ?? GPU_PCIE_FINGER_DEFAULTS.height;
  const thickness = requireParam(pcie.fingerThickness, "pcie.fingerThickness");
  const offsetFromBracket = requireParam(
    pcie.fingerOffsetFromBracket,
    "pcie.fingerOffsetFromBracket"
  );
  const visualDrop = pcie.fingerVisualDrop ?? GPU_PCIE_FINGER_DEFAULTS.visualDrop;
  const insertionDepth = pcie.insertionDepth ?? GPU_PCIE_FINGER_DEFAULTS.insertionDepth;
  const connectorEpsUp = pcie.connectorEpsUp ?? GPU_PCIE_FINGER_DEFAULTS.connectorEpsUp;

  const zOffset = pcie.fingerZOffset ?? GPU_PCIE_FINGER_DEFAULTS.zOffsetFromBack;

  const anchor = anchorPoint(dims, "bottom-left-back");
  const center = addVec(anchor, [
    length / 2 + offsetFromBracket,
    -height / 2 + visualDrop, // visual placement only; keep top flush when visualDrop=0
    zOffset,
  ]);

  // Connector point at bottom edge + small lift; slot side controls insertion depth
  const connectorPos = addVec(center, [0, -height / 2 + connectorEpsUp, 0]);

  // Debug: log connector and bottom edge positions to verify placement
  if (pcie.__debugLog) {
    const bottomEdge = center[1] - height / 2;
    // eslint-disable-next-line no-console
    console.log("[gpuPcieSpec] finger placement", {
      dims,
      pcieKey: pcie.key || pcie.presetKey || "unknown",
      length,
      height,
      thickness,
      offsetFromBracket,
      visualDrop,
      connectorEpsUp,
      zOffset,
      center,
      bottomEdge,
      connectorPos,
    });
  }

  return {
    length,
    height,
    thickness,
    offsetFromBracket,
    visualDrop,
    insertionDepth,
    zOffset,
    center,
    connectorPos,
  };
};
