// Built-in backdrop presets. User uploads live as files in
// frontend/public/backdrops/ (managed by the backend backdrops module);
// the picker merges them with this list at runtime.
//
// Adding a built-in:
//  - kind:'parchment' → no backdrop element, just dot grid + parchment
//  - kind:'css'       → renders a <div className={cssClass}/>; pair with a
//                        rule in frontend/src/styles/backgrounds.css

import type { CSSProperties } from 'react';

export type BuiltinPreset =
    | { key: 'parchment'; label: string; note?: string; kind: 'parchment'; thumb: CSSProperties }
    | { key: string;       label: string; note?: string; kind: 'css'; cssClass: string; opacity?: number; thumb: CSSProperties };

export const BUILTIN_PRESETS: BuiltinPreset[] = [
    {
        key: 'parchment',
        kind: 'parchment',
        label: 'Parchment',
        note: 'Default · static',
        thumb: { background: '#F7F2E8' },
    },
    {
        key: 'emerald',
        kind: 'css',
        cssClass: 'backdrop-emerald',
        label: 'Emerald sky',
        note: 'Animated · CSS clouds + lightning',
        opacity: 0.55,
        thumb: {
            background: 'radial-gradient(ellipse at 25% 35%, rgba(220,235,255,0.55) 0%, transparent 50%), linear-gradient(180deg, #0a1f4a, #1c4569 55%, #2a7d6f)',
        },
    },
    {
        key: 'rain',
        kind: 'css',
        cssClass: 'backdrop-rain',
        label: 'Drizzle',
        note: 'Animated · falling streaks',
        opacity: 0.55,
        thumb: {
            background: 'linear-gradient(180deg, #2c3e50, #34495e), repeating-linear-gradient(75deg, transparent 0 3px, rgba(180,200,220,0.4) 3px 4px)',
        },
    },
    {
        key: 'hex',
        kind: 'css',
        cssClass: 'backdrop-hex',
        label: 'Hex grid',
        note: 'Static · tactical',
        opacity: 0.5,
        thumb: {
            background: '#F7F2E8',
            backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='16' viewBox='0 0 56 64'><g fill='none' stroke='%23241D17' stroke-width='2' stroke-opacity='0.4'><path d='M28 1 L55 16 L55 48 L28 63 L1 48 L1 16 Z'/></g></svg>\")",
            backgroundSize: '14px 16px',
        },
    },
    {
        key: 'topo',
        kind: 'css',
        cssClass: 'backdrop-topo',
        label: 'Topographic',
        note: 'Static · survey lines',
        thumb: {
            background:
                'repeating-linear-gradient(12deg, #F7F2E8 0 4px, #C9C0B1 4px 5px), #F7F2E8',
        },
    },
];

export const DEFAULT_KEY = 'parchment';

export function findBuiltin(key: string): BuiltinPreset | undefined {
    return BUILTIN_PRESETS.find((p) => p.key === key);
}
