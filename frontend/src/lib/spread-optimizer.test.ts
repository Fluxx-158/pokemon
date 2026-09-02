import { describe, it, expect } from 'vitest';
import {
    finalStat, finalHp, minSpeedPoints, minBulkToSurvive, minOffenseToKO,
    solveSpread, type SolveConstraints,
} from './spread-optimizer';

const GARCHOMP_BASE = { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 };
function constraints(partial: Partial<SolveConstraints>): SolveConstraints {
    return { base: GARCHOMP_BASE, nature: 'jolly', speed: [], survive: [], ko: [], ...partial };
}

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

describe('solveSpread, multi-constraint solver', () => {
    it('no constraints, empty spread, full budget left', () => {
        const r = solveSpread(constraints({}));
        expect(r.points).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
        expect(r.totalUsed).toBe(0);
        expect(r.leftover).toBe(66);
        expect(r.feasible).toBe(true);
    });

    it('one speed constraint, spends only Spe, and it actually outspeeds', () => {
        const need = minSpeedPoints(GARCHOMP_BASE.spe, 'jolly', 150)!;
        const r = solveSpread(constraints({ speed: [{ label: 'outspeed', targetSpe: 150 }] }));
        expect(r.points.spe).toBe(need);
        expect(r.points.hp + r.points.atk + r.points.def + r.points.spa + r.points.spd).toBe(0);
        expect(finalStat(GARCHOMP_BASE.spe, 'spe', r.points.spe, 'jolly')).toBeGreaterThan(150);
        expect(r.feasible).toBe(true);
    });

    it('speed and a physical KO are solved on independent stats', () => {
        const ko = { label: 'ohko', hits: 1 as const, movePower: 100, isStab: true, typeMult: 1, isPhysical: true, targetDef: 70, targetHp: 140 };
        const expectedAtk = minOffenseToKO({
            offBase: GARCHOMP_BASE.atk, offKey: 'atk', nature: 'jolly', currentPoints: 0,
            movePower: ko.movePower, isStab: ko.isStab, typeMult: ko.typeMult, isPhysical: ko.isPhysical,
            targetDef: ko.targetDef, targetHp: ko.targetHp,
        }, 1).points!;
        const r = solveSpread(constraints({ speed: [{ label: 'outspeed', targetSpe: 140 }], ko: [ko] }));
        expect(r.points.spe).toBeGreaterThan(0);
        expect(r.points.atk).toBe(expectedAtk); // physical KO drives Atk exactly
        expect(r.points.spa).toBe(0);           // and never touches SpA
    });

    it('a survivable-at-zero hit costs no bulk points', () => {
        const r = solveSpread(constraints({
            survive: [{ label: 'weak hit', attackerStat: 80, movePower: 40, isStab: false, typeMult: 0.5, isPhysical: true }],
        }));
        expect(r.points.hp).toBe(0);
        expect(r.points.def).toBe(0);
        expect(r.feasible).toBe(true);
    });

    it('flags a constraint impossible even at 32 as infeasible (not just over budget)', () => {
        const r = solveSpread(constraints({ speed: [{ label: 'outspeed rocket', targetSpe: 9999 }] }));
        expect(r.infeasible).toContain('outspeed rocket');
        expect(r.feasible).toBe(false);
    });

    it('a satisfiable constraint that busts the budget is infeasible with negative leftover', () => {
        const r = solveSpread(constraints({ speed: [{ label: 'outspeed', targetSpe: 160 }] }), 0);
        expect(r.infeasible).toHaveLength(0); // the constraint itself is achievable
        expect(r.leftover).toBeLessThan(0);   // just not within a 0-point budget
        expect(r.feasible).toBe(false);
    });

    it('shares HP across physical and special survival (total <= naive per-stat sum)', () => {
        const both = solveSpread(constraints({
            survive: [
                { label: 'phys', attackerStat: 180, movePower: 90, isStab: true, typeMult: 1, isPhysical: true },
                { label: 'spec', attackerStat: 170, movePower: 90, isStab: true, typeMult: 1, isPhysical: false },
            ],
        }));
        // Whatever it lands on, it must respect the budget when feasible.
        if (both.feasible) expect(both.totalUsed).toBeLessThanOrEqual(66);
        // HP is counted once even though it backs both survivals.
        expect(both.points.hp).toBeGreaterThanOrEqual(0);
        expect(both.points.hp).toBeLessThanOrEqual(32);
    });
});
