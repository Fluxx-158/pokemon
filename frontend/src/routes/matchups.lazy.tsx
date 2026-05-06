import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
    getPokemonList,
    getTeams,
    searchMatchups,
    type MatchupSearchResult,
} from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { buildPokemonLookup, findSpecies } from '@/lib/species-lookup';
import { cn } from '@/lib/utils';

export const Route = createLazyFileRoute('/matchups')({
    component: MatchupsSearchPage,
});

function MatchupsSearchPage() {
    const navigate = useNavigate();
    const { q: urlQ, teamId: urlTeamId } = useSearch({ from: '/matchups' });
    const [q, setQ] = useState(urlQ ?? '');
    const [teamId, setTeamId] = useState<number | null>(urlTeamId ?? null);

    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: getTeams });

    // Keep the URL in sync as the user types so the result is shareable / on
    // browser back. Debounce a touch so we don't spam history entries.
    useEffect(() => {
        const t = setTimeout(() => {
            const next = q.trim();
            if (next === (urlQ ?? '') && (teamId ?? undefined) === urlTeamId) return;
            navigate({
                to: '/matchups',
                search: {
                    ...(next ? { q: next } : {}),
                    ...(teamId !== null ? { teamId } : {}),
                },
                replace: true,
            });
        }, 200);
        return () => clearTimeout(t);
    }, [q, teamId, urlQ, urlTeamId, navigate]);

    // Debounced query value used for the network call. We call the server even
    // for empty q so we get the full index when the user lands fresh.
    const [debouncedQ, setDebouncedQ] = useState(q.trim());
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 200);
        return () => clearTimeout(t);
    }, [q]);

    const { data, isLoading, error } = useQuery({
        queryKey: ['matchups', 'search', debouncedQ, teamId],
        queryFn: () => searchMatchups({ q: debouncedQ, teamId: teamId ?? undefined }),
    });

    return (
        <section className="flex flex-col gap-4 px-6 py-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Matchups search</h1>
                <p className="text-sm text-muted-foreground">
                    Cross-team search. Matches on title, slug, frontmatter (result, encountered date, opponent species), and body content. Empty query lists every matchup.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="relative flex-1 min-w-[280px] max-w-xl">
                    <label className="text-xs font-medium text-muted-foreground">Search</label>
                    <Search className="absolute left-2 top-[1.65rem] h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Garchomp, rain, lost, Ceruledge…"
                        className="pl-8"
                        autoFocus
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Team</label>
                    <Select
                        value={teamId === null ? '__all' : String(teamId)}
                        onValueChange={(v) => setTeamId(v === '__all' ? null : Number(v))}
                    >
                        <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">All teams</SelectItem>
                            {(teams ?? []).map((t) => (
                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isLoading && <p className="text-muted-foreground">Loading…</p>}
            {error && (
                <p className="text-destructive">
                    {error instanceof Error ? error.message : 'Failed to load matchups'}
                </p>
            )}

            {data && (
                <>
                    <div className="text-xs text-muted-foreground">
                        {data.length === 0
                            ? 'No matching matchups.'
                            : `${data.length} matchup${data.length === 1 ? '' : 's'}${debouncedQ ? ` matching “${debouncedQ}”` : ''}`}
                    </div>
                    <ul className="flex flex-col gap-2">
                        {data.map((r) => (
                            <ResultRow key={`${r.teamId}-${r.slug}`} result={r} q={debouncedQ} />
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}

function ResultRow({ result, q }: { result: MatchupSearchResult; q: string }) {
    const { data: pokemonList } = useQuery({ queryKey: ['pokemon'], queryFn: getPokemonList });

    // Resolve any opponent-lead names to sprite IDs so the row is scannable.
    // Tolerant lookup so abbreviated names ("Charizard" → "Charizard Mega Y")
    // and styled names ("Mega Charizard Y") both find the right entry.
    const lookup = useMemo(() => buildPokemonLookup(pokemonList), [pokemonList]);
    const leadSprites = useMemo(() => {
        if (!result.frontmatter.opponent_lead) return [];
        return result.frontmatter.opponent_lead
            .map((name) => findSpecies(lookup, name))
            .filter((p): p is NonNullable<typeof p> => p !== undefined);
    }, [lookup, result.frontmatter.opponent_lead]);

    const resultBadge = result.frontmatter.result?.toLowerCase();
    const resultCls = resultBadge === 'won' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
        : resultBadge === 'lost' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

    return (
        <li className="rounded-md border bg-card p-3 hover:bg-accent/40 transition">
            <Link
                to="/teams/$id"
                params={{ id: result.teamId }}
                hash={`matchup-${result.slug}`}
                className="flex flex-col gap-2"
            >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Team: <span className="font-semibold text-foreground normal-case">{result.teamName}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {leadSprites.length > 0 && (
                        <div className="flex -space-x-2">
                            {leadSprites.map((p) => (
                                <Sprite
                                    key={p.id}
                                    id={p.id}
                                    alt={p.displayName}
                                    title={p.displayName}
                                    className="h-8 w-8 rounded-full bg-muted/30"
                                />
                            ))}
                        </div>
                    )}
                    <span className="font-medium">{result.title}</span>
                    {result.frontmatter.result && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', resultCls)}>
                            {result.frontmatter.result}
                        </span>
                    )}
                    {result.frontmatter.encountered && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                            {result.frontmatter.encountered}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <code className="text-[10px] text-muted-foreground">{result.slug}</code>
                    {result.frontmatter.opponent_six && result.frontmatter.opponent_six.length > 0 && (
                        <span className="text-[10px] text-muted-foreground truncate">
                            opp 6: {result.frontmatter.opponent_six.join(' · ')}
                        </span>
                    )}
                </div>
                {result.excerpt && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2">
                        <Highlight text={result.excerpt} q={q} />
                    </p>
                )}
            </Link>
        </li>
    );
}

// Tiny highlighter — wraps occurrences of `q` in the text with <mark>.
function Highlight({ text, q }: { text: string; q: string }) {
    if (!q) return <>{text}</>;
    const parts: Array<string | { mark: string }> = [];
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    let i = 0;
    while (i < text.length) {
        const at = lower.indexOf(ql, i);
        if (at === -1) {
            parts.push(text.slice(i));
            break;
        }
        if (at > i) parts.push(text.slice(i, at));
        parts.push({ mark: text.slice(at, at + ql.length) });
        i = at + ql.length;
    }
    return (
        <>
            {parts.map((p, idx) =>
                typeof p === 'string' ? p
                    : <mark key={idx} className="rounded bg-yellow-200/60 px-0.5 not-italic dark:bg-yellow-500/30">{p.mark}</mark>,
            )}
        </>
    );
}

