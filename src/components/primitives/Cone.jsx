import React, { forwardRef } from 'react';

const Cone = forwardRef(({
  radius = 1,
  height = 1,
  segments = 32,
  ...props
}, ref) => {
  return (
    <mesh ref={ref} {...props}>
      <coneGeometry args={[radius, height, segments]} />
      {props.children}
    </mesh>
  );
});

export default Cone;
