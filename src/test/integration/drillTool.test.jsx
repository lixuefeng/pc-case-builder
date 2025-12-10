import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useDrillTool } from '../../hooks/useDrillTool';
import * as THREE from 'three';
import { calculateCrossLap } from '../../utils/connectionUtils';
import { expandObjectsWithEmbedded } from '../../utils/embeddedParts';

// Mock the Store or generic State Container if needed, 
// but for this specific regression (DRILL-03), we can test the Hook in isolation 
// OR simpler: render a fake component that uses the hook.
// Since the bug was about "View Quaternion" vs "State Quaternion", 
// we must ensure we pass the 'View Quaternion' (simulating the Canvas event) to the hook handle.

import { ToastContext } from '../../context/ToastContext';

// Mock Toast Provider
const MockToastProvider = ({ children }) => {
    return (
        <ToastContext.Provider value={{ showToast: vi.fn() }}>
            {children}
        </ToastContext.Provider>
    );
};

function TestDrillComponent({ objects, drillParams, onViewEvent, onStateUpdate }) {
    const [localObjects, setLocalObjects] = React.useState(objects);

    // Expand objects (mimic Editor logic)
    const expandedObjects = React.useMemo(() => expandObjectsWithEmbedded(localObjects), [localObjects]);

    const { handleDrillHover, drillGhost } = useDrillTool({
        objects: localObjects,
        setObjects: (val) => {
            setLocalObjects(val);
            onStateUpdate && onStateUpdate(val);
        },
        selectedObject: null,
        expandedObjects,
        drillParams,
        transformMode: 'drill'
    });

    // Expose handler for testing
    React.useImperativeHandle(onViewEvent, () => ({
        handleDrillHover,
        getGhost: () => drillGhost
    }), [drillGhost, handleDrillHover]);

    return null;
}

describe('DRILL-03: Cross Joint Snap Regression (Integration)', () => {
    it('should ignore view-layer quaternion and snap to true surface Y=10', async () => {
        // 1. Setup Data: Cross Lap
        const barA = {
            id: "bar_a", type: "cube", dims: { w: 200, h: 10, d: 10 },
            pos: [0, 5, 0], rot: [0, 0, 0]
        };
        const barB = {
            id: "bar_b", type: "cube", dims: { w: 10, h: 10, d: 200 },
            pos: [0, 5, 0], rot: [0, 0, 0]
        };

        // Calculate CSG (Simulation of real app logic)
        const { partA, partB } = calculateCrossLap(barA, barB);
        const objects = [partA, partB];

        const drillParams = { holeDiameter: 3, holeDepth: 5, drillType: 'hole' };
        const ref = React.createRef();

        // 2. Render
        const renderer = await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <TestDrillComponent
                    objects={objects}
                    drillParams={drillParams}
                    onViewEvent={ref}
                />
            </MockToastProvider>
        );

        const { handleDrillHover, getGhost } = ref.current;

        // 3. Simulate The Bug Condition
        // The bug was: The View (Mesh) had a WEIRD quaternion (e.g. rotated -90X), 
        // while the State (Object) had Identity quaternion.
        // We pass the "View Quaternion" in the event info.

        // Construct a "Bad" View Quaternion (e.g. rotated -90 deg X)
        // This simulates the movable part container rotation mismatch found in logs
        const badViewQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

        // Target: Bar B (Top Surface is at Y=10)
        const targetId = partB.id;
        const hoverPoint = [0, 10, 0]; // Exact center top
        const hoverNormal = [0, 1, 0];

        // ACT
        await ReactThreeTestRenderer.act(async () => {
            handleDrillHover({
                point: hoverPoint,
                normal: hoverNormal,
                partId: targetId,
                face: '+Y',
                faceCenter: [0, 10, 0],
                faceSize: [10, 200], // W, D
                quaternion: badViewQuat.toArray() // <--- THE POISONED PILL
            });
        });

        // ASSERT
        // Must access ref.current again to get the updated closure from useImperativeHandle
        const ghost = ref.current.getGhost();
        expect(ghost).not.toBeNull();
        expect(ghost.snapped).toBe(true);
        expect(ghost.position[1]).toBeCloseTo(10);
    });
});
