import React from 'react';
import Cylinder from './primitives/Cylinder';

const CSGStandoff = ({
  height = 10,
  outerDiameter = 6,
  holeDiameter = 3,
  baseHeight = 3,
  baseDiameter = 10,
  color = "#d4af37",
  opacity = 1,
  transparent = false,
  selected = false,
  id,
  isDebugHighlighted,
  ...props
}) => {
  const finalColor = isDebugHighlighted ? "#d946ef" : (selected ? "#ef4444" : color);
  
  // Ensure dimensions are numbers
  const h = Number(height) || 10;
  const od = Number(outerDiameter) || 6;
  const hd = Number(holeDiameter) || 3;
  const bh = Number(baseHeight) || 3;
  const bd = Number(baseDiameter) || 10;

  const shaftHeight = Math.max(0, h - bh);

  return (
    <group {...props}>
      {/* Base (Volcano) */}
      <Cylinder
        radiusTop={od / 2}
        radiusBottom={bd / 2}
        height={bh}
        segments={32}
        position={[0, bh / 2, 0]}
      >
        <meshStandardMaterial color={finalColor} opacity={opacity} transparent={transparent} />
      </Cylinder>

      {/* Shaft */}
      {shaftHeight > 0 && (
        <Cylinder
          radius={od / 2}
          height={shaftHeight}
          segments={32}
          position={[0, bh + shaftHeight / 2, 0]}
        >
          <meshStandardMaterial color={finalColor} opacity={opacity} transparent={transparent} />
        </Cylinder>
      )}

      {/* Fake Hole (Visual Only) */}
      <Cylinder
        radius={hd / 2}
        height={h + 0.2} // Slightly taller to avoid z-fighting on top/bottom
        segments={32}
        position={[0, h / 2, 0]}
      >
        <meshBasicMaterial color="#000000" />
      </Cylinder>
    </group>
  );
};

export default CSGStandoff;
