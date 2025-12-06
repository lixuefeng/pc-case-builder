import React, { useMemo } from "react";
import * as THREE from "three";
import { buildGpuFingerPlacement } from "../utils/gpuPcieSpec";
import { GPU_BRACKET_SPEC } from "../utils/gpuBracketSpec";
import { GPU_SPECS, COLORS } from "../constants";

// Returns { mainGeometry, flangeGeometry }
const buildPcieBracketGeometry = ({ width, height, thickness, slotCount = 1 }) => {
  const tongueHeight = 9;
  const tongueWidth = 10;
  const flangeLength = 15; // Increased to 15mm based on "too small" feedback
  
  // Vertical face setup
  const yBottom = 0;
  const yTongueTop = yBottom + tongueHeight;
  const yTop = height;
  
  const shape = new THREE.Shape();
  
  // We trace the outlines.
  // Strategy: Start from top-left, go down, trace tongues across bottom, go up right, close.
  const xLeft = -width / 2;
  const xRight = width / 2;
  
  shape.moveTo(xLeft, yTop);
  shape.lineTo(xLeft, yTongueTop);

  // Tongues creation loop
  // Calculate center of the bracket in terms of slots.
  // If slotCount=1, center is 0. Tongue at 0.
  // If slotCount=2, center is between slots. Tongues at -pitch/2 and +pitch/2.
  // Formula for ith slot center relative to bracket center (which is centered on the whole width):
  // center(i) = (i - (slotCount-1)/2) * PITCH
  
  const PITCH = GPU_SPECS.SLOT_PITCH;
  
  if (slotCount > 1) {
    // Intentionally empty or remove block
  }

  for (let i = 0; i < slotCount; i++) {
      const tongueCenterX = (i - (slotCount - 1) / 2) * PITCH;
      const xTLeft = tongueCenterX - tongueWidth / 2;
      const xTRight = tongueCenterX + tongueWidth / 2;
      
      // Line to start of tongue
      shape.lineTo(xTLeft, yTongueTop);
      // Down
      shape.lineTo(xTLeft, yBottom);
      // Across
      shape.lineTo(xTRight, yBottom);
      // Up
      shape.lineTo(xTRight, yTongueTop);
  }

  // Line to right edge
  shape.lineTo(xRight, yTongueTop);
  shape.lineTo(xRight, yTop);
  shape.closePath();

  const mainGeo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });
  // Build Top Flange (Horizontal Tab)
  // Box: Width=width, Height=thickness (it's flat), Depth=flangeLength
  
  if (width < 1 || height < 1) {
      console.warn("buildPcieBracketGeometry: Invalid dims", { width, height });
  }

  const flangeGeo = new THREE.BoxGeometry(width, thickness, flangeLength);
  
  // Position it at the top.
  const yTrans = yTop + thickness/2;
  // Flip force direction: user reported it ran into the card.
  // Previously: zTrans = flangeLength/2 - thickness/2 (Positive Z).
  // Now: - (flangeLength/2 - thickness/2) (Negative Z, bends other way)
  // Actually, we want the FACE of the flange to flush with the bracket face (Z=0)
  // And extend outwards (-Z or +Z).
  // If thickness is centered at Z=0.
  // We want flange to start at Z = thickness/2 (Outer face) and go to Z = thickness/2 + flangeLength? 
  // Or start at -thickness/2?
  // Let's just Negate the previous center-point translation.
  const zTrans = -(flangeLength/2 - thickness/2);
  
  flangeGeo.translate(0, yTrans, zTrans); 
  
  return { mainGeo, flangeGeo };
};

