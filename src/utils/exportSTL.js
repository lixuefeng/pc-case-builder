// utils/exportSTL.js — Export visible meshes as STL with boolean subtraction for holes/screws
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { SUBTRACTION, ADDITION, Brush, Evaluator } from "three-bvh-csg";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function exportSTLFrom(root, options = {}) {
  if (!root) return;
  const exporter = new STLExporter();

  const { onlyOneId, excludeTypes } = options;
  const positiveGeometries = [];
  const negativeGeometries = [];

  root.traverse((obj) => {
    if (!obj.visible) return;

    // Check ancestors for flags and identity
    let current = obj;
    let isNoExport = false;
    let isExcludedType = false;
    let matchesTargetId = !onlyOneId; // If no target ID, we match everything by default (subject to exclusions)
    if (onlyOneId) matchesTargetId = false; // Reset if looking for specific

    // If looking for specific ID, we must find it in the chain.
    // If excluding types, we must NOT find them in the chain.

    while (current) {
      if (current.userData?.noExport) {
        isNoExport = true;
        break;
      }

      if (excludeTypes && excludeTypes.includes(current.userData?.type)) {
        isExcludedType = true;
        // Don't break immediately, we might continue to verify other things if needed? 
        // Actually if it's excluded, we can stop checking.
        break;
      }

      if (onlyOneId && current.userData?.objectId === onlyOneId) {
        matchesTargetId = true;
      }

      if (current === root) break;
      current = current.parent;
    }

    if (isNoExport) return;
    if (isExcludedType) return;


    // For positive geometry, we strictly need to match the target ID if provided.
    // For negative geometry (holes), usually they belong to the object, so they will match too.
    // NOTE: If we wanted to allow global holes to cut the selected object, we'd need different logic.
    // But currently holes are children of parts. So holes of other parts won't be picked up.
    // This is probably desired (don't let an invisible part's hole cut my part).
    if (onlyOneId && !matchesTargetId) return;

    // Check if it's a hole/screw/negative volume
    // HoleMarker uses userData: { isHole: true }
    const isNegative = obj.userData?.isHole === true;


    // Helper to sanitize geometry for merging/CSG
    const sanitizeGeometry = (geom) => {
      // Convert to non-indexed to avoid index mismatches and ensure clean CSG
      const nonIndexed = geom.toNonIndexed();

      // Re-compute normals if needed
      if (!nonIndexed.attributes.normal) nonIndexed.computeVertexNormals();

      // Create a brand new geometry to ensure we ONLY have position and normal.
      // This avoids mismatches with uv, uv2, skinWeight, color, etc.
      const cleanGeom = new THREE.BufferGeometry();
      cleanGeom.setAttribute('position', nonIndexed.attributes.position);
      cleanGeom.setAttribute('normal', nonIndexed.attributes.normal);

      // Add dummy UVs to satisfy tools that expect them (three-bvh-csg / exporters)
      const count = nonIndexed.attributes.position.count;
      const uvs = new Float32Array(count * 2);
      cleanGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      return cleanGeom;
    };

    if (obj.isMesh && obj.geometry) {
      let g = obj.geometry.clone();

      if (isNegative) {
        // KEY FIX: Slightly extend the cutter (hole) along its local Y axis.
        // This ensures it fully penetrates the surface and avoids Z-fighting/coincident faces caused by exact length matches.
        // Standard Three.js cylinders are Y-aligned.
        g.scale(1, 1.1, 1);
      }

      g.applyMatrix4(obj.matrixWorld);
      g = sanitizeGeometry(g);

      if (isNegative) {
        negativeGeometries.push(g);
      } else {
        positiveGeometries.push(g);
      }
    }
  });

  if (!positiveGeometries.length) {
    alert("No exportable geometry found!");
    return;
  }

  // 1. Merge all positives into one geometry
  const mergedPositive = BufferGeometryUtils.mergeGeometries(positiveGeometries, false);
  let finalGeometry = mergedPositive;

  // 2. If we have negatives, perform CSG subtraction
  // Strategy: Union all negatives into one "Master Cutter", then subtract from Positive.
  // This avoids issues with self-intersecting negatives (overlapping head/shaft) and is more robust.
  if (negativeGeometries.length > 0) {
    // Use basic material
    const mat = new THREE.MeshBasicMaterial();
    const evaluator = new Evaluator();

    // 2a. Build the Cutter (Union of all holes)
    let cutterBrush = new Brush(negativeGeometries[0], mat);

    for (let i = 1; i < negativeGeometries.length; i++) {
      const nextNegBrush = new Brush(negativeGeometries[i], mat);
      cutterBrush = evaluator.evaluate(cutterBrush, nextNegBrush, ADDITION);
    }

    // 2b. Subtract Cutter from Positive
    const positiveBrush = new Brush(mergedPositive, mat);
    const resultBrush = evaluator.evaluate(positiveBrush, cutterBrush, SUBTRACTION);

    // Final result
    finalGeometry = resultBrush.geometry;
  }

  // 3. Export
  const dummy = new THREE.Mesh(finalGeometry);
  const stl = exporter.parse(dummy);

  const blob = new Blob([stl], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "assembly_with_holes.stl";
  a.click();
  URL.revokeObjectURL(url);
}
