import { describe, it, expect } from 'vitest';
import { getComponentForObject } from '../components/MeshRegistry';
import {
    MotherboardMesh, GPUMesh, GPUBracketMesh, PartBox, GroupMesh,
    ImportedMesh,
    ReferenceMesh,
    CPUCoolerMesh,
    IOShieldMesh,
    CylinderMesh,
} from '../components/Meshes';

describe('MeshRegistry', () => {
    it('should return PartBox for cube type', () => {
        expect(getComponentForObject({ type: 'cube' })).toBe(PartBox);
    });

    it('should return PartBox for structure type', () => {
        expect(getComponentForObject({ type: 'structure' })).toBe(PartBox);
    });

    it('should return MotherboardMesh for motherboard type', () => {
        expect(getComponentForObject({ type: 'motherboard' })).toBe(MotherboardMesh);
    });

    it('should return GPUMesh for gpu type', () => {
        expect(getComponentForObject({ type: 'gpu' })).toBe(GPUMesh);
    });

    it('should return GroupMesh for group type', () => {
        expect(getComponentForObject({ type: 'group' })).toBe(GroupMesh);
    });

    it('should return GPUBracketMesh for gpu-bracket type', () => {
        expect(getComponentForObject({ type: 'gpu-bracket' })).toBe(GPUBracketMesh);
    });

    it('should return CylinderMesh for cylinder type', () => {
        expect(getComponentForObject({ type: 'cylinder' })).toBe(CylinderMesh);
    });

    it('should return CylinderMesh for cone type', () => {
        expect(getComponentForObject({ type: 'cone' })).toBe(CylinderMesh);
    });

    it('should return PartBox for unknown types', () => {
        expect(getComponentForObject({ type: 'unknown-part' })).toBe(PartBox);
        expect(getComponentForObject({})).toBe(PartBox);
        expect(getComponentForObject(null)).toBe(PartBox);
    });
});
