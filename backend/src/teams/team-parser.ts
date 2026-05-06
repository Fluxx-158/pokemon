// Pure team.md parsing + lookup-key normalisation. No DB or filesystem
// access — both the seed script and the POST /teams service import this.

import type { TeamNotesJson } from '../db/schema/teams';

export interface ParsedMember {
    slot: number;
    species: string;
    ability: string;
    nature: string;
    heldItem: string | null;
    moves: string[];
    evs: [number, number, number, number, number, number];
    // IVs are optional in the team.md format. PC defaults to 31 across the
    // board, so most teams don't write them. When absent the value stays
    // undefined and downstream code treats it as "use the format default".
    ivs?: [number, number, number, number, number, number];
}

export interface ParsedTeam {
    name: string;
    sourceFolder: string;
    members: ParsedMember[];
    notes: TeamNotesJson;
}

export interface Lookups {
    pokemon: Map<string, number>;        // normKey(display_name) -> id (default form preferred)
    pokemonSpecies: Map<string, number>; // normKey(first word of display_name) -> default-form id
    abilities: Map<string, number>;
    items: Map<string, number>;
    moves: Map<string, number>;
}

export function normKey(s: string): string {
    // Lowercase + strip non-alphanumerics so common author variants resolve:
    // "Heatwave" ↔ "Heat Wave", "Kommo-o" ↔ "Kommo O".
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseBullet(line: string): { label: string; value: string } | null {
    // Accept both `- **Label:** value` (colon inside the bold) and `- Label: value`,
    // matching on the first colon and stripping `**` off both halves.
    const match = line.match(/^\s*-\s+(.+?):\s*(.*)$/);
    if (!match) return null;
    const stripBold = (s: string) => s.replace(/^\*\*+/, '').replace(/\*\*+$/, '').trim();
    return { label: stripBold(match[1]), value: stripBold(match[2]) };
}

function parseSlashList(value: string, expectedLength: number, context: string): string[] {
    const parts = value.split('/').map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length === 0) {
        throw new Error(`${context}: empty slash-list value`);
    }
    if (expectedLength > 0 && parts.length !== expectedLength) {
        throw new Error(`${context}: expected ${expectedLength} values, got ${parts.length} (${value})`);
    }
    return parts;
}

function parseIntSlashList(value: string, context: string): [number, number, number, number, number, number] {
    const parts = parseSlashList(value, 6, context);
    return parts.map((p) => {
        const n = Number(p);
        if (!Number.isFinite(n)) throw new Error(`${context}: non-numeric value "${p}"`);
        return n;
    }) as [number, number, number, number, number, number];
}

