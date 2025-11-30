import React, { forwardRef } from 'react';

const Cylinder = forwardRef(({
  radius = 1,
  radiusTop,
  radiusBottom,
  height = 1,
  segments = 32,
  ...props
}, ref) => {
  const rTop = radiusTop !== undefined ? radiusTop : radius;
  const rBottom = radiusBottom !== undefined ? radiusBottom : radius;

  return (
    <mesh ref={ref} {...props}>
      <cylinderGeometry args={[rTop, rBottom, height, segments]} />
      {props.children}
    </mesh>
  );
});

export default Cylinder;
