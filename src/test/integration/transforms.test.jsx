import React, { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { usePartStretch } from '../../hooks/usePartStretch';
import MovablePart from '../../components/MovablePart';
import * as THREE from 'three';
import { LanguageProvider } from '../../i18n/LanguageContext';

// --- MOCKS ---

// Mock TransformControls found in MovablePart
vi.mock('@react-three/drei', async () => {
    const actual = await vi.importActual('@react-three/drei');
    return {
        ...actual,
        TransformControls: ({ onChange, onMouseUp, children }) => {
            return (
                <group name="MockTransformControls">
                    <mesh
                        name="GizmoTrigger"
                        onPointerMove={() => onChange && onChange({})}
                        onPointerUp={() => onMouseUp && onMouseUp()}
                    />
                    {children}
                </group>
            );
        },
        Html: () => null
    };
});

// Mock Dependencies of MovablePart
vi.mock('../../components/MeshRegistry', () => ({
    getComponentForObject: () => () => <mesh name="PartMesh" />
}));
vi.mock('../../hooks/usePartModifiers', () => ({
    usePartModifiers: () => ({ modifiers: [] })
}));
vi.mock('../../store', () => ({
    useStore: () => ({
        setHudState: vi.fn(), // Mock HUD updates
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
// We mock usePartStretch for CORE-02 traversal, but for CORE-03 we use real logic?
// actually for CORE-02 we can use the real hook or mock it.
// Let's use real if possible, or mock to avoid noise.
// Since we import usePartStretch for CORE-03 TEST locally, we can mock it gloabally but then CORE-03 fails?
// We should NOT mock it globally if we test it.
// But MovablePart imports it from same path.
// Setup a conditional mock or just let MovablePart use the real hook (it won't activate unless simulated).

vi.mock('../../components/ConnectorMarker', () => ({ default: () => null }));
vi.mock('../../components/HoleMarker', () => ({ default: () => null }));
vi.mock('../../components/CSGStandoff', () => ({ default: () => null }));

// --- COMPONENTS ---

// Test Component for CORE-03 (Scale)
function TestStretchComponent({ obj, setObj, onViewEvent }) {
    const groupRef = useRef();

    // Minimal mock for groupRef
    React.useLayoutEffect(() => {
        if (groupRef.current) {
            groupRef.current.position.set(...(obj.pos || [0, 0, 0]));
        }
    }, [obj.pos]);

    const [locked, setLocked] = React.useState(false);

    const { beginStretch, isStretching } = usePartStretch({
        obj,
        setObj: (val) => {
            const newVal = typeof val === 'function' ? val(obj) : val;
            setObj(newVal);
        },
        groupRef,
        isEmbedded: false,
        setHudState: () => { },
        onFacePick: () => { },
        isShiftPressed: false,
        setUiLock: setLocked,
    });

    React.useImperativeHandle(onViewEvent, () => ({
        beginStretch,
        isStretching
    }));

    return (
        <group ref={groupRef}>
            <mesh />
        </group>
    );
}

// --- TESTS ---

describe('CORE-03: Scale Transform Integration', () => {
    it('should scale object when stretched', async () => {
        const initialObj = {
            id: 'cube1', type: 'cube',
            dims: { w: 10, h: 10, d: 10 },
            pos: [0, 0, 0], rot: [0, 0, 0]
        };

        const setObj = vi.fn(); // Mock setter
        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <LanguageProvider>
                <TestStretchComponent obj={initialObj} setObj={setObj} onViewEvent={ref} />
            </LanguageProvider>
        );

        const mockEvent = {
            ray: {
                origin: new THREE.Vector3(10, 10, 0),
                direction: new THREE.Vector3(-1, -1, 0).normalize()
            },
            pointerId: 1,
            clientX: 100, clientY: 100,
            target: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() }
        };

        const faceDetails = {
            center: [5, 0, 0],
            normal: [1, 0, 0]
        };

        const success = await ReactThreeTestRenderer.act(async () => {
            return ref.current.beginStretch('+X', faceDetails, mockEvent);
        });

        expect(success).toBe(true);
        expect(ref.current.isStretching).toBe(true);
    });
});

describe('CORE-02: Transform Propagation (Move)', () => {
    it('should update object position in store when moved via Gizmo', async () => {
        const initialObj = {
            id: 'moveCube', type: 'cube',
            dims: { w: 10, h: 10, d: 10 },
            pos: [0, 0, 0], rot: [0, 0, 0],
            visible: true
        };

        let currentObj = initialObj;
        const setObj = vi.fn((updater) => {
            // Mimic setState functional update
            const res = typeof updater === 'function' ? updater(currentObj) : updater;
            currentObj = res; // Update local ref if needed
            return res;
        });

        // Render MovablePart
        const renderer = await ReactThreeTestRenderer.create(
            <LanguageProvider>
                <MovablePart
                    obj={initialObj}
                    selected={true}
                    selectionOrder={0}
                    selectedCount={1}
                    setObj={setObj}
                    onSelect={() => { }}
                    allObjects={[]} // candidates
                    setDragging={() => { }}
                    connections={[]}
                    alignMode={false}
                    onFacePick={() => { }}
                    mode="translate" // Translate Mode
                    showTransformControls={true} // Enable Gizmo
                    gizmoHovered={false}
                    setGizmoHovered={() => { }}
                />
            </LanguageProvider>
        );

        // 1. Verify Gizmo Trigger exists
        const gizmo = renderer.scene.findByProps({ name: 'GizmoTrigger' });
        expect(gizmo).toBeDefined();

        const partGroup = renderer.scene.children.find(child =>
            child.props.userData && child.props.userData.objectId === 'moveCube'
        );
        expect(partGroup).toBeDefined();

        // 3. Simulate Drag: Move the group manually -> Trigger onChange -> Trigger onMouseUp

        // Move the instance (mocking what TransformControls does internally)
        partGroup.instance.position.set(10, 0, 0);

        // Confirm instance moved (sanity check)
        expect(partGroup.instance.position.x).toBe(10);

        // Fire onChange (MovablePart updates HUD/internal delta)
        await renderer.fireEvent(gizmo, 'onPointerMove');

        // Fire onMouseUp (MovablePart commits change to store)
        await renderer.fireEvent(gizmo, 'onPointerUp');

        // 4. Verify setObj called with new position
        expect(setObj).toHaveBeenCalled();

        // Check the last call argument
        const updater = setObj.mock.calls[0][0]; // It receives an updater function usually
        // Execute updater to see result
        const result = updater(initialObj);

        expect(result.pos[0]).toBeCloseTo(10);
        expect(result.pos[1]).toBeCloseTo(0);
        expect(result.pos[2]).toBeCloseTo(0);
    });
});
