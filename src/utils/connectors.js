import * as THREE from "three";
import { PRESETS } from "./presets";

const DEFAULT_NORMAL = new THREE.Vector3(0, 1, 0);
const DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const toVector3 = (value, fallback) => {
  if (Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n))) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return fallback.clone();
};

const pickPerpendicular = (normal) => {
  const candidates = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];
  let choice = candidates[0];
  let smallest = Math.abs(choice.dot(normal));
  for (let i = 1; i < candidates.length; i += 1) {
    const dot = Math.abs(candidates[i].dot(normal));
    if (dot < smallest) {
      smallest = dot;
      choice = candidates[i];
    }
  }
  return choice.clone();
};

const buildConnectorLocalMatrix = (connector) => {
  if (!connector) return null;

  const pos = Array.isArray(connector.pos) && connector.pos.length === 3
    ? connector.pos
    : [0, 0, 0];

  const normal = toVector3(connector.normal, DEFAULT_NORMAL);
  if (normal.lengthSq() === 0) {
    normal.copy(DEFAULT_NORMAL);
  }
  normal.normalize();

  let up = toVector3(connector.up, DEFAULT_UP);
  if (up.lengthSq() === 0) {
    up = pickPerpendicular(normal);
  }

  // Remove component along normal to ensure orthogonality
  const projection = normal.clone().multiplyScalar(up.dot(normal));
  up.sub(projection);
  if (up.lengthSq() === 0) {
    up = pickPerpendicular(normal);
    up.sub(normal.clone().multiplyScalar(up.dot(normal)));
  }
  up.normalize();

  const xAxis = new THREE.Vector3().crossVectors(up, normal);
  if (xAxis.lengthSq() === 0) {
    xAxis.copy(pickPerpendicular(normal));
    xAxis.cross(normal).normalize();
  } else {
    xAxis.normalize();
  }

  const rotation = new THREE.Matrix4().makeBasis(xAxis, up, normal);
  const translation = new THREE.Matrix4().makeTranslation(pos[0], pos[1], pos[2]);

  return new THREE.Matrix4().multiplyMatrices(translation, rotation);
};

const buildObjectMatrix = (obj) => {
  const position = Array.isArray(obj?.pos) && obj.pos.length === 3
    ? new THREE.Vector3(obj.pos[0], obj.pos[1], obj.pos[2])
    : new THREE.Vector3();

  const rotation = Array.isArray(obj?.rot) && obj.rot.length === 3
    ? new THREE.Euler(obj.rot[0], obj.rot[1], obj.rot[2], "XYZ")
    : new THREE.Euler(0, 0, 0, "XYZ");

  const quaternion = new THREE.Quaternion().setFromEuler(rotation);

  const matrix = new THREE.Matrix4();
  matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
  return matrix;
};

const clampTiny = (value) => {
  const EPS = 1e-6;
  if (Math.abs(value) < EPS) return 0;
  return value;
};

const wrapAngle = (angle) => {
  const wrapped = THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
  return clampTiny(wrapped);
};

const extractBasis = (matrix) => {
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  matrix.clone().extractBasis(xAxis, yAxis, zAxis);
  return { xAxis, yAxis, zAxis };
};

const buildTargetFacingMatrix = (anchorWorldMatrix) => {
  const position = new THREE.Vector3().setFromMatrixPosition(anchorWorldMatrix);
  const { xAxis, yAxis, zAxis } = extractBasis(anchorWorldMatrix);

  const anchorUp = yAxis.clone().normalize();
  const anchorNormal = zAxis.clone().normalize();

  const targetNormal = anchorNormal.multiplyScalar(-1).normalize();

  let targetUp = anchorUp.lengthSq() > 0 ? anchorUp.clone() : pickPerpendicular(targetNormal);
  if (Math.abs(targetUp.dot(targetNormal)) > 0.999) {
    targetUp = pickPerpendicular(targetNormal);
  }
  targetUp.normalize();

  let targetX = new THREE.Vector3().crossVectors(targetUp, targetNormal);
  if (targetX.lengthSq() === 0) {
    targetUp = pickPerpendicular(targetNormal);
    targetX = new THREE.Vector3().crossVectors(targetUp, targetNormal);
  }
  targetX.normalize();

  const correctedUp = new THREE.Vector3().crossVectors(targetNormal, targetX).normalize();

  const basisMatrix = new THREE.Matrix4().makeBasis(targetX, correctedUp, targetNormal);
  basisMatrix.setPosition(position);
  return basisMatrix;
};

