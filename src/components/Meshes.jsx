import React, { useMemo } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

const approxEqual = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

const GPU_BASE_META = {
  bracket: { width: 19.05, height: 120, thickness: 2 },
  pcie: {
    fingerLength: 89,
    fingerThickness: 1.6,
    fingerDepth: 5,
    fingerOffsetFromBracket: 11,
    fingerDrop: 1.2,
  },
  pcb: { thickness: 1.6, clearanceAbove: 10, insetFromBottom: 7 },
};

const GPU_PRESET_OVERRIDES = {
  std: {},
  large: {
    pcb: { clearanceAbove: 14, insetFromBottom: 8 },
    pcie: { fingerDepth: 5.5, fingerDrop: 1.4 },
  },
};

const resolveGpuPresetKey = (obj) => {
  if (obj?.meta?.presetKey) return obj.meta.presetKey;
  const w = obj?.dims?.w;
  if (!w) return "std";
  if (w > 300) return "large";
  return "std";
};

const mergeGpuMeta = (obj) => {
  const preset = resolveGpuPresetKey(obj);
  const override = GPU_PRESET_OVERRIDES[preset] || {};
  return {
    bracket: {
      ...GPU_BASE_META.bracket,
      ...(override.bracket || {}),
      ...(obj?.meta?.bracket || {}),
    },
    pcie: {
      ...GPU_BASE_META.pcie,
      ...(override.pcie || {}),
      ...(obj?.meta?.pcie || {}),
    },
    pcb: {
      ...GPU_BASE_META.pcb,
      ...(override.pcb || {}),
      ...(obj?.meta?.pcb || {}),
    },
  };
};

