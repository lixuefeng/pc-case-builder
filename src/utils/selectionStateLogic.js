/**
 * Pure reducer logic for Modify Mode selection state (HUD State).
 * 
 * @param {Object} currentState - The current HUD state object (type, data).
 * @param {Object} action - The action details { partId, edge, shiftKey }.
 * @returns {Object} The new HUD state.
 */
export const reduceModifyState = (currentState, action) => {
    const { partId, edge, shiftKey } = action;
    const isModify = currentState?.type === 'modify';
    const currentData = isModify ? currentState.data : {};

    // 1. Switching Parts -> Reset
    if (currentData.partId && currentData.partId !== partId) {
        return {
            type: 'modify',
            data: {
                partId: partId,
                edges: [edge],
                operation: 'chamfer',
                size: 5
            }
        };
    }

    let newEdges = currentData.edges || [];

    if (shiftKey) {
        // Toggle Logic
        const existsIndex = newEdges.findIndex(e => e.id === edge.id);
        if (existsIndex >= 0) {
            // Remove (Filter out)
            newEdges = newEdges.filter(e => e.id !== edge.id);
        } else {
            // Add
            newEdges = [...newEdges, edge];
        }
    } else {
        // Single Selection (Replace)
        // Check if we are clicking an already selected edge? 
        // Standard behavior: replace selection with this one.
        newEdges = [edge];
    }

    // Default operation params if not present
    const operation = currentData.operation || 'chamfer';
    const size = currentData.size || 5;

    return {
        type: 'modify',
        data: {
            partId,
            edges: newEdges,
            operation,
            size
        }
    };
};