export const alignObjectsByConnectors = (objects, pair) => {
  if (!Array.isArray(objects) || !Array.isArray(pair) || pair.length !== 2) {
    return null;
  }

  const [anchorSel, moverSel] = pair;
  if (
    !anchorSel ||
    !moverSel ||
    !anchorSel.partId ||
    !anchorSel.connectorId ||
    !moverSel.partId ||
    !moverSel.connectorId ||
    anchorSel.partId === moverSel.partId
  ) {
    return null;
  }

  const anchorObj = objects.find((obj) => obj.id === anchorSel.partId);
  const movingObj = objects.find((obj) => obj.id === moverSel.partId);
  if (!anchorObj || !movingObj) {
    return null;
  }

  const anchorConnector = (anchorObj.connectors || []).find(
    (connector) => connector?.id === anchorSel.connectorId
  );
  const movingConnector = (movingObj.connectors || []).find(
    (connector) => connector?.id === moverSel.connectorId
  );
  if (!anchorConnector || !movingConnector) {
    return null;
  }

  const anchorObjectMatrix = buildObjectMatrix(anchorObj);
  const movingObjectMatrix = buildObjectMatrix(movingObj);
  const anchorConnectorMatrix = buildConnectorLocalMatrix(anchorConnector);
  const movingConnectorMatrix = buildConnectorLocalMatrix(movingConnector);

  if (!anchorConnectorMatrix || !movingConnectorMatrix) {
    return null;
  }

  const anchorWorldMatrix = new THREE.Matrix4().multiplyMatrices(
    anchorObjectMatrix,
    anchorConnectorMatrix
  );

  const movingWorldMatrix = new THREE.Matrix4().multiplyMatrices(
    movingObjectMatrix,
    movingConnectorMatrix
  );

  const targetMatrix = buildTargetFacingMatrix(anchorWorldMatrix);
  const movingWorldInverse = new THREE.Matrix4().copy(movingWorldMatrix).invert();

  const transformationMatrix = new THREE.Matrix4().multiplyMatrices(
    targetMatrix,
    movingWorldInverse
  );

  const newMovingMatrix = new THREE.Matrix4().multiplyMatrices(
    transformationMatrix,
    movingObjectMatrix
  );

  const newPosition = new THREE.Vector3();
  const newQuaternion = new THREE.Quaternion();
  const newScale = new THREE.Vector3();
  newMovingMatrix.decompose(newPosition, newQuaternion, newScale);

  const newEuler = new THREE.Euler().setFromQuaternion(newQuaternion, "XYZ");

  const updatedMoving = {
    ...movingObj,
    pos: [
      clampTiny(newPosition.x),
      clampTiny(newPosition.y),
      clampTiny(newPosition.z),
    ],
    rot: [
      wrapAngle(newEuler.x),
      wrapAngle(newEuler.y),
      wrapAngle(newEuler.z),
    ],
  };

  const updatedObjects = objects.map((obj) => {
    if (obj.id === movingObj.id) {
      return updatedMoving;
    }
    if (obj.id === anchorObj.id) {
      return { ...obj };
    }
    return obj;
  });

  const connection = {
    id: `conn_${Date.now()}`,
    from: { partId: anchorObj.id, connectorId: anchorConnector.id },
    to: { partId: movingObj.id, connectorId: movingConnector.id },
  };

  return {
    objects: updatedObjects,
    connection,
    movedPartId: movingObj.id,
  };
};

const deepCloneConnectors = (connectors) =>
  Array.isArray(connectors)
    ? connectors.map((connector) => JSON.parse(JSON.stringify(connector)))
    : [];

const findPresetForObject = (obj) => {
  const family = PRESETS[obj?.type];
  if (!Array.isArray(family)) {
    return null;
  }

  if (obj?.meta?.presetKey) {
    const presetByKey = family.find((candidate) => candidate.key === obj.meta.presetKey);
    if (presetByKey) {
      return presetByKey;
    }
  }

  const tolerance = 0.5;
  const dims = obj?.dims;
  if (!dims) {
    return null;
  }

  return family.find((candidate) => {
    const candidateDims = candidate.dims || {};
    const compare = (axis) =>
      typeof dims[axis] === "number" &&
      typeof candidateDims[axis] === "number" &&
      Math.abs(dims[axis] - candidateDims[axis]) <= tolerance;
    const axes = ["w", "h", "d"];
    return axes.every((axis) => {
      if (typeof dims[axis] !== "number" || typeof candidateDims[axis] !== "number") {
        return true;
      }
      return compare(axis);
    });
  });
};

export const ensureObjectConnectors = (obj) => {
  if (!obj) {
    return obj;
  }

  const hasConnectors =
    Array.isArray(obj.connectors) && obj.connectors.length > 0;

  if (hasConnectors) {
    return obj;
  }

  const preset = findPresetForObject(obj);
  const presetConnectors = preset?.connectors || [];
  if (!presetConnectors.length && Array.isArray(obj.connectors)) {
    // Nothing to hydrate but connectors array already exists.
    return obj;
  }

  return {
    ...obj,
    connectors: deepCloneConnectors(presetConnectors),
  };
};

export const ensureSceneConnectors = (objects) => {
  let changed = false;
  const nextObjects = objects.map((obj) => {
    if (!obj) return obj;
    const hydrated = ensureObjectConnectors(obj);
    if (hydrated !== obj) {
      changed = true;
    }
    return hydrated;
  });
  return { objects: nextObjects, changed };
};
