import { describe, it, expect } from 'vitest';
import {
    typeEffectiveness, computeDamage, defenderImmuneByAbility, type DamageInput,
} from './damage-calc';

const chart = {
    Ice: { Dragon: 2, Ground: 2 },
    Fire: { Water: 0.5, Grass: 2 },
    Normal: { Ghost: 0 },
};

describe('typeEffectiveness', () => {
    it('multiplies both defender types', () => {
        expect(typeEffectiveness('ice', 'dragon', 'ground', chart)).toBe(4);
    });
    it('single type + missing pairs default to 1×', () => {
        expect(typeEffectiveness('fire', 'water', null, chart)).toBe(0.5);
        expect(typeEffectiveness('fire', 'normal', null, chart)).toBe(1);
    });
    it('handles the real input shapes (lowercase move type + any-case types)', () => {
        // API move types are lowercase; chart keys are Title-case. capitalize()
        // upper-cases the first letter, so both shapes resolve (ALL-CAPS is not
        // a real input and is intentionally not supported).
        expect(typeEffectiveness('ice', 'dragon', 'ground', chart)).toBe(4);
        expect(typeEffectiveness('ice', 'Dragon', 'Ground', chart)).toBe(4);
    });
});

describe('defenderImmuneByAbility', () => {
    it('true only when the ability blocks that move type', () => {
        expect(defenderImmuneByAbility('Levitate', 'ground')).toBe(true);
        expect(defenderImmuneByAbility('Levitate', 'fire')).toBe(false);
        expect(defenderImmuneByAbility('none', 'ground')).toBe(false);
        expect(defenderImmuneByAbility(undefined, 'ground')).toBe(false);
    });
});

const dmg = (over: Partial<DamageInput> = {}): DamageInput => ({
    level: 50, attackingStat: 150, defendingStat: 100, movePower: 90,
    isStab: false, typeMultiplier: 1, isCritical: false, isPhysical: true, ...over,
});

describe('computeDamage, invariants', () => {
    it('a no-effect (0×) hit deals nothing and never KOs', () => {
        const r = computeDamage(dmg({ typeMultiplier: 0 }), 200);
        expect(r.max).toBe(0);
        expect(r.ohko).toBe('no');
    });
    it('returns 16 rolls with min ≤ max', () => {
        const r = computeDamage(dmg(), 200);
        expect(r.rolls).toHaveLength(16);
        expect(r.min).toBeLessThanOrEqual(r.max);
    });
    it('more attacking stat never reduces damage', () => {
        const lo = computeDamage(dmg({ attackingStat: 100 }), 200).max;
        const hi = computeDamage(dmg({ attackingStat: 200 }), 200).max;
        expect(hi).toBeGreaterThan(lo);
    });
    it('super-effective + STAB out-damages a neutral non-STAB hit', () => {
        const neutral = computeDamage(dmg(), 200).max;
        const boosted = computeDamage(dmg({ isStab: true, typeMultiplier: 2 }), 200).max;
        expect(boosted).toBeGreaterThan(neutral);
    });
    it('flags a guaranteed OHKO when even the min roll exceeds HP', () => {
        const r = computeDamage(dmg({ attackingStat: 300, movePower: 150, typeMultiplier: 2, isStab: true }), 60);
        expect(r.ohko).toBe('guaranteed');
    });
});
