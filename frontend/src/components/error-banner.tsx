import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
    children?: ReactNode;
    className?: string;
}

export function ErrorBanner({ children, className }: Props) {
    if (!children) return null;
    return (
        <div
            className={cn(
                'rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive',
                className,
            )}
        >
            {children}
        </div>
    );
}
