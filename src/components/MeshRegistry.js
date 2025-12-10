import {
    MotherboardMesh, GPUMesh, GPUBracketMesh, PartBox, GroupMesh,
    ImportedMesh,
    ReferenceMesh,
    CPUCoolerMesh,
    IOShieldMesh,
    CylinderMesh,
} from "./Meshes.jsx";

export const getComponentForObject = (object, fallback) => {
    if (!object || !object.type) {
        return fallback || PartBox;
    }

    switch (object.type) {
        case "group":
            return GroupMesh;
        case "motherboard":
            return MotherboardMesh;
        case "gpu":
            return GPUMesh;
        case "gpu-bracket":
            return GPUBracketMesh;
        case "imported":
            return ImportedMesh;
        case "reference":
            return ReferenceMesh;
        case "io-shield":
            return IOShieldMesh;
        case "cpu-cooler":
            return CPUCoolerMesh;
        case "cylinder":
        case "cone":
            // CylinderMesh handles both currently (or RenderDispatch logic might handle props)
            // Meshes.jsx exports CylinderMesh which handles obj.type? 
            // Let's check Meshes.jsx details again if needed, but CylinderMesh is the renderer.
            return CylinderMesh;
        case "cube":
        case "structure":
        default:
            return PartBox;
    }
};
