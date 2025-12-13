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

/**
 * Normalizes an angle in degrees to the range (-180, 180].
 * @param {number} deg - The angle in degrees.
 * @returns {number} - The normalized angle.
 */
export function normalizeDegree(deg) {
    if (typeof deg !== 'number' || isNaN(deg)) return 0;
    // (deg % 360) reduces it to (-360, 360)
    let d = deg % 360;
    // shift to (-180, 540) then mod again isn't quite right for negatives.
    // Easier:
    // 1. reduce to (-360, 360)
    // 2. force to (0, 360] or similar

    // Standard formula: ((deg + 180) % 360) - 180
    // But Javascript % operator is remainder, not modulo, so it can return negative.

    d = (d + 360) % 360; // now in [0, 360)
    if (d > 180) d -= 360; // now in (-180, 180]

    return d;
}

/**
 * Sets targetEuler from quaternion trying to strictly minimize the change from prevEuler.
 * This helps avoid 360-degree jumps or Gimbal-lock flips (e.g. 0,90,0 -> 180,90,180).
 * @param {THREE.Euler} targetEuler - The euler object to update.
 * @param {THREE.Quaternion} quaternion - The source quaternion.
 * @param {THREE.Euler} prevEuler - The previous frame's euler angles.
 * @param {string} order - Euler order (default 'XYZ').
 */
export function setEulerFromQuaternionPreservingContinuity(targetEuler, quaternion, prevEuler, order = 'XYZ') {
    // 1. Get standard solution
    const tempEuler = new THREE.Euler().setFromQuaternion(quaternion, order);

    // 2. Generate alternative solutions
    // A quaternion q can be represented by Euler (x,y,z) and also others often involving +/- 180 flips or +/- 360 shifts.
    // Simplifying assumption:
    // We mainly care about +/- 360 shifts for each axis to be close to prev.
    // AND the "alternative" Euler branch representation which usually means (x+180, 180-y, z+180) type things.

    // For now, let's just handle the +/- 360 shift to keep it simple but effective for "winding".
    // AND check the "flipped" version if it exists.

    // However, Three.js setFromQuaternion is deterministic.
    // If we want to support "winding" (going past 360), we need to shift tempEuler components by multiples of 360 
    // to match prevEuler components.

    const adjust = (val, prevVal) => {
        const diff = val - prevVal;
        // if diff is > 180, subtract 360
        // if diff is < -180, add 360
        // We want to minimize |val + k*360 - prevVal|
        // rounds roughly to finding nearest k
        const k = Math.round((prevVal - val) / (2 * Math.PI));
        return val + k * 2 * Math.PI;
    };

    targetEuler.set(
        adjust(tempEuler.x, prevEuler.x),
        adjust(tempEuler.y, prevEuler.y),
        adjust(tempEuler.z, prevEuler.z),
        order
    );
}
