import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateHoveredFace } from '../utils/raycasting';

describe('Raycasting Utils', () => {
    describe('calculateHoveredFace', () => {
        // Standard 10x10x10 cube centered at 0,0,0
        // Extents: [-5, -5, -5] to [5, 5, 5]
        const w = 10, h = 10, d = 10;

        it('should detect top face when ray hits from above', () => {
            const origin = new THREE.Vector3(0, 10, 0); // Above
            const dir = new THREE.Vector3(0, -1, 0); // Pointing down
            const ray = new THREE.Ray(origin, dir);

            const face = calculateHoveredFace(ray, w, h, d);
            expect(face).toBe('+Y');
        });

        it('should detect front face when ray hits from front', () => {
            const origin = new THREE.Vector3(0, 0, 10); // Front (Z+)
            const dir = new THREE.Vector3(0, 0, -1); // Pointing back (Z-)
            const ray = new THREE.Ray(origin, dir);

            const face = calculateHoveredFace(ray, w, h, d);
            expect(face).toBe('+Z');
        });

        it('should detect right face when ray hits from right', () => {
            const origin = new THREE.Vector3(10, 0, 0); // Right (X+)
            const dir = new THREE.Vector3(-1, 0, 0); // Pointing left (X-)
            const ray = new THREE.Ray(origin, dir);

            const face = calculateHoveredFace(ray, w, h, d);
            expect(face).toBe('+X');
        });

        it('should return null if ray misses the box', () => {
            const origin = new THREE.Vector3(20, 20, 20);
            const dir = new THREE.Vector3(0, 1, 0); // Pointing away
            const ray = new THREE.Ray(origin, dir);

            const face = calculateHoveredFace(ray, w, h, d);
            expect(face).toBe(null);
        });

        it('should respect non-uniform dimensions', () => {
            // Flat plate: 10x1x10
            const face = calculateHoveredFace(
                new THREE.Ray(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0)),
                10, 1, 10
            );
            expect(face).toBe('+Y');
        });
    });
});
