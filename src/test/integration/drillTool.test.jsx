import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useDrillTool } from '../../hooks/useDrillTool.jsx';
import * as THREE from 'three';
import { calculateCrossLap } from '../../utils/connectionUtils';
import { expandObjectsWithEmbedded } from '../../utils/embeddedParts';

// Mock the Store or generic State Container if needed, 
// but for this specific regression (DRILL-03), we can test the Hook in isolation 
// OR simpler: render a fake component that uses the hook.
// Since the bug was about "View Quaternion" vs "State Quaternion", 
// we must ensure we pass the 'View Quaternion' (simulating the Canvas event) to the hook handle.

import { ToastContext } from '../../context/ToastContext';
import { LanguageProvider } from '../../i18n/LanguageContext';

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

    const { handleDrillHover, drillGhost, handleDrillClick } = useDrillTool({
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
        handleDrillClick,
        getGhost: () => drillGhost
    }), [drillGhost, handleDrillHover, handleDrillClick]);

    return null;
}

describe('DRILL-03: Cross Joint Snap Regression (Integration)', () => {
    it('should ignore view-layer quaternion and snap to true surface Y=10', async () => {
        // ... (existing DRILL-03 implementation)
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
        // eslint-disable-next-line
        const renderer = await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <LanguageProvider>
                    <TestDrillComponent
                        objects={objects}
                        drillParams={drillParams}
                        onViewEvent={ref}
                    />
                </LanguageProvider>
            </MockToastProvider>
        );

        const { handleDrillHover, getGhost } = ref.current;

        // 3. Simulate The Bug Condition
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
                quaternion: badViewQuat.toArray()
            });
        });

        // ASSERT
        const ghost = ref.current.getGhost();
        expect(ghost).not.toBeNull();
        expect(ghost.snapped).toBe(true);
        expect(ghost.position[1]).toBeCloseTo(10);
    });

    it('DRILL-01: Basic Face Snap (Cube)', async () => {
        // Setup standard cube
        const cube = {
            id: 'cube_basic', type: 'cube', dims: { w: 20, h: 20, d: 20 },
            pos: [0, 10, 0], rot: [0, 0, 0] // Centered at 0,10,0 -> Top face at Y=20
        };
        const drillParams = { holeDiameter: 5, holeDepth: 5, drillType: 'hole' };
        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <LanguageProvider>
                    <TestDrillComponent objects={[cube]} drillParams={drillParams} onViewEvent={ref} />
                </LanguageProvider>
            </MockToastProvider>
        );

        const { handleDrillHover, getGhost } = ref.current;

        // Act: Hover Top Face (+Y) center
        await ReactThreeTestRenderer.act(async () => {
            handleDrillHover({
                point: [0, 20, 0],
                normal: [0, 1, 0],
                partId: cube.id,
                face: '+Y',
                faceCenter: [0, 20, 0],
                faceSize: [20, 20],
                quaternion: new THREE.Quaternion().toArray() // Identity for basic case
            });
        });

        // Re-read from ref to get updated state
        const ghost = ref.current.getGhost();
        expect(ghost).not.toBeNull();
        expect(ghost.snapped).toBe(false); // No other objects, so it's a free drill (unsnapped)
        expect(ghost.position).toEqual([0, 20, 0]);
        expect(ghost.direction).toEqual([0, 1, 0]);
    });

    it('DRILL-02: Rotated Object Snap', async () => {
        // Setup Cube Rotated 90 X -> Top (+Y) becomes Front (+Z) in World?
        // Wait, Rot 90 X:
        // Local +Y -> World +Z
        // Local +Z -> World -Y
        // Local -Z -> World +Y (This is now Top)

        // Let's use simple 90 deg rotation
        const cube = {
            id: 'cube_rot', type: 'cube', dims: { w: 20, h: 20, d: 20 },
            pos: [0, 0, 0],
            rot: [Math.PI / 2, 0, 0]
        };
        // After rot 90 X:
        // Original Top (+Y) is at World (0, 0, 10). (Front)
        // Original Front (+Z) is at World (0, -10, 0). (Bottom)
        // Original Back (-Z) is at World (0, 10, 0). (Top)

        const drillParams = { holeDiameter: 5, holeDepth: 5, drillType: 'hole' };
        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <LanguageProvider>
                    <TestDrillComponent objects={[cube]} drillParams={drillParams} onViewEvent={ref} />
                </LanguageProvider>
            </MockToastProvider>
        );

        const { handleDrillHover } = ref.current;

        // Act: Hover the new Top Face (which is Local -Z)
        await ReactThreeTestRenderer.act(async () => {
            handleDrillHover({
                point: [0, 10, 0],
                normal: [0, 1, 0], // World Up
                partId: cube.id,
                face: '-Z', // Correct semantic face
                faceCenter: [0, 10, 0], // World center of face
                faceSize: [20, 20],
                quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)).toArray()
            });
        });

        const ghost = ref.current.getGhost();
        expect(ghost).not.toBeNull();
        expect(ghost.snapped).toBe(false); // Free drill
        expect(ghost.position[1]).toBeCloseTo(10);
        // Normal should align with object surface at that point (World Up)
        expect(ghost.direction[1]).toBeCloseTo(1);
    });

    it('DRILL-04: Hole Creation', async () => {
        const cube = {
            id: 'cube_drill_action', type: 'cube', dims: { w: 20, h: 20, d: 20 },
            pos: [0, 0, 0], rot: [0, 0, 0]
        };
        const drillParams = { holeDiameter: 4, holeDepth: 10, drillType: 'hole' };
        const ref = React.createRef();
        let capturedObjects = [cube];

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <LanguageProvider>
                    <TestDrillComponent
                        objects={capturedObjects}
                        drillParams={drillParams}
                        onViewEvent={ref}
                        onStateUpdate={(newObjs) => { capturedObjects = newObjs; }}
                    />
                </LanguageProvider>
            </MockToastProvider>
        );

        const { handleDrillHover, getGhost } = ref.current;

        // 1. Hover to set ghost
        await ReactThreeTestRenderer.act(async () => {
            handleDrillHover({
                point: [5, 10, 5],
                normal: [0, 1, 0],
                partId: cube.id,
                face: '+Y',
                faceCenter: [0, 10, 0],
                faceSize: [20, 20],
                quaternion: [0, 0, 0, 1]
            });
        });

        // 2. Trigger Drill (Ghost has a 'quaternion' we need? No useDrillTool handles it?
        // Wait, how do we trigger click? useDrillTool usually exposes 'performDrill' or we assume a click handler calls something.
        // Checking useDrillTool: it usually returns `handleDrillClick`.
        // We need to update TestDrillComponent to expose handleDrillClick.
    });
});
