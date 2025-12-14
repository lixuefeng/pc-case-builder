
import { describe, it, expect } from 'vitest';
import { reduceModifyState } from '../../utils/selectionStateLogic';

describe('Modify State Reducer (Feature: Shift+Select)', () => {

    const edge1 = { id: 'e1' };
    const edge2 = { id: 'e2' };
    const edge3 = { id: 'e3' };

    it('should initialize state with single edge on first click', () => {
        const result = reduceModifyState(null, { partId: 'p1', edge: edge1, shiftKey: false });
        expect(result.type).toBe('modify');
        expect(result.data.edges).toHaveLength(1);
        expect(result.data.edges[0].id).toBe('e1');
    });

    it('should replace selection if clicking another edge without shift', () => {
        const initial = { type: 'modify', data: { partId: 'p1', edges: [edge1] } };
        const result = reduceModifyState(initial, { partId: 'p1', edge: edge2, shiftKey: false });

        expect(result.data.edges).toHaveLength(1);
        expect(result.data.edges[0].id).toBe('e2'); // Replaced
    });

    it('should ADD to selection if clicking new edge WITH shift', () => {
        const initial = { type: 'modify', data: { partId: 'p1', edges: [edge1] } };
        const result = reduceModifyState(initial, { partId: 'p1', edge: edge2, shiftKey: true });

        expect(result.data.edges).toHaveLength(2);
        expect(result.data.edges).toContainEqual(edge1);
        expect(result.data.edges).toContainEqual(edge2);
    });

    it('should REMOVE from selection if clicking existing edge WITH shift (Toggle)', () => {
        const initial = { type: 'modify', data: { partId: 'p1', edges: [edge1, edge2] } };
        const result = reduceModifyState(initial, { partId: 'p1', edge: edge1, shiftKey: true });

        expect(result.data.edges).toHaveLength(1);
        expect(result.data.edges[0].id).toBe('e2'); // e1 removed
    });

    it('should reset selection if switching parts (even with shift)', () => {
        const initial = { type: 'modify', data: { partId: 'p1', edges: [edge1] } };
        // User shifts click on a DIFFERENT part
        const result = reduceModifyState(initial, { partId: 'p2', edge: edge3, shiftKey: true });

        expect(result.data.partId).toBe('p2');
        expect(result.data.edges).toHaveLength(1);
        expect(result.data.edges[0].id).toBe('e3');
    });
});
