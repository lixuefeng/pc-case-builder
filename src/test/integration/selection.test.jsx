import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useSelection } from '../../hooks/useSelection';
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

function TestSelectionComponent({ objects, onViewEvent }) {
    // We only test the selection hook logic here. 
    // In a full E2E we would click meshes, but here we invoke 'select' directly 
    // to verify the state update logic for multi-select.

    const [selectionState, setSelectionState] = React.useState({
        selectedIds: [],
        selectedObject: null
    });

    const { select, selectedIds, selectedObject } = useSelection({
        objects,
        setObjects: () => { }, // Mock
        selectedIds: selectionState.selectedIds,
        setSelectedIds: (idsOrFn) => {
            setSelectionState(prev => {
                const newIds = typeof idsOrFn === 'function' ? idsOrFn(prev.selectedIds) : idsOrFn;
                const newSelectedObject = objects.find(o => newIds.includes(o.id));
                return { selectedIds: newIds, selectedObject: newSelectedObject };
            });
        },
        transformMode: 'translate',
        setTransformMode: () => { },
    });

    // Expose hook state and methods
    React.useImperativeHandle(onViewEvent, () => ({
        select,
        getSelectedIds: () => selectionState.selectedIds,
        getSelectedObject: () => selectionState.selectedObject
    }), [select, selectionState]);

    return null;
}

describe('CORE-01: Multi-Selection Integration', () => {
    it('should toggle selection with Ctrl key (multi=true)', async () => {
        const objects = [
            { id: 'cube1', type: 'cube' },
            { id: 'cube2', type: 'cube' }
        ];
        const ref = React.createRef();

        await ReactThreeTestRenderer.create(
            <MockToastProvider>
                <LanguageProvider>
                    <TestSelectionComponent objects={objects} onViewEvent={ref} />
                </LanguageProvider>
            </MockToastProvider>
        );

        // 1. Select First Object directly
        await ReactThreeTestRenderer.act(async () => {
            ref.current.select('cube1', false); // multi=false
        });

        expect(ref.current.getSelectedIds()).toEqual(['cube1']);
        expect(ref.current.getSelectedObject().id).toBe('cube1');

        // 2. Select Second Object with Multi=true (Ctrl Click)
        await ReactThreeTestRenderer.act(async () => {
            ref.current.select('cube2', true); // multi=true
        });

        // 3. Verify Both Selected
        const ids = ref.current.getSelectedIds();
        expect(ids).toContain('cube1');
        expect(ids).toContain('cube2');
        expect(ids.length).toBe(2);

        // 4. Deselect Second Object with Multi=true
        await ReactThreeTestRenderer.act(async () => {
            ref.current.select('cube2', true);
        });

        expect(ref.current.getSelectedIds()).toEqual(['cube1']);
    });
});
