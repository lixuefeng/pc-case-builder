import * as THREE from "three";
import { EDITOR_CONFIG } from "../constants";

const alog = () => { };

// Original placeholder
const getMotherboardIoCutoutBounds = (dims) => {
    return null;
};

export const getWorldAxesForObject = (obj) => {
    const rot = Array.isArray(obj.rot) ? obj.rot : [0, 0, 0];
    const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rot[0], rot[1], rot[2], "XYZ")
    );
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    return { ax, ay, az };
};

export const getWorldTransform = ({ ref, obj }) => {
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);

    if (ref && ref.current) {
        ref.current.getWorldPosition(p);
        ref.current.getWorldQuaternion(q);
        ref.current.getWorldScale(s);
    } else if (obj) {
        if (obj.pos) p.set(...obj.pos);
        if (obj.rot) q.setFromEuler(new THREE.Euler(...obj.rot));
        if (obj.scale) s.set(...obj.scale);
    }

    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
    const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();

    return { p, q, scale: s, axes: { ax, ay, az } };
};

export const projectedHalfExtentAlongAxis = (worldAxis, dims, axes) => {
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

export const getLocalAxisDir = (tf, axisLabel) => {
    if (!tf || !tf.axes) return null;
    if (axisLabel === 'X') return tf.axes.ax.clone();
    if (axisLabel === 'Y') return tf.axes.ay.clone();
    if (axisLabel === 'Z') return tf.axes.az.clone();
    return null;
};

export const inferAxisFromMovement = (mv, selfTF) => {
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

export const pickTargetBasis = (tf, dir) => {
    if (!tf || !tf.axes) return { dir: new THREE.Vector3(0, 1, 0), label: 'Y' };
    const { ax, ay, az } = tf.axes;
    const dx = Math.abs(dir.dot(ax));
    const dy = Math.abs(dir.dot(ay));
    const dz = Math.abs(dir.dot(az));

    if (dx > dy && dx > dz) return { dir: ax, label: 'X' };
    if (dy > dx && dy > dz) return { dir: ay, label: 'Y' };
    return { dir: az, label: 'Z' };
};

export const computeFaceTransform = (obj, faceName) => {
    const { p, q } = getWorldTransform({ obj });

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

    if (isChild) {
        const childPos = new THREE.Vector3(...(targetObj.pos || [0, 0, 0]));
        const childEuler = new THREE.Euler(...(targetObj.rot || [0, 0, 0]));
        const childQuat = new THREE.Quaternion().setFromEuler(childEuler);
        p.add(childPos.applyQuaternion(q));
        q.multiply(childQuat);
    }

    // Original IO Cutout logic
    if (targetFace === "io-cutout" && targetObj.type === "motherboard") {
        const spec = getMotherboardIoCutoutBounds(targetObj.dims);
        if (!spec) return null;
        // Note: since spec is currently null, this just returns null.
        // If checks pass:
        const localCenter = new THREE.Vector3(...spec.center);
        const localNormal = new THREE.Vector3(...spec.normal);
        const worldCenter = p.clone().add(localCenter.applyQuaternion(q.clone()));
        const worldNormal = localNormal.applyQuaternion(q.clone()).normalize();
        return { center: worldCenter, normal: worldNormal, quaternion: q.clone(), size: { w: 0, h: 0 } };
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
    const surfacePadding = 0;

    const sign = targetFace.startsWith("+") ? 1 : -1;
    let localOffset = new THREE.Vector3();
    let localNormal = new THREE.Vector3();
    let size = [0, 0];

    if (targetFace.endsWith("X")) {
        localOffset.set(sign * (width / 2 + surfacePadding), 0, 0);
        localNormal.set(sign, 0, 0);
        size = [depth, height];
    } else if (targetFace.endsWith("Y")) {
        localOffset.set(0, sign * (height / 2 + surfacePadding), 0);
        localNormal.set(0, sign, 0);
        size = [width, depth];
    } else if (targetFace.endsWith("Z")) {
        localOffset.set(0, 0, sign * (depth / 2 + surfacePadding));
        localNormal.set(0, 0, sign);
        size = [width, height];
    }

    const worldOffset = localOffset.clone().applyQuaternion(q);
    const center = new THREE.Vector3().copy(p).add(worldOffset);
    const normal = localNormal.clone().applyQuaternion(q).normalize();

    return {
        center,
        normal,
        quaternion: q.clone(),
        size: { w: size[0], h: size[1] }
    };
};

export const getConnectorLabel = (part, connectorId) => {
    if (!part || !connectorId) return connectorId || "Unknown connector";
    const connector = (part.connectors || []).find((item) => item?.id === connectorId);
    if (connector?.label) return connector.label;
    return connectorId;
};

export const computeConnectorTransform = (obj, connectorId) => {
    if (!obj || !connectorId) return null;
    const connector = (obj.connectors || []).find((item) => item?.id === connectorId);
    if (!connector) return null;
    const localPos = new THREE.Vector3(
        ...(Array.isArray(connector.pos) ? connector.pos : [0, 0, 0])
    );
    const localNormal = new THREE.Vector3(
        ...(Array.isArray(connector.normal) ? connector.normal : [0, 1, 0])
    ).normalize();
    const localUp = new THREE.Vector3(
        ...(Array.isArray(connector.up) ? connector.up : [0, 0, 1])
    ).normalize();

    // Using simple transform logic
    const position = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(obj.rot || [0, 0, 0])));

    return {
        connector,
        localPos,
        localNormal,
        localUp,
        worldCenter: position.clone().add(localPos.clone().applyQuaternion(quaternion)),
        worldNormal: localNormal.clone().applyQuaternion(quaternion).normalize(),
        worldUp: localUp.clone().applyQuaternion(quaternion).normalize(),
        quaternion,
    };
};

export const flattenObjectsWithTransforms = (objs, parentWorldPos = null, parentWorldQuat = null) => {
    let results = [];
    if (!objs) return results;

    objs.forEach(obj => {
        if (obj.visible === false) return;

        const localPos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
        const localEuler = new THREE.Euler(...(obj.rot || [0, 0, 0]));
        const localQuat = new THREE.Quaternion().setFromEuler(localEuler);
        const s = new THREE.Vector3(...(obj.scale || [1, 1, 1]));

        let worldPos, worldQuat, worldScale;

        if (parentWorldPos && parentWorldQuat) {
            worldPos = parentWorldPos.clone().add(localPos.clone().applyQuaternion(parentWorldQuat));
            worldQuat = parentWorldQuat.clone().multiply(localQuat);
            worldScale = s; // Simplified scale
        } else {
            worldPos = localPos;
            worldQuat = localQuat;
            worldScale = s;
        }

        results.push({
            ...obj,
            worldPos,
            worldQuat,
            worldScale
        });

        if (Array.isArray(obj.children) && obj.children.length > 0) {
            results = results.concat(flattenObjectsWithTransforms(obj.children, worldPos, worldQuat));
        }
    });
    return results;
};

export const getFace2DInfo = (faceName, dims) => {
    let w, h, d;
    if (Array.isArray(dims)) {
        [w, h, d] = dims;
    } else {
        w = dims.w || 0;
        h = dims.h || 0;
        d = dims.d || 0;
    }

    if (faceName === '+X' || faceName === '-X') {
        return { dims: [d, h], axesIndices: [2, 1] }; // Z, Y
    }
    if (faceName === '+Y' || faceName === '-Y') {
        return { dims: [w, d], axesIndices: [0, 2] }; // X, Z
    }
    if (faceName === '+Z' || faceName === '-Z') {
        return { dims: [w, h], axesIndices: [0, 1] }; // X, Y
    }
    return { dims: [0, 0], axesIndices: [0, 1] };
};

export const getClosestEdge = (localPoint, dims) => {
    if (!dims) return { edge: null, distance: Infinity };
    const { w, h, d } = dims;
    const w2 = w / 2;
    const h2 = h / 2;
    const d2 = d / 2;

    const edges = [
        // X-Aligned
        { id: 'top-front', axis: 'x', center: [0, h2, d2], length: w },
        { id: 'top-back', axis: 'x', center: [0, h2, -d2], length: w },
        { id: 'bottom-front', axis: 'x', center: [0, -h2, d2], length: w },
        { id: 'bottom-back', axis: 'x', center: [0, -h2, -d2], length: w },
        // Y-Aligned
        { id: 'front-right', axis: 'y', center: [w2, 0, d2], length: h },
        { id: 'front-left', axis: 'y', center: [-w2, 0, d2], length: h },
        { id: 'back-right', axis: 'y', center: [w2, 0, -d2], length: h },
        { id: 'back-left', axis: 'y', center: [-w2, 0, -d2], length: h },
        // Z-Aligned
        { id: 'top-right', axis: 'z', center: [w2, h2, 0], length: d },
        { id: 'top-left', axis: 'z', center: [-w2, h2, 0], length: d },
        { id: 'bottom-right', axis: 'z', center: [w2, -h2, 0], length: d },
        { id: 'bottom-left', axis: 'z', center: [-w2, -h2, 0], length: d },
    ];

    let minDesc = null;
    let minDist = Infinity;
    const MARGIN = 10; // Allow snapping even if slightly outside (raycast usually on surface though)

    edges.forEach(edge => {
        const c = new THREE.Vector3(...edge.center);
        let dist = 0;

        if (edge.axis === 'x') {
            const dy = localPoint.y - c.y;
            const dz = localPoint.z - c.z;
            dist = Math.sqrt(dy * dy + dz * dz);
            if (Math.abs(localPoint.x) > w2 + MARGIN) dist = Infinity;
        } else if (edge.axis === 'y') {
            const dx = localPoint.x - c.x;
            const dz = localPoint.z - c.z;
            dist = Math.sqrt(dx * dx + dz * dz);
            if (Math.abs(localPoint.y) > h2 + MARGIN) dist = Infinity;
        } else {
            const dx = localPoint.x - c.x;
            const dy = localPoint.y - c.y;
            dist = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(localPoint.z) > d2 + MARGIN) dist = Infinity;
        }

        if (dist < minDist) {
            minDist = dist;
            minDesc = edge;
        }
    });

    return { edge: minDesc, distance: minDist };
};

