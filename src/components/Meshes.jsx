import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { buildMotherboardLayout, getMotherboardIoCutoutBounds } from "../config/motherboardPresets";
import {
  GPU_BRACKET_SPEC,
  GPU_PCB_SPEC,
  GPU_PCIE_FINGER_SPEC,
} from "../config/gpuSpecs";

const buildPcieBracketGeometry = (width, height) => {
  const spec = {
    thickness: 1.6,
    width: width,
    height: height,
  };

  const x0 = -spec.width / 2;
  const x1 = spec.width / 2;
  const yBottom = 0;
  const yTop = spec.height;

  const shape = new THREE.Shape();
  shape.moveTo(x0, yBottom);
  shape.lineTo(x1, yBottom);
  shape.lineTo(x1, yTop);
  shape.lineTo(x0, yTop);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: spec.thickness, // 娌?Z 杞存媺浼?
    bevelEnabled: false,
    curveSegments: 16,
  });

  // 鍘氬害灞呬腑鍒?X=0
  geo.translate(-spec.thickness / 2, 0, 0);

  // 閲嶆柊璁＄畻鍖呭洿鐩掞紝鍋氬簳杈硅惤鍦?& Z 灞呬腑
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2; // Z 杞村眳涓?

  // X 鍐嶆绮剧‘灞呬腑锛堝熀鏈负 0锛夛紝Y 钀藉埌 0锛孼 灞呬腑
  geo.translate(-cx, -b.min.y, -cz);

  geo.computeVertexNormals();
  return geo;
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
  const extrudeBelow = Math.max(0, feature.extrudeBelow ?? 0);
  const extrudeAbove = Math.max(0, feature.extrudeAbove ?? 0);
  const height = feature.size.h + extrudeAbove + extrudeBelow;
  const centerY = (feature.size.h + extrudeAbove - extrudeBelow) / 2 + offsetY;
  const position = [x, centerY, z];

  return (
    <mesh key={key} position={position}>
      <boxGeometry args={[feature.size.w, height, feature.size.d]} />
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
  const ioCutout = getMotherboardIoCutoutBounds(dims);

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
              const { size, anchor = "left", colors = [] } = layout.ramSlots;
              if (!size) return null;

              const isRowAlongZ = size.w >= size.d;
              const slotThickness = isRowAlongZ ? size.d : size.w;
              const spacing = slotThickness + 3;

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
                z = isRowAlongZ
                  ? topBase + index * spacing
                  : topBase;
              } else if (typeof layout.ramSlots.fromBottom === "number") {
                const bottomBase =
                  dims.d / 2 - layout.ramSlots.fromBottom - size.d / 2;
                z = isRowAlongZ
                  ? bottomBase - index * spacing
                  : bottomBase;
              }

              const y = size.h / 2 + (layout.ramSlots.offsetY ?? 0);
              const colorAlt = colors[index % colors.length] || "#cbd5f5";

              return (
                <mesh key={`ram-${index}`} position={[x, y, z]}>
                  <boxGeometry args={[size.w, size.h, size.d]} />
                  <meshStandardMaterial
                    color={colorAlt}
                    roughness={0.4}
                    metalness={0.07}
                  />
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
      {ioCutout && (
        <mesh position={ioCutout.center}>
          <boxGeometry args={ioCutout.size} />
          <meshStandardMaterial color="#fb923c" opacity={0.35} transparent />
        </mesh>
      )}
    </group>
  );
}

