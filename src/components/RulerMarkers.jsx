import React from "react";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";

const RulerMarkers = ({ measurements }) => {
    if (!measurements || measurements.length === 0) return null;

    return (
        <group>
            {measurements.map((m, index) => {
                const start = new THREE.Vector3(...m.p1);
                const end = new THREE.Vector3(...m.p2);
                const mid = start.clone().add(end).multiplyScalar(0.5);
                const distance = start.distanceTo(end);

                return (
                    <group key={index}>
                        <Line
                            points={[start, end]}
                            color="#facc15"
                            lineWidth={2}
                            dashed={false}
                        />
                        <mesh position={start}>
                            <sphereGeometry args={[2, 16, 16]} />
                            <meshBasicMaterial color="#facc15" />
                        </mesh>
                        <mesh position={end}>
                            <sphereGeometry args={[2, 16, 16]} />
                            <meshBasicMaterial color="#facc15" />
                        </mesh>
                        <Html position={mid} center>
                            <div
                                style={{
                                    background: "rgba(0, 0, 0, 0.7)",
                                    color: "#facc15",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    whiteSpace: "nowrap",
                                    pointerEvents: "none",
                                }}
                            >
                                {distance.toFixed(2)}mm
                            </div>
                        </Html>
                    </group>
                );
            })}
        </group>
    );
};

export default RulerMarkers;
