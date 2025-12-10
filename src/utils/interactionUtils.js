import { Mesh } from "three";

export function applyConnectorRaycastBias(mesh, raycaster, intersects, bias = 0.1) {
    // Simple bias logic if needed, otherwise just push standard intersection
    // ...

    const prevLen = intersects.length;
    // Use prototype to avoid recursion if this function is called from within an overridden raycast
    Mesh.prototype.raycast.call(mesh, raycaster, intersects);

    if (intersects.length > prevLen) {
        const last = intersects[intersects.length - 1];
        last.distance = Math.max(0, last.distance - bias);
    }
}
