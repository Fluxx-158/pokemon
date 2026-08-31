import { describe, it, expect } from 'vitest';
import { resolveFormats, resolveSeason, subjectCandidates, type IndexResponse } from './usage-sync';

const idx = (over: Partial<IndexResponse>): IndexResponse => ({
    generatedAt: '2026-07-23T00:00:00.000Z',
    battleDataFolders: [],
    pokemon: [],
    ...over,
});

describe('resolveFormats, the season-rollover data-loss guard', () => {
    it('reads formats from the roster csvs even when battleDataFolders lists a SEASON (the M4 bug)', () => {
        // This is exactly what broke: battleDataFolders became ["M4"], not the formats.
        const index = idx({
            battleDataFolders: ['M4'],
            pokemon: [{ name: 'Garchomp', battleDataCsvs: [
                { season: 'M4', format: 'Doubles' },
                { season: 'M4', format: 'Singles' },
            ] }],
        });
        expect(resolveFormats(index).sort()).toEqual(['Doubles', 'Singles']);
    });

    it('uses battleDataFolders when they DO list formats (the old shape)', () => {
        expect(resolveFormats(idx({ battleDataFolders: ['Doubles', 'Singles'] })).sort())
            .toEqual(['Doubles', 'Singles']);
    });

    it('never returns an empty list, falls back to the known formats', () => {
        // A totally unrecognised index must still yield work, not zero → truncate.
        expect(resolveFormats(idx({ battleDataFolders: ['M4'], seasons: ['M4'] })).sort())
            .toEqual(['Doubles', 'Singles']);
    });

    it('ignores non-format folder/csv values', () => {
        const index = idx({
            battleDataFolders: ['M4', 'Doubles'],
            pokemon: [{ name: 'X', battleDataCsvs: [{ format: 'Doubles' }, { format: 'Nonsense' as string }] }],
        });
        expect(resolveFormats(index)).toEqual(['Doubles']);
    });
});

describe('resolveSeason', () => {
    it('prefers a concrete season folder over "Current"', () => {
        expect(resolveSeason(idx({ battleDataFolders: ['M4'] }))).toBe('M4');
    });
    it('falls back to seasons[] when folders are just "Current"', () => {
        expect(resolveSeason(idx({ battleDataFolders: ['Current'], seasons: ['Current', 'M4'] }))).toBe('M4');
    });
    it('returns null when only "Current" is present', () => {
        expect(resolveSeason(idx({ battleDataFolders: ['Current'], seasons: ['Current'] }))).toBeNull();
    });
});

describe('subjectCandidates, roster-name → DB-name translation', () => {
    const has = (raw: string, want: string) => expect(subjectCandidates(raw)).toContain(want);

    it('regional prefixes append the region (single-word species)', () => {
        has('Alolan Ninetales', 'Ninetales alola');
        has('Galarian Slowking', 'Slowking galar');
        has('Hisuian Goodra', 'Goodra hisui');
    });
    it('regional prefix inserts the region after the species for multi-word forms', () => {
        // The Paldean Tauros bug, region must land as the 2nd token.
        has('Paldean Tauros Aqua Breed', 'Tauros paldea Aqua Breed');
    });
    it('strips Forme / Form suffixes', () => {
        has('Aegislash Shield Forme', 'Aegislash Shield');
        has('Lycanroc Dusk Form', 'Lycanroc Dusk');
    });
    it('maps Gourgeist varieties', () => {
        has('Gourgeist Jumbo Variety', 'Gourgeist super');
        has('Gourgeist Small Variety', 'Gourgeist small');
    });
    it('reduces "<name> Fancy Pattern" to the base species', () => {
        has('Vivillon Fancy Pattern', 'Vivillon');
    });
    it('always includes the raw name as a candidate', () => {
        has('Garchomp', 'Garchomp');
    });
});
