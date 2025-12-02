import React, { useMemo } from 'react';
import * as THREE from 'three';

const MortiseTenon = ({ conn, partA, partB }) => {
  // Simple visualization: 2 screws at the connection point
  // We assume the connection point is the midpoint between the two parts' centers for now
  // In a real implementation, we'd calculate the overlap region

  const center = useMemo(() => {
    const posA = new THREE.Vector3(...partA.pos);
    const posB = new THREE.Vector3(...partB.pos);
    return posA.clone().add(posB).multiplyScalar(0.5);
  }, [partA.pos, partB.pos]);

  return (
    <group position={center.toArray()}>
       {/* Screw 1 */}
       <mesh position={[0, 5, -5]}>
         <cylinderGeometry args={[1.5, 1.5, 10]} />
         <meshStandardMaterial color="#silver" />
       </mesh>
       {/* Screw 2 */}
       <mesh position={[0, 5, 5]}>
         <cylinderGeometry args={[1.5, 1.5, 10]} />
         <meshStandardMaterial color="silver" />
       </mesh>
    </group>
  );
};

export default MortiseTenon;
