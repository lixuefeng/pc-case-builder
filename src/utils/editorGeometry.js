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
