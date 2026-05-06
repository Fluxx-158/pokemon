import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getTypeChart, getTypes } from '@/modules/api/endpoints';
import { TypeEffectivenessChart } from '@/components/type-effectiveness-chart';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { typeColor } from '@/lib/type-colors';

const ANY_TYPE = '__any__';
const NO_TYPE_2 = '__none__';

export const Route = createFileRoute('/types')({
    component: TypesPage,
});

function TypesPage() {
    const typesQuery = useQuery({ queryKey: ['types'], queryFn: getTypes });
    const chartQuery = useQuery({ queryKey: ['types', 'chart'], queryFn: getTypeChart });

    const [defenderType1, setDefenderType1] = useState<string | null>(null);
    const [defenderType2, setDefenderType2] = useState<string | null>(null);

    const isLoading = typesQuery.isLoading || chartQuery.isLoading;
    const error = typesQuery.error ?? chartQuery.error;

    // Buttons only control Type 1. Type 2 is set via the dropdown.
    const handleTypeClick = (typeName: string) => {
        if (typeName === defenderType1) {
            setDefenderType1(null);
            setDefenderType2(null);
        } else {
            setDefenderType1(typeName);
            if (defenderType2 === typeName) {
                setDefenderType2(null);
            }
        }
    };

    return (
        <section className="flex flex-col gap-4 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold">Types</h2>
                <span className="text-xs text-muted-foreground">
                    Click a type to filter the chart by primary type. Use the Type 2 dropdown for dual focus.
                </span>
            </div>

            {typesQuery.data && (
                <div className="flex flex-wrap gap-2">
                    {typesQuery.data.map((t) => {
                        const isType1 = defenderType1 === t.name;
                        const color = typeColor(t.name);
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => handleTypeClick(t.name)}
                                style={{ backgroundColor: color.bg, color: color.fg }}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-sm font-semibold border-2 transition-all',
                                    isType1
                                        ? 'border-foreground shadow-md'
                                        : 'border-transparent opacity-65 hover:opacity-100',
                                )}
                            >
                                {t.name}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                        Defender Type 1
                    </label>
                    <Select
                        value={defenderType1 ?? ANY_TYPE}
                        onValueChange={(v) => {
                            if (v === ANY_TYPE) {
                                setDefenderType1(null);
                                setDefenderType2(null);
                            } else {
                                setDefenderType1(v);
                                if (defenderType2 === v) setDefenderType2(null);
                            }
                        }}
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY_TYPE}>Any (all blocks)</SelectItem>
                            {typesQuery.data?.map((t) => (
                                <SelectItem key={t.id} value={t.name}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                        Defender Type 2
                    </label>
                    <Select
                        value={defenderType2 ?? NO_TYPE_2}
                        onValueChange={(v) => {
                            setDefenderType2(v === NO_TYPE_2 ? null : v);
                        }}
                        disabled={!defenderType1}
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_TYPE_2}>None (mono)</SelectItem>
                            {typesQuery.data
                                ?.filter((t) => t.name !== defenderType1)
                                .map((t) => (
                                    <SelectItem key={t.id} value={t.name}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                {(defenderType1 || defenderType2) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDefenderType1(null);
                            setDefenderType2(null);
                        }}
                    >
                        Clear
                    </Button>
                )}
            </div>

            {isLoading && <p className="text-muted-foreground">Loading…</p>}
            {error && (
                <p className="text-destructive">
                    {error instanceof Error ? error.message : 'Failed to load chart'}
                </p>
            )}

            {typesQuery.data && chartQuery.data && (
                <TypeEffectivenessChart
                    chart={chartQuery.data}
                    types={typesQuery.data}
                    defenderType1={defenderType1}
                    defenderType2={defenderType2}
                />
            )}
        </section>
    );
}
