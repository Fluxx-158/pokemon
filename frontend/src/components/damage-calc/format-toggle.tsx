// Shared Singles/Doubles resolution for the damage calculators.
//
// A team with a fixed format (doubles|singles) derives its calc mode
// automatically, no toggle shown. A `both`-format team and the standalone
// /calc page expose a Singles/Doubles toggle that defaults to Doubles and
// remembers the last choice for the session (sessionStorage). See feature-plan
// F1 cross-cutting decisions.

import { useState } from 'react';
import type { TeamFormat } from '@/modules/api/endpoints';
import { cn } from '@/lib/utils';

export type CalcMode = 'doubles' | 'singles';

const STORAGE_KEY = 'calc.formatMode';

function readStored(): CalcMode {
    if (typeof window === 'undefined') return 'doubles';
    return window.sessionStorage.getItem(STORAGE_KEY) === 'singles' ? 'singles' : 'doubles';
}

export interface CalcModeState {
    mode: CalcMode;
    isDoubles: boolean;
    setMode: (m: CalcMode) => void;
    /** True when the caller should render <FormatToggle> (both / standalone). */
    showToggle: boolean;
}

export function useCalcMode(teamFormat?: TeamFormat): CalcModeState {
    const [stored, setStored] = useState<CalcMode>(readStored);
    const setMode = (m: CalcMode) => {
        setStored(m);
        if (typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, m);
    };

    // Fixed-format team → derive, hide the toggle.
    if (teamFormat === 'doubles' || teamFormat === 'singles') {
        return { mode: teamFormat, isDoubles: teamFormat === 'doubles', setMode, showToggle: false };
    }
    // `both` team or standalone /calc → user-controlled, remembered in-session.
    return { mode: stored, isDoubles: stored === 'doubles', setMode, showToggle: true };
}

export function FormatToggle({ mode, onChange }: { mode: CalcMode; onChange: (m: CalcMode) => void }) {
    return (
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Battle format">
            {(['doubles', 'singles'] as CalcMode[]).map((m) => (
                <button
                    key={m}
                    type="button"
                    onClick={() => onChange(m)}
                    className={cn(
                        'rounded px-3 py-1 text-xs font-medium capitalize transition-colors',
                        mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {m}
                </button>
            ))}
        </div>
    );
}
