import { useEffect, useState } from 'react';
import { createLazyFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getTeamDetail, getTeams } from '@/modules/api/endpoints';
import { SpeedTiersView } from '@/components/team-detail/speed-tiers-view';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export const Route = createLazyFileRoute('/speed-tiers')({
    component: SpeedTiersPage,
});

function SpeedTiersPage() {
    const navigate = useNavigate();
    const { teamId: urlTeamId } = useSearch({ from: '/speed-tiers' });
    const [teamId, setTeamId] = useState<number | null>(urlTeamId ?? null);

    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: getTeams });

    useEffect(() => {
        if (teamId === null && teams && teams.length > 0) setTeamId(teams[0].id);
    }, [teamId, teams]);

    useEffect(() => {
        if (teamId !== null && teamId !== urlTeamId) {
            navigate({ to: '/speed-tiers', search: { teamId }, replace: true });
        }
    }, [teamId, urlTeamId, navigate]);

    const teamDetail = useQuery({
        queryKey: ['teams', teamId],
        queryFn: () => getTeamDetail(teamId!),
        enabled: teamId !== null,
    });

    return (
        <section className="flex flex-col gap-4 px-6 py-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Speed tiers</h1>
                <p className="text-sm text-muted-foreground">
                    Your team's effective speeds against the real meta (most-common spreads + fast benchmarks),
                    with live Tailwind / Trick Room / weather + terrain speed / Choice Scarf / paralysis / stage toggles.
                </p>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Your team</label>
                <Select
                    value={teamId !== null ? String(teamId) : ''}
                    onValueChange={(v) => setTeamId(v ? Number(v) : null)}
                    disabled={!teams || teams.length === 0}
                >
                    <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder={teams && teams.length === 0 ? 'No teams on file' : 'Pick a team'} />
                    </SelectTrigger>
                    <SelectContent>
                        {(teams ?? []).map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {teamDetail.isLoading && <p className="text-muted-foreground">Loading team…</p>}
            {teamDetail.error && (
                <p className="text-destructive">
                    {teamDetail.error instanceof Error ? teamDetail.error.message : 'Failed to load team'}
                </p>
            )}
            {teamDetail.data && <SpeedTiersView team={teamDetail.data} />}
        </section>
    );
}
