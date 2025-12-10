import React, { useImperativeHandle } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { useRulerTool } from '../../hooks/useRulerTool';
import { ToastContext } from '../../context/ToastContext';
import { useStore } from '../mocks/mockStore';

// Mock Store using the external mock file to avoid hoisting issues
vi.mock('../../store', () => import('../mocks/mockStore'));

const MockToastProvider = ({ children }) => {
    return (
        <ToastContext.Provider value={{ showToast: vi.fn() }}>
            {children}
        </ToastContext.Provider>
    );
};

// 2. Helper Component
const TestRulerComponent = ({ onViewEvent }) => {
    // We assume transformMode is 'ruler' for this test
    const { handleRulerPick, clearMeasurements, startFace } = useRulerTool({ transformMode: 'ruler' });

    // allow access to store state for assertions via ref
    useImperativeHandle(onViewEvent, () => ({
        handleRulerPick,
        clearMeasurements,
        startFace,
        getStoreState: () => useStore.getState()
    }));

    return null;
};

describe('RULE-01: Ruler Tool Integration', () => {
    beforeEach(() => {
        useStore.getState().reset();
    });

    it('should measure distance between two points', async () => {
        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <TestRulerComponent onViewEvent={ref} />
            </MockToastProvider>
        );

        // 1. Pick First Point (Shift + Click)
        // Simulate picking a face at (0, 0, 0) normal (0, 1, 0)
        const pick1 = {
            center: new THREE.Vector3(0, 0, 0),
            normal: new THREE.Vector3(0, 1, 0),
            shiftKey: true,
            partId: 'obj1',
            face: 'top'
        };

        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleRulerPick(pick1);
        });

        // Verify Start State
        const state1 = ref.current.getStoreState();
        expect(state1.rulerPoints.length).toBe(1);
        expect(state1.rulerPoints[0]).toEqual([0, 0, 0]);
        // Also verify local startFace state if exposed
        // expect(ref.current.startFace).toBeDefined(); // Need to verify if hook updates it synchronously or if renderer catches it

        // 2. Pick Second Point (Click)
        // Simulate picking a face at (10, 0, 0) normal (0, 1, 0)
        const pick2 = {
            center: new THREE.Vector3(10, 0, 0),
            normal: new THREE.Vector3(0, 1, 0),
            shiftKey: false, // Second click doesn't strictly need shift? logic says: if rulerPoints.length > 0...
            partId: 'obj2',
            face: 'top'
        };

        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleRulerPick(pick2);
        });

        // Verify Measurement
        const state2 = ref.current.getStoreState();
        expect(state2.rulerPoints.length).toBe(2); // Should show line
        expect(state2.measurements.length).toBe(1);

        const m = state2.measurements[0];
        expect(m.distance).toBeCloseTo(10);
        expect(m.label).toBe("Center to Center");

        // 3. Verify HUD State Update (Effect)
        expect(state2.hudState).toBeDefined();
        expect(state2.hudState.type).toBe('ruler');
        expect(state2.hudState.data.distance).toBeCloseTo(10);
    });
});
