import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ResultCardCalc {
    rolls: readonly number[];
    min: number;
    max: number;
    hpPercent: { min: number; max: number };
    ohko: 'guaranteed' | 'chance' | 'no';
    thko: 'guaranteed' | 'chance' | 'no';
    isStab: boolean;
    typeMult: number;
    isPhysical: boolean;
}

interface Props {
    calc: ResultCardCalc | null;
    placeholder?: string;
}

export function ResultCard({ calc, placeholder = 'Pick an attacker, a move, and a defender to compute damage.' }: Props) {
    if (!calc) {
        return (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                {placeholder}
            </div>
        );
    }

    const koLabel = (band: 'guaranteed' | 'chance' | 'no'): { text: string; cls: string } => {
        if (band === 'guaranteed') return { text: 'Guaranteed', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' };
        if (band === 'chance') return { text: 'Possible', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' };
        return { text: 'No', cls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' };
    };
    const ohko = koLabel(calc.ohko);
    const thko = koLabel(calc.thko);

    const typeMultLabel = calc.typeMult === 0 ? 'Immune (×0)'
        : calc.typeMult === 0.25 ? 'Quad-resisted (×0.25)'
        : calc.typeMult === 0.5 ? 'Resisted (×0.5)'
        : calc.typeMult === 1 ? 'Neutral (×1)'
        : calc.typeMult === 2 ? 'Super-effective (×2)'
        : calc.typeMult === 4 ? '4× super-effective'
        : `×${calc.typeMult}`;

    return (
        <div className="rounded-md border p-4 flex flex-col gap-3">
            <h2 className="dossier-eyebrow">Result</h2>
            <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{typeMultLabel}</span>
                {calc.isStab && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        STAB ×1.5
                    </span>
                )}
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {calc.isPhysical ? 'Physical' : 'Special'}
                </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Stat label="Damage range" value={`${calc.min}–${calc.max} HP`} />
                <Stat
                    label="Of defender's HP"
                    value={`${calc.hpPercent.min.toFixed(1)}–${calc.hpPercent.max.toFixed(1)}%`}
                />
                <Stat
                    label="OHKO / 2HKO"
                    value={
                        <span className="flex flex-wrap gap-1">
                            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', ohko.cls)}>
                                OHKO {ohko.text}
                            </span>
                            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', thko.cls)}>
                                2HKO {thko.text}
                            </span>
                        </span>
                    }
                />
            </div>
            {calc.typeMult > 0 && (
                <div className="flex items-center gap-2">
                    <div className="relative h-3 flex-1 rounded bg-muted">
                        <div
                            className="absolute inset-y-0 left-0 rounded bg-emerald-300/70 dark:bg-emerald-500/40"
                            style={{ width: `${Math.min(100, calc.hpPercent.min)}%` }}
                        />
                        <div
                            className="absolute inset-y-0 left-0 rounded border-r-2 border-red-500"
                            style={{ width: `${Math.min(100, calc.hpPercent.max)}%` }}
                        />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground w-20 text-right">
                        {calc.hpPercent.max >= 100 ? '≥100%' : `${calc.hpPercent.max.toFixed(0)}%`}
                    </span>
                </div>
            )}
            <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">All 16 rolls</summary>
                <div className="mt-1 grid grid-cols-8 gap-1 tabular-nums">
                    {calc.rolls.map((r, i) => (
                        <span key={i} className="rounded bg-muted px-1 py-0.5 text-center">{r}</span>
                    ))}
                </div>
            </details>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
        </div>
    );
}
