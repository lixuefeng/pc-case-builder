// Dimensions and Specs
export const GPU_SPECS = {
    BRACKET_WIDTH_SINGLE: 18.42,
    SLOT_PITCH: 20.32,
    ALIGNMENT_OFFSET: 6.54, // Updated from 5.09 based on user calc
    DEFAULT_BODY_LENGTH: 265,
    DEFAULT_DIMS: { w: 267, h: 112, d: 51 },
    BRACKET: {
        HEIGHT: 120,
        THICKNESS: 2,
        DROP_BELOW_BODY: 30,
        X_OFFSET: -0.8,
        HOLE_DIA: 4.0, // Clearance for #6-32
        HOLE_OFFSET_Z: 6.0, // Distance from the bend (face) to center of hole
        HOLE_X_OFFSET: -4.5, // Shift holes left to visually match "edge" alignment
    },
};

export const COOLER_SPECS = {
    FAN_DEPTH: 25,
    MIN_HEATSINK_DEPTH: 10,
    TOWER_120: { w: 125, h: 160, d: 80 },
};

export const MOTHERBOARD_SPECS = {
    DIMENSIONS: {
        ITX: { w: 170, d: 170 },
        MATX: { w: 244, d: 244 },
        ATX: { w: 305, d: 244 },
    },

    LAYOUT_ATX_2_2: {
        KEEPOUT_SIZE: 77.5,
        KEEPOUT_LEFT: 61.3,
        KEEPOUT_TOP: 51.3,
        CPU_SOCKET: { w: 45, h: 4.5, d: 37.5 },
        RAM_SLOT: { w: 127, h: 4, d: 6 },
        RAM_OFFSET_RIGHT: 14,
        RAM_OFFSET_TOP: 139,
        RAM_PITCH: 9.5,
        EPS8: { w: 10, h: 5, d: 18.75 },
        ATX24: { w: 52, h: 5, d: 10 },
        PCIE_X16: { w: 7.2, h: 11, d: 89.5 },
        PCIE_OFFSET_TOP: 45.5,
        IO_APERTURE: { w: 158.75, h: 44.45, d: 19 },
        IO_APERTURE_OFFSET_LEFT: 13.56,
        IO_APERTURE_OFFSET_TOP: -1.14,
        IO_KEEPOUT: 2.54,
        IO_SHIELD_RECESS_DEPTH: 2.0,
        IO_BODY_VERTICAL_OFFSET: 40.64,
        IO_BODY_HORIZONTAL_OFFSET: 2.44,
        IO_BODY_Z_OFFSET: 3.43,
    },

    // Virtual Origin for Alignment (0.4" from Left, 0.25" from Top)
    ANCHOR: { x: -6.35, y: 10.16 },

    // Hole coordinates relative to ANCHOR
    // Standard ATX Layout (IO 'Up'):
    // C: Top-Left  (6.35, 10.16)
    // F: Top-Right (163.83, 33.02)

    // ITX: C, F, H, J
    ITX_HOLES: [
        [-157.48, 0],    // C
        [0, 22.86],   // F: Aligned Top with C (User request)
        [-157.48, 154.94],  // H
        [0, 154.94], // J
    ],
    // mATX: C, F, H, J, L, M
    MATX_HOLES: [
        [-157.48, 0],     // C
        [0, 22.86],       // F: Dropped 0.9" from Anchor
        [-157.48, 154.94],// H
        [0, 154.94],      // J
        [-157.48, 233.68],// L: Bottom-Left-Far
        [0, 233.68],      // M
    ],
    // ATX: C, F, H, J, L, M, A, G, K 
    // Hole A is at Top-Right Corner (Anchor). C/F are to the left.
    ATX_HOLES: [
        [-271.78, 0],     // C: Top-Left (Far Left)
        [-114.3, 22.86],  // F: Top-Middle (Dropped)
        [-271.78, 154.94],// H
        [-114.3, 154.94], // J
        [-271.78, 233.68],// L
        [-114.3, 233.68], // M
        [0, 0],           // A: Top-Right (Anchor)
        [0, 154.94],      // G
        [0, 233.68],      // K
    ],
    ATX_HOLE_FH_TOP_OFFSET: 163.83,
};

export const RAM_SPECS = {
    DIMM: { w: 133, h: 31, d: 7 },
    SLOT_LENGTH_ITX: 127,
    SLOT_LENGTH_ATX: 130,
    SPACING_ITX: 9,
    SPACING_ATX: 10,
};

export const PSU_SPECS = {
    SFX: { w: 125, h: 63.5, d: 100 },
    ATX: { w: 150, h: 86, d: 140 },
};

export const PCIE_SPECS = {
    SLOT_HEIGHT: 11,
    CONTACT_OFFSET: 5,
    FINGER_LENGTH: 89,
    FINGER_HEIGHT: 12.5,
    FINGER_THICKNESS: 1.6,
    FINGER_OFFSET_FROM_BRACKET: 45.5,
    FINGER_DROP: -5,
};

export const REFERENCE_OBJECT_SPECS = {
    COKE_CAN_DIAMETER: 66,
    COKE_CAN_HEIGHT: 115,
};

export const GPU_PCIE_FINGER_DEFAULTS = Object.freeze({
    height: 12.5, // mm finger height
    visualDrop: 0, // mm; 0 keeps finger top flush with GPU bottom face
    insertionDepth: 5, // mm; intended slot engagement depth (does not move mesh center)
    zOffsetFromBack: 3, // mm from back face (PCB side) to finger center along Z
    connectorEpsUp: 0.1, // mm; lift connector slightly above bottom edge to avoid being under geometry
});

// Editor Configuration
export const EDITOR_CONFIG = {
    DUPLICATE_OFFSET: 25,
    SNAP_THRESHOLD: 3,
    DRILL_MAX_DIM: 1000,
    DRILL_MARGIN: 0.5,
};

// Colors
export const COLORS = {
    SELECTION: {
        PRIMARY: "#ef4444",   // Red
        SECONDARY: "#eab308", // Yellow
        TERTIARY: "#ef4444",  // Red (fallback/default for >2)
        IMPORTED: "#60a5fa",  // Blue for imported
    },
    DEFAULT: {
        GPU_BRACKET: "#9ca3af",
        GPU_BODY: "#475569",
        GPU_FINGER: "#fbbf24",
        MOTHERBOARD: "#81a1c1",
        MOTHERBOARD_HOLE: "#202020",
        GROUP_GHOST: "#4f46e5",
        STRUCTURE: "#d1d5db",
        GENERIC_PART: "#ffaa44",
        IMPORTED_DEFAULT: "#94a3b8",
        SILVER: "#e2e8f0",
        FAN_BLACK: "#1e293b",
        RED_PAINT: "#ef4444",
    },
};
