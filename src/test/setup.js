import { vi } from 'vitest';

// Mock ResizeObserver for React Three Fiber / Drei
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock pointer events if needed
if (!global.PointerEvent) {
    global.PointerEvent = class PointerEvent extends Event {
        constructor(type, props) {
            super(type, props);
            Object.assign(this, props);
        }
    };
}

// Mock Three.js STLLoader to avoid binary file issues in tests
vi.mock('three/examples/jsm/loaders/STLLoader', () => {
    return {
        STLLoader: class STLLoader {
            parse() {
                return {
                    computeBoundingBox: () => { },
                    boundingBox: {
                        getSize: (v) => v.set(10, 10, 10),
                        min: { x: -5, y: -5, z: -5 },
                        max: { x: 5, y: 5, z: 5 }
                    }
                };
            }
        }
    };
});
