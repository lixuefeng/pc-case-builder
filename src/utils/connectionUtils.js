import * as THREE from 'three';
import { getRelativeTransform } from '../hooks/usePartModifiers';

/**
 * Calculates the modifications needed for a Mortise & Tenon joint.
 * @param {Object} tenon - The part acting as the tenon (will be extended).
 * @param {Object} mortise - The part acting as the mortise (will have a hole).
 * @param {number} insertionDepth - The depth of the tenon insertion.
 * @returns {Object} - An object containing the modified tenon and mortise objects, or null if calculation fails.
 *                     Returns { tenon: modifiedTenon, mortise: modifiedMortise }
 */
export const calculateMortiseTenon = (tenon, mortise, insertionDepth) => {
    if (!tenon || !mortise) return null;

    // Helper to get Mortise AABB in Tenon's Local Space
    const getMortiseBoundsInTenonSpace = () => {
        const { w, h, d } = mortise.dims;
        const hw = w / 2, hh = h / 2, hd = d / 2;
        const corners = [
            new THREE.Vector3(hw, hh, hd), new THREE.Vector3(hw, hh, -hd),
            new THREE.Vector3(hw, -hh, hd), new THREE.Vector3(hw, -hh, -hd),
            new THREE.Vector3(-hw, hh, hd), new THREE.Vector3(-hw, hh, -hd),
            new THREE.Vector3(-hw, -hh, hd), new THREE.Vector3(-hw, -hh, -hd)
        ];

        const mortiseRot = new THREE.Euler(...(mortise.rot || [0, 0, 0]));
        const mortiseQuat = new THREE.Quaternion().setFromEuler(mortiseRot);
        const mortisePos = new THREE.Vector3(...mortise.pos);

        const tenonRot = new THREE.Euler(...(tenon.rot || [0, 0, 0]));
        const tenonQuat = new THREE.Quaternion().setFromEuler(tenonRot);
        const invTenonQuat = tenonQuat.clone().invert();
        const tenonPos = new THREE.Vector3(...tenon.pos);

        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

        corners.forEach(c => {
            // Local -> World (Mortise)
            const worldPos = c.clone().applyQuaternion(mortiseQuat).add(mortisePos);
            // World -> Local (Tenon)
            const localPos = worldPos.sub(tenonPos).applyQuaternion(invTenonQuat);
            min.min(localPos);
            max.max(localPos);
        });

        return { min, max };
    };

    const mortiseBounds = getMortiseBoundsInTenonSpace();
    const tenonHalfDims = {
        x: tenon.dims.w / 2,
        y: tenon.dims.h / 2,
        z: tenon.dims.d / 2
    };

    // Calculate Gaps (Distance between AABBs)
    // Gap = max(0, minT - maxM, minM - maxT)
    // Tenon is centered at 0,0,0 in its own space, so minT = -halfDim, maxT = +halfDim
    const gaps = {
        x: Math.max(0, -tenonHalfDims.x - mortiseBounds.max.x, mortiseBounds.min.x - tenonHalfDims.x),
        y: Math.max(0, -tenonHalfDims.y - mortiseBounds.max.y, mortiseBounds.min.y - tenonHalfDims.y),
        z: Math.max(0, -tenonHalfDims.z - mortiseBounds.max.z, mortiseBounds.min.z - tenonHalfDims.z)
    };

    let axis = 'y'; // default

    // Strategy:
    // 1. If there are positive gaps, pick the axis with the SMALLEST positive gap (Closest Face).
    // 2. If all gaps are 0 (Intersection), pick the axis with the LARGEST Tenon dimension (Length).

    const positiveGaps = Object.entries(gaps).filter(([_, val]) => val > 0.001); // epsilon

    if (positiveGaps.length > 0) {
        // Sort by gap size (ascending)
        positiveGaps.sort((a, b) => a[1] - b[1]);
        axis = positiveGaps[0][0];
    } else {
        // Intersection case: Pick longest dimension of Tenon
        const dims = { x: tenon.dims.w, y: tenon.dims.h, z: tenon.dims.d };
        const sortedDims = Object.entries(dims).sort((a, b) => b[1] - a[1]); // Descending
        axis = sortedDims[0][0];
    }

    // Determine direction (+ or -)
    // We need to know which side of the Tenon the Mortise is on.
    // Compare centers.
    const mortiseCenterLocal = new THREE.Vector3()
        .addVectors(mortiseBounds.min, mortiseBounds.max)
        .multiplyScalar(0.5);

    // 1. Modify Tenon: Extend Length
    let tenonEnd = 0;
    let newTenonDims = { ...tenon.dims };
    let shift = new THREE.Vector3();

    if (axis === 'x') {
        const isRight = mortiseCenterLocal.x > 0;
        tenonEnd = isRight ? 1 : -1;
        newTenonDims.w = tenon.dims.w + insertionDepth;
        shift.set((insertionDepth / 2) * tenonEnd, 0, 0);
    } else if (axis === 'y') {
        const isTop = mortiseCenterLocal.y > 0;
        tenonEnd = isTop ? 1 : -1;
        newTenonDims.h = tenon.dims.h + insertionDepth;
        shift.set(0, (insertionDepth / 2) * tenonEnd, 0);
    } else { // z
        const isFront = mortiseCenterLocal.z > 0;
        tenonEnd = isFront ? 1 : -1;
        newTenonDims.d = tenon.dims.d + insertionDepth;
        shift.set(0, 0, (insertionDepth / 2) * tenonEnd);
    }

    const rot = new THREE.Euler(...(tenon.rot || [0, 0, 0]));
    const quat = new THREE.Quaternion().setFromEuler(rot);
    const worldShift = shift.clone().applyQuaternion(quat);

    // Update CSG Operations (Holes) to stay in place
    const newCsgOperations = (tenon.csgOperations || []).map(op => {
        if (op.relativeTransform && op.relativeTransform.pos) {
            const oldPos = new THREE.Vector3(...op.relativeTransform.pos);
            const newPos = oldPos.clone().sub(shift); // shift is already in local space
            return {
                ...op,
                relativeTransform: {
                    ...op.relativeTransform,
                    pos: newPos.toArray()
                }
            };
        }
        return op;
    });

    const modifiedTenon = {
        ...tenon,
        dims: newTenonDims,
        pos: [tenon.pos[0] + worldShift.x, tenon.pos[1] + worldShift.y, tenon.pos[2] + worldShift.z],
        csgOperations: newCsgOperations
    };

    // 2. Modify Mortise: Subtract Tenon (using NEW dimensions)

    const tenonObjForCalc = {
        ...tenon,
        pos: modifiedTenon.pos,
        dims: modifiedTenon.dims,
        rot: modifiedTenon.rot,
        scale: modifiedTenon.scale
    };

    const relTransform = getRelativeTransform(tenonObjForCalc, mortise);

    let modifiedMortise = { ...mortise };
    if (relTransform) {
        const modifier = {
            id: `sub_${tenon.id}_${Date.now()}`,
            type: tenon.type,
            dims: tenonObjForCalc.dims,
            relativeTransform: relTransform,
            scale: tenon.scale || [1, 1, 1]
        };
        modifiedMortise = {
            ...mortise,
            csgOperations: [...(mortise.csgOperations || []), modifier]
        };
    }

    return { tenon: modifiedTenon, mortise: modifiedMortise };
};

