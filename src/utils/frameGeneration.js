import * as THREE from "three";
import {
  buildConnectorLocalMatrix,
  buildObjectMatrix,
} from "./connectors";

/**
 * Skeleton helpers for the upcoming automatic frame generation pipeline.
 * Each function currently returns placeholder data so we can integrate/fan out
 * the call sites gradually while keeping the app stable.
 */

export const DEFAULT_FRAME_ROOT_HINT = "motherboard";
const FRAME_BAR_SIZE = 10;
const FRAME_BASE_CLEARANCE = 2;
const FRAME_IO_CLEARANCE = 0;

const EPS = 1e-6;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const ensureVec3Array = (value, fallback = [0, 0, 0]) => {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((component) => Number.isFinite(component))
  ) {
    return value;
  }
  return fallback.slice();
};

const clampTiny = (value) => {
  if (Math.abs(value) < EPS) return 0;
  return value;
};

const wrapAngle = (angle) => {
  const wrapped =
    THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
  return clampTiny(wrapped);
};

const matrixToPose = (matrix) => {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  return {
    matrix,
    position: [clampTiny(position.x), clampTiny(position.y), clampTiny(position.z)],
    rotation: [wrapAngle(euler.x), wrapAngle(euler.y), wrapAngle(euler.z)],
  };
};

const applyMatrixToPoint = (matrix, point) => {
  const vec = new THREE.Vector3(point[0], point[1], point[2]);
  vec.applyMatrix4(matrix);
  return [vec.x, vec.y, vec.z];
};

const computeWorldPositionFromMatrices = (objectMatrix, localMatrix) => {
  if (!objectMatrix || !localMatrix) {
    return null;
  }
  const worldMatrix = new THREE.Matrix4().multiplyMatrices(
    objectMatrix,
    localMatrix
  );
  const position = new THREE.Vector3().setFromMatrixPosition(worldMatrix);
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    return null;
  }
  return [position.x, position.y, position.z];
};

const getConnectorWorldPosition = (nodeId, connector, poseMap) => {
  if (!nodeId || !connector) {
    return null;
  }
  const pose = poseMap.get(nodeId);
  if (!pose?.matrix) {
    return null;
  }
  const connectorMatrix = buildConnectorLocalMatrix(connector);
  if (!connectorMatrix) {
    return null;
  }
  return computeWorldPositionFromMatrices(pose.matrix, connectorMatrix);
};

const deriveOrientationFromPose = (matrix) => {
  if (!matrix) {
    return "horizontal";
  }
  const elements = matrix.elements;
  const axisY = new THREE.Vector3(elements[4], elements[5], elements[6]);
  if (axisY.lengthSq() < EPS) {
    return "horizontal";
  }
  axisY.normalize();
  const alignment = Math.abs(axisY.dot(WORLD_UP));
  return alignment >= 0.5 ? "horizontal" : "vertical";
};

const inferPartRole = (object = {}) => {
  if (object.meta?.role) {
    return object.meta.role;
  }
  if (object.type === "motherboard") return "motherboard";
  if (object.type === "gpu") return "gpu";
  if (object.type === "ram") return "ram";
  if (object.type === "psu") return "psu";
  return object.type || "generic";
};

const pickRootId = (objects = []) => {
  const explicitRoot = objects.find(
    (obj) =>
      obj?.meta?.root === true ||
      obj?.meta?.role === DEFAULT_FRAME_ROOT_HINT ||
      obj?.type === DEFAULT_FRAME_ROOT_HINT
  );
  if (explicitRoot?.id) {
    return explicitRoot.id;
  }
  const firstMotherboard = objects.find((obj) => obj?.type === "motherboard");
  if (firstMotherboard?.id) {
    return firstMotherboard.id;
  }
  return objects[0]?.id ?? null;
};

const normalizeConnector = (connector) => {
  if (!connector) return null;
  return {
    id: connector.id,
    label: connector.label,
    slotType: connector.slotType || connector.type || "generic-slot",
    type: connector.type,
    pos: Array.isArray(connector.pos) ? connector.pos : [0, 0, 0],
    normal: Array.isArray(connector.normal) ? connector.normal : [0, 1, 0],
    up: Array.isArray(connector.up) ? connector.up : null,
    meta: connector.meta || {},
  };
};

const buildEdgeId = (connection, fallbackIndex) =>
  connection?.id ||
  [
    connection?.from?.partId,
    connection?.from?.connectorId,
    "to",
    connection?.to?.partId,
    connection?.to?.connectorId,
    fallbackIndex,
  ]
    .filter(Boolean)
    .join("__");

