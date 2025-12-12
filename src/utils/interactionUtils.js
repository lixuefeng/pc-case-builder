import { Mesh } from "three";

export function applyConnectorRaycastBias(mesh, raycaster, intersects, bias = 100.0) {
    // Simple bias logic if needed, otherwise just push standard intersection
    // ...

    const prevLen = intersects.length;
    // Use prototype to avoid recursion if this function is called from within an overridden raycast
    Mesh.prototype.raycast.call(mesh, raycaster, intersects);

    if (intersects.length > prevLen) {
        for (let i = prevLen; i < intersects.length; i++) {
            intersects[i].distance = Math.max(0, intersects[i].distance - bias);
        }
    }
}
