import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { projectedHalfExtentAlongAxis, getLocalAxisDir, inferAxisFromMovement, pickTargetBasis } from '../utils/editorGeometry';

describe('editorGeometry', () => {
    describe('projectedHalfExtentAlongAxis', () => {
        const dims = { w: 10, h: 20, d: 30 }; // Half: 5, 10, 15

        it('calculates correct extent for unrotated object (aligned with world axes)', () => {
            // Identity rotation
            const axes = {
                ax: new THREE.Vector3(1, 0, 0),
                ay: new THREE.Vector3(0, 1, 0),
                az: new THREE.Vector3(0, 0, 1)
            };

            // Test World X (should match local X half-width)
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(1, 0, 0), dims, axes)).toBeCloseTo(5);
            // Test World Y (should match local Y half-height)
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(0, 1, 0), dims, axes)).toBeCloseTo(10);
            // Test World Z (should match local Z half-depth)
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(0, 0, 1), dims, axes)).toBeCloseTo(15);
        });

        it('calculates correct extent for 90 deg rotation around Z (XY Plane rotation)', () => {
            // Rotated 90 deg around Z: Local X -> World Y, Local Y -> World -X
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
            const axes = {
                ax: new THREE.Vector3(1, 0, 0).applyQuaternion(q), // (0, 1, 0)
                ay: new THREE.Vector3(0, 1, 0).applyQuaternion(q), // (-1, 0, 0)
                az: new THREE.Vector3(0, 0, 1).applyQuaternion(q)  // (0, 0, 1)
            };

            // World X aligns with Local Y (size 20 -> half 10)
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(1, 0, 0), dims, axes)).toBeCloseTo(10);
            // World Y aligns with Local X (size 10 -> half 5)
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(0, 1, 0), dims, axes)).toBeCloseTo(5);
            // World Z aligns with Local Z
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(0, 0, 1), dims, axes)).toBeCloseTo(15);
        });

        it('calculates correct extent for 90 deg rotation around Y (ZX Plane rotation)', () => {
            // Rotated 90 deg around Y: Local X -> World -Z, Local Z -> World X
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
            const axes = {
                ax: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
                ay: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
                az: new THREE.Vector3(0, 0, 1).applyQuaternion(q)
            };

            // World X aligns with Local Z (size 30 -> half 15)
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(1, 0, 0), dims, axes)).toBeCloseTo(15);
        });

        it('calculates correct extent for 45 deg rotation around X (YZ Plane rotation)', () => {
            // Rotated 45 deg around X
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4);
            const axes = {
                ax: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
                ay: new THREE.Vector3(0, 1, 0).applyQuaternion(q), // Y and Z mixed
                az: new THREE.Vector3(0, 0, 1).applyQuaternion(q)
            };

            // World X aligns with Local X (size 10 -> half 5)
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(1, 0, 0), dims, axes)).toBeCloseTo(5);

            // World Y aligns partially with Local Y and Local Z
            // cos(45) * h/2 + sin(45) * d/2 = 0.707*10 + 0.707*15 = 7.07 + 10.605 = 17.67
            const expected = (Math.cos(Math.PI / 4) * 10) + (Math.sin(Math.PI / 4) * 15);
            expect(projectedHalfExtentAlongAxis(new THREE.Vector3(0, 1, 0), dims, axes)).toBeCloseTo(expected);
        });
    });

    describe('inferAxisFromMovement', () => {
        // Basic setup for unrotated object
        const identityAxes = {
            axes: {
                ax: new THREE.Vector3(1, 0, 0),
                ay: new THREE.Vector3(0, 1, 0),
                az: new THREE.Vector3(0, 0, 1)
            }
        };

        it('infers X axis correctly', () => {
            const mv = new THREE.Vector3(10, 0.5, 0.5);
            const { axis } = inferAxisFromMovement(mv, identityAxes);
            expect(axis).toBe('X');
        });

        it('infers Y axis correctly', () => {
            const mv = new THREE.Vector3(0.5, 10, 0.5);
            const { axis } = inferAxisFromMovement(mv, identityAxes);
            expect(axis).toBe('Y');
        });

        it('infers Z axis correctly', () => {
            const mv = new THREE.Vector3(0.5, 0.5, 10);
            const { axis } = inferAxisFromMovement(mv, identityAxes);
            expect(axis).toBe('Z');
        });
    });

    describe('pickTargetBasis', () => {
        it('picks aligned basis for cardinal directions', () => {
            const tf = {
                axes: {
                    ax: new THREE.Vector3(1, 0, 0),
                    ay: new THREE.Vector3(0, 1, 0),
                    az: new THREE.Vector3(0, 0, 1)
                }
            };

            expect(pickTargetBasis(tf, new THREE.Vector3(1, 0, 0)).label).toBe('X');
            expect(pickTargetBasis(tf, new THREE.Vector3(0, 1, 0)).label).toBe('Y');
            expect(pickTargetBasis(tf, new THREE.Vector3(0, 0, 1)).label).toBe('Z');
            expect(pickTargetBasis(tf, new THREE.Vector3(-1, 0, 0)).label).toBe('X'); // Dot is abs()
        });
    });
});
