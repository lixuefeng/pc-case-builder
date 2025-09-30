// components/GridPlane.jsx
import React from "react";
import { Text } from "@react-three/drei";

export default function GridPlane({ size = 10000, divisions = 100 }) {
  const halfSize = size / 2;
  const step = size / divisions; // e.g., 10000 / 100 = 100mm per step

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

  return (
    <group>
      <gridHelper args={[size, divisions, "#888", "#ddd"]} />
      {labels}
    </group>
  );
}