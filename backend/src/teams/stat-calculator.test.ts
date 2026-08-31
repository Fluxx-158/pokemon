import { describe, it, expect } from 'vitest';
import { computeFinalStats, natureEffect, type StatBlock } from './stat-calculator';

const evs = (o: Partial<StatBlock> = {}): StatBlock => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...o });

describe('computeFinalStats, the canonical L50 Champions stat formula', () => {
    // Anchors reverse-engineered from real team.md final stats (see the module header).
    it('Incineroar base HP 95, 32 EV, no HP nature → 202', () => {
        const base = evs({ hp: 95 });
        expect(computeFinalStats(base, evs({ hp: 32 }), null, 'careful').hp).toBe(202);
    });
    it('Greninja base SpA 103, 32 EV, neutral SpA → 155', () => {
        const base = evs({ spa: 103 });
        expect(computeFinalStats(base, evs({ spa: 32 }), null, 'hardy').spa).toBe(155);
    });
    it('Greninja base Spe 122, 26 EV, Timid (+Spe) → 184', () => {
        const base = evs({ spe: 122 });
        expect(computeFinalStats(base, evs({ spe: 26 }), null, 'timid').spe).toBe(184);
    });
    it('Garchomp base Atk 130 / Spe 102, Jolly 32/32 → Atk 182, Spe 169', () => {
        const base = evs({ atk: 130, spe: 102 });
        const out = computeFinalStats(base, evs({ atk: 32, spe: 32 }), null, 'jolly');
        expect(out.atk).toBe(182); // Jolly is neutral on Atk
        expect(out.spe).toBe(169); // +Spe
    });
    it('applies the −10% drop on the lowered stat', () => {
        // Jolly lowers SpA. base SpA 80, 0 EV: raw = floor((160+31)*0.5)=95, +5 = 100, ×0.9 = 90.
        expect(computeFinalStats(evs({ spa: 80 }), evs(), null, 'jolly').spa).toBe(90);
    });
    it('defaults unknown nature to neutral', () => {
        const a = computeFinalStats(evs({ atk: 100 }), evs({ atk: 10 }), null, 'not-a-nature');
        const b = computeFinalStats(evs({ atk: 100 }), evs({ atk: 10 }), null, 'hardy');
        expect(a.atk).toBe(b.atk);
    });
});

describe('natureEffect', () => {
    it('maps a boosting/lowering nature', () => {
        expect(natureEffect('adamant')).toEqual({ plus: 'atk', minus: 'spa' });
        expect(natureEffect('timid')).toEqual({ plus: 'spe', minus: 'atk' });
    });
    it('is case-insensitive and trims', () => {
        expect(natureEffect('  Jolly ')).toEqual({ plus: 'spe', minus: 'spa' });
    });
    it('neutral natures have both null', () => {
        expect(natureEffect('hardy')).toEqual({ plus: null, minus: null });
    });
});
