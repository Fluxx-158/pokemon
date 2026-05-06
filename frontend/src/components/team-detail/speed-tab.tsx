// Combines your team's effective speeds with a curated meta threat list
// (frontend/src/data/meta-threats.json). Speeds for the meta entries are
// computed at level 50 with neutral nature, max IVs, no EVs — there's no
// way to know what the opponent actually runs, so we show the format default.

import { useQuery } from '@tanstack/react-query';
import {
    getPokemonList,
    type TeamDetail,
} from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { TypePill } from '@/components/type-pill';
import { defaultStat } from '@/lib/damage-calc';
import { cn } from '@/lib/utils';
import metaThreats from '@/data/meta-threats.json';

interface MetaThreatEntry {
    pokemonName: string;
    notes?: string;
}

export function SpeedTab({ team }: { team: TeamDetail }) {
    const { data: pokemonList } = useQuery({ queryKey: ['pokemon'], queryFn: getPokemonList });

    if (!pokemonList) return <p className="text-sm text-muted-foreground">Loading…</p>;

    interface Row {
        kind: 'team' | 'meta';
        spe: number;
        pokemonId: number;
        displayName: string;
        type1: string;
        type2: string | null;
        notes: string | null;
        slot?: number;       // team only
        nature?: string;      // team only
        evSpe?: number;       // team only
    }
    const rows: Row[] = [];

    for (const m of team.members) {
        rows.push({
            kind: 'team',
            spe: m.finalStats.spe,
            pokemonId: m.pokemon.id,
            displayName: m.pokemon.displayName,
            type1: m.pokemon.type1,
            type2: m.pokemon.type2,
            notes: null,
            slot: m.slot,
            nature: m.nature,
            evSpe: m.evs.spe,
        });
    }

    const unresolved: string[] = [];
    for (const entry of metaThreats as MetaThreatEntry[]) {
        const p = pokemonList.find((x) => x.displayName === entry.pokemonName);
        if (!p) {
            unresolved.push(entry.pokemonName);
            continue;
        }
        rows.push({
            kind: 'meta',
            spe: defaultStat(p.stats.spe, 50),
            pokemonId: p.id,
            displayName: p.displayName,
            type1: p.type1,
            type2: p.type2,
            notes: entry.notes ?? null,
        });
    }

    rows.sort((a, b) => b.spe - a.spe || a.displayName.localeCompare(b.displayName));

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
                <p className="mb-1">
                    Your team's effective speeds are EV-loaded from the registered set. Meta entries
                    use neutral nature, 31 IVs, 0 EVs at level 50 (the format default). Items and
                    abilities (Choice Scarf, Sand Rush, Tailwind) are noted in the right column but
                    not applied to the displayed number.
                </p>
                {unresolved.length > 0 && (
                    <p className="text-amber-700 dark:text-amber-300">
                        Unresolved entries (typo in meta-threats.json?): {unresolved.join(', ')}
                    </p>
                )}
            </div>
            <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="px-2 py-1.5 text-right font-semibold w-[60px]">Spe</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Pokemon</th>
                            <th className="px-2 py-1.5 text-left font-semibold w-[140px]">Source</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr
                                key={`${row.kind}-${row.pokemonId}-${row.slot ?? ''}-${i}`}
                                className={cn(
                                    'border-b last:border-0',
                                    row.kind === 'team' && 'bg-emerald-50/60 dark:bg-emerald-900/20',
                                )}
                            >
                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                                    {row.spe}
                                </td>
                                <td className="px-2 py-1.5">
                                    <div className="flex items-center gap-2">
                                        <Sprite
                                            id={row.pokemonId}
                                            className="h-7 w-7 shrink-0"
                                        />
                                        <span className="truncate font-medium">{row.displayName}</span>
                                        <TypePill name={row.type1} className="text-[10px]" />
                                        {row.type2 && <TypePill name={row.type2} className="text-[10px]" />}
                                    </div>
                                </td>
                                <td className="px-2 py-1.5">
                                    {row.kind === 'team' ? (
                                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                            Your slot {row.slot}
                                        </span>
                                    ) : (
                                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                            Meta threat
                                        </span>
                                    )}
                                </td>
                                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                                    {row.kind === 'team' ? (
                                        <span>
                                            {row.nature} · {row.evSpe! > 0 ? `${row.evSpe} Spe EV` : 'no Spe EVs'}
                                        </span>
                                    ) : (
                                        row.notes ?? '—'
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