export function GPUBracketMesh({ obj, selected, selectionOrder, selectedCount }) {
  const { meta = {} } = obj;
  const bracketSpec = meta.bracket || GPU_BRACKET_SPEC;

  // Calculate width based on slot count
  const slotCount = bracketSpec.slotCount || 1;
  const bracketWidth = slotCount === 1 
    ? (bracketSpec.width || GPU_SPECS.BRACKET_WIDTH_SINGLE)
    : ((slotCount - 1) * GPU_SPECS.SLOT_PITCH + (bracketSpec.width || GPU_SPECS.BRACKET_WIDTH_SINGLE));

  // Determine Z offset relative to the finger position specific to this object
  const fingerPlacement = buildGpuFingerPlacement({ dims: obj.dims, pcie: meta.pcie || {} });
  const fingerZ = fingerPlacement.center[2];
  
  // Base offset calibration: 
  // In the default model (d=51, zOff=3, bracketZ=5.09), the distance from Finger to Bracket is fixed.
  // defaultFingerZ = -51/2 + 3 = -22.5
  // defaultBracketZ = 5.09
  // relativeOffset = 5.09 - (-22.5) = 27.59
  const defaultFingerZ = -GPU_SPECS.DEFAULT_DIMS.d / 2 + (3); 
  const defaultBracketZ = GPU_SPECS.ALIGNMENT_OFFSET;
  const relativeOffset = defaultBracketZ - defaultFingerZ;
  
  // New Bracket Z follows the actual finger position + standard relative spacing
  const bracketBaseZ = fingerZ + relativeOffset;
  
  const zOffset = (slotCount > 1 ? -((slotCount - 1) * GPU_SPECS.SLOT_PITCH) / 2 : 0) + bracketBaseZ;

  const { mainGeo, flangeGeo } = useMemo(
    () =>
      buildPcieBracketGeometry({
        width: bracketWidth,
        height: bracketSpec.height || GPU_BRACKET_SPEC.height,
        thickness: bracketSpec.thickness || GPU_BRACKET_SPEC.thickness,
        slotCount // Pass slotCount!
      }),
    [bracketSpec, bracketWidth, slotCount]
  );
  
  // Calculate vertical center shift to align
  // Previously we centered the geo. Now the geo is 0-based Y (0 to 120).
  // We need to shift it so it aligns with the card.
  // bracketSpec.height is ~120.
  // We want the alignment datum (usually near the screw hole/top) or the connector center to match.
  // The 'zOffset' we calculate assumes it's placing the logical center of the bracket?
  // NO, `position={[0, 0, zOffset]}` places the group.
  // Inside the group, we need to shift the mesh so Y is correct relative to the GPU body.
  // GPU Body is centered at (0,0,0).
  // Finger is at specified Y.
  // Bracket Top should align with case hole.
  // For now, let's roughly center it vertically relative to the GPU height logic, 
  // or use the 'dropBelowBody' logic if we have it.
  
  // Re-enable the simple centering for now to maintain previous behavior behavior logic visually
  // Previous logic: geo.translate(-cx, -cy, -cz) -> Centered at 0,0,0
  // So we should center our new geometry bounding box at 0,0,0 too?
  const yShift = -(bracketSpec.height || 120) / 2;

  return (
    <group userData={{ objectId: obj.id }} position={[0, 0, zOffset]}>
      {mainGeo && (
        <group position={[0, yShift, 0]} rotation={[0, Math.PI / 2, 0]}>
             <mesh geometry={mainGeo}>
               <meshStandardMaterial
                color={selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : COLORS.DEFAULT.GPU_BRACKET}
                metalness={0.55}
                roughness={0.32}
                opacity={selected ? 0.7 : 1}
                transparent={selected}
                side={THREE.DoubleSide}
              />
             </mesh>
             <mesh geometry={flangeGeo}>
                <meshStandardMaterial
                color={selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : COLORS.DEFAULT.GPU_BRACKET}
                metalness={0.55}
                roughness={0.32}
                opacity={selected ? 0.7 : 1}
                transparent={selected}
                side={THREE.DoubleSide}
              />
             </mesh>
        </group>
      )}
    </group>
  );
}

export function GPUMesh({ obj, selected, selectionOrder, selectedCount }) {
  const { dims, color, meta = {} } = obj;
  const BODY_LENGTH = GPU_SPECS.DEFAULT_BODY_LENGTH; // mm
  const coolerColor = selected ? (selectedCount > 2 ? COLORS.SELECTION.TERTIARY : (selectionOrder === 0 ? COLORS.SELECTION.PRIMARY : (selectionOrder === 1 ? COLORS.SELECTION.SECONDARY : COLORS.SELECTION.TERTIARY))) : color || COLORS.DEFAULT.GPU_BODY;

  const fingerPlacement = useMemo(
    () => {
      const fp = buildGpuFingerPlacement({ dims, pcie: meta.pcie || {} });
      return fp;
    },
    [dims, meta.pcie]
  );

  return (
    <group userData={{ objectId: obj.id }}>
      <mesh>
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial
          color={coolerColor}
          metalness={0.6}
          roughness={0.4}
          opacity={selected ? 0.7 : 1}
          transparent={true}
        />
      </mesh>

      <mesh position={fingerPlacement.center}>
        <boxGeometry
          args={[
            fingerPlacement.length,
            fingerPlacement.height,
            fingerPlacement.thickness,
          ]}
        />
        <meshStandardMaterial color={COLORS.DEFAULT.GPU_FINGER} metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}
