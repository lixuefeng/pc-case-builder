import * as THREE from 'three';

// Helper to get local axis aligned with a world vector
const getAlignedAxis = (obj, worldDir) => {
    const rot = new THREE.Euler(...(obj.rot || [0, 0, 0]));
    const quat = new THREE.Quaternion().setFromEuler(rot);
    const invQuat = quat.clone().invert();

    // Transform world direction to local space
    const localDir = worldDir.clone().applyQuaternion(invQuat).normalize();

    const absX = Math.abs(localDir.x);
    const absY = Math.abs(localDir.y);
    const absZ = Math.abs(localDir.z);

    if (absX > absY && absX > absZ) return 'w'; // Width is length
    if (absY > absX && absY > absZ) return 'h'; // Height is length
    return 'd'; // Depth is length
};

export const validateHalfLapCompatibility = (objA, objB) => {
    if (!objA || !objB) return { compatible: false, reason: "Missing objects" };

    const posA = new THREE.Vector3(...objA.pos);
    const posB = new THREE.Vector3(...objB.pos);
    const dir = new THREE.Vector3().subVectors(posB, posA).normalize();

    // 1. Identify "Length" axis for each object (aligned with connection direction)
    const axisA = getAlignedAxis(objA, dir);
    const axisB = getAlignedAxis(objB, dir); // Note: For B, dir is A->B, but alignment is axis-agnostic (abs)

    // 2. Get Cross-Section Dimensions
    const getCrossSection = (obj, lengthAxis) => {
        const dims = obj.dims || { w: 10, h: 10, d: 10 };
        if (lengthAxis === 'w') return [dims.h, dims.d];
        if (lengthAxis === 'h') return [dims.w, dims.d];
        return [dims.w, dims.h]; // axis === 'd'
    };

    const [csA1, csA2] = getCrossSection(objA, axisA);
    const [csB1, csB2] = getCrossSection(objB, axisB);

    // 3. Compare Cross-Sections (Allow rotation/swapping)
    const tolerance = 0.5; // mm

    const matchDirect = Math.abs(csA1 - csB1) < tolerance && Math.abs(csA2 - csB2) < tolerance;
    const matchSwapped = Math.abs(csA1 - csB2) < tolerance && Math.abs(csA2 - csB1) < tolerance;

    if (!matchDirect && !matchSwapped) {
        return {
            compatible: false,
            reason: `Mismatched cross-section. A: ${csA1.toFixed(1)}x${csA2.toFixed(1)}, B: ${csB1.toFixed(1)}x${csB2.toFixed(1)}`
        };
    }

    return { compatible: true, axisA, axisB, crossSectionMatch: matchDirect ? 'direct' : 'swapped' };
};

