import React, { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import MovablePart from '../../components/MovablePart';
import * as THREE from 'three';

// --- MOCKS ---

vi.mock('@react-three/drei', () => ({
    TransformControls: ({ children }) => <group name="MockTransformControls">{children}</group>,
    Html: () => null
}));

vi.mock('../../components/MeshRegistry', () => ({
    getComponentForObject: () => () => <mesh name="PartMesh" />
}));

vi.mock('../../hooks/usePartModifiers', () => ({
    usePartModifiers: () => []
}));

vi.mock('../../store', () => ({
    useStore: () => ({
        setHudState: vi.fn(),
        measurements: [],
    })
}));

vi.mock('../../hooks/usePartAlignment', () => ({
    usePartAlignment: () => ({
        findBestAlignCandidate: () => null,
        snapToCandidate: () => { },
        calculateAlignPosition: () => { }
    })
}));

vi.mock('../../hooks/usePartStretch', () => ({
    usePartStretch: () => ({
        beginStretch: vi.fn(),
        isStretching: false
    })
}));

vi.mock('../../components/ConnectorMarker', () => ({ default: () => null }));
vi.mock('../../components/HoleMarker', () => ({ default: () => null }));
vi.mock('../../components/CSGStandoff', () => ({ default: () => null }));

// --- TEST SETUP ---

describe('CORE-05: Face Highlight on Rotation', () => {
    it('should correctly identify Top face on rotated object', async () => {
        // Use mutable object just in case
        const initialObj = {
            id: 'cube1', type: 'cube',
            dims: { w: 10, h: 10, d: 10 },
            pos: [0, 0, 0],
            rot: [Math.PI / 2, 0, 0]
        };

        // Spy on onFacePick
        const onFacePick = vi.fn();
        const setObj = vi.fn();

        const renderer = await ReactThreeTestRenderer.create(
            <MovablePart
                obj={initialObj}
                selected={true}
                selectionOrder={0}
                selectedCount={1}
                setObj={setObj}
                onSelect={() => { }}
                allObjects={[]}
                setDragging={() => { }}
                connections={[]}
                alignMode={false}
                mode="ruler" // Use Ruler mode to trigger onFacePick
                showTransformControls={true}
                gizmoHovered={false}
                setGizmoHovered={() => { }}
                onFacePick={onFacePick}
            />
        );

        // Find the group to fire event on
        const group = renderer.scene.children.find(child =>
            child.props.userData && child.props.userData.objectId === 'cube1'
        );
        expect(group).toBeDefined();

        // Simulate Raycast from Top (World +Y)
        // Hitting point [0, 5, 0] (Top surface of 10x10x10 cube at origin)
        const mockEvent = {
            stopPropagation: vi.fn(),
            shiftKey: true, // Enable face selection
            ray: {
                origin: new THREE.Vector3(0, 10, 0),
                direction: new THREE.Vector3(0, -1, 0)
            },
            point: new THREE.Vector3(0, 5, 0)
        };

        // Fire Pointer Move to hover
        await renderer.fireEvent(group, 'onPointerMove', mockEvent);

        // Fire Pointer Down to pick
        await renderer.fireEvent(group, 'onPointerDown', mockEvent);

        expect(onFacePick).toHaveBeenCalled();
        const callArgs = onFacePick.mock.calls[0][0];

        // Expected Face: -Z
        // Cube Rotated 90 deg X.
        // Local +Y (Top) -> World +Z (Front)
        // Local -Z (Back) -> World +Y (Top)
        // We hit the World Top. So we expect the Local '-Z' face.
        expect(callArgs.face).toBe('-Z');
    });
});
