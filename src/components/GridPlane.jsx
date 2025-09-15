// components/GridPlane.jsx — 简单地面网格
import React, { useMemo } from "react";
import * as THREE from "three";

const toMeters = (mm) => mm / 1000;

export default function GridPlane({ size = 1000, divisions = 25 }) {
  const grid = useMemo(
    () => new THREE.GridHelper(toMeters(size), divisions, 0x888888, 0xcccccc),
    [size, divisions]
  );
  return <primitive object={grid} />;
}
