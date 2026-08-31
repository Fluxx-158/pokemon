import { type TeamDetail } from '@/modules/api/endpoints';
import { SpeedTiersView } from '@/components/team-detail/speed-tiers-view';

export function SpeedTab({ team }: { team: TeamDetail }) {
    if (team.members.length === 0) {
        return <p className="text-sm text-muted-foreground">No team members yet.</p>;
    }
    return <SpeedTiersView team={team} />;
}