/**
 * Builds a lightweight graph describing how parts connect together.
 * @param {Array} objects - Scene objects authored by the user.
 * @param {Array} connections - Existing connector pairings.
 * @returns {{ nodes: Map<string, object>, edges: Array<object>, rootId: string|null, warnings: Array<string> }}
 */
export function buildPartGraph(objects = [], connections = []) {
  const nodes = new Map();
  const warnings = [];

  objects.forEach((object) => {
    if (!object?.id) {
      warnings.push("Encountered object without id, skipped.");
      return;
    }
    const connectors = Array.isArray(object.connectors)
      ? object.connectors.map((connector) => normalizeConnector(connector)).filter(Boolean)
      : [];
    nodes.set(object.id, {
      id: object.id,
      type: object.type,
      role: inferPartRole(object),
      name: object.name,
      pos: ensureVec3Array(object.pos),
      rot: ensureVec3Array(object.rot),
      connectors,
      connectorById: connectors.reduce((acc, connector) => {
        if (connector?.id) {
          acc[connector.id] = connector;
        }
        return acc;
      }, {}),
      metadata: {
        dims: object.dims,
        hints: object.meta,
      },
    });
  });

  const edges = [];
  connections.forEach((connection, index) => {
    const fromPart = nodes.get(connection?.from?.partId);
    const toPart = nodes.get(connection?.to?.partId);
    if (!fromPart || !toPart) {
      warnings.push(
        `Connection ${index} references unknown part (${connection?.from?.partId} -> ${connection?.to?.partId}).`
      );
      return;
    }
    const fromConnectorId = connection?.from?.connectorId;
    const toConnectorId = connection?.to?.connectorId;

    const fromConnector =
      fromConnectorId && fromPart.connectorById
        ? fromPart.connectorById[fromConnectorId]
        : null;
    const toConnector =
      toConnectorId && toPart.connectorById ? toPart.connectorById[toConnectorId] : null;

    if (fromConnectorId && !fromConnector) {
      warnings.push(
        `Connection ${index} missing source connector ${fromConnectorId} on ${fromPart.id}.`
      );
    }
    if (toConnectorId && !toConnector) {
      warnings.push(
        `Connection ${index} missing target connector ${toConnectorId} on ${toPart.id}.`
      );
    }

    edges.push({
      id: buildEdgeId(connection, index),
      from: {
        partId: fromPart.id,
        connectorId: fromConnectorId ?? null,
        connector: fromConnector,
      },
      to: {
        partId: toPart.id,
        connectorId: toConnectorId ?? null,
        connector: toConnector,
      },
      relation: connection.relation || "attached",
      meta: connection.meta || {},
    });
  });

  return {
    nodes,
    edges,
    warnings,
    rootId: pickRootId(objects),
  };
}

/**
 * Derives world poses for every part in the graph. For now it simply mirrors
 * the existing object transforms so the scene behaves as before.
 * @param {{ nodes: Map<string, object>, edges: Array<object>, rootId: string|null }} graph
 * @returns {Map<string, { position: Array<number>, rotation: Array<number> }>}
 */
const resolveConnector = (node, connectorRef, connectorId) => {
  if (connectorRef) {
    return connectorRef;
  }
  if (!connectorId || !node?.connectorById) {
    return null;
  }
  return node.connectorById[connectorId] ?? null;
};

const describeEdge = (edge) => {
  if (!edge) return "unknown edge";
  return `${edge.from?.partId || "?"}:${edge.from?.connectorId || "?"} -> ${
    edge.to?.partId || "?"
  }:${edge.to?.connectorId || "?"}`;
};