export const calculateHalfLapTransforms = (objA, objB, lapLength) => {
    const posA = new THREE.Vector3(...objA.pos);
    const posB = new THREE.Vector3(...objB.pos);
    const dir = new THREE.Vector3().subVectors(posB, posA).normalize();

    if (dir.lengthSq() === 0) {
        console.error("[HalfLap] Objects are at the same position!");
        return null;
    }

    // Re-run validation to get axes
    const validation = validateHalfLapCompatibility(objA, objB);
    if (!validation.compatible) return null;

    const { axisA, axisB } = validation;

    // Helper to get dimension value by axis name
    const getDim = (obj, axis) => (obj.dims || {})[axis] || 0;

    const halfLenA = getDim(objA, axisA) / 2;
    const halfLenB = getDim(objB, axisB) / 2;

    // Calculate Joint Center
    const endA = posA.clone().add(dir.clone().multiplyScalar(halfLenA));
    const startB = posB.clone().sub(dir.clone().multiplyScalar(halfLenB));
    const jointCenter = new THREE.Vector3().addVectors(endA, startB).multiplyScalar(0.5);

    // New Dimensions & Positions
    // We extend along the "Length" axis.

    // New End Points
    const newEndA = jointCenter.clone().add(dir.clone().multiplyScalar(lapLength / 2));
    const newStartB = jointCenter.clone().sub(dir.clone().multiplyScalar(lapLength / 2));

    // Calculate New Lengths and Centers
    // Fixed End A = posA - dir * halfLenA
    const fixedEndA = posA.clone().sub(dir.clone().multiplyScalar(halfLenA));
    const newLenA = fixedEndA.distanceTo(newEndA);
    const newPosA = new THREE.Vector3().addVectors(fixedEndA, newEndA).multiplyScalar(0.5);

    // Fixed End B = posB + dir * halfLenB
    const fixedEndB = posB.clone().add(dir.clone().multiplyScalar(halfLenB));
    const newLenB = fixedEndB.distanceTo(newStartB);
    const newPosB = new THREE.Vector3().addVectors(fixedEndB, newStartB).multiplyScalar(0.5);

    if (isNaN(newLenA) || isNaN(newLenB)) {
        console.error("[HalfLap] Invalid lengths calculated");
        return null;
    }

    // CSG Operations
    // We need to cut "half" of the cross-section in the overlap region.
    // Overlap region size: lapLength (Length Axis) x CrossSection1 x CrossSection2

    // Determine Cut Axis (Perpendicular to Length)
    // We pick one of the cross-section axes to cut along.
    // For simplicity, let's pick the "Height" axis relative to the object if possible.

    const getCutAxisAndSize = (obj, lenAxis) => {
        const dims = obj.dims || { w: 10, h: 10, d: 10 };
        if (lenAxis === 'w') return { axis: 'h', size: dims.h, otherAxis: 'd', otherSize: dims.d };
        if (lenAxis === 'h') return { axis: 'w', size: dims.w, otherAxis: 'd', otherSize: dims.d };
        return { axis: 'h', size: dims.h, otherAxis: 'w', otherSize: dims.w }; // len='d', cut 'h'
    };

    const cutInfoA = getCutAxisAndSize(objA, axisA);
    const cutInfoB = getCutAxisAndSize(objB, axisB);

    // Cut Dimensions
    // We cut 50% of the "Cut Axis" dimension.
    // Width of cut = lapLength (along Length Axis)
    // Height of cut = size / 2
    // Depth of cut = otherSize + 1 (to be safe)

    // CSG Box Dimensions (Local Space)
    // We need to map these back to w, h, d for the CSG box definition
    const getCsgDims = (lenAxis, cutAxis, lenVal, cutVal, otherVal) => {
        const d = {};
        d[lenAxis] = lenVal;
        d[cutAxis] = cutVal;
        // The third axis gets 'otherVal'
        const axes = ['w', 'h', 'd'];
        const otherAxis = axes.find(a => a !== lenAxis && a !== cutAxis);
        d[otherAxis] = otherVal;
        return d;
    };

    // Cut A: Top Half (Positive Cut Axis)
    const csgDimsA = getCsgDims(axisA, cutInfoA.axis, lapLength, cutInfoA.size / 2, cutInfoA.otherSize + 2);

    // Offset A:
    // Along Length: At the tip.
    // Tip is at +newLenA/2 (if dir aligns with +LocalAxis) or -newLenA/2
    // We need to know if 'dir' is + or - local axis.

    // Helper to map dim axis to vector axis
    const dimToVec = { w: 'x', h: 'y', d: 'z' };

    // Check direction in local space
    const rotA = new THREE.Euler(...(objA.rot || [0, 0, 0]));
    const quatA = new THREE.Quaternion().setFromEuler(rotA);
    const localDirA = dir.clone().applyQuaternion(quatA.clone().invert());
    const signA = localDirA[dimToVec[axisA]] >= 0 ? 1 : -1;

    const offsetLenA = signA * ((newLenA / 2) - (lapLength / 2));
    const offsetCutA = cutInfoA.size / 4; // Center of the removed half (0 to size/2 -> center at size/4)

    const csgPosA = [0, 0, 0];
    const axisIdx = { w: 0, h: 1, d: 2 };
    csgPosA[axisIdx[axisA]] = offsetLenA;
    csgPosA[axisIdx[cutInfoA.axis]] = offsetCutA;

    const csgA = {
        type: 'box',
        dims: csgDimsA,
        relativeTransform: { pos: csgPosA, rot: [0, 0, 0] },
        operation: 'subtract',
        id: `cut_${Date.now()}_a`
    };

    // Cut B: Bottom Half (Negative Cut Axis)
    // We need to ensure B's cut complements A's cut.
    // If A cuts "Top", B must cut "Bottom" *relative to the interface*.
    // This is tricky if B is rotated differently.
    // Ideally, we define the cut plane in World Space and transform to Local.

    // Simplified: Just cut the "Negative" side of B's cut axis.
    // This assumes B is oriented such that its "Bottom" meets A's "Top".
    // If they are just 180 deg rotated, this works.

    const csgDimsB = getCsgDims(axisB, cutInfoB.axis, lapLength, cutInfoB.size / 2, cutInfoB.otherSize + 2);

    const rotB = new THREE.Euler(...(objB.rot || [0, 0, 0]));
    const quatB = new THREE.Quaternion().setFromEuler(rotB);
    const localDirB = dir.clone().applyQuaternion(quatB.clone().invert()); // dir is A->B. For B, we want B->A? No, we extend towards A.
    // B extends towards A, which is -dir.
    const extendDirB = localDirB.clone().negate();
    const signB = extendDirB[dimToVec[axisB]] >= 0 ? 1 : -1;

    const offsetLenB = signB * ((newLenB / 2) - (lapLength / 2));
    const offsetCutB = -cutInfoB.size / 4; // Cut the OTHER side (Negative)

    const csgPosB = [0, 0, 0];
    csgPosB[axisIdx[axisB]] = offsetLenB;
    csgPosB[axisIdx[cutInfoB.axis]] = offsetCutB;

    const csgB = {
        type: 'box',
        dims: csgDimsB,
        relativeTransform: { pos: csgPosB, rot: [0, 0, 0] },
        operation: 'subtract',
        id: `cut_${Date.now()}_b`
    };

    return {
        updates: [
            {
                id: objA.id,
                pos: newPosA.toArray(),
                dims: { ...objA.dims, [axisA]: newLenA },
                csgOperations: [...(objA.csgOperations || []), csgA]
            },
            {
                id: objB.id,
                pos: newPosB.toArray(),
                dims: { ...objB.dims, [axisB]: newLenB },
                csgOperations: [...(objB.csgOperations || []), csgB]
            }
        ]
    };
};
