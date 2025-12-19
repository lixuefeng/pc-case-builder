import { describe, it, expect } from 'vitest';
import defaultProjectData from '../pc-case-design-2025-12-14.json';

describe('Default Model Compatibility', () => {
    it('should be a valid array', () => {
        expect(Array.isArray(defaultProjectData)).toBe(true);
        expect(defaultProjectData.length).toBeGreaterThan(0);
    });

    it('should contain essential components', () => {
        const motherboards = defaultProjectData.filter(o => o.type === 'motherboard');
        const gpus = defaultProjectData.filter(o => o.type === 'gpu');

        expect(motherboards.length).toBeGreaterThan(0);
        expect(gpus.length).toBeGreaterThan(0);
    });

    it('should have valid base properties for all objects', () => {
        defaultProjectData.forEach(obj => {
            expect(obj).toHaveProperty('id');
            expect(obj).toHaveProperty('type');
            expect(obj).toHaveProperty('name');
            try {
                expect(obj).toHaveProperty('visible');
            } catch (e) {
                console.error(`Object missing 'visible': ${obj.id} (type: ${obj.type})`);
                throw e;
            }

            // Dimensions
            expect(obj).toHaveProperty('dims');
            expect(obj.dims).toHaveProperty('w');
            expect(obj.dims).toHaveProperty('h');
            expect(obj.dims).toHaveProperty('d');

            // Position
            expect(obj).toHaveProperty('pos');
            expect(obj.pos).toHaveLength(3);

            // Rotation
            expect(obj).toHaveProperty('rot');
            expect(obj.rot).toHaveLength(3);
        });
    });

    it('should have valid GPU specification metadata', () => {
        const gpu = defaultProjectData.find(o => o.type === 'gpu');
        if (gpu) {
            expect(gpu.meta).toBeDefined();
            // Check for PCIe specs if they exist in meta
            if (gpu.meta.pcie) {
                expect(gpu.meta.pcie).toHaveProperty('fingerLength');
                expect(gpu.meta.pcie).toHaveProperty('fingerHeight');
            }
        }
    });
});