export function solvePartPoses(graph) {
  const poseMap = new Map();
  const warnings = [];

  if (!graph?.nodes || graph.nodes.size === 0) {
    poseMap.debug = { warnings };
    return poseMap;
  }

  const rootId =
    graph.rootId && graph.nodes.has(graph.rootId)
      ? graph.rootId
      : graph.nodes.keys().next().value;

  if (!rootId) {
    poseMap.debug = { warnings };
    return poseMap;
  }

  const adjacency = new Map();
  (graph.edges || []).forEach((edge) => {
    if (!edge?.from?.partId || !edge?.to?.partId) {
      warnings.push(`Skipped malformed edge: ${JSON.stringify(edge)}`);
      return;
    }
    const forward = {
      edge,
      anchorSide: "from",
      anchorId: edge.from.partId,
      movingId: edge.to.partId,
    };
    const backward = {
      edge,
      anchorSide: "to",
      anchorId: edge.to.partId,
      movingId: edge.from.partId,
    };

    if (!adjacency.has(forward.anchorId)) {
      adjacency.set(forward.anchorId, []);
    }
    adjacency.get(forward.anchorId).push(forward);

    if (!adjacency.has(backward.anchorId)) {
      adjacency.set(backward.anchorId, []);
    }
    adjacency.get(backward.anchorId).push(backward);
  });

  const matrixStore = new Map();
  const enqueue = [];
  const rootNode = graph.nodes.get(rootId);
  const rootMatrix = buildObjectMatrix(rootNode);
  const rootPose = matrixToPose(rootMatrix);
  poseMap.set(rootId, {
    position: rootPose.position,
    rotation: rootPose.rotation,
    matrix: rootPose.matrix,
  });
  matrixStore.set(rootId, rootPose.matrix);
  enqueue.push(rootId);

  const solveChildPose = (anchorId, descriptor) => {
    const { edge, anchorSide, movingId } = descriptor;
    const anchorNode = graph.nodes.get(anchorId);
    const movingNode = graph.nodes.get(movingId);
    if (!anchorNode || !movingNode) {
      warnings.push(
        `Pose solver edge skipped because node missing: ${describeEdge(edge)}`
      );
      return null;
    }
    const anchorConnectorId =
      anchorSide === "from"
        ? edge.from?.connectorId
        : edge.to?.connectorId;
    const movingConnectorId =
      anchorSide === "from"
        ? edge.to?.connectorId
        : edge.from?.connectorId;

    const anchorConnector = resolveConnector(
      anchorNode,
      anchorSide === "from" ? edge.from?.connector : edge.to?.connector,
      anchorConnectorId
    );
    const movingConnector = resolveConnector(
      movingNode,
      anchorSide === "from" ? edge.to?.connector : edge.from?.connector,
      movingConnectorId
    );

    if (!anchorConnector || !movingConnector) {
      warnings.push(
        `Pose solver missing connector(s) for edge ${describeEdge(edge)}`
      );
      return null;
    }

    const anchorObjectMatrix = matrixStore.get(anchorId);
    if (!anchorObjectMatrix) {
      warnings.push(`Anchor matrix missing for ${anchorId}`);
      return null;
    }

    const anchorConnectorMatrix = buildConnectorLocalMatrix(anchorConnector);
    const movingConnectorMatrix = buildConnectorLocalMatrix(movingConnector);

    if (!anchorConnectorMatrix || !movingConnectorMatrix) {
      warnings.push(
        `Failed to build connector matrices for edge ${describeEdge(edge)}`
      );
      return null;
    }

    const movingObjectMatrix = buildObjectMatrix(movingNode);

    const anchorWorldConnector = new THREE.Matrix4().multiplyMatrices(
      anchorObjectMatrix,
      anchorConnectorMatrix
    );
    const movingWorldConnector = new THREE.Matrix4().multiplyMatrices(
      movingObjectMatrix,
      movingConnectorMatrix
    );

    const transformationMatrix = new THREE.Matrix4().multiplyMatrices(
      anchorWorldConnector,
      movingWorldConnector.clone().invert()
    );
    const newMovingMatrix = new THREE.Matrix4().multiplyMatrices(
      transformationMatrix,
      movingObjectMatrix
    );
    return matrixToPose(newMovingMatrix);
  };

  while (enqueue.length > 0) {
    const anchorId = enqueue.shift();
    const neighbors = adjacency.get(anchorId) || [];
    neighbors.forEach((descriptor) => {
      const targetId = descriptor.movingId;
      if (matrixStore.has(targetId)) {
        return;
      }
      const solvedPose = solveChildPose(anchorId, descriptor);
      if (!solvedPose) {
        return;
      }
      matrixStore.set(targetId, solvedPose.matrix);
      poseMap.set(targetId, {
        position: solvedPose.position,
        rotation: solvedPose.rotation,
        matrix: solvedPose.matrix,
      });
      enqueue.push(targetId);
    });
  }

  graph.nodes.forEach((node, nodeId) => {
    if (poseMap.has(nodeId)) {
      return;
    }
    warnings.push(
      `Part ${nodeId} was not connected to the root. Using existing transform.`
    );
    poseMap.set(nodeId, {
      position: ensureVec3Array(node.pos),
      rotation: ensureVec3Array(node.rot),
      matrix: buildObjectMatrix({
        pos: ensureVec3Array(node.pos),
        rot: ensureVec3Array(node.rot),
      }),
    });
  });

  poseMap.debug = { warnings };
  return poseMap;
}

