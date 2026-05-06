import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface EvBlock {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

interface Props {
    value: EvBlock;
    onChange: (next: EvBlock) => void;
}

const STATS: Array<{ key: keyof EvBlock; label: string }> = [
    { key: 'hp', label: 'HP' },
    { key: 'atk', label: 'Atk' },
    { key: 'def', label: 'Def' },
    { key: 'spa', label: 'SpA' },
    { key: 'spd', label: 'SpD' },
    { key: 'spe', label: 'Spe' },
];

export const EV_PER_STAT_CAP = 32;
export const EV_TOTAL_CAP = 66;

function clampStat(n: number): number {
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(EV_PER_STAT_CAP, Math.floor(n)));
}

export function evTotal(evs: EvBlock): number {
    return evs.hp + evs.atk + evs.def + evs.spa + evs.spd + evs.spe;
}

export function EvInputs({ value, onChange }: Props) {
    const total = evTotal(value);
    const overTotal = total > EV_TOTAL_CAP;

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    EVs (cap {EV_PER_STAT_CAP}/stat, {EV_TOTAL_CAP} total)
                </span>
                <span className={cn(
                    'text-xs tabular-nums',
                    overTotal ? 'text-destructive font-semibold' : 'text-muted-foreground',
                )}>
                    {total} / {EV_TOTAL_CAP}
                </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
                {STATS.map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1 text-center">
                        <label className="text-[10px] text-muted-foreground">{label}</label>
                        <Input
                            type="number"
                            min={0}
                            max={EV_PER_STAT_CAP}
                            value={value[key]}
                            onChange={(e) => {
                                onChange({ ...value, [key]: clampStat(Number(e.target.value)) });
                            }}
                            className={cn(
                                'h-8 px-1 text-center text-sm tabular-nums',
                                value[key] > 0 && 'bg-emerald-50 dark:bg-emerald-900/20',
                            )}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