export const getChamferParams = (edgeId, dims, size) => {
    // Returns { pos, rot, size } for a box cutter
    if (!edgeId || !dims) return null;
    const { w, h, d } = dims;
    const s = size;
    const halfW = w / 2;
    const halfH = h / 2;
    const halfD = d / 2;

    // Cutter dimensions: The face touching the object matches length.
    // The other two dims need to be large enough to cut the corner.
    // For a chamfer size s, the diagonal is s*sqrt(2).
    // Box thickness T should just be > s.
    const T = Math.max(s * 2, 10);

    // Start with default transform
    let pos = new THREE.Vector3();
    let rot = new THREE.Euler();
    let boxSize = [1, 1, 1];

    // Midpoint of chamfer line is offset by s/2 from the surface, 
    // but we want the cutter BOX to be centered at:
    // Midpoint + Normal * (T/2)
    // Where Normal points OUT of the object from the chamfer plane.

    // Simplification:
    // Corner is at (X, Y). Chamfer plane passes through (X, Y-s) and (X-s, Y).
    // We want to cut the triangle (X,Y), (X, Y-s), (X-s, Y).
    // We place a box rotated 45deg.
    // The "bottom" of the box (local y=-T/2) should be on the plane.
    // The plane center M is at (X - s/2, Y - s/2).
    // The box center should be M + Normal * (T/2).
    // Normal is (1, 1) direction for Top-Right (conceptually).

    // Let's go edge by edge (or group by axis).

    const offset = s / 2;
    const N = new THREE.Vector3(1, 1, 1).normalize(); // Placeholder
    const dist = T / 2;

    // Helpers
    // Top (+Y), Bottom (-Y), Front (+Z), Back (-Z), Right (+X), Left (-X)

    switch (edgeId) {
        // X-Aligned (Length W)
        case 'top-front': // +Y, +Z. Corner: (0, h2, d2). Cut: Y and Z.
            boxSize = [w + 2, T, T]; // Extra length for clean cut
            rot = new THREE.Euler(Math.PI / 4, 0, 0); // 45 deg around X
            pos.set(0, halfH - offset + (T / 2) * Math.sin(Math.PI / 4), halfD - offset + (T / 2) * Math.sin(Math.PI / 4));
            // Wait, logic check.
            // Vector from (h2-offset, d2-offset) pointing towards (h2, d2) is (1, 1) in YZ.
            // We want cutter to be OUTWARDS.
            // Normal is (1, 1). Box center = (h2-offset, d2-offset) + (1, 1).normalize() * T/2.
            {
                const cy = halfH - offset;
                const cz = halfD - offset;
                const ny = 1; const nz = 1; // Direction (+Y, +Z) is corner direction relative to center
                const len = Math.sqrt(ny * ny + nz * nz);
                pos.set(0, cy + (ny / len) * dist, cz + (nz / len) * dist);
            }
            break;

        case 'top-back': // +Y, -Z
            boxSize = [w + 2, T, T];
            rot = new THREE.Euler(-Math.PI / 4, 0, 0);
            {
                const cy = halfH - offset;
                const cz = -halfD + offset;
                // Corner direction is (+1, -1) in YZ
                const ny = 1; const nz = -1;
                const len = Math.sqrt(2);
                pos.set(0, cy + (ny / len) * dist, cz + (nz / len) * dist);
            }
            break;

        case 'bottom-front': // -Y, +Z
            boxSize = [w + 2, T, T];
            rot = new THREE.Euler(-Math.PI / 4, 0, 0);
            {
                const cy = -halfH + offset;
                const cz = halfD - offset;
                // Corner direction (-1, +1)
                const ny = -1; const nz = 1;
                const len = Math.sqrt(2);
                pos.set(0, cy + (ny / len) * dist, cz + (nz / len) * dist);
            }
            break;

        case 'bottom-back': // -Y, -Z
            boxSize = [w + 2, T, T];
            rot = new THREE.Euler(Math.PI / 4, 0, 0);
            {
                const cy = -halfH + offset;
                const cz = -halfD + offset;
                // Corner direction (-1, -1)
                const ny = -1; const nz = -1;
                const len = Math.sqrt(2);
                pos.set(0, cy + (ny / len) * dist, cz + (nz / len) * dist);
            }
            break;

        // Y-Aligned (Length H)
        case 'front-right': // +Z, +X. Corner (+w2, +d2)
            boxSize = [T, h + 2, T];
            rot = new THREE.Euler(0, -Math.PI / 4, 0);
            {
                const cx = halfW - offset;
                const cz = halfD - offset;
                // Corner (+1, +1) in XZ
                const nx = 1; const nz = 1;
                const len = Math.sqrt(2);
                pos.set(cx + (nx / len) * dist, 0, cz + (nz / len) * dist);
            }
            break;

        case 'front-left': // +Z, -X. Corner (-w2, +d2)
            boxSize = [T, h + 2, T];
            rot = new THREE.Euler(0, Math.PI / 4, 0);
            {
                const cx = -halfW + offset;
                const cz = halfD - offset;
                // Corner (-1, +1)
                const nx = -1; const nz = 1;
                const len = Math.sqrt(2);
                pos.set(cx + (nx / len) * dist, 0, cz + (nz / len) * dist);
            }
            break;

        case 'back-right': // -Z, +X. Corner (+w2, -d2)
            boxSize = [T, h + 2, T];
            rot = new THREE.Euler(0, Math.PI / 4, 0);
            {
                const cx = halfW - offset;
                const cz = -halfD + offset;
                // (+1, -1)
                const nx = 1; const nz = -1;
                const len = Math.sqrt(2);
                pos.set(cx + (nx / len) * dist, 0, cz + (nz / len) * dist);
            }
            break;

        case 'back-left': // -Z, -X. Corner (-w2, -d2)
            boxSize = [T, h + 2, T];
            rot = new THREE.Euler(0, -Math.PI / 4, 0);
            {
                const cx = -halfW + offset;
                const cz = -halfD + offset;
                // (-1, -1)
                const nx = -1; const nz = -1;
                const len = Math.sqrt(2);
                pos.set(cx + (nx / len) * dist, 0, cz + (nz / len) * dist);
            }
            break;

        // Z-Aligned (Length D)
        case 'top-right': // +Y, +X. Corner (+w2, +h2)
            boxSize = [T, T, d + 2];
            rot = new THREE.Euler(0, 0, Math.PI / 4);
            {
                const cx = halfW - offset;
                const cy = halfH - offset;
                // (+1, +1) in XY
                const nx = 1; const ny = 1;
                const len = Math.sqrt(2);
                pos.set(cx + (nx / len) * dist, cy + (ny / len) * dist, 0);
            }
            break;

        case 'top-left': // +Y, -X. Corner (-w2, +h2)
            boxSize = [T, T, d + 2];
            rot = new THREE.Euler(0, 0, -Math.PI / 4);
            {
                const cx = -halfW + offset;
                const cy = halfH - offset;
                // (-1, +1)
                const nx = -1; const ny = 1;
                const len = Math.sqrt(2);
                pos.set(cx + (nx / len) * dist, cy + (ny / len) * dist, 0);
            }
            break;

        case 'bottom-right': // -Y, +X. Corner (+w2, -h2)
            boxSize = [T, T, d + 2];
            rot = new THREE.Euler(0, 0, -Math.PI / 4);
            {
                const cx = halfW - offset;
                const cy = -halfH + offset;
                // (+1, -1)
                const nx = 1; const ny = -1;
                const len = Math.sqrt(2);
                pos.set(cx + (nx / len) * dist, cy + (ny / len) * dist, 0);
            }
            break;

        case 'bottom-left': // -Y, -X. Corner (-w2, -h2)
            boxSize = [T, T, d + 2];
            rot = new THREE.Euler(0, 0, Math.PI / 4);
            {
                const cx = -halfW + offset;
                const cy = -halfH + offset;
                // (-1, -1)
                const nx = -1; const ny = -1;
                const len = Math.sqrt(2);
                pos.set(cx + (nx / len) * dist, cy + (ny / len) * dist, 0);
            }
            break;
    }


    return { pos, rot, size: boxSize };
};

