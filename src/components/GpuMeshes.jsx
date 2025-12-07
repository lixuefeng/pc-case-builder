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

  // Build Top Flange (Horizontal Tab) with Screw Holes
  // We use ExtrudeGeometry again to support holes.
  
  if (width < 1 || height < 1) {
      console.warn("buildPcieBracketGeometry: Invalid dims", { width, height });
  }

  const flangeShape = new THREE.Shape();
  // Flange shape is a rectangle in X-Z plane (visually), but we'll draw it in X-Y and rotate/extrude.
  // We want width along X, and Length (flangeLength) along Y (which will become Z).
  // Center X is 0.
  const fXLeft = -width / 2;
  const fXRight = width / 2;
  const fYBottom = 0;
  const fYTop = flangeLength;

  flangeShape.moveTo(fXLeft, fYBottom);
  flangeShape.lineTo(fXRight, fYBottom);
  flangeShape.lineTo(fXRight, fYTop);
  flangeShape.lineTo(fXLeft, fYTop);
  flangeShape.closePath();

  // Add Screw Holes
  // One hole per slot.
  const holeRadius = (GPU_SPECS.BRACKET.HOLE_DIA || 4.0) / 2;
  const holeOffset = GPU_SPECS.BRACKET.HOLE_OFFSET_Z || 6.0;
  const holeXShift = GPU_SPECS.BRACKET.HOLE_X_OFFSET || 0;

  for (let i = 0; i < slotCount; i++) {
    // Calculate X center for this slot
    // We apply the shift to align with the visual "edge" requirement
    const slotCenterX = (i - (slotCount - 1) / 2) * PITCH + holeXShift;
    
    const holePath = new THREE.Path();
    // Start at right edge of circle (relative to center)
    // Center of hole is at (slotCenterX, holeOffset)
    
    holePath.absarc(slotCenterX, holeOffset, holeRadius, 0, Math.PI * 2, false);
    flangeShape.holes.push(holePath);
  }

  const flangeGeo = new THREE.ExtrudeGeometry(flangeShape, {
    depth: thickness, // Extrude quantity (thickness)
    bevelEnabled: false,
    curveSegments: 24, // smoother circles
  });

  // Position it at the top.
  // The shape is drawn in X-Y. Extrusion gives it Depth in Z.
  // We want the Flange Plane to be X-Z (Horizontal).
  // So we need to Rotate X by 90 deg.
  // Before rotation: width is X, length is Y, thickness is Z.
  // After Rotate X (+90?): Y becomes -Z, Z becomes Y.
  // Let's visualize: 
  // Initial: Shape on XY plane. Extruded in +Z by `thickness`.
  // Rotate X(-90): 
  //   Old X -> New X
  //   Old Y -> New -Z (Flange extends away from camera? or usually towards 'back' of case? typical bracket bends OUT of the case? No, bends IN usually to sit on chassis shelf).
  //   Wait, PC case rear: GPU is inside. Bracket is at back. 
  //   The bent part sits on the "shelf" of the case frame. 
  //   The shelf is usually OUTSIDE the vertical plane of the slot openings? Or inside?
  //   Usually the bracket L-shape goes OUT. 
  //   Let's assume "Back" of case is -Z (or +Z). 
  //   If we look at `zTrans = -(flangeLength/2 - thickness/2)` in old code, it implies direction.
  //   Old code: BoxGeometry(width, thickness, flangeLength).
  //   Let's align with that.

  // Let's keep it simple: Create, then rotate/translate to match previous placement.
  // Previous Box Center: (0, yTop + thickness/2, -(flangeLength/2 - thickness/2))
  // Previous Box Size: (width, thickness, flangeLength)
  // Which means it spanned:
  //   X: -w/2 to w/2
  //   Y: yTop to yTop + thickness
  //   Z: It was centered at -flangeLength/2 + thickness/2.
  //      Extent: Z_center - L/2 to Z_center + L/2
  //      Min Z = (-L/2 + t/2) - L/2 = -L + t/2. 
  //      Max Z = (-L/2 + t/2) + L/2 = t/2.
  //      So it went from Z = t/2 (front face of bracket main?) back to -L + t/2.
  //      So it extends in Negative Z.
  
  // New Geometry:
  //   Shape in XY. Y is Length (0 to L). X is Width. 
  //   Extruded Z is Thickness (0 to t).
  //   We want:
  //     Dimension corresponds to Width -> X (Already X)
  //     Dimension corresponds to Thickness -> Y (Was Z in extrude)
  //     Dimension corresponds to Length -> Z (Was Y in shape, need to be -Z)

  // Step 1: Center the extrude geo on X-axis? X is -w/2 to w/2, so it's centered.
  // Step 2: Rotate so Shape-Y points to -Z. 
  //         Rotate X by -90 deg. 
  //         (x, y, z) -> (x, z, -y).
  //         Shape Y (0 to L) becomes -Z (0 to -L). Correct (extends negative).
  //         Extrude Z (0 to t) becomes Y (0 to t). Correct (thickness goes Up).
  flangeGeo.rotateX(-Math.PI / 2);

  // Now bounding box is:
  // X: -w/2 to +w/2
  // Y: 0 to thickness
  // Z: -flangeLength to 0
  
  // We want to place it on top of the main bracket.
  // Main bracket top is at `yTop`.
  // So we translate Y by `yTop`.
  // Z alignment: The "Face" of the main bracket is centered at Z=Thickness/2 ? 
  // Earlier mainGeo extrude depth=thickness. It goes Z=0 to Z=depth.
  // So front face is at Z=thickness (or 0 depending on view). 
  // The bracket is usually flush.
  // Let's assume Main Bracket is Z=0 to Z=thickness.
  // Our Flange (curr Z: -L to 0) needs to start at Z=thickness? No, usually the bend is flush with the face.
  // The code `zTrans = -(flangeLength/2 - thickness/2)` suggested valid range.
  // If we want the vertical face (Z=0..t) and horizontal shelf to meet at the top-front edge?
  // Usually it bends at the top. The material thickness is constant.
  // If we take a metal sheet, bend 90 deg. 
  // Vertical part Z=0..t. Horizontal part Y=Top..Top+t.
  // Horizontal part should extend from Z=0 back to Z=-Lungth? Or Z=t back?
  // Standard: The "outside" surface is continuous.
  // Providing the previous logic was "roughly right", let's try to match:
  // Previous Max Z = t/2. Min Z = -L + t/2.
  // Our rotated one: Max Z = 0. Min Z = -L.
  // Shift Z by +thickness/2? => Max Z=t/2. Min Z=-L+t/2. Yes.
  
  flangeGeo.translate(0, yTop, thickness/2); 
  
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
