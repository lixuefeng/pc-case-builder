import React, { useState, useImperativeHandle } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { useSelection } from '../../hooks/useSelection';
import { ToastContext } from '../../context/ToastContext';

// Mock Toast Provider
const MockToastProvider = ({ children }) => {
    return (
        <ToastContext.Provider value={{ showToast: vi.fn() }}>
            {children}
        </ToastContext.Provider>
    );
};

// Helper component to expose hooks
const TestWorkflowComponent = ({ objects: initialObjects, onViewEvent }) => {
    const [objects, setObjects] = useState(initialObjects);
    const [selectedIds, setSelectedIds] = useState([]);

    const { handleGroup, handleUngroup, select } = useSelection({
        objects,
        setObjects,
        selectedIds,
        setSelectedIds
    });

    useImperativeHandle(onViewEvent, () => ({
        objects,
        setObjects,
        selectedIds,
        setSelectedIds,
        handleGroup,
        handleUngroup,
        select
    }));

    return null;
};

describe('Workflow Integration Tests', () => {
    it('FLOW-02: Group & Manipulate', async () => {
        // 1. Setup: Two Cubes
        // Cube A at (-10, 0, 0)
        // Cube B at (10, 0, 0)
        // Group Center should be (0, 0, 0)
        const cubeA = {
            id: 'cube_a', type: 'cube', dims: { w: 10, h: 10, d: 10 },
            pos: [-10, 0, 0], rot: [0, 0, 0]
        };
        const cubeB = {
            id: 'cube_b', type: 'cube', dims: { w: 10, h: 10, d: 10 },
            pos: [10, 0, 0], rot: [0, 0, 0]
        };

        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <TestWorkflowComponent
                    objects={[cubeA, cubeB]}
                    onViewEvent={ref}
                />
            </MockToastProvider>
        );

        // 2. Select Both Object
        await ReactThreeTestRenderer.act(async () => {
            ref.current.setSelectedIds(['cube_a', 'cube_b']);
        });

        // 3. Group
        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleGroup();
        });

        // Verify Group Creation
        const groupObj = ref.current.objects.find(o => o.type === 'group');
        expect(groupObj).toBeDefined();
        expect(ref.current.objects.length).toBe(1); // Only group remains
        expect(groupObj.children.length).toBe(2);

        // Verify Group Center (should be 0,0,0)
        expect(groupObj.pos).toEqual([0, 0, 0]);
        // Verify Children Relative Pos
        // A was at -10, group at 0 -> Rel: -10
        const childA = groupObj.children.find(c => c.id === 'cube_a');
        expect(childA.pos).toEqual([-10, 0, 0]);


        // 4. Manipulate: Rotate Group 90 deg Y
        // New State: Group Rot (0, PI/2, 0)
        const rotatedGroup = {
            ...groupObj,
            rot: [0, Math.PI / 2, 0]
        };

        await ReactThreeTestRenderer.act(async () => {
            ref.current.setObjects([rotatedGroup]);
            ref.current.setSelectedIds([rotatedGroup.id]); // Select group for ungrouping
        });

        // 5. Ungroup
        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleUngroup();
        });

        // 6. Verify Final Positions
        // A was at (-10, 0, 0) relative. 
        // Rotated 90 deg Y: (-10, 0, 0) -> (0, 0, 10)? 
        // Wait, standard rotation:
        // x' = x cos - z sin
        // z' = x sin + z cos
        // x=-10, z=0
        // x' = -10 * 0 - 0 * 1 = 0
        // z' = -10 * 1 + 0 * 0 = -10
        // Wait, THREE.js coord system: 
        // +X Right, +Y Up, +Z Front
        // Rot +Y (CCW looking from top):
        // (1,0,0) -> (0,0,-1)
        // (-10,0,0) -> (0,0,10)

        const finalA = ref.current.objects.find(o => o.id === 'cube_a');
        const finalB = ref.current.objects.find(o => o.id === 'cube_b');

        expect(ref.current.objects.length).toBe(2);

        // A should be at (0, 0, 10)
        expect(finalA.pos[0]).toBeCloseTo(0);
        expect(finalA.pos[1]).toBeCloseTo(0);
        expect(finalA.pos[2]).toBeCloseTo(10);

        // B was at (10, 0, 0) relative
        // Rotated -> (0, 0, -10)
        expect(finalB.pos[0]).toBeCloseTo(0);
        expect(finalB.pos[1]).toBeCloseTo(0);
        expect(finalB.pos[2]).toBeCloseTo(-10);
    });
});
