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

        expect(mods[0].relativeTransform).toBeDefined();
        expect(mods[0].relativeTransform.pos[0]).toBeCloseTo(5);
    });
});
