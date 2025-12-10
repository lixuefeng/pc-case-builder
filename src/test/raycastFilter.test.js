
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('Raycast Filter Logic', () => {
    it('should detect internal screw geometries inside a cube', () => {
        // 1. Setup Scene
        const scene = new THREE.Scene();

        // 2. Create "Part" (Cube)
        // Dimensions: 10x10x10. Position: 0,0,0
        const partGeometry = new THREE.BoxGeometry(10, 10, 10);
        const partMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
        const partMesh = new THREE.Mesh(partGeometry, partMaterial);
        partMesh.name = "PartMesh";
        partMesh.userData = { isPart: true };
        scene.add(partMesh);

        // 3. Create "Hole" (Internal Screw)
        // Position: Inside the cube. e.g. 0,0,0.
        // Head: Cyl radius 3, depth 2.
        // Shaft: Cyl radius 1.5, depth 10.
        // Meshes need to be physically inside the cube volume.

        const holeGroup = new THREE.Group();
        holeGroup.position.set(0, 0, 0); // Center of cube

        // Head Mesh (simulating HoleMarker structure)
        const headGeo = new THREE.CylinderGeometry(3, 3, 2, 32);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.name = "HoleHead";
        headMesh.userData = { isHole: true };
        // Position relative to group. HoleMarker logic: [0, -headDepth/2 + eps, 0]
        // If headDepth=2, y = -1.
        headMesh.position.set(0, -1, 0);
        holeGroup.add(headMesh);

        // Shaft Mesh
        const shaftGeo = new THREE.CylinderGeometry(1.5, 1.5, 10, 32);
        const shaftMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
        shaftMesh.name = "HoleShaft";
        shaftMesh.userData = { isHole: true };
        // Position relative to group. HoleMarker logic: [0, -headDepth - shaftLength/2 + eps, 0]
        // If headDepth=2, shaftLength=10. y = -2 - 5 = -7.
        shaftMesh.position.set(0, -7, 0);
        holeGroup.add(shaftMesh);

        scene.add(holeGroup);

        // 4. Update Matrices
        scene.updateMatrixWorld(true);

        // 5. Raycast from OUTSIDE
        // Camera at (0, 20, 0) looking down Y?
        // Cube extends Y: [-5, 5].
        // Hole Group at (0,0,0).
        // Head at y=-1 (Inside).
        // Shaft at y=-7 (Partially inside, partially protruding out bottom if cube is h=10 (y -5 to 5)).
        // Cube Y range: -5 to 5.
        // Shaft Y range: center -7, height 10 => [-12, -2].
        // So shaft is [-12, -2]. Cube is [-5, 5]. Overlap -5 to -2.

        const raycaster = new THREE.Raycaster();
        // Origin: (0, 20, 0). Direction: (0, -1, 0) (Down)
        raycaster.set(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0));

        // 6. Check Intersections
        const intersects = raycaster.intersectObjects(scene.children, true);

        // Expected hits:
        // 1. PartMesh Top Face (y=5)
        // 2. HoleHead Top Face (y=0 if height 2, center -1? No top is -1+1=0).
        //    Wait, Head is Cylinder. 
        //    CylinderGeometry creates center at origin of mesh.
        //    Mesh at (0, -1, 0). Height 2.
        //    Top cap at -1 + 1 = 0.
        //    Bottom cap at -1 - 1 = -2.
        //    So Head is [0, -2].
        //    Cube is [-5, 5].
        //    So Head is FULLY INSIDE Cube.

        console.log("Hits found:", intersects.length);
        intersects.forEach((hit, i) => {
            console.log(`Hit ${i}: ${hit.object.name} at dist ${hit.distance} (point y: ${hit.point.y})`);
        });

        // Assertion: We MUST find the HoleHead and HoleShaft in the list.
        const hitHead = intersects.find(h => h.object.name === "HoleHead");
        const hitShaft = intersects.find(h => h.object.name === "HoleShaft");
        const hitPart = intersects.find(h => h.object.name === "PartMesh");

        expect(hitPart).toBeDefined();
        expect(hitHead).toBeDefined(); // If this fails, Raycaster is culling internal faces!

        // 7. Verify Filter Logic
        // Simulate Scene.jsx filter
        const transformMode = "drill";
        let filteredIntersects = intersects;

        if (transformMode === "drill") {
            const holes = [];
            const others = [];
            intersects.forEach((hit) => {
                if (hit.object.userData?.isHole || hit.object.parent?.userData?.isHole) {
                    holes.push(hit);
                } else {
                    others.push(hit);
                }
            });
            filteredIntersects = [...holes, ...others];
        }

        console.log("Filtered Top Hit:", filteredIntersects[0]?.object.name);
        expect(filteredIntersects[0].object.userData.isHole).toBe(true);
    });
});
