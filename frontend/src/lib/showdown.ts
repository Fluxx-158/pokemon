// F6: Showdown paste serialize + parse. Pure (no DB/network). Champions uses a
// stat-point system (cap 32/stat, 66 total), NOT mainline 252/510 EVs, export
// emits the stat points AS-IS (labeled), and import clamps mainline values down.
// Name → id resolution happens in the import UI (it needs the live lists).

import type { TeamDetail } from '@/modules/api/endpoints';

const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
// Showdown stat abbreviations → our keys (parse direction).
const STAT_KEY: Record<string, 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'> = {
    hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe',
};

// ---- Export ----

export function teamToPaste(team: TeamDetail): string {
    const blocks = team.members
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((m) => {
            const lines: string[] = [];
            const item = m.item?.displayName;
            lines.push(item ? `${m.pokemon.displayName} @ ${item}` : m.pokemon.displayName);
            lines.push(`Ability: ${m.ability.displayName}`);
            lines.push('Level: 50');

            const evParts = (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const)
                .filter((k) => m.evs[k] > 0)
                .map((k) => `${m.evs[k]} ${STAT_LABEL[k]}`);
            if (evParts.length) lines.push(`EVs: ${evParts.join(' / ')}`);

            if (m.nature) lines.push(`${m.nature} Nature`);

            if (m.ivs) {
                const ivParts = (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const)
                    .filter((k) => m.ivs![k] !== 31)
                    .map((k) => `${m.ivs![k]} ${STAT_LABEL[k]}`);
                if (ivParts.length) lines.push(`IVs: ${ivParts.join(' / ')}`);
            }

            for (const mv of m.moves.slice().sort((a, b) => a.slot - b.slot)) {
                lines.push(`- ${mv.displayName}`);
            }
            return lines.join('\n');
        });

    // Leading comment flags the EV semantics; our parser (and Showdown) ignore it.
    return `# Pokémon Champions stat points (cap 32/stat, 66 total), not mainline EVs\n\n${blocks.join('\n\n')}\n`;
}

// Normalize a name for matching: lowercase + strip non-alphanumerics, so
// Showdown's hyphenated forms ("Ninetales-Alola", "Choice Scarf") match our
// space-separated display names.
export function normName(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---- Parse ----

export interface ParsedPasteMon {
    species: string;
    item: string | null;
    ability: string | null;
    nature: string | null;
    evs: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
    ivs: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
    moves: string[];
}

function parseStatList(value: string): Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> {
    const out: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> = {};
    for (const part of value.split('/')) {
        const m = part.trim().match(/^(\d+)\s+([A-Za-z]+)$/);
        if (!m) continue;
        const key = STAT_KEY[m[2].toLowerCase()];
        if (key) out[key] = Number(m[1]);
    }
    return out;
}

function parseFirstLine(line: string): { species: string; item: string | null } {
    let left = line;
    let item: string | null = null;
    const at = line.lastIndexOf(' @ ');
    if (at !== -1) {
        left = line.slice(0, at).trim();
        item = line.slice(at + 3).trim() || null;
    }
    // Strip a trailing "(Species)" nickname-form, or a "(M)"/"(F)" gender tag.
    const paren = left.match(/^(.*)\s+\(([^)]+)\)\s*$/);
    if (paren) {
        const inner = paren[2].trim();
        if (inner === 'M' || inner === 'F') left = paren[1].trim();
        else left = inner; // Nickname (Species) → keep Species
    }
    return { species: left.trim(), item };
}

export function parseShowdownPaste(text: string): ParsedPasteMon[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];
    // Blocks are separated by blank lines. Comment lines (#) are dropped.
    const blocks = normalized
        .split(/\n\s*\n/)
        .map((b) => b.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n').trim())
        .filter((b) => b.length > 0);

    const mons: ParsedPasteMon[] = [];
    for (const block of blocks) {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;

        const { species, item } = parseFirstLine(lines[0]);
        const mon: ParsedPasteMon = { species, item, ability: null, nature: null, evs: {}, ivs: {}, moves: [] };

        for (const line of lines.slice(1)) {
            if (line.startsWith('- ')) { mon.moves.push(line.slice(2).trim()); continue; }
            const ability = line.match(/^Ability:\s*(.+)$/i);
            if (ability) { mon.ability = ability[1].trim(); continue; }
            const evs = line.match(/^EVs:\s*(.+)$/i);
            if (evs) { mon.evs = parseStatList(evs[1]); continue; }
            const ivs = line.match(/^IVs:\s*(.+)$/i);
            if (ivs) { mon.ivs = parseStatList(ivs[1]); continue; }
            const nature = line.match(/^(\w+)\s+Nature$/i);
            if (nature) { mon.nature = nature[1].trim(); continue; }
            // Level / Tera / Shiny / Happiness etc., ignored.
        }
        if (mon.species) mons.push(mon);
    }
    return mons;
}
