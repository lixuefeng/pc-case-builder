import React, { useMemo } from 'react';
import * as THREE from 'three';

const StandoffMesh = ({
  height = 10,
  outerDiameter = 6, // M3 standoff usually ~5-6mm
  holeDiameter = 3,  // M3 screw
  baseHeight = 3,    // Height of the conical base
  baseDiameter = 10, // Diameter of the conical base bottom
  color = "#d4af37", // Brass color default
  opacity = 1,
  transparent = false,
  selected = false,
  isDebugHighlighted
}) => {
  
  const finalColor = isDebugHighlighted ? "#d946ef" : (selected ? "#ef4444" : color);

  const geometry = useMemo(() => {
    // 1. Shaft (Cylinder)
    // Height needs to be adjusted because we are stacking shapes
    const shaftHeight = Math.max(0, height - baseHeight);
    
    // We'll merge geometries for a single mesh, or just return a group of meshes.
    // Merging is better for performance but slightly more complex code.
    // For simplicity in React Three Fiber / standard React, returning a group is easier.
    
    // However, if we want to export this later, a single geometry is better.
    // Let's use CSG or just simple group for now. The user asked for "merged geometry" in TODO,
    // but for the editor view, a group is fine. We can handle export logic separately.
    
    // Actually, let's try to make a custom LatheGeometry or merge them manually if needed.
    // But for now, a group of two meshes is the simplest way to get the visual.
    
    return null; // We will use sub-components
  }, [height, baseHeight]);

  // Cylinder (Shaft)
  // Position: It sits on top of the base.
  // Base is at y=0 to y=baseHeight.
  // Shaft is at y=baseHeight to y=height.
  // Cylinder geometry is centered at origin.
  
  const shaftHeight = Math.max(0, height - baseHeight);
  const shaftPos = baseHeight + shaftHeight / 2;

  // Cone (Base)
  // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
  // Top radius = outerDiameter / 2
  // Bottom radius = baseDiameter / 2
  const basePos = baseHeight / 2;

  return (
    <group>
      {/* Base (Volcano Cone) */}
      <mesh position={[0, basePos, 0]}>
        <cylinderGeometry args={[outerDiameter / 2, baseDiameter / 2, baseHeight, 32]} />
        <meshStandardMaterial color={finalColor} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Shaft */}
      <mesh position={[0, shaftPos, 0]}>
        <cylinderGeometry args={[outerDiameter / 2, outerDiameter / 2, shaftHeight, 32]} />
        <meshStandardMaterial color={finalColor} opacity={opacity} transparent={transparent} />
      </mesh>
      
      {/* Hole (Visual) */}
      <mesh position={[0, height - 0.05, 0]}>
        <cylinderGeometry args={[holeDiameter / 2, holeDiameter / 2, 0.1, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
};

export default StandoffMesh;