export function GPUMesh({ obj, selected }) {
  const { dims, color } = obj;

  const coolerColor = selected ? "#ef4444" : color || "#475569";

  const { bracketWidth, bracketHeight, pcbLayout, pcieFingerLayout } = useMemo(() => {
    const numSlots = Math.max(1, Math.round(dims.h / GPU_BRACKET_SPEC.slotWidth));
    const bracketWidth = numSlots * GPU_BRACKET_SPEC.widthPerSlot;
    const bracketHeight = GPU_BRACKET_SPEC.height;

    const pcbLayout = {
      thickness: GPU_PCB_SPEC.thickness,
      depth: Math.max(
        GPU_PCB_SPEC.minDepth,
        dims.w - GPU_PCB_SPEC.depthOffsets.front - GPU_PCB_SPEC.depthOffsets.rear
      ),
      width: Math.max(
        GPU_PCB_SPEC.minWidth,
        dims.d - GPU_PCB_SPEC.widthClearance.inner - GPU_PCB_SPEC.widthClearance.shroud
      ),
    };

    const pcieFingerLayout = { ...GPU_PCIE_FINGER_SPEC };

    return { bracketWidth, bracketHeight, pcbLayout, pcieFingerLayout };
  }, [dims.h, dims.w, dims.d]);

  const bracketPosition = [
    -dims.d / 2 + GPU_BRACKET_SPEC.offsetX,
    0,
    dims.w / 2 + GPU_BRACKET_SPEC.offsetZ,
  ];

  const bracketGeometry = useMemo(
    () => buildPcieBracketGeometry(bracketWidth, bracketHeight),
    [bracketWidth, bracketHeight],
  );

  const fingerPosition = useMemo(
    () => [
      dims.d / 2 + pcieFingerLayout.depth / 2,
      -dims.h / 2 + pcieFingerLayout.thickness / 2,
      dims.w / 2 - pcieFingerLayout.length / 2 - GPU_PCIE_FINGER_SPEC.topInset,
    ],
    [dims.d, dims.h, dims.w, pcieFingerLayout.depth, pcieFingerLayout.length, pcieFingerLayout.thickness],
  );

  useEffect(() => {
    // Ensure this component is the single source of truth for the PCIe connector.
    // First, remove any existing PCIe card connectors to avoid duplicates.
    const otherConnectors = (obj.connectors || []).filter(
      (c) => c.type !== "pcie-x16-card"
    );

    // Then, add the definitive PCIe connector with the correct position.
    const pcieConnector = {
      id: "gpu_pcie_x16",
      label: "PCIe x16",
      type: "pcie-x16-card",
      pos: fingerPosition,
      normal: [1, 0, 0], // Points down, away from the card
      up: [0, 0, -1], // Points along the card's depth axis
    };

    obj.connectors = [...otherConnectors, pcieConnector];
  }, [obj, fingerPosition]);

  useEffect(() => {
    return () => {
      bracketGeometry?.dispose();
    };
  }, [bracketGeometry]);

  const pcbLeft =
    -dims.d / 2 +
    GPU_PCB_SPEC.widthClearance.inner +
    GPU_PCB_SPEC.sideInset;
  const pcbPosition = [
    pcbLeft + pcbLayout.width / 2,
    -dims.d / 2 +
      GPU_PCB_SPEC.widthClearance.inner +
      GPU_PCB_SPEC.sideInset +
      pcbLayout.width / 2,
    -dims.h / 2 + pcbLayout.thickness / 2 + GPU_PCB_SPEC.heightLift,
    -dims.w / 2 + GPU_PCB_SPEC.depthOffsets.front + pcbLayout.depth / 2,
  ];

  return (
    <group>
      <mesh userData={{ objectId: obj.id }}>
        <boxGeometry args={[dims.d, dims.h, dims.w]} />
        <meshStandardMaterial color={coolerColor} metalness={0.25} roughness={0.5} />
      </mesh>

      {bracketGeometry && (
        //<mesh geometry={bracketGeometry} position={bracketPosition}>
        <mesh geometry={bracketGeometry} position={bracketPosition} rotation={[0 , 0, -Math.PI/2]}>
          <meshStandardMaterial color="#9ca3af" metalness={0.55} roughness={0.32} />
        </mesh>
      )}

      <mesh position={pcbPosition}>
        <boxGeometry args={[pcbLayout.width, pcbLayout.thickness, pcbLayout.depth]} />
        <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.55} />
      </mesh>

      <mesh position={fingerPosition}>
        <boxGeometry args={[pcieFingerLayout.depth, pcieFingerLayout.thickness, pcieFingerLayout.length]} />
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
    <group userData={{ objectId: obj.id }}>
      <mesh>
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial
          color={selected ? "#ef4444" : color || defaultColor}
          opacity={1}
          transparent={false}
        />
      </mesh>
    </group>
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



