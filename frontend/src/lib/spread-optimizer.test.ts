import { describe, it, expect } from 'vitest';
import {
    finalStat, finalHp, minSpeedPoints, minBulkToSurvive, minOffenseToKO,
} from './spread-optimizer';

describe('finalStat / finalHp, mirror the backend L50 formula', () => {
    it('Garchomp Jolly: Spe 32 → 169, Atk 32 (neutral) → 182', () => {
        expect(finalStat(102, 'spe', 32, 'jolly')).toBe(169);
        expect(finalStat(130, 'atk', 32, 'jolly')).toBe(182);
    });
    it('finalHp adds level+10, no nature', () => {
        // Incineroar base HP 95, 32 pts → 202.
        expect(finalHp(95, 32)).toBe(202);
    });
});

describe('minSpeedPoints, outspeed helper', () => {
    it('finds the fewest Spe points to exceed a target', () => {
        // Garchomp base 102 Jolly: 0 pts = 137, need to beat 150 → some points.
        const n = minSpeedPoints(102, 'jolly', 150);
        expect(n).not.toBeNull();
        expect(finalStat(102, 'spe', n!, 'jolly')).toBeGreaterThan(150);
        expect(finalStat(102, 'spe', n! - 1, 'jolly')).toBeLessThanOrEqual(150);
    });
    it('returns 0 when the base already outspeeds', () => {
        expect(minSpeedPoints(102, 'jolly', 50)).toBe(0);
    });
    it('returns null when even 32 points cannot outspeed', () => {
        expect(minSpeedPoints(50, 'adamant', 999)).toBeNull();
    });
});

describe('minBulkToSurvive, survival helper', () => {
    it('reports it survives when the max roll is below current HP', () => {
        const res = minBulkToSurvive({
            attackerStat: 100, movePower: 60, isStab: false, typeMult: 1, isPhysical: true,
            defBaseHp: 100, defBase: 120, defKey: 'def', nature: 'bold', currentHpPoints: 0, currentDefPoints: 0,
        });
        expect(res.currentlySurvives).toBe(true);
        expect(res.currentMaxPercent).toBeLessThan(100);
    });
    it('finds min HP or Def points to live a big hit', () => {
        const res = minBulkToSurvive({
            attackerStat: 200, movePower: 120, isStab: true, typeMult: 2, isPhysical: true,
            defBaseHp: 90, defBase: 90, defKey: 'def', nature: 'hardy', currentHpPoints: 0, currentDefPoints: 0,
        });
        // Either a valid investment exists (0..32) or it's flagged impossible (null).
        for (const v of [res.viaHp, res.viaDef]) {
            expect(v === null || (v >= 0 && v <= 32)).toBe(true);
        }
    });
});

describe('minOffenseToKO, OHKO/2HKO helper', () => {
    it('needs fewer points for a 2HKO than a OHKO against the same target', () => {
        const base = {
            offBase: 130, offKey: 'atk' as const, nature: 'adamant', currentPoints: 0,
            movePower: 100, isStab: true, typeMult: 1, isPhysical: true, targetDef: 100, targetHp: 175,
        };
        const ohko = minOffenseToKO(base, 1);
        const thko = minOffenseToKO(base, 2);
        if (ohko.points !== null && thko.points !== null) {
            expect(thko.points).toBeLessThanOrEqual(ohko.points);
        }
        // 2HKO should at least be achievable when OHKO is.
        if (ohko.points !== null) expect(thko.points).not.toBeNull();
    });
    it('reports the current min-roll damage percent', () => {
        const res = minOffenseToKO({
            offBase: 130, offKey: 'atk', nature: 'adamant', currentPoints: 32,
            movePower: 120, isStab: true, typeMult: 2, isPhysical: true, targetDef: 80, targetHp: 150,
        }, 1);
        expect(res.currentMinPercent).toBeGreaterThan(0);
    });
});
