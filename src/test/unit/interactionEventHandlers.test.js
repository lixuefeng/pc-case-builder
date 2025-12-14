
import { describe, it, expect, vi } from 'vitest';
import { handlePartPointerDownLogic, handlePartClickLogic } from '../../utils/interactionEventHandlers';

// Mock dependencies
vi.mock('../../utils/interactionLogic', () => ({
    canSelectObject: (mode) => {
        const blocking = ["ruler", "cut", "drill"];
        return !blocking.includes(mode);
    }
}));

describe('Interaction Logic - Regression Tests', () => {
    describe('handlePartPointerDownLogic', () => {
        it('should prioritized modify edge pick over everything else (FIX for Click Ignored)', () => {
            const onModifyPick = vi.fn();
            const e = { point: [0, 0, 0], shiftKey: false, stopPropagation: vi.fn() };

            const result = handlePartPointerDownLogic({
                e,
                mode: 'modify',
                obj: { id: 'part-1' },
                hoveredEdge: { id: 'edge-1' },
                hoveredFace: { id: 'face-1' }, // Conflicting face
                onModifyPick,
                // conflicting handlers
                onFacePick: vi.fn(),
                alignMode: true // Would normally trigger face pick
            });

            expect(result.action).toBe('modifyPick');
            expect(result.payload.edge.id).toBe('edge-1');
            expect(result.stopPropagation).toBe(true);
        });
    });

    describe('handlePartClickLogic', () => {
        it('should BLOCK object selection if edge is hovered in modify mode (User Req)', () => {
            const onSelect = vi.fn();
            const e = { shiftKey: false, stopPropagation: vi.fn() };

            const result = handlePartClickLogic({
                e,
                mode: 'modify',
                obj: { id: 'part-1' },
                hoveredEdge: { id: 'edge-1' },
                onSelect
            });

            expect(result.action).toBe('prevent_selection_due_to_edge');
            expect(result.stopPropagation).toBe(true);
        });

        it('should allow object selection if modify mode but NO edge hovered (FIX for Options Missing)', () => {
            const onSelect = vi.fn();
            const e = { shiftKey: false, stopPropagation: vi.fn() };

            const result = handlePartClickLogic({
                e,
                mode: 'modify',
                obj: { id: 'part-1' },
                hoveredEdge: null, // User checking body
                onSelect
            });

            expect(result.action).toBe('select');
            expect(result.payload.id).toBe('part-1');
        });
    });
});