export function parseTeamMarkdown(folderName: string, content: string): ParsedTeam {
    const lines = content.split(/\r?\n/);

    let teamName = folderName;
    for (const line of lines) {
        const m = line.match(/^#\s+Team name:\s*(.+)$/i);
        if (m) {
            teamName = m[1].trim();
            break;
        }
    }

    interface Section { heading: string; lines: string[]; }
    const sections: Section[] = [];
    let current: Section | null = null;
    for (const line of lines) {
        const m = line.match(/^##\s+(.+?)\s*$/);
        if (m) {
            current = { heading: m[1], lines: [] };
            sections.push(current);
            continue;
        }
        if (current) current.lines.push(line);
    }

    const members: ParsedMember[] = [];
    for (const section of sections) {
        const slotMatch = section.heading.match(/^Pokemon\s+(\d+)$/i);
        if (!slotMatch) continue;
        const slot = Number(slotMatch[1]);
        const ctx = `${folderName} / Pokemon ${slot}`;

        let species: string | null = null;
        let ability: string | null = null;
        let nature: string | null = null;
        let heldItem: string | null = null;
        let moves: string[] = [];
        let evs: [number, number, number, number, number, number] | null = null;
        let ivs: [number, number, number, number, number, number] | null = null;

        for (const line of section.lines) {
            const bullet = parseBullet(line);
            if (!bullet) continue;
            const { label, value } = bullet;
            const labelLc = label.toLowerCase();
            if (labelLc === 'species') species = value || null;
            else if (labelLc === 'ability') ability = value || null;
            else if (labelLc === 'nature') nature = value || null;
            else if (labelLc === 'held item') heldItem = value || null;
            else if (labelLc === 'moves') {
                if (!value) continue;
                moves = parseSlashList(value, 0, `${ctx}: moves`);
                if (moves.length === 0 || moves.length > 4) {
                    throw new Error(`${ctx}: moves must have 1–4 entries (got ${moves.length})`);
                }
            } else if (labelLc.startsWith('evs')) {
                if (!value) continue;
                evs = parseIntSlashList(value, `${ctx}: EVs`);
            } else if (labelLc.startsWith('ivs')) {
                if (!value) continue;
                ivs = parseIntSlashList(value, `${ctx}: IVs`);
            }
            // Type and Stats lines are ignored — derived / recomputed.
        }

        if (!species) throw new Error(`${ctx}: missing Species`);
        if (!ability) throw new Error(`${ctx}: missing Ability`);
        if (!nature) throw new Error(`${ctx}: missing Nature`);
        if (moves.length === 0) throw new Error(`${ctx}: missing Moves`);

        members.push({
            slot,
            species,
            ability,
            nature,
            heldItem,
            moves,
            evs: evs ?? [0, 0, 0, 0, 0, 0],
            ...(ivs ? { ivs } : {}),
        });
    }

    if (members.length === 0) {
        throw new Error(`${folderName}: no Pokemon sections found`);
    }

    const slotSet = new Set<number>();
    for (const m of members) {
        if (m.slot < 1 || m.slot > 6) throw new Error(`${folderName}: invalid slot ${m.slot}`);
        if (slotSet.has(m.slot)) throw new Error(`${folderName}: duplicate slot ${m.slot}`);
        slotSet.add(m.slot);
    }

    const notes: TeamNotesJson = {};
    const notesSection = sections.find((s) => /^notes/i.test(s.heading));
    if (notesSection) {
        const other: string[] = [];
        for (const line of notesSection.lines) {
            const bullet = parseBullet(line);
            if (!bullet) continue;
            const { label, value } = bullet;
            const labelLc = label.toLowerCase();
            if (!value) continue;
            if (labelLc === 'mega stone holder') notes.mega_holder = value;
            else if (/^standard\s+lead( pair)?$/.test(labelLc) || labelLc === 'lead pair') notes.lead_pair = value;
            else if (/^standard\s+back( pair)?$/.test(labelLc) || labelLc === 'back pair') notes.back_pair = value;
            else other.push(`${label}: ${value}`);
        }
        if (other.length > 0) notes.other = other;
    }

    return { name: teamName, sourceFolder: folderName, members, notes };
}

export function resolve(map: Map<string, number>, kind: string, name: string, ctx: string): number {
    const id = map.get(normKey(name));
    if (id === undefined) throw new Error(`${ctx}: unknown ${kind} "${name}"`);
    return id;
}

function pokemonCandidates(raw: string): string[] {
    // Translate common regional descriptors to the slug-style form names PokeAPI
    // (and our DB) use, then offer both the original and translated strings as
    // lookup candidates.
    const translated = raw
        .replace(/\bhisu[ei]an\s+form\b/gi, 'hisui')
        .replace(/\bhisu[ei]an\b/gi, 'hisui')
        .replace(/\balolan\s+form\b/gi, 'alola')
        .replace(/\balolan\b/gi, 'alola')
        .replace(/\bgalarian\s+form\b/gi, 'galar')
        .replace(/\bgalarian\b/gi, 'galar')
        .replace(/\bpaldean\s+form\b/gi, 'paldea')
        .replace(/\bpaldean\b/gi, 'paldea')
        // Generic "(<word> form)" suffix: drops parens, keeps the descriptor.
        // Catches Rotom (Wash form), Deoxys (Attack form), etc.
        .replace(/\(\s*(\w+)\s+form\s*\)/gi, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    return translated !== raw ? [raw, translated] : [raw];
}

export function resolvePokemon(lookups: Lookups, raw: string, ctx: string): number {
    for (const candidate of pokemonCandidates(raw)) {
        const id = lookups.pokemon.get(normKey(candidate));
        if (id !== undefined) return id;
    }
    // Fall back: bare species name resolves to that species's default form.
    const speciesId = lookups.pokemonSpecies.get(normKey(raw));
    if (speciesId !== undefined) return speciesId;
    throw new Error(`${ctx}: unknown pokemon "${raw}"`);
}

export interface ResolvedMember {
    slot: number;
    pokemonId: number;
    abilityId: number;
    itemId: number | null;
    nature: string;
    moveIds: number[];
    evs: [number, number, number, number, number, number];
    // Carried through from ParsedMember — undefined means "use format default
    // 31s" and the create/update path skips inserting an IV row.
    ivs?: [number, number, number, number, number, number];
}

export function resolveMembers(parsed: ParsedTeam, lookups: Lookups): ResolvedMember[] {
    return parsed.members.map((m) => {
        const ctx = `${parsed.sourceFolder} / Pokemon ${m.slot}`;
        return {
            slot: m.slot,
            pokemonId: resolvePokemon(lookups, m.species, ctx),
            abilityId: resolve(lookups.abilities, 'ability', m.ability, ctx),
            itemId: m.heldItem ? resolve(lookups.items, 'item', m.heldItem, ctx) : null,
            nature: m.nature,
            moveIds: m.moves.map((mv, i) => resolve(lookups.moves, 'move', mv, `${ctx} move ${i + 1}`)),
            evs: m.evs,
            ...(m.ivs ? { ivs: m.ivs } : {}),
        };
    });
}
