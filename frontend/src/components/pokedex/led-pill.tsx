// Compact status indicator with a tiny LED dot. Variants map to colour:
//   ok      — green (PC-available, current, etc.)
//   off     — gray  (not in PC, deprecated)
//   region  — blue  (regional variant)
//   mega    — red/foil (mega-evolved form)

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'ok' | 'off' | 'region' | 'mega';

interface Props {
    variant: Variant;
    children: ReactNode;
    className?: string;
}

export function LedPill({ variant, children, className }: Props) {
    return (
        <span className={cn('pokedex-led-pill', `pokedex-led-pill--${variant}`, className)}>
            {children}
        </span>
    );
}
