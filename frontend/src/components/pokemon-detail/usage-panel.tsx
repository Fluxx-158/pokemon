// Competitive usage panel for the Pokémon detail page. Renders championsbattledata
// move/item/ability/nature/spread/teammate usage with a Doubles/Singles toggle
// limited to the formats we actually have data for. The provenance line shows the
// ranked SEASON reported by the source (e.g. "M4" → "Season M-4") rather than a
// hardcoded regulation, so it stays correct across season rollovers.

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type {
    PokemonUsage,
    UsageBlock,
    UsageEntry,
    UsageNature,
    UsageSpread,
} from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { seasonLabel } from '@/lib/season';
import { UsageUnavailable } from '@/components/usage-unavailable';
import { cn } from '@/lib/utils';

type Fmt = 'doubles' | 'singles';

function pct(p: number | null): string {
    return p === null ? '' : `${p.toFixed(1)}%`;
}

// A horizontal bar sized to the percentage (capped visually at 100). Colors are
// set with inline styles rather than Tailwind classes so they render solid
// regardless of the parchment theme's opacity/contrast handling. The fill is
// absolutely positioned (inset-y-0) so its height always resolves.
function Bar({ p }: { p: number | null }) {
    if (p === null) return null;
    return (
        <span
            className="relative ml-2 inline-block h-2.5 w-24 shrink-0 overflow-hidden rounded-full"
            style={{ backgroundColor: 'rgba(16,185,129,0.18)', boxShadow: 'inset 0 0 0 1px rgba(5,150,105,0.35)' }}
        >
            <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.min(100, Math.max(3, p))}%`, backgroundColor: '#059669' }}
            />
        </span>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 rounded border p-3">
            <h3 className="dossier-eyebrow text-xs">{title}</h3>
            {children}
        </div>
    );
}

function EntryList({ title, entries, limit = 8 }: { title: string; entries: UsageEntry[]; limit?: number }) {
    if (entries.length === 0) return null;
    return (
        <Card title={title}>
            <ol className="flex flex-col gap-1 text-xs">
                {entries.slice(0, limit).map((e) => (
                    <li key={`${e.rank}-${e.name}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{e.name || ', '}</span>
                        <span className="flex items-center tabular-nums text-muted-foreground">
                            {pct(e.percentage)}
                            <Bar p={e.percentage} />
                        </span>
                    </li>
                ))}
            </ol>
        </Card>
    );
}

function NatureList({ natures }: { natures: UsageNature[] }) {
    if (natures.length === 0) return null;
    return (
        <Card title="Natures">
            <ol className="flex flex-col gap-1 text-xs">
                {natures.slice(0, 6).map((n) => (
                    <li key={`${n.rank}-${n.name}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                            {n.name}
                            {n.statUp && n.statDown && (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                    +{n.statUp} −{n.statDown}
                                </span>
                            )}
                        </span>
                        <span className="flex items-center tabular-nums text-muted-foreground">
                            {pct(n.percentage)}
                            <Bar p={n.percentage} />
                        </span>
                    </li>
                ))}
            </ol>
        </Card>
    );
}

const SPREAD_KEYS: Array<[keyof UsageSpread['evs'], string]> = [
    ['hp', 'HP'], ['atk', 'Atk'], ['def', 'Def'], ['spa', 'SpA'], ['spd', 'SpD'], ['spe', 'Spe'],
];

function SpreadList({ spreads }: { spreads: UsageSpread[] }) {
    if (spreads.length === 0) return null;
    return (
        <Card title="Spreads (stat points)">
            <ol className="flex flex-col gap-1 text-xs">
                {spreads.slice(0, 5).map((s) => {
                    const parts = SPREAD_KEYS
                        .filter(([k]) => s.evs[k] > 0)
                        .map(([k, label]) => `${label} ${s.evs[k]}`);
                    return (
                        <li key={s.rank} className="flex items-center justify-between gap-2">
                            <span className="truncate tabular-nums">{parts.join(' / ') || 'neutral'}</span>
                            <span className="flex items-center tabular-nums text-muted-foreground">
                                {pct(s.percentage)}
                                <Bar p={s.percentage} />
                            </span>
                        </li>
                    );
                })}
            </ol>
        </Card>
    );
}

function TeammateList({ teammates }: { teammates: UsageEntry[] }) {
    if (teammates.length === 0) return null;
    return (
        <Card title="Common teammates">
            <ol className="flex flex-col gap-1 text-xs">
                {teammates.slice(0, 8).map((t) => (
                    <li key={`${t.rank}-${t.name}`}>
                        {t.refId !== null ? (
                            <Link
                                to="/pokemon/$id"
                                params={{ id: t.refId }}
                                className="flex items-center gap-1.5 hover:underline"
                            >
                                <Sprite id={t.refId} className="h-6 w-6" loading="lazy" decoding="async" />
                                <span className="truncate">{t.name}</span>
                            </Link>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-6 w-6 rounded bg-muted/40" />
                                <span className="truncate">{t.name}</span>
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </Card>
    );
}

function FormatTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded px-3 py-1 text-xs font-medium capitalize transition-colors',
                active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
        >
            {label}
        </button>
    );
}

export function UsagePanel({ usage }: { usage: PokemonUsage }) {
    const available = (['doubles', 'singles'] as Fmt[]).filter((f) => usage[f] !== null);
    const [fmt, setFmt] = useState<Fmt>(available[0] ?? 'doubles');

    if (available.length === 0) {
        return (
            <div className="rounded-md border p-4">
                <h2 className="mb-2 text-lg font-semibold">Competitive usage</h2>
                <UsageUnavailable />
            </div>
        );
    }
    const block: UsageBlock = usage[fmt] ?? usage[available[0]]!;

    return (
        <div className="rounded-md border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-lg font-semibold">Competitive usage</h2>
                    <span className="text-xs text-muted-foreground">
                        {seasonLabel(usage.sourceSeason)}championsbattledata.com
                        {usage.sourceGeneratedAt && ` · ${usage.sourceGeneratedAt.slice(0, 10)}`}
                    </span>
                </div>
                {available.length > 1 && (
                    <div className="inline-flex rounded-md border p-0.5">
                        {available.map((f) => (
                            <FormatTab key={f} active={fmt === f} label={f} onClick={() => setFmt(f)} />
                        ))}
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <EntryList title="Moves" entries={block.moves} />
                <EntryList title="Items" entries={block.items} />
                <EntryList title="Abilities" entries={block.abilities} />
                <NatureList natures={block.natures} />
                <SpreadList spreads={block.spreads} />
                <TeammateList teammates={block.teammates} />
            </div>
        </div>
    );
}
