import { describe, it, expect } from 'vitest';
import { parseShowdownPaste, teamToPaste, normName } from './showdown';
import type { TeamDetail } from '@/modules/api/endpoints';

describe('parseShowdownPaste', () => {
    const paste = `# a comment line, ignored

Incineroar (M) @ Sitrus Berry
Ability: Intimidate
Level: 50
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
IVs: 0 Spe
- Fake Out
- Parting Shot
- Flare Blitz
- Throat Chop

Nickname (Greninja-Alola) @ Choice Scarf
Ability: Protean
Adamant Nature
- Ice Beam`;

    const mons = parseShowdownPaste(paste);

    it('parses two blocks, skipping the comment', () => {
        expect(mons).toHaveLength(2);
    });
    it('strips a gender tag from the species', () => {
        expect(mons[0].species).toBe('Incineroar');
    });
    it('keeps the species from a Nickname (Species) form', () => {
        expect(mons[1].species).toBe('Greninja-Alola');
    });
    it('parses item, ability, nature, EVs, IVs and moves', () => {
        expect(mons[0].item).toBe('Sitrus Berry');
        expect(mons[0].ability).toBe('Intimidate');
        expect(mons[0].nature).toBe('Careful');
        expect(mons[0].evs).toEqual({ hp: 252, atk: 4, spd: 252 });
        expect(mons[0].ivs).toEqual({ spe: 0 });
        expect(mons[0].moves).toEqual(['Fake Out', 'Parting Shot', 'Flare Blitz', 'Throat Chop']);
    });
    it('handles an itemless / minimal mon', () => {
        expect(mons[1].item).toBe('Choice Scarf');
        expect(mons[1].moves).toEqual(['Ice Beam']);
    });
    it('returns [] for empty input', () => {
        expect(parseShowdownPaste('   ')).toEqual([]);
    });
});

describe('teamToPaste', () => {
    const team = {
        members: [{
            slot: 1,
            pokemon: { displayName: 'Garchomp' },
            ability: { displayName: 'Rough Skin' },
            item: { displayName: 'Life Orb' },
            nature: 'Jolly',
            evs: { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
            ivs: null,
            moves: [
                { slot: 2, displayName: 'Earthquake' },
                { slot: 1, displayName: 'Dragon Claw' },
            ],
        }],
    } as unknown as TeamDetail;

    const out = teamToPaste(team);

    it('emits Champions stat points as-is (not scaled to 252)', () => {
        expect(out).toContain('EVs: 32 Atk / 32 Spe');
    });
    it('includes species @ item, ability, nature, and moves in slot order', () => {
        expect(out).toContain('Garchomp @ Life Orb');
        expect(out).toContain('Ability: Rough Skin');
        expect(out).toContain('Jolly Nature');
        expect(out.indexOf('- Dragon Claw')).toBeLessThan(out.indexOf('- Earthquake'));
    });
    it('round-trips back through the parser', () => {
        const back = parseShowdownPaste(out)[0];
        expect(back.species).toBe('Garchomp');
        expect(back.item).toBe('Life Orb');
        expect(back.nature).toBe('Jolly');
        expect(back.evs).toEqual({ atk: 32, spe: 32 });
        expect(back.moves).toEqual(['Dragon Claw', 'Earthquake']);
    });
});

describe('normName', () => {
    it('matches Showdown hyphenated forms to spaced display names', () => {
        expect(normName('Ninetales-Alola')).toBe(normName('Ninetales Alola'));
        expect(normName('Choice Scarf')).toBe('choicescarf');
    });
});
