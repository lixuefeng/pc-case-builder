import * as THREE from "three";
import { EDITOR_CONFIG } from "../constants";

// Helper function that was locally defined
const alog = () => { };

// Placeholder if we can't find it - should be resolved
const getMotherboardIoCutoutBounds = (dims) => {
    // TODO: Implement or import correct logic
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

export const computeFaceTransform = (obj, faceName) => {
    if (!obj || !faceName) return null;
    const pos = Array.isArray(obj.pos) ? obj.pos : [0, 0, 0];
    const rot = Array.isArray(obj.rot) ? obj.rot : [0, 0, 0];
    const dims = obj.dims || {};
    const width = dims.w ?? 0;
    const height = dims.h ?? 0;
    const depth = dims.d ?? 0;
    const position = new THREE.Vector3(pos[0], pos[1], pos[2]);
    const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rot[0], rot[1], rot[2], "XYZ")
    );

    if (faceName === "io-cutout" && obj.type === "motherboard") {
        const spec = getMotherboardIoCutoutBounds(dims);
        if (!spec) return null;
        const localCenter = new THREE.Vector3(...spec.center);
        const localNormal = new THREE.Vector3(...spec.normal);
        const worldCenter = position.clone().add(localCenter.applyQuaternion(quaternion.clone()));
        const worldNormal = localNormal.applyQuaternion(quaternion.clone()).normalize();
        return { center: worldCenter, normal: worldNormal };
    }

    let localOffset;
    let localNormal;
    switch (faceName) {
        case "+X":
            localOffset = new THREE.Vector3(width / 2, 0, 0);
            localNormal = new THREE.Vector3(1, 0, 0);
            break;
        case "-X":
            localOffset = new THREE.Vector3(-width / 2, 0, 0);
            localNormal = new THREE.Vector3(-1, 0, 0);
            break;
        case "+Y":
            localOffset = new THREE.Vector3(0, height / 2, 0);
            localNormal = new THREE.Vector3(0, 1, 0);
            break;
        case "-Y":
            localOffset = new THREE.Vector3(0, -height / 2, 0);
            localNormal = new THREE.Vector3(0, -1, 0);
            break;
        case "+Z":
            localOffset = new THREE.Vector3(0, 0, depth / 2);
            localNormal = new THREE.Vector3(0, 0, 1);
            break;
        case "-Z":
            localOffset = new THREE.Vector3(0, 0, -depth / 2);
            localNormal = new THREE.Vector3(0, 0, -1);
            break;
        default:
            return null;
    }

    const worldCenter = position.clone().add(localOffset.applyQuaternion(quaternion));
    const worldNormal = localNormal.clone().applyQuaternion(quaternion).normalize();

    // Fix: Calculate Face World Quaternion (Object Quat * Face Local Quat)
    // This is needed for Drill Tool to establish correct 2D basis on the face.
    const faceLocalQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);
    // Adjust roll for specific faces if needed (like standard views), but setFromUnitVectors is a good start for normal alignment.
    // Better: use the explicit known rotations for each face to preserve roll.
    const preciseLocalQ = new THREE.Quaternion();
    if (faceName === "+X") preciseLocalQ.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    else if (faceName === "-X") preciseLocalQ.setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
    else if (faceName === "+Y") preciseLocalQ.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    else if (faceName === "-Y") preciseLocalQ.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    else if (faceName === "+Z") preciseLocalQ.setFromEuler(new THREE.Euler(0, 0, 0));
    else if (faceName === "-Z") preciseLocalQ.setFromEuler(new THREE.Euler(0, Math.PI, 0));

    const worldFaceQuaternion = quaternion.clone().multiply(preciseLocalQ);

    if (obj.type === "gpu" || obj.type === "gpu-bracket") {
        alog("face-transform:gpu", {
            id: obj.id,
            type: obj.type,
            face: faceName,
            pos,
            rot,
            dims,
            width,
            height,
            depth,
            center: worldCenter.toArray(),
            normal: worldNormal.toArray(),
        });
    }
    // Fix: We must return the OBJECT'S quaternion, because useDrillTool uses
    // axesIndices (e.g. [0, 2] for Y-face) to select basis vectors from the Object's frame.
    // If we return the Face-Aligned quaternion, those indices selects wrong vectors (e.g. Z becomes Y).
    return { center: worldCenter, normal: worldNormal, quaternion: quaternion.toArray() };
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
    const position = new THREE.Vector3(
        ...(Array.isArray(obj.pos) ? obj.pos : [0, 0, 0])
    );
    const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
            ...(Array.isArray(obj.rot) ? obj.rot : [0, 0, 0]),
            "XYZ"
        )
    );
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
    objs.forEach(obj => {
        if (obj.visible === false) return;

        // Calculate World Transform
        const localPos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
        const localEuler = new THREE.Euler(...(obj.rot || [0, 0, 0]));
        const localQuat = new THREE.Quaternion().setFromEuler(localEuler);

        let worldPos, worldQuat;

        if (parentWorldPos && parentWorldQuat) {
            worldPos = parentWorldPos.clone().add(localPos.clone().applyQuaternion(parentWorldQuat));
            worldQuat = parentWorldQuat.clone().multiply(localQuat);
        } else {
            worldPos = localPos;
            worldQuat = localQuat;
        }

        // Add current object
        results.push({
            ...obj,
            worldPos,
            worldQuat
        });

        // Recurse children
        if (Array.isArray(obj.children) && obj.children.length > 0) {
            results = results.concat(flattenObjectsWithTransforms(obj.children, worldPos, worldQuat));
        }
    });
    return results;
};

export const getFace2DInfo = (faceName, size3D) => {
    if (!faceName || !size3D) return null;
    if (faceName.includes("X")) return { dims: [size3D[1], size3D[2]], axesIndices: [1, 2] }; // Y, Z
    if (faceName.includes("Y")) return { dims: [size3D[0], size3D[2]], axesIndices: [0, 2] }; // X, Z
    if (faceName.includes("Z")) return { dims: [size3D[0], size3D[1]], axesIndices: [0, 1] }; // X, Y
    return null; // Fallback or io-cutout
};
