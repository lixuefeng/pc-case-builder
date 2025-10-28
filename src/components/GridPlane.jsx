// components/GridPlane.jsx
import React, { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

export default function GridPlane({ size = 10000, divisions = 100 }) {
  const halfSize = size / 2;
  const step = size / divisions; // e.g., 10000 / 100 = 100mm per step

  const horizontalLabelOffset = Math.min(Math.max(size * 0.05, 120), halfSize);
  const verticalLabelOffset = Math.min(Math.max(size * 0.08, 180), halfSize);

  const labels = [];
  // We want a label every 5 steps (e.g., every 500mm)
  const labelStep = step * 5;

  for (let i = -halfSize; i <= halfSize; i += labelStep) {
    // Don't label the origin
    if (i === 0) continue;

    // Labels along Z axis
    labels.push(
      <Text
        key={`z-${i}`}
        position={[i, 0, halfSize + 50]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={15}
        color="#999"
        anchorX="center"
        anchorY="middle"
      >
        {i}
      </Text>
    );

    // Labels along X axis
    labels.push(
      <Text
        key={`x-${i}`}
        position={[halfSize + 50, 0, i]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={15}
        color="#999"
        anchorX="center"
        anchorY="middle"
      >
        {i}
      </Text>
    );
  }

  const axesHelper = useMemo(() => {
    const helper = new THREE.AxesHelper(halfSize);
    const applyMaterialTweaks = (material) => {
      if (!material) return;
      material.depthTest = false;
      material.transparent = true;
      material.opacity = 0.85;
    };
    if (Array.isArray(helper.material)) {
      helper.material.forEach(applyMaterialTweaks);
    } else {
      applyMaterialTweaks(helper.material);
    }
    return helper;
  }, [halfSize]);

  const axisLabels = (
    <>
      <Text
        position={[horizontalLabelOffset, 0.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={20}
        color="#ef4444"
        anchorX="center"
        anchorY="middle"
      >
        X
      </Text>
      <Text
        position={[0, 0.2, horizontalLabelOffset]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={20}
        color="#3b82f6"
        anchorX="center"
        anchorY="middle"
      >
        Z
      </Text>
      <Text
        position={[0, verticalLabelOffset, 0]}
        fontSize={20}
        color="#22c55e"
        anchorX="center"
        anchorY="middle"
      >
        Y
      </Text>
    </>
  );

  return (
    <group>
      <gridHelper args={[size, divisions, "#888", "#ddd"]} />
      <primitive object={axesHelper} position={[0, 0.05, 0]} />
      {axisLabels}
      {labels}
    </group>
  );
}
