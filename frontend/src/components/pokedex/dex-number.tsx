// Big monospace dex number readout. Use plain <DexNumber> in row context
// (#0001) and <DexNumberLarge> for the detail page.

import { cn } from '@/lib/utils';

interface Props {
    id: number;
    /** Number of digits to pad to. Default 4 (covers up to #9999). */
    digits?: number;
    className?: string;
}

export function DexNumber({ id, digits = 4, className }: Props) {
    return (
        <span className={cn('pokedex-dex-number', className)}>
            #{String(id).padStart(digits, '0')}
        </span>
    );
}
