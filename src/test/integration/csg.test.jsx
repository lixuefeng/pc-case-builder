import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useCutTool } from '../../hooks/useCutTool';
import { usePartModifiers } from '../../hooks/usePartModifiers';
import { ToastContext } from '../../context/ToastContext';
import * as THREE from 'three';

// Mock Toast Provider
const MockToastProvider = ({ children }) => {
    return (
        <ToastContext.Provider value={{ showToast: vi.fn() }}>
            {children}
        </ToastContext.Provider>
    );
};

// Test Component for useCutTool
function TestCutComponent({ objects, setObjects, selectedIds, setSelectedIds, onViewEvent }) {
    // Mock transformMode state
    const [transformMode, setTransformMode] = React.useState('translate');

    const { handleCutPick, performSplit, cutterFace, setCutterFace, handleToggleCutMode } = useCutTool({
        objects,
        setObjects,
        selectedIds,
        setSelectedIds,
        transformMode,
        setTransformMode
    });

    React.useImperativeHandle(onViewEvent, () => ({
        handleCutPick,
        performSplit,
        enableCutMode: () => setTransformMode('cut'),
        getCutterFace: () => cutterFace
    }));

    return null;
}

// Test Component for usePartModifiers
function TestModifiersComponent({ obj, connections, allObjects, onViewEvent }) {
    const modifiers = usePartModifiers(obj, connections, allObjects);

    React.useImperativeHandle(onViewEvent, () => ({
        modifiers
    }));

    return null;
}

describe('CSG-01: Simple Split Integration', () => {
    it('should split a cube into two halves (Axis Aligned)', async () => {
        // Setup: Cube 10x10x10 at [0,0,0]
        const cube = {
            id: 'cube1', type: 'cube',
            dims: { w: 10, h: 10, d: 10 },
            pos: [0, 0, 0], rot: [0, 0, 0]
        };

        const initialObjects = [cube];
        let currentObjects = initialObjects;
        const setObjects = vi.fn((updater) => {
            const res = typeof updater === 'function' ? updater(currentObjects) : updater;
            currentObjects = res;
            return res;
        });

        const selectedIds = ['cube1'];
        const setSelectedIds = vi.fn();

        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <TestCutComponent
                    objects={initialObjects}
                    setObjects={setObjects}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    onViewEvent={ref}
                />
            </MockToastProvider>
        );

        // 1. Enable Cut Mode
        await ReactThreeTestRenderer.act(async () => {
            ref.current.enableCutMode();
        });

        // 2. Simulate Picking a Cut Plane (Shift+Click)
        const faceInfo = {
            point: [0, 5, 5], // Point on the plane x=0
            normal: [1, 0, 0], // Plane Normal +X
            event: { shiftKey: true }
        };

        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleCutPick(faceInfo);
        });

        // Verify cutterFace is set
        const cutter = ref.current.getCutterFace();
        expect(cutter).toBeDefined();
        expect(cutter.normal).toEqual([1, 0, 0]);

        // 3. Perform Split
        await ReactThreeTestRenderer.act(async () => {
            ref.current.performSplit();
        });

        // 4. Verify Result
        expect(setObjects).toHaveBeenCalled();
        expect(currentObjects.length).toBe(2);

        const partA = currentObjects[0];
        const partB = currentObjects[1];

        expect(partA.dims.w).toBeCloseTo(5);
        expect(partB.dims.w).toBeCloseTo(5);
        expect(Math.abs(partA.pos[0])).toBeCloseTo(2.5);
        expect(Math.abs(partB.pos[0])).toBeCloseTo(2.5);
    });
});

describe('CSG-02: Boolean Subtract Integration', () => {
    it('should generate subtract modifier from connection', async () => {
        const objA = {
            id: 'host', type: 'cube',
            dims: { w: 10, h: 10, d: 10 },
            pos: [0, 0, 0], rot: [0, 0, 0]
        };
        const objB = {
            id: 'cutter', type: 'cube',
            dims: { w: 2, h: 2, d: 2 },
            pos: [5, 0, 0], rot: [0, 0, 0] // Centered at edge of A
        };

        const connections = [
            { id: 'conn1', type: 'subtraction', partA: 'host', partB: 'cutter' }
        ];

        const allObjects = [objA, objB];
        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <TestModifiersComponent
                obj={objA}
                connections={connections}
                allObjects={allObjects}
                onViewEvent={ref}
            />
        );

        const mods = ref.current.modifiers;
        expect(mods).toBeDefined();
        expect(mods.length).toBe(1);
        expect(mods[0].operation).toBe('subtract');
        expect(mods[0].id).toBe('cutter');

    });
});

