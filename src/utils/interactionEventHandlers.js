import * as THREE from "three";

import { getClosestEdge } from "./editorGeometry";
import { canSelectObject } from "./interactionLogic";

/**
 * Pure logic handler for pointer down events on a part.
 * Returns an object indicating action taken: { stopPropagation: boolean, action: string, ... }
 */
export const handlePartPointerDownLogic = ({
    e,
    mode,
    obj,
    hoveredEdge,
    hoveredFace,
    hoveredFaceDetails,
    alignMode,
    onModifyPick,
    onFacePick,
    onDrillHover,
    beginStretchFn
}) => {
    // 1. Modify Mode - Edge Section (Top Priority as fixed)
    if (mode === 'modify') {
        if (hoveredEdge && onModifyPick) {
            return {
                stopPropagation: true,
                action: 'modifyPick',
                payload: {
                    partId: obj.id,
                    edge: hoveredEdge,
                    point: e.point,
                    shiftKey: e.shiftKey || e.nativeEvent?.shiftKey
                }
            };
        }
    }

    const topHit = e.intersections?.[0];
    const topHitIsHole = topHit?.object?.userData?.isHole || topHit?.object?.parent?.userData?.isHole;

    if (mode === "drill" && topHitIsHole) {
        return { action: 'ignore_drill_hole' };
    }

    if (mode === "scale" && hoveredFace) {
        const started = beginStretchFn(hoveredFace, hoveredFaceDetails, e);
        if (started) {
            return { stopPropagation: true, action: 'start_stretch' };
        }
    }

    const isHoleClick = e.target?.userData?.isHole || e.object?.userData?.isHole;
    if (isHoleClick && mode === "drill") {
        return { action: 'ignore_drill_hole_click' };
    }

    if ((alignMode || mode === "ruler" || mode === "cut" || mode === "drill") && hoveredFace && hoveredFaceDetails && onFacePick) {
        const centerVec = new THREE.Vector3(...hoveredFaceDetails.center);
        const normalVec = new THREE.Vector3(...hoveredFaceDetails.normal);
        return {
            stopPropagation: true,
            action: 'facePick',
            payload: {
                partId: obj.id,
                face: hoveredFace,
                shiftKey: e.shiftKey || e?.nativeEvent?.shiftKey,
                center: centerVec,
                normal: normalVec,
                point: e.point ? e.point.toArray() : undefined
            }
        };
    }

    return { action: 'none' };
};

/**
 * Pure logic handler for click events on a part.
 */
export const handlePartClickLogic = ({
    e,
    mode,
    obj,
    hoveredFace,
    hoveredEdge,
    alignMode,
    onSelect
}) => {
    if (!canSelectObject(mode)) return { action: 'blocked_by_mode' };

    // Face interaction check
    if (hoveredFace && (alignMode || mode === 'scale')) {
        return { stopPropagation: true, action: 'prevent_selection_due_to_face' };
    }

    // Cut Mode: Shift+Click is for setting plane, ignore selection
    if (mode === 'cut' && hoveredFace && (e.shiftKey || e?.nativeEvent?.shiftKey)) {
        return { stopPropagation: true, action: 'prevent_selection_due_to_cut_plane' };
    }

    // Edge interaction check (Modify Mode)
    // User Requirement: Clicking edge should NOT select body.
    if (mode === 'modify' && hoveredEdge) {
        return { stopPropagation: true, action: 'prevent_selection_due_to_edge' };
    }

    if (onSelect) {
        return {
            stopPropagation: true,
            action: 'select',
            payload: {
                id: obj.id,
                multi: e.shiftKey || e?.nativeEvent?.shiftKey || e.ctrlKey || e?.nativeEvent?.ctrlKey || e.metaKey || e?.nativeEvent?.metaKey
            }
        };
    }

    return { action: 'none' };
};