/**
 * Generates frame segment descriptors from the solved poses. These descriptors
 * will later be converted into actual meshes inside the scene.
 * @param {{ nodes: Map<string, object> }} graph
 * @param {Map<string, object>} poseMap
 * @returns {Array<{ id: string, start: Array<number>, end: Array<number>, kind: string }>}
 */
const pushSegment = (segments, warnings, meta = {}) => {
  const { start, end } = meta;
  if (!Array.isArray(start) || !Array.isArray(end)) {
    return;
  }
  const startVec = new THREE.Vector3().fromArray(start);
  const endVec = new THREE.Vector3().fromArray(end);
  const delta = new THREE.Vector3().subVectors(endVec, startVec);
  const length = delta.length();
  if (!Number.isFinite(length) || length < EPS) {
    warnings.push(
      `Frame segment skipped: invalid length between ${JSON.stringify(start)} and ${JSON.stringify(
        end
      )}`
    );
    return;
  }
  segments.push({
    id: meta.id || `frame_${segments.length + 1}`,
    start: [startVec.x, startVec.y, startVec.z],
    end: [endVec.x, endVec.y, endVec.z],
    length,
    direction: delta.normalize().toArray(),
    relation: meta.relation || "frame",
    sourceEdgeId: meta.sourceEdgeId || null,
    kind: meta.kind || "frame",
    from: meta.from || null,
    to: meta.to || null,
    metadata: meta.meta || null,
  });
};

const generateRootBaseFrame = (graph, poseMap, warnings) => {
  const rootId = graph?.rootId;
  if (!rootId) {
    return [];
  }
  const rootNode = graph.nodes.get(rootId);
  if (!rootNode || rootNode.type !== "motherboard") {
    return [];
  }
  const dims = rootNode.metadata?.dims || {};
  const width = dims.w || dims.width || 200;
  const depth = dims.d || dims.depth || 200;
  const height = dims.h || dims.height || 20;

  const baseMatrix = poseMap.get(rootNode.id)?.matrix;
  if (!baseMatrix) {
    warnings.push("Missing pose matrix for motherboard root.");
    return [];
  }

  const hintedOrientation = rootNode.metadata?.hints?.orientation;
  const orientation =
    hintedOrientation === "vertical" || hintedOrientation === "horizontal"
      ? hintedOrientation
      : deriveOrientationFromPose(baseMatrix);

  const insetBy = Math.max(FRAME_BAR_SIZE / 2, 0);
  const halfWidth = Math.max(width / 2 - insetBy, 0);
  const halfDepth = Math.max(depth / 2 - insetBy, 0);
  const halfHeight = Math.max(height / 2, 0);
  const halfHeightInset = Math.max(halfHeight - insetBy, 0);

  const additionalVerticalOffset = 2; // extra clearance to avoid IO cutout interference
  const basePlaneValue =
    orientation === "vertical"
      ? -depth / 2 - FRAME_BAR_SIZE / 2 - FRAME_IO_CLEARANCE
      : -halfHeight - FRAME_BAR_SIZE / 2 - FRAME_BASE_CLEARANCE - additionalVerticalOffset;

  const localCorners =
    orientation === "vertical"
      ? [
          [-halfWidth, -halfHeightInset, basePlaneValue],
          [halfWidth, -halfHeightInset, basePlaneValue],
          [halfWidth, halfHeightInset, basePlaneValue],
          [-halfWidth, halfHeightInset, basePlaneValue],
        ]
      : [
          [-halfWidth, basePlaneValue, -halfDepth],
          [halfWidth, basePlaneValue, -halfDepth],
          [halfWidth, basePlaneValue, halfDepth],
          [-halfWidth, basePlaneValue, halfDepth],
        ];

  const worldCorners = localCorners.map((corner) => applyMatrixToPoint(baseMatrix, corner));

  const extendSegmentForThickness = (start, end, size = FRAME_BAR_SIZE) => {
    const offset = Math.max(size / 2, 0);
    const dir = [
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2],
    ];
    const length = Math.hypot(dir[0], dir[1], dir[2]);
    if (length < EPS || offset === 0) {
      return { start, end };
    }
    const nx = (dir[0] / length) * offset;
    const ny = (dir[1] / length) * offset;
    const nz = (dir[2] / length) * offset;
    return {
      start: [start[0] - nx, start[1] - ny, start[2] - nz],
      end: [end[0] + nx, end[1] + ny, end[2] + nz],
    };
  };

  const baseSegments = [];
  for (let i = 0; i < worldCorners.length; i += 1) {
    const start = worldCorners[i];
    const end = worldCorners[(i + 1) % worldCorners.length];
    const extended = extendSegmentForThickness(start, end, FRAME_BAR_SIZE);
    baseSegments.push({
      id: `base_${rootNode.id}_${i}`,
      start: extended.start,
      end: extended.end,
      kind: "motherboard-base",
      relation: "frame",
      meta: {
        orientation,
        size: FRAME_BAR_SIZE,
      },
    });
  }

  const anchorConnectors = (rootNode.connectors || []).filter(
    (connector) => connector.slotType === "mb-mount"
  );

  anchorConnectors.forEach((connector, idx) => {
    const connectorWorld = getConnectorWorldPosition(rootNode.id, connector, poseMap);
    if (!connectorWorld) {
      warnings.push(`Missing world position for connector ${connector.id} on ${rootNode.id}`);
      return;
    }
    const localBasePoint =
      orientation === "vertical"
        ? [connector.pos?.[0] ?? 0, connector.pos?.[1] ?? 0, basePlaneValue]
        : [connector.pos?.[0] ?? 0, basePlaneValue, connector.pos?.[2] ?? 0];
    const basePoint = applyMatrixToPoint(baseMatrix, localBasePoint);
    pushSegment(baseSegments, warnings, {
      id: `mount_post_${rootNode.id}_${connector.id}`,
      start: basePoint,
      end: connectorWorld,
      kind: "mount-post",
      relation: "frame",
      meta: { orientation, size: FRAME_BAR_SIZE * 0.6 },
    });
  });

  if (orientation === "vertical") {
    const groundY = 0;
    [0, 1, 2, 3].forEach((index) => {
      const point = worldCorners[index];
      if (!point) return;
      const groundPoint = [point[0], groundY, point[2]];
      pushSegment(baseSegments, warnings, {
        id: `base_support_${rootNode.id}_${index}`,
        start: point,
        end: groundPoint,
        kind: "motherboard-support",
        relation: "frame",
        meta: { orientation: "vertical", size: FRAME_BAR_SIZE },
      });
    });
  }

  return baseSegments;
};

