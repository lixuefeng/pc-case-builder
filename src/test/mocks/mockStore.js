import { create } from 'zustand';

export const useStore = create((set) => ({
    rulerPoints: [],
    measurements: [],
    hudState: null,

    setRulerPoints: (points) => set({ rulerPoints: points }),
    setMeasurements: (updater) => set((state) => ({
        measurements: typeof updater === 'function' ? updater(state.measurements) : updater
    })),
    setHudState: (state) => set({ hudState: state }),

    // Add reset for testing
    reset: () => set({ rulerPoints: [], measurements: [], hudState: null })
}));
