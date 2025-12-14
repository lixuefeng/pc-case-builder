import * as THREE from "three";
import { getWorldTransform } from "./editorGeometry";

const IO_CUTOUT_FACE = "io-cutout";

/**
 * Calculates the visual details (center, size, quaternion, normal) for a given face of an object.
 * 
 * @param {Object} params - The parameters.
 * @param {Object} params.obj - The data object (with dimensions, pos, rot).
 * @param {Object} params.ref - The React ref to the THREE.Group (optional, for world transform).
 * @param {string} params.faceName - The face to get details for (e.g., "+X", "-Y").
 * @returns {Object|null} - The details { center, localCenter, size, quaternion, normal } or null.
 */
export const getFaceDetails = ({ obj, ref, faceName }) => {
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
    const surfacePadding = 0.02;

    const currentFaceName = targetFace;

    let localOffset;
    let size;
    let localNormal;
    const baseQ = new THREE.Quaternion();

    if (currentFaceName === IO_CUTOUT_FACE && obj?.type === "motherboard") {
        // Logic for IO cutout skipped in extraction as it wasn't fully present/working in source review
        return null;
    } else {
        // Ensure we handle both "right" vs "+X" if legacy still exists, but prefer signed
        // The previous raycasting fix returns signed, so we focus on that.

        // Normalize input to handle potential "right" vs "+X" mismatch if any remaining legacy callers exist?
        // For now, assume signed inputs as per recent fix.

        const sign = currentFaceName[0] === "+" ? 1 : -1;
        // Handle the case where faceName might not have +/-, though raycasting.js guarantees it.
        if (!['+', '-'].includes(currentFaceName[0])) return null;

        const axis = currentFaceName.slice(1); // X, Y, Z


        switch (axis) {
            case "X":
                localOffset = new THREE.Vector3(sign * (width / 2 + surfacePadding), 0, 0);
                size = [depth, height];
                localNormal = new THREE.Vector3(sign, 0, 0);
                // Rotate XY plane to YZ plane: Rotate 90 deg around Y axis
                baseQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
                break;
            case "Y":
                localOffset = new THREE.Vector3(0, sign * (height / 2 + surfacePadding), 0);
                size = [width, depth];
                localNormal = new THREE.Vector3(0, sign, 0);
                // Rotate XY plane to XZ plane: Rotate -90 deg around X axis
                baseQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
                break;
            case "Z":
                localOffset = new THREE.Vector3(0, 0, sign * (depth / 2 + surfacePadding));
                size = [width, height];
                localNormal = new THREE.Vector3(0, 0, sign);
                // Already XY plane, no rotation needed (Identity)
                break;
            default:
                return null;
        }
    }

    const localCenter = localOffset.clone();
    const worldOffset = localOffset.clone().applyQuaternion(q);
    const center = new THREE.Vector3().copy(p).add(worldOffset);
    const worldNormal = localNormal.applyQuaternion(q).normalize();

    // Final quaternion = ObjectWorldRot * FaceAlignmentRot
    const finalQuaternion = q.clone().multiply(baseQ);

    return {
        center: center.toArray(),
        localCenter: localCenter.toArray(),
        size,
        quaternion: finalQuaternion, // Return the composed quaternion
        localQuaternion: baseQ,
        normal: worldNormal.toArray(),
    };
};
