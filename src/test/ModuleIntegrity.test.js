import { describe, it, expect } from 'vitest';
import * as editorGeometry from '../utils/editorGeometry';

describe('Module Integrity: editorGeometry', () => {
    it('should export computeFaceTransform', () => {
        expect(editorGeometry.computeFaceTransform).toBeDefined();
        expect(typeof editorGeometry.computeFaceTransform).toBe('function');
    });

    it('should export flattenObjectsWithTransforms', () => {
        expect(editorGeometry.flattenObjectsWithTransforms).toBeDefined();
        expect(typeof editorGeometry.flattenObjectsWithTransforms).toBe('function');
    });

    it('should export computeConnectorTransform', () => {
        expect(editorGeometry.computeConnectorTransform).toBeDefined();
        expect(typeof editorGeometry.computeConnectorTransform).toBe('function');
    });

    it('should export getWorldTransform', () => {
        expect(editorGeometry.getWorldTransform).toBeDefined();
        expect(typeof editorGeometry.getWorldTransform).toBe('function');
    });

    it('should export projectedHalfExtentAlongAxis', () => {
        expect(editorGeometry.projectedHalfExtentAlongAxis).toBeDefined();
        expect(typeof editorGeometry.projectedHalfExtentAlongAxis).toBe('function');
    });
});
