import React, { useImperativeHandle, forwardRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useConnectors } from '../../hooks/useConnectors';
import { ToastContext } from '../../context/ToastContext';
import { PRESETS } from '../../utils/presets';
import { LanguageProvider } from '../../i18n/LanguageContext';
import * as THREE from 'three';

// Mock Toast Provider
const MockToastProvider = ({ children }) => {
    return (
        <ToastContext.Provider value={{ showToast: vi.fn() }}>
            {children}
        </ToastContext.Provider>
    );
};

// Test Component to expose Hook
const TestConnectorComponent = forwardRef(({ objects, setObjects, selectedIds, setSelectedIds, setConnections }, ref) => {
    const hookResult = useConnectors({
        objects,
        setObjects,
        selectedIds,
        setSelectedIds,
        setConnections
    });

    useImperativeHandle(ref, () => hookResult, [hookResult]);

    return null;
});

describe('Connector Integration Check', () => {

    it('should initialize ITX motherboard with correct connectors', () => {
        // 1. Create Layout from Preset (simulating Add Object)
        const itxPreset = PRESETS.motherboard.find(p => p.key === 'itx');
        expect(itxPreset).toBeDefined();

        const board = {
            id: 'board_1',
            type: 'motherboard',
            dims: itxPreset.dims,
            meta: itxPreset.meta,
            connectors: itxPreset.connectors
        };

        // 2. Validate Connector List
        const connectorIds = board.connectors.map(c => c.type);

        // ITX should have:
        // - 4x screw-m3 (mounts)
        // - 1x pcie-slot
        // - 2x dimm-slot (RAM)
        const mountCount = connectorIds.filter(id => id === 'screw-m3').length;
        const pcieCount = connectorIds.filter(id => id === 'pcie-slot').length;
        const dimmCount = connectorIds.filter(id => id === 'dimm-slot').length;

        expect(mountCount).toBe(4);
        expect(pcieCount).toBe(1);
        expect(dimmCount).toBe(2);
    });

    it('should connect GPU to PCIe slot correctly', async () => {
        // 1. Setup Board (Anchor)
        const itxPreset = PRESETS.motherboard.find(p => p.key === 'itx');
        const board = {
            id: 'board_1',
            type: 'motherboard',
            dims: itxPreset.dims,
            meta: itxPreset.meta,
            connectors: itxPreset.connectors,
            pos: [0, 0, 0],
            rot: [0, 0, 0]
        };

        // 2. Setup GPU (Moving Part)
        const gpuPreset = PRESETS.gpu.find(p => p.key === 'std');
        const gpu = {
            id: 'gpu_1',
            type: 'gpu',
            dims: gpuPreset.dims,
            meta: gpuPreset.meta,
            connectors: gpuPreset.connectors,
            pos: [50, 50, 50], // Random starting pos
            rot: [0, Math.PI / 2, 0] // Random starting rot
        };

        let objects = [board, gpu];
        const setObjects = (val) => {
            if (typeof val === 'function') {
                objects = val(objects);
            } else {
                objects = val;
            }
        };
        const setConnections = vi.fn();
        let selectedIds = [gpu.id];
        const setSelectedIds = (val) => { selectedIds = val; };

        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <LanguageProvider>
                    <TestConnectorComponent
                        ref={ref}
                        objects={objects}
                        setObjects={setObjects}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                        setConnections={setConnections}
                    />
                </LanguageProvider>
            </MockToastProvider>
        );

        // 3. Select GPU Connector (Moving)
        const gpuConnector = gpu.connectors.find(c => c.type === 'pcie-fingers');
        expect(gpuConnector).toBeDefined();

        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleConnectorPick({ partId: gpu.id, connectorId: gpuConnector.id });
        });

        expect(ref.current.pendingConnector).toEqual({ partId: gpu.id, connectorId: gpuConnector.id });

        // 4. Select Board Connector (Target)
        const pcieSlot = board.connectors.find(c => c.type === 'pcie-slot');
        expect(pcieSlot).toBeDefined();

        // Need to update the component props effectively if we were using a real renderer that reacts to prop changes,
        // but since we are modifying 'objects' in place via the mock setObjects (which just updates the local var 'objects'),
        // the Hook inside TestConnectorComponent won't see the update unless we re-render or the hook pulls from a mutable source.
        // The Hook receives 'objects' as a prop.
        // So if handleConnectorPick is called, it uses the 'objects' prop passed during the LAST render.

        // BUT, for the SECOND pick, we haven't changed objects yet (pending pick just updates local state 'pendingConnector').
        // So 'objects' is still valid.
        // However, we rely on 'pendingConnector' state from the hook.

        // Act: Pick Board Connector (Target)
        await ReactThreeTestRenderer.act(async () => {
            ref.current.handleConnectorPick({ partId: board.id, connectorId: pcieSlot.id });
        });

        // 5. Verify Result
        // The setObjects should have been called.
        // We can inspect 'objects' variable since our mock setObjects updates it.

        const movedGpu = objects.find(o => o.id === gpu.id);

        // Safety check: GPU shouldn't be at original pos
        expect(movedGpu.pos).not.toEqual([50, 50, 50]);

        // pendingConnector should be null (reset after success)
        // We need to check the Ref/Hook state.
        // Since React batching, we might need to wait or check the latest ref.
        expect(ref.current.pendingConnector).toBeNull();
    });
});