const MOTHERBOARD_LAYOUT_BUILDERS = {
  itx: (dims) => {
    const keepoutSize = 95;
    const keepoutLeft = 24;
    const keepoutTop = 18;
    const cpuSocketSize = { w: 45, h: 4.5, d: 37.5 };
    const cpuSocketLeft = keepoutLeft + (keepoutSize - cpuSocketSize.w) / 2;
    const cpuSocketTop = keepoutTop + (keepoutSize - cpuSocketSize.d) / 2;
    const ramLength = Math.min(130, dims.d - keepoutTop - 28);
    const chipsetLeft = Math.min(dims.w - 46, keepoutLeft + keepoutSize + 8);

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
        size: { w: 6.2, h: 4, d: ramLength },
        fromRight: 14,
        fromTop: keepoutTop,
        pitch: 9.5,
        anchor: "right",
        colors: ["#e2e8f0", "#cbd5f5"],
      },
      powerConnectors: [
        {
          key: "eps8",
          size: { w: 15, h: 7, d: 14 },
          fromLeft: Math.max(6, keepoutLeft - 10),
          fromTop: Math.max(4, keepoutTop - 8),
          color: "#1e293b",
        },
        {
          key: "atx24",
          size: { w: 24, h: 8, d: 16 },
          fromRight: 6,
          fromTop: keepoutTop + 6,
          color: "#334155",
        },
      ],
      pcieSlots: [
        {
          key: "pcie16",
          size: { w: 89, h: 4, d: 6 },
          fromLeft: 20,
          fromBottom: 18,
          color: "#1e293b",
        },
      ],
      chipset: {
        size: { w: 32, h: 4, d: 32 },
        fromLeft: chipsetLeft,
        fromBottom: 32,
        color: "#64748b",
      },
    };
  },
  matx: (dims) => {
    const keepoutSize = 95;
    const keepoutLeft = 38;
    const keepoutTop = 24;
    const cpuSocketSize = { w: 45, h: 4.5, d: 37.5 };
    const cpuSocketLeft = keepoutLeft + (keepoutSize - cpuSocketSize.w) / 2;
    const cpuSocketTop = keepoutTop + (keepoutSize - cpuSocketSize.d) / 2;
    const ramLength = Math.min(140, dims.d - keepoutTop - 40);
    const chipsetLeft = Math.min(dims.w - 60, keepoutLeft + keepoutSize + 52);

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
        count: 4,
        size: { w: 6.2, h: 4, d: ramLength },
        fromRight: 18,
        fromTop: keepoutTop,
        pitch: 9.5,
        anchor: "right",
        colors: ["#e2e8f0", "#cbd5f5"],
      },
      powerConnectors: [
        {
          key: "eps8",
          size: { w: 15, h: 7, d: 14 },
          fromLeft: keepoutLeft - 12,
          fromTop: keepoutTop - 10,
          color: "#1e293b",
        },
        {
          key: "atx24",
          size: { w: 24, h: 8, d: 16 },
          fromRight: 10,
          fromTop: keepoutTop + 10,
          color: "#334155",
        },
      ],
      pcieSlots: [
        {
          key: "pcie16",
          size: { w: 89, h: 4, d: 6 },
          fromLeft: 28,
          fromBottom: 24,
          color: "#1e293b",
        },
      ],
      chipset: {
        size: { w: 36, h: 4, d: 36 },
        fromLeft: chipsetLeft,
        fromBottom: 46,
        color: "#64748b",
      },
    };
  },
  atx: (dims) => {
    const keepoutSize = 95;
    const keepoutLeft = 52;
    const keepoutTop = 26;
    const cpuSocketSize = { w: 45, h: 4.5, d: 37.5 };
    const cpuSocketLeft = keepoutLeft + (keepoutSize - cpuSocketSize.w) / 2;
    const cpuSocketTop = keepoutTop + (keepoutSize - cpuSocketSize.d) / 2;
    const ramLength = Math.min(140, dims.d - keepoutTop - 42);
    const chipsetLeft = Math.min(dims.w - 72, keepoutLeft + keepoutSize + 64);

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
        count: 4,
        size: { w: 6.2, h: 4, d: ramLength },
        fromRight: 18,
        fromTop: keepoutTop,
        pitch: 9.5,
        anchor: "right",
        colors: ["#e2e8f0", "#cbd5f5"],
      },
      powerConnectors: [
        {
          key: "eps8",
          size: { w: 15, h: 7, d: 14 },
          fromLeft: keepoutLeft - 16,
          fromTop: keepoutTop - 12,
          color: "#1e293b",
        },
        {
          key: "atx24",
          size: { w: 24, h: 8, d: 16 },
          fromRight: 12,
          fromTop: keepoutTop + 14,
          color: "#334155",
        },
      ],
      pcieSlots: [
        {
          key: "pcie16",
          size: { w: 89, h: 4, d: 6 },
          fromLeft: 32,
          fromBottom: 26,
          color: "#1e293b",
        },
      ],
      chipset: {
        size: { w: 40, h: 4, d: 40 },
        fromLeft: chipsetLeft,
        fromBottom: 50,
        color: "#64748b",
      },
    };
  },
};

const resolveMotherboardPresetKey = (obj) => {
  if (obj?.meta?.presetKey) return obj.meta.presetKey;
  const { w, d } = obj?.dims || {};
  if (!w || !d) return null;
  if (approxEqual(w, 170) && approxEqual(d, 170)) return "itx";
  if (approxEqual(w, 244) && approxEqual(d, 244)) return "matx";
  if (approxEqual(w, 305) && approxEqual(d, 244)) return "atx";
  return null;
};

const buildMotherboardLayout = (obj) => {
  if (!obj?.dims) return null;
  if (obj.meta?.layout) return obj.meta.layout;
  const presetKey = resolveMotherboardPresetKey(obj);
  const builder = presetKey ? MOTHERBOARD_LAYOUT_BUILDERS[presetKey] : null;
  return builder ? builder(obj.dims) : null;
};

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

