import { EDITOR_CONFIG } from "../constants";

const DUPLICATE_OFFSET = EDITOR_CONFIG.DUPLICATE_OFFSET;

export const randomSuffix = () => Math.random().toString(36).slice(2, 8);

export const generateObjectId = (type = "obj") => {
    const safeType = typeof type === "string" && type.trim().length > 0 ? type.trim() : "obj";
    return `${safeType}_${Date.now().toString(36)}_${randomSuffix()}`;
};

export const remapConnectorIds = (connectors, ownerId) => {
    if (!Array.isArray(connectors) || connectors.length === 0) {
        return connectors;
    }
    return connectors.map((connector, index) => ({
        ...connector,
        id: `${ownerId}_conn_${index}_${randomSuffix()}`,
    }));
};

export const shiftDuplicatePosition = (pos, offsetIndex = 1) => {
    if (offsetIndex === 0) return Array.isArray(pos) ? [...pos] : [0, 0, 0];
    const offset = DUPLICATE_OFFSET * Math.max(1, offsetIndex);
    const [x = 0, y = 0, z = 0] = Array.isArray(pos) ? pos : [0, 0, 0];
    return [x + offset, y, z + offset];
};

export const buildCopyName = (name, type) => {
    if (typeof name === "string" && name.trim().length > 0) {
        return `${name.trim()} 副本`;
    }
    if (typeof type === "string" && type.length > 0) {
        return `${type.toUpperCase()} 副本`;
    }
    return "对象 副本";
};

export const deepCloneObject = (value) => JSON.parse(JSON.stringify(value));

export const duplicateObject = (sourceObject, offsetIndex = 1) => {
    if (!sourceObject) return null;
    const clone = deepCloneObject(sourceObject);

    const assignIds = (node, { applyOffset }) => {
        if (!node || typeof node !== "object") return node;
        const newId = generateObjectId(node.type || "obj");
        node.id = newId;
        node.name = buildCopyName(node.name, node.type);
        if (applyOffset) {
            node.pos = shiftDuplicatePosition(node.pos, offsetIndex);
        } else if (!Array.isArray(node.pos)) {
            node.pos = [0, 0, 0];
        }
        if (node.embeddedParentId) {
            delete node.embeddedParentId;
        }
        if (Array.isArray(node.connectors) && node.connectors.length > 0) {
            node.connectors = remapConnectorIds(node.connectors, newId);
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
            node.children = node.children.map((child) => assignIds(child, { applyOffset: false }));
        }
        return node;
    };


    return assignIds(clone, { applyOffset: true });
};

export const formatPartName = (part) => {
    if (!part) return "对象";
    if (part.name) return part.name;
    if (part.type) return part.type.toUpperCase();
    return part.id;
};