/**
 * Calculates the modifications needed for a Cross-Lap joint.
 * @param {Object} partA - The first part (Top part).
 * @param {Object} partB - The second part (Bottom part).
 * @returns {Object} - An object containing the modified parts, or throws an error if intersection is invalid.
 *                     Returns { partA: modifiedPartA, partB: modifiedPartB }
 */
export const calculateCrossLap = (partA, partB) => {
    if (!partA || !partB) return null;

    // 0. Check Intersection (Robust World AABB)
    const getWorldBounds = (p) => {
        const { w, h, d } = p.dims;
        const hw = w / 2, hh = h / 2, hd = d / 2;
        // 8 corners of local box
        const corners = [
            new THREE.Vector3(hw, hh, hd), new THREE.Vector3(hw, hh, -hd),
            new THREE.Vector3(hw, -hh, hd), new THREE.Vector3(hw, -hh, -hd),
            new THREE.Vector3(-hw, hh, hd), new THREE.Vector3(-hw, hh, -hd),
            new THREE.Vector3(-hw, -hh, hd), new THREE.Vector3(-hw, -hh, -hd)
        ];

        const rot = new THREE.Euler(...(p.rot || [0, 0, 0]));
        const quat = new THREE.Quaternion().setFromEuler(rot);
        const pos = new THREE.Vector3(...p.pos);

        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

        corners.forEach(c => {
            c.applyQuaternion(quat).add(pos);
            min.min(c);
            max.max(c);
        });

        return { min, max };
    };

    const bA = getWorldBounds(partA);
    const bB = getWorldBounds(partB);

    const intersectMin = bA.min.clone().max(bB.min);
    const intersectMax = bA.max.clone().min(bB.max);

    // Check if there is a positive intersection volume
    const sizeX = intersectMax.x - intersectMin.x;
    const sizeY = intersectMax.y - intersectMin.y;
    const sizeZ = intersectMax.z - intersectMin.z;

    // Use a small epsilon to avoid floating point issues, but ensure it's > 0
    const epsilon = 1.0; // Require at least 1mm intersection
    if (sizeX < epsilon || sizeY < epsilon || sizeZ < epsilon) {
        throw new Error("Parts must intersect to create a Cross-Lap Joint.");
    }

    // 1. Determine Stack Axis (the axis along which they are stacked/crossing)
    // Heuristic: "Common Smallest Dimension" (Sum of Ranks)
    const sizeA = bA.max.clone().sub(bA.min);
    const sizeB = bB.max.clone().sub(bB.min);

    const getRankedAxes = (size) => {
        const axes = [
            { axis: 'x', val: size.x },
            { axis: 'y', val: size.y },
            { axis: 'z', val: size.z }
        ];
        // Sort: Smallest val = Rank 0
        axes.sort((a, b) => a.val - b.val);
        // Return map: { x: rank, y: rank, z: rank }
        const ranks = {};
        axes.forEach((item, index) => ranks[item.axis] = index);
        return ranks;
    };

    const ranksA = getRankedAxes(sizeA);
    const ranksB = getRankedAxes(sizeB);

    const scores = [
        { axis: 'x', score: ranksA.x + ranksB.x },
        { axis: 'y', score: ranksA.y + ranksB.y },
        { axis: 'z', score: ranksA.z + ranksB.z }
    ];

    // Sort by score (Lowest is best)
    scores.sort((a, b) => a.score - b.score);

    let stackAxis = scores[0].axis;

    // Tie-breaking: If tie, prefer Y (Vertical) -> Z (Depth) -> X (Width)
    if (scores[0].score === scores[1].score) {
        const tied = scores.filter(s => s.score === scores[0].score);
        if (tied.find(s => s.axis === 'y')) stackAxis = 'y';
        else if (tied.find(s => s.axis === 'z')) stackAxis = 'z';
        else stackAxis = 'x';
    }

    // 2. Calculate Cut Plane (Center of Intersection)
    const center = new THREE.Vector3().addVectors(intersectMin, intersectMax).multiplyScalar(0.5);
    const splitPlane = center[stackAxis];

    // Modify Top Part (Part A): Cut from Bottom
    let modifiedPartA = { ...partA };
    {
        const cutter = partB;
        const cutterCurrentTop = bB.max[stackAxis];
        const shiftVal = splitPlane - cutterCurrentTop;

        const newCutterPos = [...cutter.pos];
        if (stackAxis === 'x') newCutterPos[0] += shiftVal;
        if (stackAxis === 'y') newCutterPos[1] += shiftVal;
        if (stackAxis === 'z') newCutterPos[2] += shiftVal;

        const cutterObj = { ...cutter, pos: newCutterPos };
        const relTransform = getRelativeTransform(cutterObj, partA);

        if (relTransform) {
            modifiedPartA = {
                ...partA,
                csgOperations: [...(partA.csgOperations || []), {
                    id: `cross_${cutter.id}_${Date.now()}`,
                    type: cutter.type,
                    dims: cutter.dims,
                    relativeTransform: relTransform,
                    scale: cutter.scale || [1, 1, 1],
                    operation: 'subtract'
                }]
            };
        }
    }

    // Modify Bottom Part (Part B): Cut from Top
    let modifiedPartB = { ...partB };
    {
        const cutter = partA;
        const cutterCurrentBottom = bA.min[stackAxis];
        const shiftVal = splitPlane - cutterCurrentBottom;

        const newCutterPos = [...cutter.pos];
        if (stackAxis === 'x') newCutterPos[0] += shiftVal;
        if (stackAxis === 'y') newCutterPos[1] += shiftVal;
        if (stackAxis === 'z') newCutterPos[2] += shiftVal;

        const cutterObj = { ...cutter, pos: newCutterPos };
        const relTransform = getRelativeTransform(cutterObj, partB);

        if (relTransform) {
            modifiedPartB = {
                ...partB,
                csgOperations: [...(partB.csgOperations || []), {
                    id: `cross_${cutter.id}_${Date.now()}`,
                    type: cutter.type,
                    dims: cutter.dims,
                    relativeTransform: relTransform,
                    scale: cutter.scale || [1, 1, 1],
                    operation: 'subtract'
                }]
            };
        }
    }

    return { partA: modifiedPartA, partB: modifiedPartB };
};
