import { Fragment, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { typeColor } from '@/lib/type-colors';
import { TypePill } from '@/components/type-pill';
import type { TypeChart, TypeListItem } from '@/modules/api/endpoints';

interface ChartRow {
    type1: string;
    type2: string | null;
}

interface ChartBlock {
    blockType: string;
    rows: ChartRow[];
}

function buildBlocks(
    types: TypeListItem[],
    defenderType1: string | null,
    defenderType2: string | null,
): ChartBlock[] {
    if (defenderType1 && defenderType2) {
        return [{
            blockType: defenderType1,
            rows: [{ type1: defenderType1, type2: defenderType2 }],
        }];
    }

    const buildBlock = (blockType: string): ChartBlock => {
        const others = types.filter((t) => t.name !== blockType);
        return {
            blockType,
            rows: [
                { type1: blockType, type2: null },
                ...others.map((t) => ({ type1: blockType, type2: t.name })),
            ],
        };
    };

    if (defenderType1) {
        return [buildBlock(defenderType1)];
    }

    return types.map((t) => buildBlock(t.name));
}

function effectiveness(chart: TypeChart, attacker: string, def1: string, def2: string | null): number {
    const m1 = chart[attacker]?.[def1] ?? 1;
    const m2 = def2 ? chart[attacker]?.[def2] ?? 1 : 1;
    return m1 * m2;
}

function formatMultiplier(m: number): string {
    if (m === 0) return '0';
    if (m === 0.25) return '¼';
    if (m === 0.5) return '½';
    if (m === 1) return '';
    return String(m);
}

function cellClasses(m: number): string {
    if (m === 0) return 'bg-red-700 text-white dark:bg-red-950 dark:text-red-200';
    if (m === 0.25) return 'bg-red-300 text-red-900 dark:bg-red-900/60 dark:text-red-200';
    if (m === 0.5) return 'bg-orange-200 text-orange-900 dark:bg-orange-900/60 dark:text-orange-200';
    if (m === 2) return 'bg-green-300 text-green-900 dark:bg-green-900/60 dark:text-green-200';
    if (m === 4) return 'bg-green-600 text-white dark:bg-green-700 dark:text-green-100';
    return 'text-muted-foreground/30';
}

interface Props {
    chart: TypeChart;
    types: TypeListItem[];
    defenderType1: string | null;
    defenderType2: string | null;
}

export function TypeEffectivenessChart({ chart, types, defenderType1, defenderType2 }: Props) {
    const blocks = useMemo(
        () => buildBlocks(types, defenderType1, defenderType2),
        [types, defenderType1, defenderType2],
    );

    return (
        <div className="rounded-md border" data-transparent-bg>
            <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                    <col style={{ width: '180px' }} />
                    {types.map((t) => (
                        <col key={t.id} />
                    ))}
                </colgroup>
                <thead className="sticky top-0 z-20 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                    <tr>
                        <th className="border-r bg-background px-3 py-3 text-left font-semibold align-bottom">
                            Defender
                        </th>
                        {types.map((t) => {
                            const c = typeColor(t.name);
                            return (
                                <th
                                    key={t.id}
                                    className="border-l px-1 pb-2 pt-3 text-center font-semibold align-bottom"
                                    style={{ backgroundColor: c.bg, color: c.fg }}
                                >
                                    <span
                                        className="inline-block whitespace-nowrap"
                                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                    >
                                        {t.name}
                                    </span>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                {blocks.map((block, i) => (
                    <Fragment key={block.blockType}>
                        {i > 0 && (
                            <tbody aria-hidden="true">
                                <tr>
                                    <td
                                        colSpan={types.length + 1}
                                        className="h-10 bg-muted/40 border-y"
                                    />
                                </tr>
                            </tbody>
                        )}
                        <tbody>
                            {block.rows.map((row) => {
                                const label = row.type2 ? `${row.type1} / ${row.type2}` : row.type1;
                                return (
                                    <tr key={label} className="hover:bg-muted/40">
                                        <td className="border-r border-b px-3 py-1.5 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1">
                                                <TypePill name={row.type1} />
                                                {row.type2 && <TypePill name={row.type2} />}
                                            </span>
                                        </td>
                                        {types.map((attacker) => {
                                            const m = effectiveness(chart, attacker.name, row.type1, row.type2);
                                            return (
                                                <td
                                                    key={attacker.id}
                                                    className={cn(
                                                        'border-l border-b px-1 py-1.5 text-center font-semibold',
                                                        cellClasses(m),
                                                    )}
                                                    title={`${attacker.name} → ${label}: ×${m}`}
                                                >
                                                    {formatMultiplier(m)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Fragment>
                ))}
            </table>
        </div>
    );
}
