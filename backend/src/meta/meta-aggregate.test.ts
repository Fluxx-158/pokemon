import { describe, it, expect } from 'vitest';
import {
    aggregateStandings, toUsageRows, deckMonKey, type LimitlessStanding,
} from './tournament-aggregate';
import { parsePikalytics, pikalyticsSlugCandidates } from './pikalytics-parse';

function deck(...ids: string[]) {
    return ids.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) }));
}
function standing(record: { wins: number; losses: number; ties: number }, ...ids: string[]): LimitlessStanding {
    return { decklist: deck(...ids), record };
}

describe('deckMonKey', () => {
    it('keys on the lowercase id (base species), ignoring the mega stone', () => {
        expect(deckMonKey({ id: 'charizard', name: 'Charizard', item: 'Charizardite Y' })).toBe('charizard');
        expect(deckMonKey({ name: 'Pelipper' })).toBe('pelipper');
        expect(deckMonKey({})).toBe('');
    });
});

describe('aggregateStandings + toUsageRows', () => {
    const standings: LimitlessStanding[] = [
        standing({ wins: 10, losses: 1, ties: 0 }, 'charizard', 'pelipper', 'archaludon'),
        standing({ wins: 6, losses: 4, ties: 0 }, 'charizard', 'pelipper', 'venusaur'),
        standing({ wins: 2, losses: 5, ties: 0 }, 'garchomp', 'incineroar', 'charizard'),
    ];

    it('counts usage% over total decklists', () => {
        const agg = aggregateStandings(standings);
        expect(agg.totalDecklists).toBe(3);
        const rows = toUsageRows(agg);
        const chari = rows.find((r) => r.key === 'charizard')!;
        expect(chari.decklists).toBe(3);
        expect(chari.usagePct).toBeCloseTo(100, 5);
        const peli = rows.find((r) => r.key === 'pelipper')!;
        expect(peli.usagePct).toBeCloseTo((2 / 3) * 100, 5);
    });

    it('rows are sorted by usage descending', () => {
        const rows = toUsageRows(aggregateStandings(standings));
        expect(rows[0].key).toBe('charizard'); // in all 3 decklists
    });

    it('team win% = wins / (wins+losses) over decklists containing the species', () => {
        const rows = toUsageRows(aggregateStandings(standings));
        const chari = rows.find((r) => r.key === 'charizard')!;
        // wins 10+6+2 = 18; losses 1+4+5 = 10; games 28
        expect(chari.teamWinPct).toBeCloseTo((18 / 28) * 100, 5);
        const garchomp = rows.find((r) => r.key === 'garchomp')!;
        expect(garchomp.teamWinPct).toBeCloseTo((2 / 7) * 100, 5);
    });

    it('teamWinPct is null when a species has no completed games', () => {
        const rows = toUsageRows(aggregateStandings([standing({ wins: 0, losses: 0, ties: 0 }, 'ditto')]));
        expect(rows.find((r) => r.key === 'ditto')!.teamWinPct).toBeNull();
    });

    it('tracks top teammates by co-occurrence within the species decklists', () => {
        const rows = toUsageRows(aggregateStandings(standings));
        const chari = rows.find((r) => r.key === 'charizard')!;
        const peli = chari.topTeammates.find((t) => t.key === 'pelipper')!;
        expect(peli.pct).toBeCloseTo((2 / 3) * 100, 5); // 2 of charizard's 3 decklists
    });

    it('skips empty decklists so they do not dilute usage%', () => {
        const agg = aggregateStandings([{ decklist: [], record: { wins: 3, losses: 0, ties: 0 } }, ...standings]);
        expect(agg.totalDecklists).toBe(3);
    });

    it('accumulates across multiple tournaments with a shared accumulator', () => {
        const agg = aggregateStandings(standings.slice(0, 1));
        aggregateStandings(standings.slice(1), agg);
        expect(agg.totalDecklists).toBe(3);
    });
});

describe('parsePikalytics', () => {
    const md = `# Garchomp
| **Usage** | N/A |
| **Win Rate** | 48.05% |
| **Record** | 10833-11714-41 |
| **Data Date** | 2026-05 |`;

    it('pulls win rate, record, and data date', () => {
        const p = parsePikalytics(md);
        expect(p.winPct).toBeCloseTo(48.05, 2);
        expect(p.record).toBe('10833-11714-41');
        expect(p.dataDate).toBe('2026-05');
    });
    it('returns null for N/A usage', () => {
        expect(parsePikalytics(md).usagePct).toBeNull();
    });
    it('handles a real numeric usage and a two-part record', () => {
        const p = parsePikalytics('| **Usage** | 12.3% |\n| **Record** | 100-50 |');
        expect(p.usagePct).toBeCloseTo(12.3, 2);
        expect(p.record).toBe('100-50');
    });
    it('returns nulls on missing fields', () => {
        const p = parsePikalytics('nothing useful here');
        expect(p).toEqual({ winPct: null, record: null, usagePct: null, dataDate: null });
    });
});

describe('pikalyticsSlugCandidates', () => {
    it('maps regional prefixes to Species-Region', () => {
        expect(pikalyticsSlugCandidates('Alolan Ninetales')[0]).toBe('Ninetales-Alola');
        expect(pikalyticsSlugCandidates('Hisuian Arcanine')[0]).toBe('Arcanine-Hisui');
    });
    it('reorders Rotom appliance forms', () => {
        expect(pikalyticsSlugCandidates('Wash Rotom')[0]).toBe('Rotom-Wash');
        expect(pikalyticsSlugCandidates('Heat Rotom')[0]).toBe('Rotom-Heat');
    });
    it('hyphenates multi-word names and keeps a plain fallback', () => {
        const c = pikalyticsSlugCandidates('Lycanroc Dusk');
        expect(c).toContain('Lycanroc-Dusk');
        expect(c).toContain('Lycanroc Dusk');
    });
    it('a plain single-word species is just itself', () => {
        expect(pikalyticsSlugCandidates('Garchomp')).toEqual(['Garchomp']);
    });
});
