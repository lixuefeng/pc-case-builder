import { describe, it, expect } from 'vitest';
import { canSelectObject } from '../utils/interactionLogic';

describe('InteractionLogic', () => {
    describe('canSelectObject', () => {
        it('should allow selection in translate mode', () => {
            // This was the regression: translate mode should allow selection even if alignMode is natively true
            expect(canSelectObject('translate')).toBe(true);
        });

        it('should allow selection in rotate mode', () => {
            expect(canSelectObject('rotate')).toBe(true);
        });

        it('should allow selection in scale mode', () => {
            // Scale mode might have valid object selection to switch target
            expect(canSelectObject('scale')).toBe(true);
        });

        it('should block selection in ruler mode', () => {
            expect(canSelectObject('ruler')).toBe(false);
        });

        it('should block selection in cut mode', () => {
            expect(canSelectObject('cut')).toBe(false);
        });

        it('should block selection in drill mode', () => {
            expect(canSelectObject('drill')).toBe(false);
        });
    });
});
