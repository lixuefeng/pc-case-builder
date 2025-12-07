// components/MovablePart.jsx
import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { TransformControls, Html } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import {
  MotherboardMesh, GPUMesh, GPUBracketMesh, PartBox, GroupMesh,
  ImportedMesh,
  ReferenceMesh,
  CPUCoolerMesh,
  IOShieldMesh,
} from "./Meshes.jsx";
import CSGStandoff from "./CSGStandoff";
import Cylinder from "./primitives/Cylinder";
import Cone from "./primitives/Cone";
import { getMotherboardIoCutoutBounds } from "../config/motherboardPresets";
import { usePartModifiers } from "../hooks/usePartModifiers";
import { useStore } from "../store";

const DEBUG_LOG = false;
const dlog = DEBUG_LOG ? (...args) => console.log("[MovablePart]", ...args) : () => { };

const CONNECTOR_TYPE_COLORS = {
  "screw-m3": "#38bdf8",
  "screw-m4": "#f97316",
  "pcie-slot": "#f87171",
  "pcie-fingers": "#22d3ee",
  "dimm-slot": "#facc15",
  "dimm-edge": "#fbbf24",
  "bracket-tab": "#a855f7",
};

const getConnectorBaseColor = (connector) => {
  if (!connector?.type) return "#facc15";
  return CONNECTOR_TYPE_COLORS[connector.type] || "#facc15";
};

// Debug flag for connector interactions; set true to trace hover/click.
const DEBUG_CONNECTOR = false;
const clogConnector = (...args) => {
  if (DEBUG_CONNECTOR) console.log("[Connector]", ...args);
};

// Small raycast bias so connectors win over nearby blocking geometry along the same ray.
const CONNECTOR_RAYCAST_PRIORITY = 10000; // mm-equivalent distance bias
const applyConnectorRaycastBias = (mesh, raycaster, intersects) => {
  // if (!mesh) return; // Allow null mesh for just bias logic if needed, but standard raycast needs mesh.
  // Actually, for HoleMarker we can just use the mesh instance from the ref or 'this' context if we were in a class,
  // but here we are in a functional component.
  // The 'mesh' arg is used to call the prototype raycast.
  // If we pass null, we assume the caller handles the raycast call or we are just using the function for the bias logic?
  // Wait, the original function calls `THREE.Mesh.prototype.raycast.call(mesh, ...)`
  // So we MUST pass the mesh.

  // Let's modify this helper to be more robust or just use a ref in HoleMarker.
  if (!mesh) return;
  const startLen = intersects.length;
  THREE.Mesh.prototype.raycast.call(mesh, raycaster, intersects);
  for (let i = startLen; i < intersects.length; i += 1) {
    const hit = intersects[i];
    if (hit.object === mesh) {
      hit.distance = Math.max(0, hit.distance - CONNECTOR_RAYCAST_PRIORITY);
    }
  }
};

const buildConnectorQuaternion = (connector) => {
  const normal = Array.isArray(connector?.normal)
    ? new THREE.Vector3(connector.normal[0], connector.normal[1], connector.normal[2])
    : new THREE.Vector3(0, 1, 0);

  if (normal.lengthSq() === 0) {
    normal.set(0, 1, 0);
  }
  normal.normalize();

  let up = Array.isArray(connector?.up)
    ? new THREE.Vector3(connector.up[0], connector.up[1], connector.up[2])
    : new THREE.Vector3(0, 0, 1);

  if (up.lengthSq() === 0 || Math.abs(up.dot(normal)) > 0.999) {
    up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  }

  const projected = normal.clone().multiplyScalar(up.dot(normal));
  up.sub(projected);
  if (up.lengthSq() === 0) {
    up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    up.sub(normal.clone().multiplyScalar(up.dot(normal)));
  }
  up.normalize();

  const xAxis = new THREE.Vector3().crossVectors(up, normal);
  if (xAxis.lengthSq() === 0) {
    xAxis.set(1, 0, 0).cross(normal).normalize();
  } else {
    xAxis.normalize();
  }

  const rotation = new THREE.Matrix4().makeBasis(xAxis, up, normal);
  return new THREE.Quaternion().setFromRotationMatrix(rotation);
};

const IO_CUTOUT_FACE = "io-cutout";
const ROTATION_SNAP_DEG = 45;
const ROTATION_SNAP_TOL_DEG = 3;



