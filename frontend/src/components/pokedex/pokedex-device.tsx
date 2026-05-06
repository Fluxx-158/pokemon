import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
    title: string;
    /** Right-aligned text in the header — e.g., "1276 ENTRIES" or "GEN 1". */
    meta?: ReactNode;
    /** Adds a subtle scanline overlay on the screen body. Default off. */
    scanlines?: boolean;
    children: ReactNode;
    className?: string;
}

export function PokedexDevice({ title, meta, scanlines, children, className }: Props) {
    return (
        <div className={cn('pokedex-device', className)}>
            <div className="pokedex-header">
                <div className="pokedex-eye" aria-hidden />
                <div className="pokedex-led-cluster" aria-hidden>
                    <span className="pokedex-led-small pokedex-led-small--red" />
                    <span className="pokedex-led-small pokedex-led-small--yellow" />
                    <span className="pokedex-led-small pokedex-led-small--green" />
                </div>
                <span className="pokedex-title">{title}</span>
                {meta && <span className="pokedex-meta">{meta}</span>}
            </div>
            <div className={cn('pokedex-screen', scanlines && 'pokedex-screen--scanlines')}>
                {children}
            </div>
        </div>
    );
}
