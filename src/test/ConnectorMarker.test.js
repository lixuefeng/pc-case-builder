import { describe, it, expect } from 'vitest';
import { getConnectorBaseColor } from '../components/ConnectorMarker';

describe('ConnectorMarker', () => {
    describe('getConnectorBaseColor', () => {
        it('returns correct color for known types', () => {
            expect(getConnectorBaseColor({ type: 'screw-m3' })).toBe('#38bdf8');
            expect(getConnectorBaseColor({ type: 'pcie-slot' })).toBe('#f87171');
        });

        it('returns gender-based color for unknown types', () => {
            // "male" -> "#60a5fa", "female" (default/other) -> "#a3e635"
            // Wait, logic in extracted component:
            // if type... return type color
            // return gender === 'male' ? ... : ...

            expect(getConnectorBaseColor({ type: 'unknown', gender: 'male' })).toBe('#60a5fa');
            expect(getConnectorBaseColor({ type: 'unknown', gender: 'female' })).toBe('#a3e635');
        });

        it('returns fallback if type missing', () => {
            // If type is missing, it falls through to gender check
            expect(getConnectorBaseColor({ gender: 'male' })).toBe('#60a5fa');
        });
    });
});
