import * as THREE from 'three';

/**
 * Calculates the relative transform (position, rotation) of a source object relative to a target object.
 * This is useful for defining CSG operations where the cutter needs to be defined in the local space of the base object.
 * @param {Object} sourceObj - The object to be transformed (e.g., the cutter).
 * @param {Object} targetObj - The reference object (e.g., the base part).
 * @returns {Object|null} - An object containing { pos: [x, y, z], rot: [x, y, z] } or null if invalid.
 */
export const getRelativeTransform = (sourceObj, targetObj) => {
    if (!sourceObj || !targetObj) return null;

    // 1. Get World Transforms for both objects
    const getMatrix = (obj) => {
        const pos = new THREE.Vector3(...(obj.pos || [0, 0, 0]));
        const rot = new THREE.Euler(...(obj.rot || [0, 0, 0]));
        const quat = new THREE.Quaternion().setFromEuler(rot);
        const scale = new THREE.Vector3(...(obj.scale || [1, 1, 1]));
        return new THREE.Matrix4().compose(pos, quat, scale);
    };

    const sourceMatrix = getMatrix(sourceObj);
    const targetMatrix = getMatrix(targetObj);

    // 2. Calculate Relative Matrix: T_rel = inv(T_target) * T_source
    const invTargetMatrix = targetMatrix.clone().invert();
    const relativeMatrix = invTargetMatrix.multiply(sourceMatrix);

    // 3. Decompose back to Pos/Rot/Scale
    const relPos = new THREE.Vector3();
    const relQuat = new THREE.Quaternion();
    const relScale = new THREE.Vector3();

    relativeMatrix.decompose(relPos, relQuat, relScale);
    const relEuler = new THREE.Euler().setFromQuaternion(relQuat);

    return {
        pos: relPos.toArray(),
        rot: [relEuler.x, relEuler.y, relEuler.z]
    };
};

/**
 * Projects the half-extents of a box onto a given world axis.
 * Used to calculate the effective size of an OBB along a specific direction.
 * @param {THREE.Vector3} worldAxis - The normalized world direction vector.
 * @param {Object} dims - Dimensions {w, h, d}.
 * @param {Object} axes - Local axes {ax, ay, az} in world space.
 * @returns {number} - The projected half-extent.
 */
export function projectedHalfExtentAlongAxis(worldAxis, dims, axes) {
    const { ax, ay, az } = axes;
    const w2 = (dims?.w ?? 0) / 2, h2 = (dims?.h ?? 0) / 2, d2 = (dims?.d ?? 0) / 2;
    return (
        Math.abs(worldAxis.dot(ax)) * w2 +
        Math.abs(worldAxis.dot(ay)) * h2 +
        Math.abs(worldAxis.dot(az)) * d2
    );
}

/**
 * Infers the primary axis of movement based on a movement vector and the object's orientation.
 * @param {THREE.Vector3} mv - The movement vector.
 * @param {Object} tf - Transform object containing axes {ax, ay, az}.
 * @returns {Object} - { axis: 'X'|'Y'|'Z', proj: {X, Y, Z}, len: number }
 */
export function inferAxisFromMovement(mv, tf) {
    if (!mv) return { axis: null, proj: { X: 0, Y: 0, Z: 0 }, len: 0 };
    const { ax, ay, az } = tf.axes;
    const len = mv.length();
    const px = Math.abs(mv.dot(ax));
    const py = Math.abs(mv.dot(ay));
    const pz = Math.abs(mv.dot(az));
    let axis = 'X';
    if (py >= px && py >= pz) axis = 'Y';
    else if (pz >= px && pz >= py) axis = 'Z';
    return { axis, proj: { X: px, Y: py, Z: pz }, len };
}

/**
 * Picks the local basis vector of a target object that is most aligned with a given direction.
 * @param {Object} targetTF - Target transform containing axes {ax, ay, az}.
 * @param {THREE.Vector3} selfDir - The direction vector to align with.
 * @returns {Object} - { dir: THREE.Vector3, label: 'X'|'Y'|'Z' }
 */
export function pickTargetBasis(targetTF, selfDir) {
    const { ax, ay, az } = targetTF.axes;
    const candidates = [
        { v: ax, label: 'X' },
        { v: ay, label: 'Y' },
        { v: az, label: 'Z' },
    ];
    let best = candidates[0], bestAbs = -1;
    for (const c of candidates) {
        const v = Math.abs(c.v.dot(selfDir));
        if (v > bestAbs) { bestAbs = v; best = c; }
    }
    return { dir: best.v.clone().normalize(), label: best.label };
}
