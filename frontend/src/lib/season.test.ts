import { describe, it, expect } from 'vitest';
import { prettySeason, seasonLabel } from './season';

describe('prettySeason', () => {
    it('formats "M4" → "M-4"', () => {
        expect(prettySeason('M4')).toBe('M-4');
        expect(prettySeason('M12')).toBe('M-12');
    });
    it('passes through unknown shapes and null', () => {
        expect(prettySeason('Current')).toBe('Current');
        expect(prettySeason(null)).toBeNull();
        expect(prettySeason(undefined)).toBeNull();
    });
});

describe('seasonLabel', () => {
    it('builds a provenance prefix', () => {
        expect(seasonLabel('M4')).toBe('Season M-4 · ');
    });
    it('is empty when the season is unknown (safe to concatenate)', () => {
        expect(seasonLabel(null)).toBe('');
        expect(seasonLabel(undefined)).toBe('');
    });
});