export function generateFrameSegments(graph, poseMap) {
  const warnings = [];
  if (!graph?.nodes || graph.nodes.size === 0 || !poseMap) {
    return { segments: [], warnings };
  }

  const segments = [];
  const seenPairs = new Set();

  const baseSegments = generateRootBaseFrame(graph, poseMap, warnings);
  baseSegments.forEach((segment) => {
    pushSegment(segments, warnings, segment);
  });

  (graph.edges || []).forEach((edge, index) => {
    if (edge?.relation !== "frame") {
      return;
    }
    const fromId = edge?.from?.partId;
    const toId = edge?.to?.partId;
    if (!fromId || !toId) {
      warnings.push(`Frame segment skipped: edge ${index} missing part ids.`);
      return;
    }

    const pairKey = [fromId, toId, edge.from?.connectorId, edge.to?.connectorId]
      .filter(Boolean)
      .join("__");
    if (seenPairs.has(pairKey)) {
      return;
    }
    seenPairs.add(pairKey);

    const fromConnector = resolveConnector(
      graph.nodes.get(fromId),
      edge.from?.connector,
      edge.from?.connectorId
    );
    const toConnector = resolveConnector(
      graph.nodes.get(toId),
      edge.to?.connector,
      edge.to?.connectorId
    );

    const start = getConnectorWorldPosition(fromId, fromConnector, poseMap);
    const end = getConnectorWorldPosition(toId, toConnector, poseMap);
    if (!start || !end) {
      warnings.push(
        `Frame segment skipped: connector transform missing for edge ${edge.id}`
      );
      return;
    }

    pushSegment(segments, warnings, {
      id: `edge_${pairKey}`,
      start,
      end,
      relation: "frame",
      sourceEdgeId: edge.id,
      from: {
        partId: fromId,
        connectorId: fromConnector?.id ?? edge.from?.connectorId ?? null,
        slotType: fromConnector?.slotType,
      },
      to: {
        partId: toId,
        connectorId: toConnector?.id ?? edge.to?.connectorId ?? null,
        slotType: toConnector?.slotType,
      },
    });
  });

  return { segments, warnings };
}
