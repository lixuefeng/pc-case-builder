import * as THREE from 'three';
import { getRelativeTransform } from '../hooks/usePartModifiers';

/**
 * Calculates the modifications needed for a Mortise & Tenon joint.
 * @param {Object} tenon - The part acting as the tenon (will be extended).
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
