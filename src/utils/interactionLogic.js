/**
 * Determines if an object can be selected based on the current editor mode.
 * 
 * @param {string} mode - The current transform mode (e.g., 'translate', 'rotate', 'scale', 'ruler', 'cut', 'drill').
 * @returns {boolean} - True if selection is allowed, false otherwise.
 */
export const canSelectObject = (mode) => {
    // These modes require specific interactions (like face picking) and should block generic object selection
    const blockingModes = ["ruler", "cut", "drill"];
    if (blockingModes.includes(mode)) {
        return false;
    }
    return true;
};
