import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useTransformInteraction } from '../../hooks/useTransformInteraction';
import { ToastContext } from '../../context/ToastContext';
import * as THREE from 'three';
import { LanguageProvider } from '../../i18n/LanguageContext';

// Mock Toast Provider
const MockToastProvider = ({ children }) => {
    return (
        <ToastContext.Provider value={{ showToast: vi.fn() }}>
            {children}
        </ToastContext.Provider>
    );
};

function TestAlignmentComponent({ objects, onViewEvent, onStateUpdate }) {
    // We maintain local state to mimic the store
    const [localObjects, setLocalObjects] = React.useState(objects);

    // For cubes, expandedObjects is usually just the objects themselves 
    // (unless they have children, which simple cubes don't)
    const expandedObjects = localObjects;

    const { handleAlignmentPick, pendingAlignFace } = useTransformInteraction({
        objects: localObjects,
        setObjects: (val) => {
            // Check if val is function or value
            const newVal = typeof val === 'function' ? val(localObjects) : val;
            setLocalObjects(newVal);
            onStateUpdate && onStateUpdate(newVal);
        },
        expandedObjects,
        setSelectedIds: () => { }, // Mock
        transformMode: 'translate' // Align works in translate mode
    });

    // Expose handler for testing
    React.useImperativeHandle(onViewEvent, () => ({
        handleAlignmentPick,
        getPendingFace: () => pendingAlignFace,
        getObjects: () => localObjects
    }), [handleAlignmentPick, pendingAlignFace, localObjects]);

    return null;
}

describe('CORE-04: Face Alignment Integration', () => {
    it('should align Object A Face to Object B Face', async () => {
        // Setup: Two Cubes.
        // Cube A (Moving): at [0, 0, 0], Size 10. Face +X is at x=5.
        // Cube B (Anchor): at [20, 0, 0], Size 10. Face -X is at x=15.
        // We want to align Cube A's +X to Cube B's -X.
        // Distance between faces = 15 - 5 = 10.
        // Cube A should move +10 in X. New pos: [10, 0, 0].
        // Verification: If pos is [10,0,0], its +X face is at 10+5=15. Matches Cube B -X (15).

        const cubeA = {
            id: 'cubeA', type: 'cube', dims: { w: 10, h: 10, d: 10 },
            pos: [0, 0, 0], rot: [0, 0, 0]
        };
        const cubeB = {
            id: 'cubeB', type: 'cube', dims: { w: 10, h: 10, d: 10 },
            pos: [20, 0, 0], rot: [0, 0, 0]
        };

        const objects = [cubeA, cubeB];
        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <LanguageProvider>
                    <TestAlignmentComponent objects={objects} onViewEvent={ref} />
                </LanguageProvider>
            </MockToastProvider>
        );

        // 1. Pick Face 1 (Cube A, +X) - The Moving Object
        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleAlignmentPick({
                partId: 'cubeA',
                face: '+X',
                // Mock point/normal if needed by useTransformInteraction?
                // computeFaceTransform calculates center/normal from OBJ state, 
                // but handleAlignmentPick uses faceInfo.partId and faceInfo.face.
                // It does NOT rely on faceInfo.point/normal for calc, except finding objects.
            });
        });

        // Verify Pending State
        expect(ref.current.getPendingFace()).toEqual(expect.objectContaining({
            partId: 'cubeA',
            face: '+X'
        }));

        // 2. Pick Face 2 (Cube B, -X) - The Anchor Object
        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleAlignmentPick({
                partId: 'cubeB',
                face: '-X'
            });
        });

        // 3. Verify Alignment
        // Pending should be cleared
        expect(ref.current.getPendingFace()).toBeNull();

        // Object A Position should be updated
        const objs = ref.current.getObjects();
        const movedA = objs.find(o => o.id === 'cubeA');

        // Expected X: 10
        expect(movedA.pos[0]).toBeCloseTo(10);
        expect(movedA.pos[1]).toBeCloseTo(0);
        expect(movedA.pos[2]).toBeCloseTo(0);
    });
});
