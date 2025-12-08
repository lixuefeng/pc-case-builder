/**
 * Position calculation utilities for motherboard holes and connectors.
 * These pure functions can be easily unit tested.
 */

import { MOTHERBOARD_SPECS } from '../constants';

/**
 * Calculate the anchor point for a given dimension and anchor type.
 * @param {Object} dims - { w, h, d }
 * @param {string} anchorType - "top-right-back", "top-left-back", etc.
 * @returns {number[]} [x, y, z]
 */
export const anchorPoint = (dims, anchorType) => {
    const halfW = dims.w / 2;
    const halfH = dims.h / 2;
    const halfD = dims.d / 2;

    switch (anchorType) {
        case 'top-right-back':
            return [halfW, halfH, -halfD];
        case 'top-left-back':
            return [-halfW, halfH, -halfD];
        case 'top-right-front':
            return [halfW, halfH, halfD];
        case 'top-left-front':
            return [-halfW, halfH, halfD];
        case 'bottom-right-back':
            return [halfW, -halfH, -halfD];
        case 'bottom-left-back':
            return [-halfW, -halfH, -halfD];
        default:
            return [0, 0, 0];
    }
};

/**
 * Calculate the world position of a motherboard hole.
 * Uses the same logic as Meshes.jsx MotherboardMesh.
 * 
 * @param {Object} dims - Motherboard dimensions { w, h, d }
 * @param {number} relX - Relative X from anchor (from holeMap)
 * @param {number} relZ - Relative Z from anchor (from holeMap)
 * @param {Object} anchorOffset - { x, y } offset from MOTHERBOARD_SPECS.ANCHOR
 * @returns {number[]} [x, y, z] world position
 */
export const calculateHolePosition = (dims, relX, relZ, anchorOffset = MOTHERBOARD_SPECS.ANCHOR) => {
    const topRightBack = anchorPoint(dims, 'top-right-back');
    return [
        topRightBack[0] + relX + anchorOffset.x,
        0, // Holes are rendered at board surface (y = 0 in local group)
        topRightBack[2] + relZ + anchorOffset.y
    ];
};

/**
 * Calculate all hole positions for a given motherboard.
 * 
 * @param {Object} dims - Motherboard dimensions { w, h, d }
 * @param {Array} holeMap - Array of [relX, relZ] pairs
 * @param {Object} anchorOffset - { x, y } offset
 * @returns {Array} Array of { relX, relZ, pos: [x, y, z] }
 */
export const calculateAllHolePositions = (dims, holeMap, anchorOffset = MOTHERBOARD_SPECS.ANCHOR) => {
    return holeMap.map(([relX, relZ], index) => ({
        index,
        relX,
        relZ,
        pos: calculateHolePosition(dims, relX, relZ, anchorOffset)
    }));
};

/**
 * Calculate connector position using the same anchor logic as holes.
 * This ensures connectors align with holes.
 * 
 * @param {Object} dims - Motherboard dimensions { w, h, d }
 * @param {number} relX - Relative X from anchor
 * @param {number} relZ - Relative Z from anchor
 * @param {Object} anchorOffset - { x, y } offset
 * @returns {number[]} [x, y, z] world position
 */
export const calculateConnectorPosition = (dims, relX, relZ, anchorOffset = MOTHERBOARD_SPECS.ANCHOR) => {
    const topRightBack = anchorPoint(dims, 'top-right-back');
    return [
        topRightBack[0] + relX + anchorOffset.x,
        -dims.h / 2, // Connector at board mid-plane
        topRightBack[2] + relZ + anchorOffset.y
    ];
};
