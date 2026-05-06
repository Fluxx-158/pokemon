import { cn } from '@/lib/utils';

interface Props {
    value: string;
    onChange: (next: string) => void;
    /** Px. Defaults to 640. */
    minHeight?: number;
    placeholder?: string;
    className?: string;
    id?: string;
}

export function MarkdownEditor({
    value, onChange, minHeight = 640, placeholder, className, id,
}: Props) {
    return (
        <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder={placeholder}
            style={{ minHeight: `${minHeight}px` }}
            className={cn(
                'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'font-mono leading-relaxed',
                className,
            )}
        />
    );
}