const createFeatureMesh = (feature, dims, key) => {
  if (!feature?.size) return null;
  const [x, z] = computeCenterFromEdges(dims, feature.size, feature);
  const offsetY = feature.offsetY ?? 0;
  const position = [x, feature.size.h / 2 + offsetY, z];

  return (
    <mesh key={key} position={position}>
      <boxGeometry args={[feature.size.w, feature.size.h, feature.size.d]} />
      <meshStandardMaterial
        color={feature.color || "#475569"}
        roughness={feature.roughness ?? 0.55}
        metalness={feature.metalness ?? 0.15}
        transparent={typeof feature.opacity === "number"}
        opacity={feature.opacity ?? 1}
      />
    </mesh>
  );
};

export function MotherboardMesh({ obj, selected }) {
  const { dims, color, meta } = obj;
  const holeMap = Array.isArray(meta?.holeMap) ? meta.holeMap : [];
  const layout = useMemo(() => buildMotherboardLayout(obj), [obj]);

  return (
    <group>
      <mesh userData={{ objectId: obj.id }}>
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial
          color={selected ? "#ef4444" : color || "#81a1c1"}
          opacity={0.95}
          transparent
        />
      </mesh>

      {holeMap.length > 0 && (
        <group position={[0, dims.h / 2, 0]}>
          {holeMap.map(([x, z], i) => (
            <mesh key={i} position={[x - dims.w / 2, 0, z - dims.d / 2]}>
              <cylinderGeometry args={[1.6, 1.6, 1.2, 24]} />
              <meshStandardMaterial color="#202020" />
            </mesh>
          ))}
        </group>
      )}

      {layout && (
        <group position={[0, dims.h / 2, 0]}>
          {layout.cpuKeepout && createFeatureMesh(layout.cpuKeepout, dims, "cpu-keepout")}
          {layout.cpuSocket && createFeatureMesh(layout.cpuSocket, dims, "cpu-socket")}

          {layout.ramSlots &&
            Array.from({ length: layout.ramSlots.count }, (_, index) => {
              const { size, pitch = 8, anchor = "left", colors = [] } = layout.ramSlots;
              if (!size) return null;

              let baseX;
              if (anchor === "right") {
                baseX = dims.w / 2 - (layout.ramSlots.fromRight ?? 0) - size.w / 2;
                baseX -= index * (size.w + pitch);
              } else {
                baseX = -dims.w / 2 + (layout.ramSlots.fromLeft ?? 0) + size.w / 2;
                baseX += index * (size.w + pitch);
              }

              let z = 0;
              if (typeof layout.ramSlots.fromTop === "number") {
                z = -dims.d / 2 + layout.ramSlots.fromTop + size.d / 2;
              } else if (typeof layout.ramSlots.fromBottom === "number") {
                z = dims.d / 2 - layout.ramSlots.fromBottom - size.d / 2;
              }

              const y = size.h / 2 + (layout.ramSlots.offsetY ?? 0);
              const colorAlt = colors[index % colors.length] || "#cbd5f5";

              return (
                <mesh key={`ram-${index}`} position={[baseX, y, z]}>
                  <boxGeometry args={[size.w, size.h, size.d]} />
                  <meshStandardMaterial color={colorAlt} roughness={0.4} metalness={0.07} />
                </mesh>
              );
            })}

          {Array.isArray(layout.powerConnectors) &&
            layout.powerConnectors.map((connector) =>
              createFeatureMesh(connector, dims, connector.key)
            )}

          {Array.isArray(layout.pcieSlots) &&
            layout.pcieSlots.map((slot, idx) => createFeatureMesh(slot, dims, `${slot.key}-${idx}`))}

          {layout.chipset && createFeatureMesh(layout.chipset, dims, "chipset")}
        </group>
      )}
    </group>
  );
}