const ConnectorMarker = ({ connector, isUsed, onPick, setConnectorHovered }) => {
  const [hovered, setHovered] = useState(false);
  const stemRef = useRef(null);
  const headRef = useRef(null);

  const quaternion = useMemo(() => buildConnectorQuaternion(connector), [connector]);


  const position = Array.isArray(connector?.pos) && connector.pos.length === 3
    ? connector.pos
    : [0, 0, 0];
  


  const radius = connector.visualRadius ?? 4;
  const stemLength = connector.visualStem ?? 10;

  const baseColor = getConnectorBaseColor(connector);
  const color = hovered ? "#60a5fa" : baseColor;
  const opacity = isUsed ? 0.35 : hovered ? 1 : 0.85;

  const handlePointerEnter = (event) => {
    event.stopPropagation();
    setHovered(true);
    setConnectorHovered?.(true);
    clogConnector("enter", connector?.id);
  };

  const handlePointerLeave = (event) => {
    event.stopPropagation();
    setHovered(false);
    setConnectorHovered?.(false);
    clogConnector("leave", connector?.id);
  };

  const handlePointerDown = (event) => {
    event.stopPropagation();
    if (typeof onPick === "function") {
      onPick(connector);
    }
    setConnectorHovered?.(true);
    clogConnector("down", connector?.id);
  };

  return (
    <group position={position} quaternion={quaternion} frustumCulled={false}>
      <mesh
        position={[0, 0, -stemLength / 2]} // Keep connector origin at head; stem extends backward
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        raycast={(raycaster, intersects) =>
          applyConnectorRaycastBias(stemRef.current, raycaster, intersects)
        }
        renderOrder={1000}
        frustumCulled={false}
        userData={{ ...(connector?.userData || {}), isConnector: true }}
        ref={stemRef}
      >
        <cylinderGeometry args={[radius * 0.25, radius * 0.25, stemLength, 10]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        position={[0, 0, 0]} // Sphere centered at connector origin
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        raycast={(raycaster, intersects) =>
          applyConnectorRaycastBias(headRef.current, raycaster, intersects)
        }
        renderOrder={1001}
        frustumCulled={false}
        userData={{ ...(connector?.userData || {}), isConnector: true }}
        ref={headRef}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={Math.min(1, opacity + 0.25)}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      {hovered && connector?.label && (
        <Html
          center
          distanceFactor={14}
          position={[0, stemLength + radius * 1.6, 0]}
          zIndexRange={[1000, 2000]}
        >
          <div
            style={{
              padding: "2px 6px",
              borderRadius: 6,
              background: "rgba(15, 23, 42, 0.85)",
              color: "#e2e8f0",
              fontSize: 11,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {connector.label}
          </div>
        </Html>
      )}
    </group>
  );
};

const MIN_MOVE_EPS = 0.1;
const ALIGN_ANG_TOL_DEG = 5;
const PARALLEL_COS = Math.cos(THREE.MathUtils.degToRad(ALIGN_ANG_TOL_DEG));
const IMPROVE_MM = 5;

const pickTargetBasis = (tf, dir) => {
  if (!tf || !tf.axes) return { dir: new THREE.Vector3(0, 1, 0), label: 'Y' };
  const { ax, ay, az } = tf.axes;
  const dx = Math.abs(dir.dot(ax));
  const dy = Math.abs(dir.dot(ay));
  const dz = Math.abs(dir.dot(az));

  if (dx > dy && dx > dz) return { dir: ax, label: 'X' };
  if (dy > dx && dy > dz) return { dir: ay, label: 'Y' };
  return { dir: az, label: 'Z' };
};

const getStretchAxisInfo = (obj, faceName) => {
  if (!obj || !faceName) return null;
  const dims = obj.dims || {};
  // Simple mapping for box-like objects
  if (faceName === '+X' || faceName === '-X') return { axis: 'X', dimKey: 'w', sign: faceName === '+X' ? 1 : -1 };
  if (faceName === '+Y' || faceName === '-Y') return { axis: 'Y', dimKey: 'h', sign: faceName === '+Y' ? 1 : -1 };
  if (faceName === '+Z' || faceName === '-Z') return { axis: 'Z', dimKey: 'd', sign: faceName === '+Z' ? 1 : -1 };
  return null;
};

const getWorldTransform = ({ ref, obj }) => {
  if (ref && ref.current) {
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    ref.current.matrixWorld.decompose(p, q, s);
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    return { p, q, s, axes: { ax, ay, az } };
  } else if (obj) {
    const p = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(obj.rot || [0, 0, 0])));
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    return { p, q, axes: { ax, ay, az } };
  }
  return null;
};

const getLocalAxisDir = (tf, axisLabel) => {
  if (!tf || !tf.axes) return null;
  if (axisLabel === 'X') return tf.axes.ax.clone();
  if (axisLabel === 'Y') return tf.axes.ay.clone();
  if (axisLabel === 'Z') return tf.axes.az.clone();
  return null;
};

const inferAxisFromMovement = (mv, selfTF) => {
  if (!mv || !selfTF) return { axis: null, proj: {} };
  const mvDir = mv.clone().normalize();
  const px = Math.abs(mvDir.dot(selfTF.axes.ax));
  const py = Math.abs(mvDir.dot(selfTF.axes.ay));
  const pz = Math.abs(mvDir.dot(selfTF.axes.az));
  let axis = null;
  if (px > py && px > pz) axis = 'X';
  else if (py > px && py > pz) axis = 'Y';
  else if (pz > px && pz > py) axis = 'Z';
  return { axis, proj: { X: px, Y: py, Z: pz } };
};

const projectedHalfExtentAlongAxis = (worldAxis, dims, axes) => {
  const { ax, ay, az } = axes;
  const w2 = (dims?.w ?? 0) / 2;
  const h2 = (dims?.h ?? 0) / 2;
  const d2 = (dims?.d ?? 0) / 2;
  const dir = worldAxis.clone().normalize();
  return (
    Math.abs(dir.dot(ax)) * w2 +
    Math.abs(dir.dot(ay)) * h2 +
    Math.abs(dir.dot(az)) * d2
  );
};

const HoleMarker = ({ hole, partId, onDelete, canDelete = false, setHoveredFace, onDrillHover }) => {
  const [hovered, setHovered] = useState(false);
  const headRef = useRef(null);
  const shaftRef = useRef(null);
  const position = new THREE.Vector3(...(hole.position || [0, 0, 0]));
  const direction = new THREE.Vector3(...(hole.direction || [0, 0, 1])).normalize();
  
  const isNut = hole.type === 'nut';

  // Specs
  const headDia = hole.headDiameter || 6;
  const headDepth = hole.headDepth || 2; 
  const shaftDia = hole.diameter || 3;
  const shaftLength = hole.depth || 10; 

  // Align cylinder to direction. Cylinder default is Y-axis.
  // If direction is Normal (OUT), we want the hole to go IN (along -Y in local space).
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const defaultUp = new THREE.Vector3(0, 1, 0);
    if (direction.dot(defaultUp) < -0.99) {
      // Handle opposite direction (180 deg rotation)
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    } else {
      q.setFromUnitVectors(defaultUp, direction);
    }
    return q;
  }, [direction]);

  const headColor = hovered && canDelete ? "#f87171" : "#ef4444";
  const shaftColor = hovered && canDelete ? "#dc2626" : "#b91c1c";
  const nutColor = hovered && canDelete ? "#fcd34d" : "#fbbf24"; // Goldish for nut
  const opacity = hovered && canDelete ? 0.9 : 0.6;

  const handlePointerEnter = (e) => {
    if (canDelete) {

      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
      setHoveredFace?.(null);
      onDrillHover?.(null);
    }
  };

  const handlePointerLeave = (e) => {
    if (canDelete) {
      e.stopPropagation();
      setHovered(false);
      document.body.style.cursor = "default";
    }
  };

  const handlePointerMove = (e) => {
    if (canDelete) {
      e.stopPropagation();
    }
  };

  const handlePointerDown = (e) => {
    if (canDelete && onDelete) {
      e.stopPropagation();
      onDelete(partId, hole.id);
    }
  };

  if (isNut) {
    // Render Nut (Hexagon)
    // ShaftDia is Nut Diameter (Flat-to-Flat)
    // ShaftLength is Nut Thickness
    // Hexagon radius = Diameter / sqrt(3) ? No, Flat-to-Flat D -> Radius (Point-to-Center) = D / sqrt(3) * 2 ??
    // Radius (Point) = D / 1.732 * 2? No.
    // Flat-to-Flat (W) = 2 * R * cos(30) = 2 * R * 0.866 = 1.732 * R
    // R = W / 1.732
    // CylinderGeometry takes Radius.
    // So radius = shaftDia / 1.732
    
    const hexRadius = shaftDia / Math.sqrt(3);

    return (
        <group position={position} quaternion={quaternion}>
            <mesh
                ref={shaftRef}
                position={[0, -shaftLength / 2, 0]} // Center it
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerDown}
                raycast={(raycaster, intersects) =>
                  applyConnectorRaycastBias(shaftRef.current, raycaster, intersects)
                }
                renderOrder={1003}
                frustumCulled={false}
                userData={{ isHole: true, holeId: hole.id, partId }}
            >
                <cylinderGeometry args={[hexRadius, hexRadius, shaftLength, 6]} />
                <meshBasicMaterial color={nutColor} transparent opacity={opacity} depthTest={false} />
            </mesh>
            {/* Optional: Inner hole for the nut? */}
            <mesh position={[0, -shaftLength / 2, 0]}>
                 <cylinderGeometry args={[shaftDia * 0.3, shaftDia * 0.3, shaftLength + 0.1, 16]} />
                 <meshBasicMaterial color="#000" />
            </mesh>
        </group>
    );
  }

  return (
    <group
      position={position}
      quaternion={quaternion}
    >
      {/* Head: Goes from 0 to -headDepth */}
      <mesh
        ref={headRef}
        position={[0, -headDepth / 2, 0]}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        raycast={(raycaster, intersects) =>
          applyConnectorRaycastBias(headRef.current, raycaster, intersects)
        }
        renderOrder={1002}
        frustumCulled={false}
        userData={{ isHole: true, holeId: hole.id, partId }}
      >
        <cylinderGeometry args={[headDia / 2, headDia / 2, headDepth, 32]} />
        <meshBasicMaterial color={headColor} transparent opacity={opacity} depthTest={false} />
      </mesh>
      {/* Shaft: Goes from -headDepth to -(headDepth + shaftLength) */}
      <mesh
        ref={shaftRef}
        position={[0, -headDepth - shaftLength / 2, 0]}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        raycast={(raycaster, intersects) =>
          applyConnectorRaycastBias(shaftRef.current, raycaster, intersects)
        }
        renderOrder={1003}
        frustumCulled={false}
        userData={{ isHole: true, holeId: hole.id, partId }}
      >
        <cylinderGeometry args={[shaftDia / 2, shaftDia / 2, shaftLength, 32]} />
        <meshBasicMaterial color={shaftColor} transparent opacity={opacity} depthTest={false} />
      </mesh>
    </group>
  );
};
export default function MovablePart({
  obj,
  selected,
  selectionOrder = -1,
  selectedCount = 0,
  setObj,
  onSelect,
  palette,
  allObjects = [],
  setDragging,
  connections = [],
  alignMode = false,
  onFacePick,
  onConnectorPick,
  activeAlignFace,
  mode = "translate",
  onModeChange,
  showTransformControls = false,
  gizmoHovered,
  setGizmoHovered,
  connectorHovered = false,
  setConnectorHovered,
  onDrillHover,
  onHoleDelete,
  rulerPoints,
  rawObjects,
}) {
  const { gl, camera } = useThree();
  const setHudState = useStore((state) => state.setHudState);
  const groupRef = useRef();
  const controlsRef = useRef();
  const hoverFaceMeshRef = useRef(null);
  const [hoveredFace, setHoveredFace] = useState(null);

  const stretchStateRef = useRef(null);
  
  // Calculate modifiers unconditionally at top level
  const modifiers = usePartModifiers(obj, connections, rawObjects);

  // Helper to determine selection color
  const getSelectionColor = () => {
    if (!selected) return "#cbd5e1"; // Default gray
    if (selectedCount > 2) return "#ef4444"; // All red if > 2 items selected
    if (selectionOrder === 0) return "#ef4444"; // Red for first selection (Tenon)
    if (selectionOrder === 1) return "#eab308"; // Yellow for second selection (Mortise)
    return "#ef4444"; // Fallback to red
  };

  const setObjRef = useRef(setObj);
  useEffect(() => {
    setObjRef.current = setObj;
  }, [setObj]);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const finishStretchRef = useRef(null);

  const requestFinish = useCallback((reason) => {
    if (DEBUG_LOG) console.log("[stretch/finish-request]", reason);
    finishStretchRef.current?.();
  }, []);

  const handleWindowPointerUp = useCallback((event) => {
    if (DEBUG_LOG) console.log("[stretch/window-pointerup]", {
      pointerId: event.pointerId,
      buttons: event.buttons,
    });
    requestFinish("pointerup");
  }, [requestFinish]);

  const handleWindowPointerCancel = useCallback((event) => {
    if (DEBUG_LOG) console.log("[stretch/window-pointercancel]", {
      pointerId: event.pointerId,
    });
    requestFinish("pointercancel");
  }, [requestFinish]);

  const handleWindowBlur = useCallback(() => {
    if (DEBUG_LOG) console.log("[stretch/window-blur]");
    requestFinish("window-blur");
  }, [requestFinish]);
  const computeAxisOffsetFromRay = useCallback((ray, axisOrigin, axisDirection) => {
    if (!ray || !axisOrigin || !axisDirection) {
      return null;
    }
    const w0 = axisOrigin.clone().sub(ray.origin);
    const rayDir = ray.direction.clone().normalize();
    const b = axisDirection.dot(rayDir);
    const d = axisDirection.dot(w0);
    const e = rayDir.dot(w0);
    const denom = 1 - b * b;
    let result;
    if (Math.abs(denom) < 0.05) {
      if (DEBUG_LOG) console.log("[stretch/axisOffset] denom too small (parallel view)", denom);
      return null;
    } else {
      result = (b * e - d) / denom;
    }
    if (DEBUG_LOG) console.log("[stretch/axisOffset]", {
      rayOrigin: ray.origin.toArray?.() ?? null,
      rayDir: rayDir.toArray?.() ?? null,
      axisOrigin: axisOrigin.toArray?.() ?? null,
      axisDir: axisDirection.toArray?.() ?? null,
      denom,
      result,
    });
    return result;
  }, []);
  const isEmbedded = !!obj?.embeddedParentId || obj?.type === "embedded";

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.traverse?.((child) => {
      if (!child) return;
      if (child.name === 'XYZ' || child.name === 'XYZE') {
        child.visible = false;
      }
    });
  }, [showTransformControls, selected]);

  const [uiLock, setUiLock] = useState(false);

  const connectedConnectorIds = useMemo(() => {
    if (!Array.isArray(connections)) return new Set();
    const set = new Set();
    connections.forEach((connection) => {
      if (connection?.from?.partId === obj.id && connection.from.connectorId) {
        set.add(connection.from.connectorId);
      }
      if (connection?.to?.partId === obj.id && connection.to.connectorId) {
        set.add(connection.to.connectorId);
      }
    });
    return set;
  }, [connections, obj.id]);

  const handleDimChange = (axis, value) => {
    if (isEmbedded) return;
    const newDimValue = Number(value) || 0;
    setObj((prev) => {
      const newDims = { ...prev.dims, [axis]: newDimValue };
      return { ...prev, dims: newDims };
    });
  };

  const handlePosChange = (axisIndex, value) => {
    if (isEmbedded) return;
    const newPosValue = Number(value) || 0;
    setObj((prev) => {
      const newPos = [...prev.pos];
      newPos[axisIndex] = newPosValue;
      return { ...prev, pos: newPos };
    });
  };

  const handleRotChange = (axisIndex, value) => {
    if (isEmbedded) return;
    const newRotValueDeg = Number(value) || 0;
    const newRotValueRad = THREE.MathUtils.degToRad(newRotValueDeg);
    setObj((prev) => {
      const newRot = [...prev.rot];
      newRot[axisIndex] = newRotValueRad;
      return { ...prev, rot: newRot };
    });
  };

  const applyRotationSnap = useCallback(
    (rotationArray) => {
      if (mode !== "rotate" || !controlsRef.current || !groupRef.current) {
        return rotationArray;
      }
      const activeAxis = controlsRef.current.axis;
      if (!activeAxis) {
        return rotationArray;
      }
      const axisLetters = ["X", "Y", "Z"].filter((letter) =>
        activeAxis.includes(letter)
      );
      if (!axisLetters.length) {
        return rotationArray;
      }
      const snapped = [...rotationArray];
      let didSnap = false;
      axisLetters.forEach((letter) => {
        const index = letter === "X" ? 0 : letter === "Y" ? 1 : 2;
        const prop = letter.toLowerCase();
        const deg = THREE.MathUtils.radToDeg(snapped[index]);
        const nearest = Math.round(deg / ROTATION_SNAP_DEG) * ROTATION_SNAP_DEG;
        if (Math.abs(deg - nearest) <= ROTATION_SNAP_TOL_DEG) {
          const rad = THREE.MathUtils.degToRad(nearest);
          snapped[index] = rad;
          groupRef.current.rotation[prop] = rad;
          didSnap = true;
        }
      });
      return didSnap ? snapped : rotationArray;
    },
    [mode]
  );

  const applyStretchDelta = useCallback(
    (delta) => {
      const state = stretchStateRef.current;
      if (!state || !groupRef.current) return;

      // Optimization: Skip if delta hasn't changed significantly
      if (Math.abs(delta - (state.lastDelta || 0)) < 0.001) return;

      const { axisInfo, startDims, startPosVec, axisDirection, objectId } = state;
      if (!axisInfo?.dimKey || !axisDirection || !startPosVec) return;
      const startSize = Number(startDims[axisInfo.dimKey]) || 0;
      let appliedDelta = delta;
      let nextSize = startSize + appliedDelta;
      const minSize = 1;
      if (nextSize < minSize) {
        nextSize = minSize;
        appliedDelta = nextSize - startSize;
      }
      const newDims = { ...startDims, [axisInfo.dimKey]: nextSize };
      const centerOffset = axisDirection.clone().multiplyScalar(appliedDelta / 2);
      const newPosVec = startPosVec.clone().add(centerOffset);

      groupRef.current.position.copy(newPosVec);

      setObjRef.current((prev) => ({
        ...prev,
        dims: newDims,
        pos: [newPosVec.x, newPosVec.y, newPosVec.z],
      }));

      // Update HUD during stretch
      setHudState({
        type: 'scale',
        data: {
          sx: newDims.w,
          sy: newDims.h,
          sz: newDims.d,
          factor: newDims.w // Fallback
        }
      });

      state.lastDelta = appliedDelta;
      if (DEBUG_LOG) console.log("[stretch/applyDelta]", {
        part: objectId,
        face: state.faceName,
        dimKey: axisInfo.dimKey,
        startSize,
        nextSize,
        appliedDelta,
        centerOffset: centerOffset.toArray(),
        startPos: startPosVec.toArray(),
        newPos: newPosVec.toArray(),
      });
    },
    [setHudState]
  );

  const handleStretchPointerMove = useCallback(
    (event) => {
      if (DEBUG_LOG) console.log("[stretch/pointerMove:raw]", {
        type: event.type,
        buttons: event.buttons,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
      });
      const state = stretchStateRef.current;
      if (!state || !state.axisDirection || !state.axisOrigin) return;
      if (event.buttons === 0) {
        return;
      }
      const rect = gl.domElement.getBoundingClientRect();
      pointerNdc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointerNdc, camera);
      const { axisDirection: axisDir, axisOrigin, objectId, pointerId } = state;
      if (pointerId !== undefined && pointerId !== event.pointerId) {
        if (DEBUG_LOG) console.log("[stretch/pointerMove] pointerId mismatch (ignoring)", {
          expected: pointerId,
          received: event.pointerId,
        });
        return;
      }

      const axisOffset = computeAxisOffsetFromRay(
        raycaster.ray,
        axisOrigin,
        axisDir
      );

      if (typeof axisOffset !== "number" || Number.isNaN(axisOffset)) {
        return;
      }

      const delta = axisOffset - state.startAxisOffset;

      if (!state.hasTriggeredDrag) {
        const dist = Math.sqrt(
          Math.pow(event.clientX - state.startScreenPos.x, 2) +
          Math.pow(event.clientY - state.startScreenPos.y, 2)
        );
        if (dist < 5) {
          return;
        }
        state.hasTriggeredDrag = true;
      }

      applyStretchDelta(delta);
    },
    [
      applyStretchDelta,
      computeAxisOffsetFromRay,
      gl,
      pointerNdc,
      raycaster,
      requestFinish,
    ]
  );

  const finishStretch = useCallback(() => {
    if (!stretchStateRef.current) return;
    window.removeEventListener("pointermove", handleStretchPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
    window.removeEventListener("pointercancel", handleWindowPointerCancel);
    window.removeEventListener("blur", handleWindowBlur);
    if (DEBUG_LOG) console.log("[stretch/finish]", {
      part: stretchStateRef.current?.objectId,
      face: stretchStateRef.current?.faceName,
    });
    const captureTarget = stretchStateRef.current?.pointerCaptureTarget;
    const pointerId = stretchStateRef.current?.pointerId;
    if (captureTarget && typeof captureTarget.releasePointerCapture === "function" && pointerId !== undefined) {
      try {
        captureTarget.releasePointerCapture(pointerId);
        if (DEBUG_LOG) console.log("[stretch/finish] releasePointerCapture", { pointerId });
      } catch (releaseError) {
        if (DEBUG_LOG) console.warn("[stretch/finish] failed to release pointer capture", releaseError);
      }
    }
    const wasDrag = stretchStateRef.current?.hasTriggeredDrag;
    const faceName = stretchStateRef.current?.faceName;
    const objectId = stretchStateRef.current?.objectId;

    stretchStateRef.current = null;
    setUiLock(false);

    if (!wasDrag && onFacePick && faceName && objectId) {
      if (DEBUG_LOG) console.log("[stretch/finish] treated as click", { objectId, faceName });
      onFacePick({ partId: objectId, face: faceName, shiftKey: isShiftPressed });
    }

    setObj((prev) => {
      if (!Array.isArray(prev.connectors) || prev.connectors.length === 0) {
        return prev;
      }
      return { ...prev, connectors: [] };
    });
  }, [handleStretchPointerMove, handleWindowBlur, handleWindowPointerCancel, handleWindowPointerUp, setObj]);

  useEffect(() => {
    finishStretchRef.current = finishStretch;
  }, [finishStretch]);

  useEffect(() => {
    return () => {
      if (DEBUG_LOG) console.log("[stretch/cleanup] removing listeners");
      window.removeEventListener("pointermove", handleStretchPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [handleStretchPointerMove, handleWindowBlur, handleWindowPointerCancel, handleWindowPointerUp]);

  const beginStretch = useCallback(
    (faceName, faceDetails, event) => {
      if (stretchStateRef.current) {
        if (DEBUG_LOG) console.log("[stretch/begin] aborted: existing session, forcing finish");
        requestFinish("begin-stale-session");
        if (stretchStateRef.current) {
          return;
        }
      }
      if (!faceDetails) {
        if (DEBUG_LOG) console.log("[stretch/begin] aborted: no faceDetails");
        return;
      }
      if (isEmbedded) {
        if (DEBUG_LOG) console.log("[stretch/begin] aborted: embedded part");
        return;
      }
      const axisInfo = getStretchAxisInfo(obj, faceName);
      if (!axisInfo) {
        if (DEBUG_LOG) console.log("[stretch/begin] aborted: axisInfo missing");
        return;
      }
      const axisDirection = new THREE.Vector3(...(faceDetails.normal || [0, 0, 1])).normalize();
      const axisOrigin = new THREE.Vector3(...(faceDetails.center || [0, 0, 0]));
      const startPosVec = new THREE.Vector3(
        ...(Array.isArray(obj.pos) ? obj.pos : [0, 0, 0])
      );
      const startAxisOffset = computeAxisOffsetFromRay(
        event.ray,
        axisOrigin,
        axisDirection
      );
      if (typeof startAxisOffset !== "number" || Number.isNaN(startAxisOffset)) {
        if (DEBUG_LOG) console.log("[stretch/begin] aborted: invalid axis offset", {
          rayOrigin: event.ray.origin.toArray(),
          rayDir: event.ray.direction.toArray(),
          axisOrigin: axisOrigin.toArray(),
          axisDir: axisDirection.toArray(),
        });
        return;
      }
      stretchStateRef.current = {
        faceName,
        axisDirection,
        axisOrigin,
        objectId: obj?.id ?? obj?.name ?? "unknown",
        axisInfo,
        startAxisOffset,
        startDims: { ...(obj.dims || {}) },
        startPosVec,
        lastDelta: 0,
        pointerId: event.pointerId,
        pointerCaptureTarget:
          event.target && typeof event.target.setPointerCapture === "function"
            ? event.target
            : null,
        hasTriggeredDrag: false, // New flag to track if actual drag occurred
        startScreenPos: { x: event.clientX, y: event.clientY }, // Track start screen pos
      };
      if (stretchStateRef.current.pointerCaptureTarget) {
        try {
          stretchStateRef.current.pointerCaptureTarget.setPointerCapture(event.pointerId);
          if (DEBUG_LOG) console.log("[stretch/begin] setPointerCapture", {
            pointerId: event.pointerId,
            target: stretchStateRef.current.pointerCaptureTarget,
          });
        } catch (captureError) {
          if (DEBUG_LOG) console.warn("[stretch/begin] failed to capture pointer", captureError);
          stretchStateRef.current.pointerCaptureTarget = null;
        }
      }
      if (DEBUG_LOG) console.log("[stretch/begin] started", {
        part: obj?.id,
        face: faceName,
        axisOrigin: axisOrigin.toArray(),
        axisDir: axisDirection.toArray(),
        startAxisOffset,
        pointerId: event.pointerId,
      });
      setHoveredFace(faceName);
      setUiLock(true);
      window.addEventListener("pointermove", handleStretchPointerMove);
      window.addEventListener("pointerup", handleWindowPointerUp);
      window.addEventListener("pointercancel", handleWindowPointerCancel);
      window.addEventListener("blur", handleWindowBlur);
    },
    [
      computeAxisOffsetFromRay,
      handleStretchPointerMove,
      handleWindowBlur,
      handleWindowPointerCancel,
      handleWindowPointerUp,
      isEmbedded,
      obj,
      setHoveredFace,
      requestFinish,
    ]
  );


  const dragStartRef = useRef({ pos: [0, 0, 0], rot: [0, 0, 0] });
  const prevPosRef = useRef(null);
  const [delta, setDelta] = useState({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });

  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [bestAlignCandidate, setBestAlignCandidate] = useState(null);
  const lastAlignCandidateRef = useRef(null);
  const isDraggingRef = useRef(false);
  const noHitFramesRef = useRef(0);
  const upListenerRef = useRef(null);
  const lastHoverSampleRef = useRef({ local: null, world: null });

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Shift') setIsShiftPressed(true); };
    const handleKeyUp = (e) => { if (e.key === 'Shift') { setIsShiftPressed(false); setBestAlignCandidate(null); } };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const ALIGN_ANG_TOL_DEG = 5;
  const PARALLEL_COS = Math.cos(THREE.MathUtils.degToRad(ALIGN_ANG_TOL_DEG));
  const DIST_THRESHOLD = 50;
  const MIN_MOVE_EPS = 0.25;
  const HYST_MM = 3;
  const IMPROVE_MM = 2;
  const GRACE_FRAMES = 6;

  function getWorldTransform({ ref, obj }) {
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    if (ref?.current) {
      ref.current.getWorldPosition(p);
      ref.current.getWorldQuaternion(q);
    } else {
      p.set(obj.pos[0], obj.pos[1], obj.pos[2]);
      const e = new THREE.Euler(obj.rot[0], obj.rot[1], obj.rot[2], 'XYZ');
      q.setFromEuler(e);
    }
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    return { p, q, axes: { ax, ay, az } };
  }

  function getFacesAlongDir({ obj: targetObj, ref, dir }) {
    const dirN = dir.clone().normalize();
    const { p, axes } = getWorldTransform({ ref, obj: targetObj });
    const half = projectedHalfExtentAlongAxis(dirN, targetObj.dims, axes);
    const centerCoord = p.dot(dirN);

    const projections = [
      { label: "X", axis: axes.ax, proj: Math.abs(dirN.dot(axes.ax)) },
      { label: "Y", axis: axes.ay, proj: Math.abs(dirN.dot(axes.ay)) },
      { label: "Z", axis: axes.az, proj: Math.abs(dirN.dot(axes.az)) },
    ].sort((a, b) => b.proj - a.proj);
    const primary = projections[0];
    const sign = Math.sign(dirN.dot(primary.axis)) || 1;
    const facePosName = (sign >= 0 ? "+" : "-") + primary.label;
    const faceNegName = (sign >= 0 ? "-" : "+") + primary.label;

    return [
      { name: facePosName, coord: centerCoord + half },
      { name: faceNegName, coord: centerCoord - half },
    ];
  }

  const findBestAlignCandidate = (worldDir, axisLabel) => {
    const dirN = worldDir.clone().normalize();
    dlog("findBestAlignCandidate:start", { axisLabel, worldDir: dirN.toArray() });
    const gpuObjects = Array.isArray(allObjects)
      ? allObjects.filter((o) => o?.type === "gpu" || o?.type === "gpu-bracket")
      : [];
    dlog("findBestAlignCandidate:targets", {
      axisLabel,
      total: allObjects?.length ?? 0,
      gpuCount: gpuObjects.length,
      gpuIds: gpuObjects.map((o) => o.id),
    });

    const selfFaces = getFacesAlongDir({ obj, ref: groupRef, dir: dirN });
    let bestCandidate = null;
    let minDistance = Infinity;

    for (const targetObj of allObjects) {
      if (targetObj.id === obj.id || !targetObj.visible) continue;
      const targetTF = getWorldTransform({ ref: null, obj: targetObj });
      const picked = pickTargetBasis(targetTF, dirN);
      const targetDir = picked.dir;
      const targetAxisLabel = picked.label;
      const isGpuTarget = targetObj.type === "gpu" || targetObj.type === "gpu-bracket";
      if (isGpuTarget) {
        dlog("gpu:target-basis", {
          targetId: targetObj.id,
          targetType: targetObj.type,
          axisLabel,
          targetAxisLabel,
          selfDir: dirN.toArray(),
          targetDir: targetDir.toArray(),
        });
      }

      const parallelCos = Math.abs(dirN.dot(targetDir));
      if (parallelCos < PARALLEL_COS) {
        if (isGpuTarget) {
          dlog("gpu:skip:not-parallel", { targetId: targetObj.id, targetType: targetObj.type, parallelCos, need: PARALLEL_COS, axisLabel });
        }
        dlog("skip:not-parallel", { targetId: targetObj.id, parallelCos, need: PARALLEL_COS });
        continue;
      }

      const targetFaces = getFacesAlongDir({ obj: targetObj, ref: null, dir: targetDir });

      for (const selfFace of selfFaces) {
        for (const targetFace of targetFaces) {
          const sameOrientation = Math.sign(targetDir.dot(dirN)) || 1;
          const targetCoordAligned = sameOrientation * targetFace.coord;
          const distance = Math.abs(selfFace.coord - targetCoordAligned);
          if (distance < minDistance && distance < DIST_THRESHOLD) {
            minDistance = distance;
            bestCandidate = {
              axisLabel,
              selfFace: selfFace.name,
              targetFace: targetFace.name,
              targetObj,
              distance,
              selfDir: dirN.clone(),
              targetDir: targetDir.clone(),
              targetAxisLabel,
            };
            dlog("candidate:update", { targetId: targetObj.id, distance, axisLabel, targetAxisLabel });
            if (isGpuTarget) {
              dlog("gpu:candidate", { targetId: targetObj.id, targetType: targetObj.type, distance, selfFace: selfFace.name, targetFace: targetFace.name, selfCoord: selfFace.coord, targetCoord: targetFace.coord, sameOrientation });
            }
          }
        }
      }
    }

    let finalCandidate = bestAlignCandidate;
    const prev = lastAlignCandidateRef.current;

    if (!bestCandidate) {
      if (gpuObjects.length > 0) {
        dlog("gpu:no-hit", {
          gpuIds: gpuObjects.map((o) => o.id),
          reason: "no new candidate (parallel/distance filter)",
        });
      }
      if (prev && noHitFramesRef.current < GRACE_FRAMES) {
        finalCandidate = prev;
        noHitFramesRef.current += 1;
        dlog('candidate:stick(prev)', { noHitFrames: noHitFramesRef.current });
      } else {
        finalCandidate = null;
        noHitFramesRef.current = 0;
      }
    } else {
      noHitFramesRef.current = 0;
      if (prev && prev.targetObj?.id === bestCandidate.targetObj?.id && prev.targetAxisLabel === bestCandidate.targetAxisLabel) {
        if (bestCandidate.distance > prev.distance - IMPROVE_MM) {
          finalCandidate = prev;
          dlog('candidate:keep(prev)', { prevDist: prev.distance, newDist: bestCandidate.distance });
        } else {
          finalCandidate = bestCandidate;
        }
      } else {
        finalCandidate = bestCandidate;
      }
    }

    setBestAlignCandidate(finalCandidate);
    dlog("candidate:final", finalCandidate);
    if (finalCandidate?.targetObj?.type === "gpu" || finalCandidate?.targetObj?.type === "gpu-bracket") {
      dlog("gpu:candidate:final", { targetId: finalCandidate.targetObj.id, targetType: finalCandidate.targetObj.type, distance: finalCandidate.distance, selfFace: finalCandidate.selfFace, targetFace: finalCandidate.targetFace, axisLabel: finalCandidate.axisLabel, targetAxisLabel: finalCandidate.targetAxisLabel });
    }
    if (finalCandidate) lastAlignCandidateRef.current = finalCandidate;
  };

  const calculateAlignPosition = (candidate) => {
    const { selfFace, targetFace, targetObj, selfDir, targetDir } = candidate;
    const dir = selfDir.clone().normalize();

    const selfFacesNow = getFacesAlongDir({ obj, ref: groupRef, dir });
    const targetFacesNow = getFacesAlongDir({ obj: targetObj, ref: null, dir: targetDir });
    const selfFaceInfo = selfFacesNow.find((f) => f.name === selfFace);
    const targetFaceInfo = targetFacesNow.find((f) => f.name === targetFace);

    if (!selfFaceInfo || !targetFaceInfo) {
      dlog("align:missing-face", {
        selfFace,
        targetFace,
        selfFaceInfo: !!selfFaceInfo,
        targetFaceInfo: !!targetFaceInfo,
      });
      return null;
    }

    const sameOrientation = Math.sign(targetDir.dot(dir)) || 1;
    const targetCoordAligned = sameOrientation * targetFaceInfo.coord;
    const delta = targetCoordAligned - selfFaceInfo.coord;

    const selfTF = getWorldTransform({ ref: groupRef, obj });
    const targetPos = selfTF.p.clone().add(dir.clone().multiplyScalar(delta));

    if (targetObj.type === "gpu" || targetObj.type === "gpu-bracket") {
      dlog("align:gpu-debug", {
        targetId: targetObj.id,
        targetType: targetObj.type,
        selfFace,
        targetFace,
        dir: dir.toArray(),
        targetDir: targetDir.toArray(),
        sameOrientation,
        delta,
        selfCoord: selfFaceInfo.coord,
        targetCoord: targetFaceInfo.coord,
        targetPos: targetPos.toArray(),
      });
    }

    return {
      targetPos,
      delta,
      sameOrientation,
      selfCoord: selfFaceInfo.coord,
      targetCoord: targetFaceInfo.coord,
    };
  };

  const snapToCandidate = (candidate) => {
    if (!groupRef.current) return;
    const result = calculateAlignPosition(candidate);
    if (!result) return;
    const { targetPos, delta, sameOrientation, selfCoord, targetCoord } = result;
    const ctrl = controlsRef.current;
    const from = groupRef.current.position.clone();
    const to = targetPos;
    const start = performance.now();
    const dur = 120;

    dlog("snap", {
      targetId: candidate.targetObj.id,
      targetType: candidate.targetObj.type,
      selfFace: candidate.selfFace,
      targetFace: candidate.targetFace,
      targetPos: to.toArray(),
      delta,
      sameOrientation,
      selfCoord,
      targetCoord,
      dir: candidate.selfDir?.toArray?.(),
      targetDir: candidate.targetDir?.toArray?.(),
    });

    const prevEnabled = ctrl?.enabled;
    if (ctrl) ctrl.enabled = false;

    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const cur = from.clone().lerp(to, t);
      groupRef.current.position.copy(cur);
      groupRef.current.updateMatrixWorld(true);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        const p = groupRef.current.position.clone().toArray();
        setObj((prev) => ({ ...prev, pos: p }));
        if (ctrl) {
          ctrl.detach();
          ctrl.attach(groupRef.current);
          ctrl.enabled = prevEnabled ?? true;
        }
      }
    }

    requestAnimationFrame(step);
  };

  const handleDragEnd = () => {
    const candidate = bestAlignCandidate || lastAlignCandidateRef.current;
    dlog("onDragEnd", {
      hasCandidate: !!candidate,
      best: !!bestAlignCandidate,
      cached: !!lastAlignCandidateRef.current,
      isShiftPressed,
    });

    if (candidate) {
      snapToCandidate(candidate);
    } else {
      const p = groupRef.current.position.clone().toArray();
      const r = [
        groupRef.current.rotation.x,
        groupRef.current.rotation.y,
        groupRef.current.rotation.z,
      ];
      const s = [
        groupRef.current.scale.x,
        groupRef.current.scale.y,
        groupRef.current.scale.z,
      ];
      setObj((prev) => ({ ...prev, pos: p, rot: r, scale: s }));
      dlog("onDragEnd:no-snap", { pos: p });
    }
    setBestAlignCandidate(null);
    lastAlignCandidateRef.current = null;
    // setHudState(null); // Keep HUD active for editing
  };

  const getFaceDetails = ({ obj, ref, faceName }) => {
    let targetObj = obj;
    let targetFace = faceName;
    let isChild = false;

    if (faceName && faceName.includes("#")) {
      const [childId, face] = faceName.split("#");
      targetFace = face;
      const child = obj.children?.find((c) => c.id === childId);
      if (child) {
        targetObj = child;
        isChild = true;
      }
    }

    const { p, q } = getWorldTransform({ ref, obj });

    if (isChild) {
      const childPos = new THREE.Vector3(...(targetObj.pos || [0, 0, 0]));
      const childEuler = new THREE.Euler(...(targetObj.rot || [0, 0, 0]));
      const childQuat = new THREE.Quaternion().setFromEuler(childEuler);
      p.add(childPos.applyQuaternion(q));
      q.multiply(childQuat);
    }

    const dims = targetObj?.dims || {};
    let width = dims.w ?? 0;
    let height = dims.h ?? 0;
    let depth = dims.d ?? 0;

    if (targetObj?.type === "standoff") {
      width = targetObj.outerDiameter || 6;
      height = targetObj.height || 10;
      depth = targetObj.outerDiameter || 6;
    }
    const thickness = 0.2;
    const surfacePadding = 0.02;

    const currentFaceName = targetFace;

    let localOffset;
    let size;
    let localNormal;

    if (currentFaceName === IO_CUTOUT_FACE && obj?.type === "motherboard") {
      const spec = getMotherboardIoCutoutBounds(dims);
      if (!spec) return null;
      localOffset = new THREE.Vector3(
        spec.center?.[0] ?? 0,
        spec.center?.[1] ?? 0,
        spec.center?.[2] ?? 0
      );
      localNormal = new THREE.Vector3(
        spec.normal?.[0] ?? 0,
        spec.normal?.[1] ?? 0,
        spec.normal?.[2] ?? 1
      ).normalize();
      localOffset.add(localNormal.clone().setLength(surfacePadding));
      size = [
        spec.size?.[0] ?? width,
        spec.size?.[1] ?? height,
        thickness,
      ];
      size = [
        spec.size?.[0] ?? width,
        spec.size?.[1] ?? height,
        thickness,
      ];

    } else {
      const sign = currentFaceName[0] === "+" ? 1 : -1;
      switch (currentFaceName) {
        case "+X":
        case "-X":
          localOffset = new THREE.Vector3(sign * (width / 2 + surfacePadding), 0, 0);
          size = [thickness, height, depth];
          localNormal = new THREE.Vector3(sign, 0, 0);
          break;
        case "+Y":
        case "-Y":
          localOffset = new THREE.Vector3(0, sign * (height / 2 + surfacePadding), 0);
          size = [width, thickness, depth];
          localNormal = new THREE.Vector3(0, sign, 0);
          break;
        case "+Z":
        case "-Z":
          localOffset = new THREE.Vector3(0, 0, sign * (depth / 2 + surfacePadding));
          size = [width, height, thickness];
          localNormal = new THREE.Vector3(0, 0, sign);
          break;
        default:
          return null;
      }
    }

    const localCenter = localOffset.clone();
    const worldOffset = localOffset.clone().applyQuaternion(q);
    const center = new THREE.Vector3().copy(p).add(worldOffset);
    const worldNormal = localNormal.applyQuaternion(q).normalize();
    return {
      center: center.toArray(),
      localCenter: localCenter.toArray(),
      size,
      quaternion: q.clone(),
      normal: worldNormal.toArray(),
    };
  };

  const getStretchAxisInfo = (obj, faceName) => {
    if (!faceName || faceName.length < 2) return null;
    const axis = faceName[1];
    const sign = faceName[0] === "+" ? 1 : -1;
    let dimKey = null;
    if (axis === "X") {
      dimKey = "w";
    } else if (axis === "Y") {
      dimKey = "h";
    } else if (axis === "Z") {
      dimKey = "d";
    }
    if (!dimKey) return null;
    return { axis, dimKey, sign };
  };

  const startDrag = () => {
    if (!groupRef.current) return;
    const p = groupRef.current.position.clone().toArray();
    const r = [groupRef.current.rotation.x, groupRef.current.rotation.y, groupRef.current.rotation.z];
    dragStartRef.current = { pos: p, rot: r };
    prevPosRef.current = p;
    setDelta({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 });
    isDraggingRef.current = true;
    dlog("startDrag", { pos: p, rot: r });
  };

  useEffect(() => {
    dlog("init", { id: obj.id, type: obj.type, pos: obj.pos, rot: obj.rot });
  }, []);

  const updateDuringDrag = () => {
    if (!groupRef.current) return;
    const p = groupRef.current.position.clone().toArray();
    const r = [
      groupRef.current.rotation.x,
      groupRef.current.rotation.y,
      groupRef.current.rotation.z,
    ];
    const s = dragStartRef.current;
    const d = {
      dx: +(p[0] - s.pos[0]).toFixed(3),
      dy: +(p[1] - s.pos[1]).toFixed(3),
      dz: +(p[2] - s.pos[2]).toFixed(3),
      rx: +(((r[0] - s.rot[0]) * 180) / Math.PI).toFixed(2),
      ry: +(((r[1] - s.rot[1]) * 180) / Math.PI).toFixed(2),
      rz: +(((r[2] - s.rot[2]) * 180) / Math.PI).toFixed(2),
    };
    setDelta(d);

    // Update HUD with absolute values
    if (groupRef.current) {
      const p = groupRef.current.position;
      const r = groupRef.current.rotation;
      const s = groupRef.current.scale;

      setHudState({
        type: mode === 'translate' ? 'move' : mode,
        data: {
          x: p.x, y: p.y, z: p.z,
          rx: THREE.MathUtils.radToDeg(r.x),
          ry: THREE.MathUtils.radToDeg(r.y),
          rz: THREE.MathUtils.radToDeg(r.z),
          factor: s.x
        }
      });
    }

    let mv = null;
    if (prevPosRef.current) {
      mv = new THREE.Vector3(
        p[0] - prevPosRef.current[0],
        p[1] - prevPosRef.current[1],
        p[2] - prevPosRef.current[2]
      );
    }
    prevPosRef.current = p;

    dlog("drag:update", {
      shift: isShiftPressed,
      axisFromCtrl: controlsRef.current?.axis,
      pos: p,
      rotDeg: [
        +THREE.MathUtils.radToDeg(r[0]).toFixed(2),
        +THREE.MathUtils.radToDeg(r[1]).toFixed(2),
        +THREE.MathUtils.radToDeg(r[2]).toFixed(2),
      ],
    });

    if (!isShiftPressed) { setBestAlignCandidate(null); return; }
    dlog("drag:update", {
      shift: isShiftPressed,
      mv: mv?.toArray?.(),
      delta: d,
      axisFromCtrl: controlsRef.current?.axis,
    });

    const absDx = Math.abs(d.dx), absDy = Math.abs(d.dy), absDz = Math.abs(d.dz);
    let currentDragAxis = null;
    if (absDx > absDy && absDx > absDz) currentDragAxis = 'X';
    else if (absDy > absDx && absDy > absDz) currentDragAxis = 'Y';
    else if (absDz > absDx && absDz > absDy) currentDragAxis = 'Z';

    const selfTF = getWorldTransform({ ref: groupRef, obj });
    const mvLen = mv ? mv.length() : 0;
    if (mvLen < MIN_MOVE_EPS) {
      dlog('axis:wait-move', { mvLen });
      return;
    }

    const axisFromCtrlRaw = controlsRef.current?.axis || null;
    let resolvedAxis = (axisFromCtrlRaw === 'X' || axisFromCtrlRaw === 'Y' || axisFromCtrlRaw === 'Z') ? axisFromCtrlRaw : null;

    const { axis: inferred, proj } = inferAxisFromMovement(mv, selfTF);
    dlog('axis:mv-proj', { mv: mv?.toArray?.(), len: +mvLen.toFixed(3), proj });

    if (!resolvedAxis) {
      resolvedAxis = inferred || currentDragAxis;
    } else {
      const margin = 1.25;
      const ctrlProj = proj[resolvedAxis] ?? 0;
      const infProj = inferred ? (proj[inferred] ?? 0) : 0;
      if (inferred && inferred !== resolvedAxis && infProj > ctrlProj * margin) {
        dlog('axis:override', { from: resolvedAxis, to: inferred, ctrlProj, infProj });
        resolvedAxis = inferred;
      } else {
        dlog('axis:keep', { kept: resolvedAxis, ctrlProj, infProj, mvLen });
      }
    }

    if (resolvedAxis === 'X' || resolvedAxis === 'Y' || resolvedAxis === 'Z') {
      const worldDir = getLocalAxisDir(selfTF, resolvedAxis);

      // Snap worldDir to cardinal axes if very close to prevent floating point drift
      if (worldDir) {
        if (Math.abs(worldDir.x) > 0.9999) worldDir.set(Math.sign(worldDir.x), 0, 0);
        else if (Math.abs(worldDir.y) > 0.9999) worldDir.set(0, Math.sign(worldDir.y), 0);
        else if (Math.abs(worldDir.z) > 0.9999) worldDir.set(0, 0, Math.sign(worldDir.z));
      }

      dlog('axis:resolved', { axisFromCtrlRaw, resolvedAxis, mv: mv?.toArray?.() });
      if (worldDir) findBestAlignCandidate(worldDir, resolvedAxis);
    } else if (currentDragAxis) {
      const worldDir =
        currentDragAxis === 'X'
          ? new THREE.Vector3(1, 0, 0)
          : currentDragAxis === 'Y'
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1);
      dlog('axis:fallback-world', { currentDragAxis });
      findBestAlignCandidate(worldDir, currentDragAxis);
    }
  };

  const hudInputStyle = {
    width: 50,
    padding: "4px 6px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#fff",
    color: "#111827",
    fontSize: 12,
    outline: "none",
    textAlign: "center",
  };

  const eat = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
      e.nativeEvent.stopPropagation?.();
      e.nativeEvent.preventDefault?.();
    }
  };

  const lock = (e) => { eat(e); setUiLock(true); };
  const unlock = (e) => { eat(e); setUiLock(false); };

  const targetHighlightDetails = useMemo(() => {
    if (!bestAlignCandidate) return null;
    const { targetObj, targetDir, targetFace, targetAxisLabel } = bestAlignCandidate;
    const { p, q, axes } = getWorldTransform({ ref: null, obj: targetObj });
    const half = projectedHalfExtentAlongAxis(targetDir, targetObj.dims, axes);
    const sign = targetFace[0] === '+' ? 1 : -1;
    const offset = 0.1;
    const center = p.clone().add(targetDir.clone().multiplyScalar(sign * (half + offset)));

    const thickness = 0.2;
    let size;
    if (targetAxisLabel === 'X') size = [thickness, targetObj.dims.h, targetObj.dims.d];
    else if (targetAxisLabel === 'Y') size = [targetObj.dims.w, thickness, targetObj.dims.d];
    else size = [targetObj.dims.w, targetObj.dims.h, thickness];

    return { center: center.toArray(), size, quaternion: q };
  }, [bestAlignCandidate]);

  useEffect(() => {
    if (!alignMode && mode !== "scale") {
      setHoveredFace(null);
    }
  }, [alignMode, mode]);

  const selfHighlightDetails = useMemo(() => {
    if (!bestAlignCandidate) return null;
    const axis = bestAlignCandidate.axisLabel;
    const face = bestAlignCandidate.selfFace[0] + axis;
    return getFaceDetails({ obj, ref: groupRef, faceName: face });
  }, [bestAlignCandidate, obj]);

  const hoveredFaceDetails = useMemo(() => {
    if (!hoveredFace) return null;
    const details = getFaceDetails({ obj, ref: groupRef, faceName: hoveredFace });
    if (obj.type === 'gpu') {
        console.log("DebugGPU: hoveredFaceDetails", { hoveredFace, details });
    }
    return details;
  }, [hoveredFace, obj]);

  useEffect(() => {
    if (!hoveredFace || !hoveredFaceDetails) return;
    const sample = lastHoverSampleRef.current;
    const worldCenter = (() => {
      if (!groupRef.current) return null;
      const v = new THREE.Vector3();
      groupRef.current.getWorldPosition(v);
      return v.toArray();
    })();
    const rotDeg = (() => {
      if (!groupRef.current) return null;
      const e = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion, "XYZ");
      return [
        THREE.MathUtils.radToDeg(e.x).toFixed(2),
        THREE.MathUtils.radToDeg(e.y).toFixed(2),
        THREE.MathUtils.radToDeg(e.z).toFixed(2),
      ];
    })();
    const localFaceCenter = hoveredFaceDetails?.localCenter || (() => {
      if (!hoveredFaceDetails?.center || !groupRef.current) return null;
      const worldV = new THREE.Vector3(...hoveredFaceDetails.center);
      const invQuat = groupRef.current.quaternion.clone().invert();
      return worldV
        .sub(groupRef.current.position.clone())
        .applyQuaternion(invQuat)
        .toArray();
    })();
    if (hoverFaceMeshRef.current) {
      const meshPos = new THREE.Vector3();
      const meshQuat = new THREE.Quaternion();
      hoverFaceMeshRef.current.getWorldPosition(meshPos);
      hoverFaceMeshRef.current.getWorldQuaternion(meshQuat);
      const meshEuler = new THREE.Euler().setFromQuaternion(meshQuat, "XYZ");
    }
  }, [hoveredFace, hoveredFaceDetails, obj]);

  const activeFaceDetails = useMemo(() => {
    if (!activeAlignFace || activeAlignFace.partId !== obj.id) return null;
    return getFaceDetails({ obj, ref: groupRef, faceName: activeAlignFace.face });
  }, [activeAlignFace, obj]);

  const resolveHoveredFace = useCallback(
    (event) => {
      if ((!alignMode && mode !== "scale" && mode !== "ruler" && mode !== "drill" && mode !== "cut") || !groupRef.current) return;

      let width, height, depth;
      if (obj.type === "standoff") {
        width = obj.outerDiameter || 6;
        height = obj.height || 10;
        depth = obj.outerDiameter || 6;
        height = obj.height || 10;
        depth = obj.outerDiameter || 6;

      } else {
        const dims = obj.dims || {};
        width = dims.w ?? 0;
        height = dims.h ?? 0;
        depth = dims.d ?? 0;
      }

      if (width === 0 || height === 0 || depth === 0) {
        setHoveredFace(null);
        return;
      }

      if (obj.type === "group") {
        const hit = event;
        if (!hit.object || !hit.face) return;
        return;
      }

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      groupRef.current.getWorldPosition(worldPos);
      groupRef.current.getWorldQuaternion(worldQuat);

      const halfW = width / 2;
      const halfH = height / 2;
      const halfD = depth / 2;

      const invQuat = worldQuat.clone().invert();
      const localOrigin = event.ray.origin
        .clone()
        .sub(worldPos)
        .applyQuaternion(invQuat);
      const localDir = event.ray.direction.clone().applyQuaternion(invQuat).normalize();
      const localRay = new THREE.Ray(localOrigin, localDir);
      const hitPoint = new THREE.Vector3();
      const localBox = new THREE.Box3(
        new THREE.Vector3(-halfW, -halfH, -halfD),
        new THREE.Vector3(halfW, halfH, halfD)
      );

      const localPoint =
        localRay.intersectBox(localBox, hitPoint) ||
        event.point.clone().sub(worldPos).applyQuaternion(invQuat);

      // 记录：局部空间的命中点，以及对应的世界坐标命中点（而不是物体中心）
      const worldHitPoint = localPoint
        .clone()
        .applyQuaternion(worldQuat)
        .add(worldPos);

      // Debug Hit Context
      if (obj.type === 'gpu-bracket') {
          console.log(`[MovablePart Debug] Hit Test ${obj.id}`, {
              dims: obj.dims,
              localPoint,
              worldHitPoint,
              candidates: [], // will be filled next
          });
      }

      lastHoverSampleRef.current = {
        local: localPoint.clone(),
        world: worldHitPoint,
      };

      const clamped = {
        x: THREE.MathUtils.clamp(localPoint.x, -halfW, halfW),
        y: THREE.MathUtils.clamp(localPoint.y, -halfH, halfH),
        z: THREE.MathUtils.clamp(localPoint.z, -halfD, halfD),
      };

      const candidates = [
        { face: "+X", value: Math.abs(clamped.x - halfW) },
        { face: "-X", value: Math.abs(clamped.x + halfW) },
        { face: "+Y", value: Math.abs(clamped.y - halfH) },
        { face: "-Y", value: Math.abs(clamped.y + halfH) },
        { face: "+Z", value: Math.abs(clamped.z - halfD) },
        { face: "-Z", value: Math.abs(clamped.z + halfD) },
      ];

      let resolvedFace = candidates.reduce((prev, cur) =>
        cur.value < prev.value ? cur : prev
      ).face;

      if (event.shiftKey && obj.type === 'gpu') {
         console.log("DebugGPU: resolveHoveredFace", {
            face: resolvedFace,
            localPoint: localPoint.toArray(),
            candidates
         });
      }



      setHoveredFace(resolvedFace);
      dlog("hover:face", {
        partId: obj.id,
        face: resolvedFace,
        localPoint: localPoint.toArray(),
        worldPos: worldPos.toArray(),
        dims: obj.dims,
        objRot: obj.rot,
      });
    },
    [alignMode, mode, obj]
  );

  useFrame(() => {
    if (selected && showTransformControls && controlsRef.current && setGizmoHovered) {
      const axis = controlsRef.current.axis;
      if (axis && !gizmoHovered) {
        setGizmoHovered(true);
      } else if (!axis && gizmoHovered) {
        setGizmoHovered(false);
      }
    }
  });


  return (
    <>
      <group
        ref={groupRef}
        visible={obj.visible !== false}
        position={obj.pos}
        rotation={obj.rot}
        scale={obj.scale || [1, 1, 1]}
        userData={{ objectId: obj.id }}
        onPointerMove={(e) => {
          e.stopPropagation();
          // Skip face hover if the event is from a hole
          const isHoleEvent = e.target?.userData?.isHole || e.object?.userData?.isHole;
          if (isHoleEvent && mode === "drill") {
            return;
          }
          // DEBUG LOG
          if (mode === "cut") {
             // console.log("MovablePart: cut hover", { shift: e.shiftKey, nativeShift: e?.nativeEvent?.shiftKey });
          }
          const faceSelectionActive =
            (alignMode && (e.shiftKey || e?.nativeEvent?.shiftKey)) ||
            (mode === "scale" && (e.shiftKey || e?.nativeEvent?.shiftKey)) ||
            (mode === "ruler" && (e.shiftKey || e?.nativeEvent?.shiftKey)) ||
            (mode === "drill") ||
            (mode === "cut" && (e.shiftKey || e?.nativeEvent?.shiftKey));
          if (faceSelectionActive) {
            resolveHoveredFace(e);
          } else if (!stretchStateRef.current && (alignMode || mode === "scale" || mode === "ruler" || mode === "drill" || mode === "cut") && hoveredFace) {
            setHoveredFace(null);
          }
          if (mode === "drill" && hoveredFace && onDrillHover) {
            onDrillHover({
              partId: obj.id,
              face: hoveredFace,
              point: lastHoverSampleRef.current?.world?.toArray(),
              normal: hoveredFaceDetails?.normal,
              faceCenter: hoveredFaceDetails?.center,
              faceSize: hoveredFaceDetails?.size,
              quaternion: hoveredFaceDetails?.quaternion?.toArray()
            });
          }
        }}
        onPointerLeave={() => {
          if (stretchStateRef.current) {
            return;
          }
          if (alignMode || mode === "scale" || mode === "ruler" || mode === "drill" || mode === "cut") {
            setHoveredFace(null);
          }
          if (mode === "drill" && onDrillHover) {
            onDrillHover(null);
          }
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          // console.log("MovablePart: pointer down", { mode, shift: e.shiftKey, hoveredFace });
          dlog("pointer:down", {
            shift: e.shiftKey || e?.nativeEvent?.shiftKey,
            ctrl: e.ctrlKey,
            meta: e.metaKey,
            alignMode,
            mode,
            hoveredFace,
            gizmoHovered,
            connectorHovered,
          });
          if (gizmoHovered) {
            return;
          }
          if (connectorHovered) {
            return;
          }

          if (isEmbedded && !alignMode) {
            return;
          }
          // Drill mode should be handled first, before alignMode logic
          if (mode === "drill" && hoveredFace) {

            onFacePick?.({
              partId: obj.id,
              face: hoveredFace,
              point: lastHoverSampleRef.current?.world?.toArray(),
              localPoint: lastHoverSampleRef.current?.local?.toArray(),

              normal: hoveredFaceDetails?.normal,
              quaternion: hoveredFaceDetails?.quaternion?.toArray()
            });
            return;
          }
          if (mode === "cut" && hoveredFace && (e.shiftKey || e?.nativeEvent?.shiftKey)) {
             console.log("MovablePart: cut pick", { hoveredFace, shift: e.shiftKey });
             onFacePick?.({
                partId: obj.id,
                face: hoveredFace,
                point: lastHoverSampleRef.current?.world?.toArray(),
                normal: hoveredFaceDetails?.normal,
                object: groupRef.current, // We need the object for matrixWorld in PCEditor
                event: e // Pass the event for shiftKey check in PCEditor
             });
             return;
          }
          if (
            !alignMode &&
            mode === "scale" &&
            (e.shiftKey || e?.nativeEvent?.shiftKey) &&
            hoveredFace &&
            hoveredFaceDetails
          ) {
            dlog("pointer:begin-stretch", { face: hoveredFace });
            beginStretch(hoveredFace, hoveredFaceDetails, e);
            return;
          }
          if (alignMode && hoveredFace && (e.shiftKey || e?.nativeEvent?.shiftKey)) {
            if (mode === "scale") {
              dlog("pointer:begin-stretch-align", { face: hoveredFace });
              beginStretch(hoveredFace, hoveredFaceDetails, e);
              return;
            }
            dlog("pointer:face-pick", { partId: obj.id, face: hoveredFace });
            if (obj.type === 'gpu') {
                console.log("DebugGPU: onFacePick", { 
                    partId: obj.id, 
                    face: hoveredFace, 
                    shift: e.shiftKey 
                });
            }
            onFacePick?.({ partId: obj.id, face: hoveredFace, shiftKey: true });
            return;
          }
          if (mode === "ruler" && hoveredFace && (e.shiftKey || e?.nativeEvent?.shiftKey)) {
            onFacePick?.({ partId: obj.id, face: hoveredFace, shiftKey: true });
            return;
          }
          // Allow Shift for multi-select if we aren't in a mode that consumes it
          const isSpecialMode = alignMode || mode === "scale" || mode === "ruler" || mode === "cut";
          if ((e.shiftKey || e?.nativeEvent?.shiftKey) && isSpecialMode) {
            return;
          }
          const multi = e.ctrlKey || e.metaKey || e.shiftKey;
          onSelect?.(obj.id, multi);
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {(() => {
           if (obj.name && (obj.name.includes("IO") || obj.type === "io-shield")) {
               console.log("[MovablePart] Rendering IO Object:", { id: obj.id, name: obj.name, type: obj.type });
           }
           return null;
        })()}
        {obj.type === "motherboard" ? (
          <MotherboardMesh obj={obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "gpu" ? (
          <GPUMesh obj={obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "group" ? (
          <GroupMesh obj={obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "imported" ? (
          <ImportedMesh obj={obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "reference" ? (
          <ReferenceMesh obj={obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "cpu-cooler" ? (
          <CPUCoolerMesh obj={obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "gpu-bracket" ? (
          <GPUBracketMesh obj={obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "io-shield" ? (
          <IOShieldMesh obj={obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "standoff" ? (
          <CSGStandoff {...obj} selected={selected} selectionOrder={selectionOrder} selectedCount={selectedCount} />
        ) : obj.type === "cylinder" ? (
          <Cylinder
            radius={obj.dims?.w ? obj.dims.w / 2 : 25}
            height={obj.dims?.h || 50}
            selected={selected}
          >
            <meshStandardMaterial
              color={getSelectionColor()}
              opacity={selected ? 0.7 : 1}
              transparent={true}
            />
          </Cylinder>
        ) : obj.type === "cone" ? (
          <Cone
            radius={obj.dims?.w ? obj.dims.w / 2 : 25}
            height={obj.dims?.h || 50}
            selected={selected}
          >
            <meshStandardMaterial
              color={getSelectionColor()}
              opacity={selected ? 0.7 : 1}
              transparent={true}
            />
          </Cone>
        ) : (
          <PartBox
            obj={obj}
            selected={selected}
            selectionOrder={selectionOrder}
            connections={connections}
            rawObjects={rawObjects}
            modifiers={modifiers}
          />
        )}
        {showTransformControls && Array.isArray(obj.connectors) && obj.connectors
          .filter((connector) => connector && connector.id)
          .map((connector) => {
            const isUsed = connectedConnectorIds.has(connector.id);
            return (
              <ConnectorMarker
                key={connector.id}
                connector={connector}
                isUsed={isUsed}
                onPick={(picked) => {
                  onConnectorPick?.({ partId: obj.id, connectorId: picked?.id });
                }}
                setConnectorHovered={setConnectorHovered}
              />
            );
          })}
        {Array.isArray(obj.holes) && obj.holes.map((hole) => (
          <HoleMarker
            key={hole.id}
            hole={hole}
            partId={obj.id}
            onDelete={onHoleDelete}
            canDelete={mode === "drill"}
            setHoveredFace={setHoveredFace}
            onDrillHover={onDrillHover}
          />
        ))}
      </group>

      {selected && !isEmbedded && showTransformControls && mode !== "scale" && mode !== "ruler" && mode !== "drill" && mode !== "cut" && (
        <TransformControls
          ref={controlsRef}
          object={groupRef.current}
          mode={mode}
          space="local"
          depthTest={false}
          enabled={!uiLock}
          onObjectChange={() => {
            if (!groupRef.current) return;
            const p = groupRef.current.position.clone().toArray();
            let r = [
              groupRef.current.rotation.x,
              groupRef.current.rotation.y,
              groupRef.current.rotation.z,
            ];
            r = applyRotationSnap(r);
            updateDuringDrag();
          }}
          onMouseDown={() => {
            startDrag();
            lastAlignCandidateRef.current = null;
            if (upListenerRef.current) {
              window.removeEventListener('pointerup', upListenerRef.current);
              upListenerRef.current = null;
            }
            upListenerRef.current = () => {
              if (isDraggingRef.current) handleDragEnd();
              window.removeEventListener('pointerup', upListenerRef.current);
              upListenerRef.current = null;
            };
            window.addEventListener('pointerup', upListenerRef.current, { once: true });
          }}
          onDraggingChange={(dragging) => {
            isDraggingRef.current = dragging;
            setDragging?.(dragging);
            if (!dragging) {
              handleDragEnd();
              if (upListenerRef.current) {
                window.removeEventListener('pointerup', upListenerRef.current);
                upListenerRef.current = null;
              }
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {(alignMode || mode === "scale" || mode === "cut") && hoveredFaceDetails && (
        <mesh
          ref={hoverFaceMeshRef}
          position={hoveredFaceDetails.center}
          quaternion={hoveredFaceDetails.quaternion}
          frustumCulled={false}
          raycast={() => null}
        >
          <boxGeometry args={hoveredFaceDetails.size} />
          <meshStandardMaterial
            color="#67e8f9"
            transparent
            opacity={0.3}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {(alignMode || mode === "scale" || mode === "cut") && activeFaceDetails && (
        <mesh
          position={activeFaceDetails.center}
          quaternion={activeFaceDetails.quaternion}
          frustumCulled={false}
          raycast={() => null}
        >
          <boxGeometry args={activeFaceDetails.size} />
          <meshStandardMaterial
            color="#facc15"
            transparent
            opacity={0.35}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {bestAlignCandidate && (
        <group>
          {targetHighlightDetails && (
            <mesh
              position={targetHighlightDetails.center}
              quaternion={targetHighlightDetails.quaternion}
              renderOrder={9998}
              frustumCulled={false}
            >
              <boxGeometry args={targetHighlightDetails.size} />
              <meshBasicMaterial
                color="#00ff00"
                transparent
                opacity={0.5}
                depthTest={false}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                toneMapped={false}
              />
            </mesh>
          )}
          {selfHighlightDetails && (
            <mesh
              position={selfHighlightDetails.center}
              quaternion={selfHighlightDetails.quaternion}
              renderOrder={9999}
              frustumCulled={false}
            >
              <boxGeometry args={selfHighlightDetails.size} />
              <meshBasicMaterial
                color="#3b82f6"
                transparent
                opacity={0.5}
                depthTest={false}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-4}
                toneMapped={false}
              />
            </mesh>
          )}
          <Html position={bestAlignCandidate.targetObj.pos}>
            <div
              style={{
                background: "rgba(0, 255, 0, 0.8)",
                color: "white",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "bold",
                pointerEvents: "none",
              }}
            >
              {/* ASCII arrow avoids non-ASCII parse issues in build tools. */}
              {bestAlignCandidate.selfFace} -&gt; {bestAlignCandidate.targetFace}
            </div>
          </Html>
        </group>
      )}
    </>
  );
}

