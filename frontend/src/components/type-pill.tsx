import type { CSSProperties } from 'react';
import { typeColor } from '@/lib/type-colors';
import { cn } from '@/lib/utils';

interface Props {
    name: string;
    className?: string;
    style?: CSSProperties;
}

export function TypePill({ name, className, style }: Props) {
    const c = typeColor(name);
    return (
        <span
            style={{ backgroundColor: c.bg, color: c.fg, ...style }}
            className={cn('dossier-pill text-xs', className)}
        >
            {name}
        </span>
    );
}
