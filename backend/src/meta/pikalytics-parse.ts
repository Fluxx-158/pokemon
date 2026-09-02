// F2 phase 3: parse Pikalytics' per-species AI markdown (the only source with a
// per-battle win rate for Champions Reg M-B). Pure string parsing; the sync
// module fetches. Attribution to Pikalytics is required wherever this surfaces.
//
// The "Quick Info" table looks like:
//   | **Usage** | N/A |
//   | **Win Rate** | 48.05% |
//   | **Record** | 10833-11714-41 |
//   | **Data Date** | 2026-05 |

export interface PikalyticsStats {
    winPct: number | null;      // per-battle win rate
    record: string | null;      // "wins-losses-ties"
    usagePct: number | null;    // often N/A on this source
    dataDate: string | null;    // e.g. "2026-05"
}

function matchPercent(md: string, label: string): number | null {
    const re = new RegExp(`\\*\\*${label}\\*\\*\\s*\\|\\s*([\\d.]+)\\s*%`, 'i');
    const m = md.match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function matchField(md: string, label: string, valuePattern: string): string | null {
    const re = new RegExp(`\\*\\*${label}\\*\\*\\s*\\|\\s*(${valuePattern})`, 'i');
    const m = md.match(re);
    return m ? m[1].trim() : null;
}

export function parsePikalytics(md: string): PikalyticsStats {
    return {
        winPct: matchPercent(md, 'Win Rate'),
        record: matchField(md, 'Record', '[\\d]+-[\\d]+(?:-[\\d]+)?'),
        usagePct: matchPercent(md, 'Usage'),
        dataDate: matchField(md, 'Data Date', '[\\d]{4}-[\\d]{2}'),
    };
}

// Pikalytics slugs regional/alt forms as "Species-Form" (e.g. "Ninetales-Alola",
// "Rotom-Wash"), whereas our roster names read "Alolan Ninetales" / "Wash Rotom".
// Return ordered slug candidates to try (unencoded); the sync URL-encodes each.
const REGION_SUFFIX: Record<string, string> = { Alolan: 'Alola', Galarian: 'Galar', Hisuian: 'Hisui', Paldean: 'Paldea' };
const ROTOM_FORMS = new Set(['Heat', 'Wash', 'Frost', 'Fan', 'Mow']);

export function pikalyticsSlugCandidates(rawName: string): string[] {
    const name = rawName.trim();
    const out: string[] = [];
    const push = (s: string) => { const e = s.trim(); if (e && !out.includes(e)) out.push(e); };

    const reg = name.match(/^(Alolan|Galarian|Hisuian|Paldean)\s+(.+)$/);
    if (reg) push(`${reg[2].replace(/\s+/g, '-')}-${REGION_SUFFIX[reg[1]]}`);

    const rotom = name.match(/^(\w+)\s+Rotom$/);
    if (rotom && ROTOM_FORMS.has(rotom[1])) push(`Rotom-${rotom[1]}`);

    push(name.replace(/\s+/g, '-')); // "Lycanroc Dusk" -> "Lycanroc-Dusk"
    push(name);                       // plain name (single-word species)
    return out;
}
