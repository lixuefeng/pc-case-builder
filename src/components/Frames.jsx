import React from "react";
import * as THREE from "three";

const tempStart = new THREE.Vector3();
const tempEnd = new THREE.Vector3();
const tempDelta = new THREE.Vector3();
const tempCenter = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();
const ALIGN_AXIS = new THREE.Vector3(0, 0, 1);

const isFiniteVec = (value) =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((component) => Number.isFinite(component));

function FrameSegment({ segment, defaultThickness = 10 }) {
  if (!isFiniteVec(segment.start) || !isFiniteVec(segment.end)) {
    return null;
  }

  const start = tempStart.fromArray(segment.start);
  const end = tempEnd.fromArray(segment.end);
  const delta = tempDelta.subVectors(end, start);
  const length = delta.length();
  if (!Number.isFinite(length) || length < 1e-3) {
    return null;
  }

  const thickness = Number.isFinite(segment.metadata?.size)
    ? segment.metadata.size
    : defaultThickness;

  if (!Number.isFinite(thickness) || thickness <= 0) {
    return null;
  }

  const center = tempCenter.addVectors(start, end).multiplyScalar(0.5);
  const direction = delta.clone().normalize();
  tempQuat.setFromUnitVectors(ALIGN_AXIS, direction);

  return (
    <mesh position={center.toArray()} quaternion={[tempQuat.x, tempQuat.y, tempQuat.z, tempQuat.w]}>
      <boxGeometry args={[thickness, thickness, length]} />
      <meshStandardMaterial color="#38bdf8" metalness={0.65} roughness={0.3} />
    </mesh>
  );
}

export default function Frames({ segments = [] }) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  return (
    <group>
      {segments.map((segment) => (
        <FrameSegment key={segment.id} segment={segment} />
      ))}
    </group>
  );
}
