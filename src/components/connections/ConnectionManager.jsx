import React from 'react';
import MortiseTenon from './MortiseTenon';
import ExternalPlate from './ExternalPlate';
import BlindJoint from './BlindJoint';
import CrossLapJoint from './CrossLapJoint';
import ShearBoss from './ShearBoss';

const ConnectionManager = ({ connections, objects }) => {
  if (!connections || connections.length === 0) return null;

  // Create a map of objects for quick lookup
  const objectMap = new Map(objects.map(obj => [obj.id, obj]));

  return (
    <group>
      {connections.map(conn => {
        const partA = objectMap.get(conn.partA);
        const partB = objectMap.get(conn.partB);

        if (!partA || !partB) {
           return null;
        }

        const props = {
          conn: conn, // Pass as 'conn' to match component expectations
          partA,
          partB
        };

        switch (conn.type) {
          case 'mortise-tenon':
            return null; // Handled by geometry modification
          case 'external-plate':
            return <ExternalPlate key={conn.id} {...props} />;
          case 'blind-joint':
            return <BlindJoint key={conn.id} {...props} />;
          case 'cross-lap':
            return <CrossLapJoint key={conn.id} {...props} />;
          case 'shear-boss':
            return <ShearBoss key={conn.id} {...props} />;
          case 'subtraction':
            return null; // Purely CSG, no extra visual component needed
          default:
            console.warn(`Unknown connection type: ${conn.type}`);
            return null;
        }
      })}
    </group>
  );
};

export default ConnectionManager;
