// utils/exportSTL.js — 导出场景中可见网格为 STL
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function exportSTLFrom(root) {
  if (!root) return;
  const exporter = new STLExporter();
  const geometries = [];

  root.traverse((obj) => {
    const mesh = obj;
    if (mesh?.isMesh && mesh.visible && mesh.geometry) {
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      geometries.push(g);
    }
  });

  if (!geometries.length) return;
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  const dummy = new THREE.Mesh(merged);
  const stl = exporter.parse(dummy);

  const blob = new Blob([stl], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "assembly.stl";
  a.click();
  URL.revokeObjectURL(url);
}
