import { Mesh } from "three";

export function applyConnectorRaycastBias(mesh, raycaster, intersects) {
    // Simple bias logic if needed, otherwise just push standard intersection
    // In original code it was:
    // raycaster.intersectObject(mesh, false, intersects);
    // // find the intersection we just added
    // const last = intersects[intersects.length - 1];
    // if (last) {
    //    last.distance -= 5; // bias
    // }

    const prevLen = intersects.length;
    // Use prototype to avoid recursion if this function is called from within an overridden raycast
    Mesh.prototype.raycast.call(mesh, raycaster, intersects);

    if (intersects.length > prevLen) {
        const last = intersects[intersects.length - 1];
        last.distance = Math.max(0, last.distance - 2); // bias 2mm closer
    }
}
