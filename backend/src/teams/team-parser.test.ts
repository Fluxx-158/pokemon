import { describe, it, expect } from 'vitest';
import { parseTeamMarkdown, normKey } from './team-parser';

const oneMon = (notes = '') => `# Team name: T

## Pokemon 1
- **Species:** Garchomp
- **Ability:** Rough Skin
- **Nature:** Jolly
- **Held Item:** Life Orb
- **Moves:** Dragon Claw / Earthquake / Rock Slide / Protect
- **EVs (HP/Atk/Def/SpA/SpD/Spe):** 0 / 32 / 0 / 0 / 2 / 32

## Notes
${notes}`;

describe('parseTeamMarkdown, format (F1)', () => {
    it('defaults to doubles when Format is absent', () => {
        expect(parseTeamMarkdown('T', oneMon()).format).toBe('doubles');
    });
    it('reads an explicit singles format', () => {
        expect(parseTeamMarkdown('T', oneMon('- Format: singles')).format).toBe('singles');
    });
    it('is case-insensitive on the value', () => {
        expect(parseTeamMarkdown('T', oneMon('- Format: Both')).format).toBe('both');
    });
    it('throws on an invalid format', () => {
        expect(() => parseTeamMarkdown('T', oneMon('- Format: triples'))).toThrow(/invalid Format/i);
    });
});

describe('parseTeamMarkdown, singles notes', () => {
    it('captures Lead and Bring three into notes', () => {
        const t = parseTeamMarkdown('T', oneMon('- Format: singles\n- Lead: Mimikyu\n- Bring three: A / B / C'));
        expect(t.notes.lead).toBe('Mimikyu');
        expect(t.notes.bring_three).toBe('A / B / C');
    });
    it('captures doubles lead/back pairs', () => {
        const t = parseTeamMarkdown('T', oneMon('- Standard lead pair: X + Y\n- Standard back pair: Z + W'));
        expect(t.notes.lead_pair).toBe('X + Y');
        expect(t.notes.back_pair).toBe('Z + W');
    });
});

describe('parseTeamMarkdown, members', () => {
    it('parses species/ability/nature/item/moves/evs', () => {
        const m = parseTeamMarkdown('T', oneMon()).members[0];
        expect(m.species).toBe('Garchomp');
        expect(m.ability).toBe('Rough Skin');
        expect(m.nature).toBe('Jolly');
        expect(m.heldItem).toBe('Life Orb');
        expect(m.moves).toEqual(['Dragon Claw', 'Earthquake', 'Rock Slide', 'Protect']);
        expect(m.evs).toEqual([0, 32, 0, 0, 2, 32]);
    });
    it('rejects a 5-value EV list', () => {
        const bad = oneMon().replace('0 / 32 / 0 / 0 / 2 / 32', '0 / 32 / 0 / 0 / 2');
        expect(() => parseTeamMarkdown('T', bad)).toThrow();
    });
});

describe('normKey', () => {
    it('lowercases and strips non-alphanumerics', () => {
        expect(normKey('Heat Wave')).toBe(normKey('Heatwave'));
        expect(normKey('Kommo-o')).toBe('kommoo');
        expect(normKey('Mr. Rime')).toBe('mrrime');
    });
});
