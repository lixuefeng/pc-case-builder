import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
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

export function MotherboardMesh({ obj, selected }) {
  const { dims, color, meta } = obj;
  const holeMap = Array.isArray(meta?.holeMap) ? meta.holeMap : [];
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

      {/* Additional motherboard features are rendered as embedded parts */}
    </group>
  );
}

export function GPUBracketMesh({ obj, selected }) {
  const { dims, color } = obj;
  
  const bracketGeometry = useMemo(
    () => buildPcieBracketGeometry(dims.d, dims.h), // Use depth (42) as width for the face
    [dims.d, dims.h]
  );

  return (
    <group userData={{ objectId: obj.id }}>
      {bracketGeometry && (
         <mesh 
           geometry={bracketGeometry} 
           position={[0, -dims.h / 2, 0]} 
           rotation={[0, Math.PI / 2, 0]} // Rotate to face X axis
         >
           <meshStandardMaterial 
             color={selected ? "#ef4444" : "#9ca3af"} 
             metalness={0.55} 
             roughness={0.32} 
           />
         </mesh>
      )}
    </group>
  );
}

export function GPUMesh({ obj, selected }) {
  const { dims, color } = obj;
  const coolerColor = selected ? "#ef4444" : color || "#475569";
  
  // Fingers Spec (Standard):
  const fingersLength = 87;
  const fingersHeight = 12.5;
  const fingersThickness = 1.6;
  
  // Calculate fingers X position relative to bracket end (-dims.w/2)
  // Standard offset from bracket face to start of fingers is approx 30mm?
  // Let's target center X = -dims.w / 2 + 5 + fingersLength / 2
  const fingersX = -dims.w / 2 + 5 + fingersLength / 2;

  return (
    <group userData={{ objectId: obj.id }}>
      {/* Main Body */}
      <mesh>
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial
          color={coolerColor}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      
      {/* PCIe Fingers (Visual) */}
      <mesh position={[fingersX, -dims.h / 2 - fingersHeight / 2 + 5, -18]}>
        <boxGeometry args={[fingersLength, fingersHeight, fingersThickness]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

export function ChildMeshRenderer({ obj }) {
  switch (obj.type) {
    case "gpu-body":
      return <GPUMesh obj={obj} selected={false} />;
    case "gpu-bracket":
      return <GPUBracketMesh obj={obj} selected={false} />;
    case "structure":
    default:
      return <PartBox obj={obj} selected={false} />;
  }
}

export function GroupMesh({ obj, selected }) {
  return (
    <group userData={{ objectId: obj.id }}>
      <mesh raycast={() => null}>
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
        <group key={child.id} position={child.pos} rotation={child.rot}>
          <ChildMeshRenderer obj={child} />
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



export function ReferenceMesh({ obj, selected }) {
  const { dims, color, key } = obj;

  // Check if it's a coke can to apply the custom shape
  // Note: obj.name is used for the display name, obj.key is the preset key
  const isCokeCan = key === "coke-can" || (obj.name && obj.name.toLowerCase().includes("coke"));

  if (isCokeCan) {
    const radius = (dims.w || 66) / 2;
    const height = dims.h || 115;
    const halfHeight = height / 2;

    // Define the profile points
    const { bottomPoints, bodyPoints, topPoints } = useMemo(() => {
      const p0 = new THREE.Vector2(0, -halfHeight);
      const p1 = new THREE.Vector2(radius * 0.7, -halfHeight);
      const p2 = new THREE.Vector2(radius * 0.75, -halfHeight + 2);
      const p3 = new THREE.Vector2(radius, -halfHeight + 10);

      const p4 = new THREE.Vector2(radius, halfHeight - 12);
      const p5 = new THREE.Vector2(radius * 0.82, halfHeight - 2);

      const p6 = new THREE.Vector2(radius * 0.82, halfHeight);
      const p7 = new THREE.Vector2(radius * 0.78, halfHeight);
      const p8 = new THREE.Vector2(0, halfHeight - 1);

      return {
        bottomPoints: [p0, p1, p2, p3],
        bodyPoints: [p3, p4, p5],
        topPoints: [p5, p6, p7, p8],
      };
    }, [radius, halfHeight]);

    const silverMaterial = (
      <meshStandardMaterial
        color="#e2e8f0"
        metalness={0.8}
        roughness={0.2}
      />
    );

    const paintMaterial = (
      <meshStandardMaterial
        color={selected ? "#ef4444" : color || "#ef4444"}
        metalness={0.6}
        roughness={0.3}
      />
    );

    return (
      <group userData={{ objectId: obj.id }}>
        {/* Bottom (Silver) */}
        <mesh>
          <latheGeometry args={[bottomPoints, 32]} />
          {silverMaterial}
        </mesh>

        {/* Body (Painted) */}
        <mesh>
          <latheGeometry args={[bodyPoints, 32]} />
          {paintMaterial}
        </mesh>

        {/* Top (Silver) */}
        <mesh>
          <latheGeometry args={[topPoints, 32]} />
          {silverMaterial}
        </mesh>
      </group>
    );
  }

  // Default cylinder for other reference objects
  const radius = (dims.w || 66) / 2;
  const height = dims.h || 115;

  return (
    <group userData={{ objectId: obj.id }}>
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 32]} />
        <meshStandardMaterial
          color={selected ? "#ef4444" : color || "#ef4444"}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

export function CPUCoolerMesh({ obj, selected }) {
  const { dims, color } = obj;
  const { w, h, d } = dims;

  // Heatsink (Silver)
  const heatsinkMaterial = (
    <meshStandardMaterial
      color="#e2e8f0"
      metalness={0.7}
      roughness={0.3}
    />
  );

  // Fan (Black) - Simplified as a block on the front
  const fanMaterial = (
    <meshStandardMaterial
      color="#1e293b"
      metalness={0.2}
      roughness={0.8}
    />
  );

  const fanDepth = 25;
  const heatsinkDepth = Math.max(10, d - fanDepth);

  return (
    <group userData={{ objectId: obj.id }}>
      {/* Heatsink */}
      <mesh position={[0, 0, -fanDepth / 2]}>
        <boxGeometry args={[w, h, heatsinkDepth]} />
        {heatsinkMaterial}
      </mesh>

      {/* Fan */}
      <mesh position={[0, 0, heatsinkDepth / 2]}>
        <boxGeometry args={[w, h, fanDepth]} />
        {fanMaterial}
      </mesh>
    </group>
  );
}
