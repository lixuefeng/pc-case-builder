
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// Since we cannot easily render hooks without a full DOM environment in some setups,
// and we want to test the logic flow, we will extract the logic or simulate the hook.
// However, the best way here given the constraints is to rely on mocking the React hooks
// and invoking the function that useRulerTool returns.

// Note: This relies on the fact that useRulerTool is a function. 
// We need to mock React's useState, useRef, useEffect, useCallback.

const mocks = {
    useState: vi.fn(),
    useRef: vi.fn(),
    useEffect: vi.fn(),
    useCallback: vi.fn((fn) => fn), // Passthrough
    useStore: vi.fn(),
    useToast: vi.fn(),
};

// Mock React
vi.mock('react', () => ({
    useState: (init) => mocks.useState(init),
    useRef: (init) => mocks.useRef(init),
    useEffect: (fn, deps) => mocks.useEffect(fn, deps),
    useCallback: (fn, deps) => mocks.useCallback(fn, deps),
}));

// Mock Store
vi.mock('../store', () => ({
    useStore: () => mocks.useStore()
}));

// Mock Toast
vi.mock('../context/ToastContext', () => ({
    useToast: () => mocks.useToast()
}));

import { useRulerTool } from '../hooks/useRulerTool';

describe('useRulerTool', () => {
    it('should set startFace when first point is picked with Shift', () => {
        // Setup State Mocks
        const setRulerPoints = vi.fn();
        const setStartFace = vi.fn();
        const setMeasurements = vi.fn();
        const setHudState = vi.fn();
        const showToast = vi.fn();
        const rulerStartRef = { current: null };

        // Mock useState
        // Call 1: startFace
        mocks.useState.mockImplementationOnce((init) => [init, setStartFace]);

        // Mock useRef
        mocks.useRef.mockReturnValue(rulerStartRef);

        // Mock Store
        mocks.useStore.mockReturnValue({
            rulerPoints: [],
            setRulerPoints,
            measurements: [],
            setMeasurements,
            setHudState
        });

        // Mock Toast
        mocks.useToast.mockReturnValue({ showToast });

        // Run Hook
        const tool = useRulerTool({ transformMode: 'ruler' });

        // Simulate Pick (Shift + Click)
        const center = new THREE.Vector3(10, 0, 0);
        const normal = new THREE.Vector3(0, 1, 0);
        const pointInfo = {
            center,
            normal,
            shiftKey: true,
            partId: 'part1',
            face: 'Top'
        };

        tool.handleRulerPick(pointInfo);

        // Assertions
        expect(setRulerPoints).toHaveBeenCalledWith([center.toArray()]);
        expect(setStartFace).toHaveBeenCalledWith({ partId: 'part1', face: 'Top' });
        expect(rulerStartRef.current).toEqual({ center, normal });
        expect(showToast).toHaveBeenCalled();
    });

    it('should clear startFace when second point is picked', () => {
        // Setup State Mocks
        const setRulerPoints = vi.fn();
        const setStartFace = vi.fn();
        const setMeasurements = vi.fn();
        const showToast = vi.fn();

        // Pre-existing state: 1 point selected
        const startCenter = new THREE.Vector3(10, 0, 0);
        const startNormal = new THREE.Vector3(0, 1, 0);
        const rulerStartRef = { current: { center: startCenter, normal: startNormal } };

        // Mock useState
        mocks.useState.mockReturnValue([null, setStartFace]);

        // Mock useRef
        mocks.useRef.mockReturnValue(rulerStartRef);

        // Mock Store (rulerPoints has 1 point)
        mocks.useStore.mockReturnValue({
            rulerPoints: [[10, 0, 0]],
            setRulerPoints,
            measurements: [],
            setMeasurements,
            setHudState: vi.fn()
        });

        mocks.useToast.mockReturnValue({ showToast });

        const tool = useRulerTool({ transformMode: 'ruler' });

        // Simulate Pick Second Point
        const endCenter = new THREE.Vector3(20, 0, 0);
        const endNormal = new THREE.Vector3(0, 1, 0);

        tool.handleRulerPick({
            center: endCenter,
            normal: endNormal,
            shiftKey: false // Shift not needed for 2nd point usually? Logic doesn't check shift for 2nd point explicitly in the branch
        });

        // Assertions
        expect(setRulerPoints).toHaveBeenCalledTimes(1); // Should update points
        expect(setMeasurements).toHaveBeenCalled();
        expect(setStartFace).toHaveBeenCalledWith(null); // Should clear start face
        expect(rulerStartRef.current).toBeNull();
    });
});
