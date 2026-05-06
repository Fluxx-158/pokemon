import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props {
    cls: string;
    className?: string;
    withTooltip?: boolean;
}

const ICON_SRC: Record<string, string> = {
    physical: '/move-class/physical_move_icon.svg',
    special: '/move-class/special_move_icon.svg',
    status: '/move-class/status_move_icon.svg',
};

const LABELS: Record<string, string> = {
    physical: 'Physical',
    special: 'Special',
    status: 'Status',
};

export function MoveClassIcon({ cls, className, withTooltip = true }: Props) {
    const src = ICON_SRC[cls];
    if (!src) return null;

    const icon = (
        <span
            className={cn(
                'inline-flex h-5 w-10 items-center justify-center overflow-hidden',
                className,
            )}
        >
            <img
                src={src}
                alt=""
                className="block h-full w-full object-contain"
                decoding="async"
            />
        </span>
    );

    if (!withTooltip) return icon;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{icon}</TooltipTrigger>
            <TooltipContent>{LABELS[cls] ?? cls}</TooltipContent>
        </Tooltip>
    );
}
