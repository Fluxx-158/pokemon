import { useMemo } from 'react';
import { type TeamDetail } from '@/modules/api/endpoints';
import { toAnalysisMembers } from '@/components/team-detail/analysis-members';
import { TeamAnalysisView } from '@/components/team-detail/team-analysis-view';

export function CoverageTab({ team }: { team: TeamDetail }) {
    const members = useMemo(() => toAnalysisMembers(team), [team]);
    if (team.members.length === 0) {
        return <p className="text-sm text-muted-foreground">No team members yet.</p>;
    }
    return <TeamAnalysisView members={members} teamFormat={team.format} />;
}
