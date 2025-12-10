import * as THREE from "three";

/**
 * Calculates which face of a box is being hovered by a ray.
 * 
 * @param {THREE.Ray} localRay - The ray in local space of the object.
 * @param {number} width - Width of the box.
 * @param {number} height - Height of the box.
 * @param {number} depth - Depth of the box.
 * @returns {string|null} - The name of the hovered face ('top', 'bottom', 'left', 'right', 'front', 'back') or null if no intersection.
 */
export function calculateHoveredFace(localRay, width, height, depth) {
    const halfW = width / 2;
    const halfH = height / 2;
    const halfD = depth / 2;

    const hitPoint = new THREE.Vector3();
    const localBox = new THREE.Box3(
        new THREE.Vector3(-halfW, -halfH, -halfD),
        new THREE.Vector3(halfW, halfH, halfD)
    );

    const hit = localRay.intersectBox(localBox, hitPoint);
    if (!hit) {
        return null;
    }

    const candidates = [
        { face: "+X", value: Math.abs(hitPoint.x - halfW) },
        { face: "-X", value: Math.abs(hitPoint.x + halfW) },
        { face: "+Y", value: Math.abs(hitPoint.y - halfH) },
        { face: "-Y", value: Math.abs(hitPoint.y + halfH) },
        { face: "+Z", value: Math.abs(hitPoint.z - halfD) },
        { face: "-Z", value: Math.abs(hitPoint.z + halfD) },
    ];

    let resolvedFace = candidates.reduce((prev, cur) =>
        cur.value < prev.value ? cur : prev
    ).face;

    return resolvedFace;
}