export const getFilletParams = (edgeId, dims, size) => {
    if (!edgeId || !dims) return null;
    const { w, h, d } = dims;
    const s = size;
    // Box dimensions
    // We create a box at the corner, size s * s (cross section)
    // And subtract a cylinder centered at the inner corner.

    // We need to determine orientation.
    // X-Aligned: YZ plane. 
    // Y-Aligned: XZ plane.
    // Z-Aligned: XY plane.

    // Default values
    let boxSize = [1, 1, 1];
    let boxPos = new THREE.Vector3();
    let boxRot = new THREE.Euler();

    let cylRadius = s;
    let cylHeight = 1;
    let cylPos = new THREE.Vector3(); // Relative to Box
    let cylRot = new THREE.Euler();

    const h2 = h / 2;
    const w2 = w / 2;
    const d2 = d / 2;

    // Helper signals
    let sx = 0, sy = 0, sz = 0;
    let axis = '';

    // Identify edge params
    if (edgeId.includes('top')) sy = 1;
    if (edgeId.includes('bottom')) sy = -1;
    if (edgeId.includes('front')) sz = 1;
    if (edgeId.includes('back')) sz = -1;
    if (edgeId.includes('right')) sx = 1;
    if (edgeId.includes('left')) sx = -1;

    // Refine based on specific names if needed or patterns
    if (edgeId === 'front-right') { sz = 1; sx = 1; sy = 0; }
    if (edgeId === 'front-left') { sz = 1; sx = -1; sy = 0; }
    if (edgeId === 'back-right') { sz = -1; sx = 1; sy = 0; }
    if (edgeId === 'back-left') { sz = -1; sx = -1; sy = 0; }

    // Determine Axis based on usage of dims
    // X-Aligned edges use Y and Z (sy, sz are non-zero)
    if (sy !== 0 && sz !== 0) axis = 'x';
    else if (sx !== 0 && sz !== 0) axis = 'y';
    else if (sx !== 0 && sy !== 0) axis = 'z';

    // Const offset relative for cylinder
    const relOffset = -s / 2;

    if (axis === 'x') {
        boxSize = [w + 2, s, s];
        boxPos.set(0, sy * (h2 - s / 2), sz * (d2 - s / 2));
        boxRot.set(0, 0, 0); // Aligned

        cylHeight = w + 4;
        cylRot.set(0, 0, Math.PI / 2); // Align Z-cylinder to X-axis? default cylinder is Y-aligned. Rotate 90 deg Z.
        cylPos.set(0, sy * relOffset, sz * relOffset);
    }
    else if (axis === 'y') {
        boxSize = [s, h + 2, s];
        boxPos.set(sx * (w2 - s / 2), 0, sz * (d2 - s / 2));
        boxRot.set(0, 0, 0);

        cylHeight = h + 4;
        cylRot.set(0, 0, 0); // Already Y-aligned
        cylPos.set(sx * relOffset, 0, sz * relOffset);
    }
    else if (axis === 'z') {
        boxSize = [s, s, d + 2];
        boxPos.set(sx * (w2 - s / 2), sy * (h2 - s / 2), 0);
        boxRot.set(0, 0, 0);

        cylHeight = d + 4;
        cylRot.set(Math.PI / 2, 0, 0); // Rotate to Z
        cylPos.set(sx * relOffset, sy * relOffset, 0);
    }

    return {
        box: { size: boxSize, pos: boxPos, rot: boxRot },
        cyl: { radius: cylRadius, height: cylHeight, pos: cylPos, rot: cylRot }
    };
};