import { calculateMortiseTenon, calculateCrossLap } from '../../utils/connectionUtils';
import { calculateHalfLapTransforms } from '../../utils/halfLapUtils';
import { useDrillTool } from '../../hooks/useDrillTool.jsx';

describe('CSG-03: Tenon Mortise Joint', () => {
    it('should calculate mortise and tenon objects', () => {
        const tenon = {
            id: 'beam1', type: 'cube', dims: { w: 20, h: 100, d: 20 },
            pos: [0, 50, 0], rot: [0, 0, 0]
        };
        const mortise = {
            id: 'beam2', type: 'cube', dims: { w: 100, h: 20, d: 100 },
            pos: [0, 0, 0], rot: [0, 0, 0]
        };

        const result = calculateMortiseTenon(tenon, mortise, 10, 0.1);

        expect(result).toBeDefined();
        // The current implementation of calculateMortiseTenon likely returns modified objects
        // or objects with holes/CSG ops.
        // Let's assume it returns { tenon: ..., mortise: ... }
        expect(result.mortise).toBeDefined();
        expect(result.tenon).toBeDefined();

        // Verify mortise has CSG operations (subtraction)
        expect(result.mortise.csgOperations).toBeDefined();
        expect(result.mortise.csgOperations.length).toBeGreaterThan(0);
        expect(result.mortise.csgOperations[0].operation).toBe('subtract');
    });
});

describe('CSG-04: Half Lap Joint', () => {
    it('should calculate half lap transforms', () => {
        // Setup two beams that will form an L-joint
        // Beam A along X, centered at -50
        const beamA = {
            id: 'a', type: 'cube', dims: { w: 100, h: 20, d: 20 },
            pos: [-50, 0, 0], rot: [0, 0, 0]
        };
        // Beam B along X, centered at +50 (End-to-End join)
        // This ensures the direction vector is aligned with the length axis (X)
        const beamB = {
            id: 'b', type: 'cube', dims: { w: 100, h: 20, d: 20 },
            pos: [50, 0, 0], rot: [0, 0, 0]
        };

        const result = calculateHalfLapTransforms(beamA, beamB, 20);

        expect(result).toBeDefined();
        expect(result.updates).toBeDefined();
        expect(result.updates.length).toBe(2); // Should update both
    });
});

describe('CSG-05: Drill on Cut Face', () => {
    // Helper to test Drill on a "Constructed" object (one with CSG ops)
    function TestDrillOnCSG({ object, drillParams, onViewEvent }) {
        const [objects, setObjects] = React.useState([object]);
        // Expand to process CSG locally if needed (mimicked by useDrillTool internal logic if it handles it)
        // useDrillTool handles "expandedObjects".
        const expandedObjects = React.useMemo(() => objects, [objects]);

        const { handleDrillClick } = useDrillTool({
            objects,
            setObjects,
            selectedObject: null,
            expandedObjects,
            drillParams,
            transformMode: 'drill'
        });

        React.useImperativeHandle(onViewEvent, () => ({
            handleDrillClick,
            getObjects: () => objects
        }));

        return null; // Mock render
    }

    it('should allow drilling on an object with existing CSG operations', async () => {
        // Object with a subtraction
        const baseObj = {
            id: 'base', type: 'cube', dims: { w: 20, h: 20, d: 20 },
            pos: [0, 0, 0], rot: [0, 0, 0],
            csgOperations: [
                { operation: 'subtract', id: 'sub1', type: 'cube', dims: { w: 10, h: 10, d: 20 }, pos: [5, 5, 0], rot: [0, 0, 0] }
            ]
        };

        const drillParams = { holeDiameter: 2, holeDepth: 5, drillType: 'hole' };
        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <TestDrillOnCSG object={baseObj} drillParams={drillParams} onViewEvent={ref} />
            </MockToastProvider>
        );

        // Simulate click on the main face (ignoring the cut geometry detail for this integration test,
        // just ensuring the tool doesn't crash and adds the hole to the object state).
        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleDrillClick({
                partId: 'base',
                point: [0, 10, 0], // Top face
                normal: [0, 1, 0], // Up
                face: '+Y'
            });
        });

        const updatedObjects = ref.current.getObjects();
        const updatedBase = updatedObjects[0];

        expect(updatedBase.holes).toBeDefined();
        expect(updatedBase.holes.length).toBe(1);
        expect(updatedBase.holes[0].diameter).toBe(2);
    });
});