export function GPUMesh({ obj, selected }) {
  const layout = useMemo(() => mergeGpuMeta(obj), [obj]);
  const { dims, color } = obj;

  const coolerColor = selected ? "#ef4444" : color || "#475569";

  const bracketThickness = layout.bracket.thickness;
  const bracketHeight = Math.min(layout.bracket.height, dims.d + 10);
  const bracketSpanY = Math.max(dims.h + 6, layout.bracket.width);
  const bracketX = -dims.w / 2 - bracketThickness / 2 + 1;

  const pcbThickness = layout.pcb.thickness;
  const pcbInsetBottom = layout.pcb.insetFromBottom;
  const pcbClearanceAbove = layout.pcb.clearanceAbove;
  const pcbDepth = Math.max(20, dims.d - pcbInsetBottom - pcbClearanceAbove);
  const pcbWidth = Math.max(40, dims.w - bracketThickness - 6);
  const pcbLeft = -dims.w / 2 + bracketThickness + 3;
  const pcbX = pcbLeft + pcbWidth / 2;
  const pcbY = -dims.h / 2 + pcbThickness / 2 + 0.6;
  const pcbZ = -dims.d / 2 + pcbInsetBottom + pcbDepth / 2;

  const fingerLength = layout.pcie.fingerLength;
  const fingerThickness = layout.pcie.fingerThickness;
  const fingerDepth = layout.pcie.fingerDepth;
  const fingerStart = pcbLeft + layout.pcie.fingerOffsetFromBracket;
  const fingerX = fingerStart + fingerLength / 2;
  const fingerY = -dims.h / 2 - fingerThickness / 2 - layout.pcie.fingerDrop;
  const fingerZ = -dims.d / 2 - fingerDepth / 2 + 0.8;

  return (
    <group>
      <mesh userData={{ objectId: obj.id }}>
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial color={coolerColor} metalness={0.25} roughness={0.5} />
      </mesh>

      <mesh position={[bracketX, 0, 0]}>
        <boxGeometry args={[bracketThickness, bracketSpanY, bracketHeight]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.3} />
      </mesh>

      <mesh position={[pcbX, pcbY, pcbZ]}>
        <boxGeometry args={[pcbWidth, pcbThickness, pcbDepth]} />
        <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.55} />
      </mesh>

      <mesh position={[fingerX, fingerY, fingerZ]}>
        <boxGeometry args={[fingerLength, fingerThickness, fingerDepth]} />
        <meshStandardMaterial color="#d4a017" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function GroupMesh({ obj, selected }) {
  return (
    <group userData={{ objectId: obj.id }}>
      <mesh>
        <boxGeometry
          args={[
            obj.dims.w + 0.1,
            obj.dims.h + 0.1,
            obj.dims.d + 0.1,
          ]}
        />
        <meshStandardMaterial
          color={selected ? "#ef4444" : "#4f46e5"}
          transparent
          opacity={selected ? 0.2 : 0.1}
        />
      </mesh>
      {obj.children.map((child) => (
        <group key={child.id} position={child.pos}>
          <PartBox obj={child} selected={false} />
        </group>
      ))}
    </group>
  );
}

export function PartBox({ obj, selected }) {
  const { dims, color, type } = obj;
  const defaultColor = type === "structure" ? "#d1d5db" : "#ffaa44";
  return (
    <mesh userData={{ objectId: obj.id }}>
      <boxGeometry args={[dims.w, dims.h, dims.d]} />
      <meshStandardMaterial
        color={selected ? "#ef4444" : color || defaultColor}
        opacity={1}
        transparent={false}
      />
    </mesh>
  );
}

const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export function ImportedMesh({ obj, selected }) {
  const geometry = useMemo(() => {
    if (!obj.meta?.geometryBase64) return null;
    try {
      const buffer = base64ToArrayBuffer(obj.meta.geometryBase64);
      const loader = new STLLoader();
      const geom = loader.parse(buffer);

      geom.computeBoundingBox();
      const center = new THREE.Vector3();
      geom.boundingBox.getCenter(center);
      geom.translate(-center.x, -center.y, -center.z);

      return geom;
    } catch (e) {
      console.error("Failed to parse stored STL geometry", e);
      return null;
    }
  }, [obj.meta?.geometryBase64]);

  if (!geometry) {
    return (
      <mesh>
        <boxGeometry args={[obj.dims.w || 10, obj.dims.h || 10, obj.dims.d || 10]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  }

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={selected ? "#60a5fa" : "#94a3b8"}
        metalness={0.3}
        roughness={0.6}
      />
    </mesh>
  );
}
