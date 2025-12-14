// utils/exportSTL.js — Export visible meshes as STL with boolean subtraction for holes/screws
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { SUBTRACTION, Brush, Evaluator } from "three-bvh-csg";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function exportSTLFrom(root) {
  if (!root) return;
  const exporter = new STLExporter();

  const positiveGeometries = [];
  const negativeGeometries = [];

  root.traverse((obj) => {
    if (!obj.visible) return;

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
  if (negativeGeometries.length > 0) {
    const mergedNegative = BufferGeometryUtils.mergeGeometries(negativeGeometries, false);

    // Create Brushes with basic material to avoid attribute inference issues
    const mat = new THREE.MeshBasicMaterial();
    const brushPos = new Brush(mergedPositive, mat);
    const brushNeg = new Brush(mergedNegative, mat);

    // Evaluator
    const evaluator = new Evaluator();

    // Perform A - B
    const resultBrush = evaluator.evaluate(brushPos, brushNeg, SUBTRACTION);

    // Result geometry
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
