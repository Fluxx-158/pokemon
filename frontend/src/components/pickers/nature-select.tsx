import { NATURES, natureLabel } from '@/lib/natures';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Props {
    value: string;
    onChange: (name: string) => void;
}

export function NatureSelect({ value, onChange }: Props) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a nature" />
            </SelectTrigger>
            <SelectContent>
                {NATURES.map((n) => (
                    <SelectItem key={n.name} value={n.name}>
                        <span className="flex items-center gap-2">
                            {n.name}
                            {n.plus && (
                                <span className="rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                    +{natureLabel(n.plus)}
                                </span>
                            )}
                            {n.minus && (
                                <span className="rounded bg-red-100 px-1 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                    −{natureLabel(n.minus)}
                                </span>
                            )}
                            {!n.plus && !n.minus && (
                                <span className="text-[10px] italic text-muted-foreground">neutral</span>
                            )}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
