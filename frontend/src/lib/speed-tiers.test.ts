import { describe, it, expect } from 'vitest';
import {
    buildLadder, effectiveSpeed, outspeedShare, EMPTY_PER_MON,
    type GlobalMods, type SpeedEntry,
} from './speed-tiers';

const G = (o: Partial<GlobalMods> = {}): GlobalMods => ({ tailwind: false, trickRoom: false, weather: 'none', terrain: 'none', ...o });

describe('effectiveSpeed, modifier math + order of ops', () => {
    it('no modifiers returns the base', () => {
        expect(effectiveSpeed(100, null, 'team', G(), EMPTY_PER_MON)).toBe(100);
    });
    it('Choice Scarf is ×1.5', () => {
        expect(effectiveSpeed(100, null, 'team', G(), { ...EMPTY_PER_MON, scarf: true })).toBe(150);
    });
    it('paralysis is ×0.5', () => {
        expect(effectiveSpeed(100, null, 'team', G(), { ...EMPTY_PER_MON, paralysis: true })).toBe(50);
    });
    it('stat stages: +1 ×1.5, +2 ×2, −1 ×2/3', () => {
        expect(effectiveSpeed(100, null, 'team', G(), { ...EMPTY_PER_MON, stage: 1 })).toBe(150);
        expect(effectiveSpeed(100, null, 'team', G(), { ...EMPTY_PER_MON, stage: 2 })).toBe(200);
        expect(effectiveSpeed(99, null, 'team', G(), { ...EMPTY_PER_MON, stage: -1 })).toBe(66);
    });
    it('Tailwind ×2 applies only to your side', () => {
        expect(effectiveSpeed(100, null, 'team', G({ tailwind: true }), EMPTY_PER_MON)).toBe(200);
        expect(effectiveSpeed(100, null, 'meta', G({ tailwind: true }), EMPTY_PER_MON)).toBe(100);
    });
    it('weather/terrain speed abilities ×2 when the field matches', () => {
        expect(effectiveSpeed(100, 'Swift Swim', 'meta', G({ weather: 'rain' }), EMPTY_PER_MON)).toBe(200);
        expect(effectiveSpeed(100, 'Swift Swim', 'meta', G({ weather: 'sun' }), EMPTY_PER_MON)).toBe(100);
        expect(effectiveSpeed(100, 'Sand Rush', 'meta', G({ weather: 'sand' }), EMPTY_PER_MON)).toBe(200);
        expect(effectiveSpeed(100, 'Surge Surfer', 'meta', G({ terrain: 'electric' }), EMPTY_PER_MON)).toBe(200);
    });
    it('stacks stage → ability → scarf → tailwind and floors', () => {
        // 100 ×1.5(+1) ×2(rain) ×1.5(scarf) ×2(tailwind) = 900
        expect(effectiveSpeed(100, 'Swift Swim', 'team', G({ weather: 'rain', tailwind: true }), { ...EMPTY_PER_MON, stage: 1, scarf: true })).toBe(900);
    });
});

const entry = (o: Partial<SpeedEntry>): SpeedEntry => ({
    key: 'k', pokemonId: 1, displayName: 'X', type1: 'normal', type2: null, side: 'meta', baseFinalSpe: 100, ability: null, ...o,
});

describe('buildLadder', () => {
    it('sorts fastest-first by default', () => {
        const l = buildLadder([entry({ key: 'a', baseFinalSpe: 80 }), entry({ key: 'b', baseFinalSpe: 120 })], G());
        expect(l.rows.map((r) => r.entry.key)).toEqual(['b', 'a']);
    });
    it('Trick Room inverts to slowest-first', () => {
        const l = buildLadder([entry({ key: 'a', baseFinalSpe: 80 }), entry({ key: 'b', baseFinalSpe: 120 })], G({ trickRoom: true }));
        expect(l.rows.map((r) => r.entry.key)).toEqual(['a', 'b']);
        expect(l.trickRoom).toBe(true);
    });
});

describe('outspeedShare', () => {
    const ladderOf = (metaSpeeds: number[], g = G()) =>
        buildLadder(metaSpeeds.map((s, i) => entry({ key: `m${i}`, side: 'meta', baseFinalSpe: s, presence: 1 })), g);

    it('is the presence-weighted share of meta you outspeed', () => {
        const l = ladderOf([80, 90, 130]);
        expect(outspeedShare(100, l)).toBe(67); // beats 80 & 90 of 3 → 2/3
    });
    it('inverts under Trick Room (slower is better)', () => {
        const l = ladderOf([80, 90, 130], G({ trickRoom: true }));
        expect(outspeedShare(100, l)).toBe(33); // only 130 is "slower/better" than you under TR → 1/3
    });
});
