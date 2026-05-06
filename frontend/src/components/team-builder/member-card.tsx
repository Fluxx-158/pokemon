import { useQuery } from '@tanstack/react-query';
import { getPokemonDetail, getPokemonList } from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { AbilityPicker } from '@/components/pickers/ability-picker';
import { evTotal, EV_TOTAL_CAP, EvInputs, type EvBlock } from '@/components/pickers/ev-inputs';
import { ItemPicker } from '@/components/pickers/item-picker';
import { MovePicker } from '@/components/pickers/move-picker';
import { NatureSelect } from '@/components/pickers/nature-select';
import { PokemonPicker } from '@/components/pickers/pokemon-picker';
import { TypePill } from '@/components/type-pill';
import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

export interface MemberFormState {
    pokemonId: number | null;
    abilityId: number | null;
    itemId: number | null;
    nature: string;
    moveIds: [number | null, number | null, number | null, number | null];
    evs: EvBlock;
}

export const EMPTY_MEMBER: MemberFormState = {
    pokemonId: null,
    abilityId: null,
    itemId: null,
    nature: '',
    moveIds: [null, null, null, null],
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
};

interface Props {
    slot: number;
    value: MemberFormState;
    onChange: (next: MemberFormState) => void;
}

export function MemberCard({ slot, value, onChange }: Props) {
    const { data: pokemonList } = useQuery({
        queryKey: ['pokemon'],
        queryFn: getPokemonList,
    });
    const summary = value.pokemonId !== null
        ? pokemonList?.find((p) => p.id === value.pokemonId) ?? null
        : null;

    const total = evTotal(value.evs);
    const totalOver = total > EV_TOTAL_CAP;

    // Auto-clear ability + moves when the pokemon changes (those are
    // pokemon-scoped and would otherwise dangle as invalid IDs).
    const handlePokemonChange = (id: number | null) => {
        onChange({
            ...value,
            pokemonId: id,
            abilityId: null,
            moveIds: [null, null, null, null],
        });
    };

    return (
        <AccordionItem value={`slot-${slot}`} className="border bg-card">
            <AccordionTrigger className="px-4">
                <div className="flex flex-1 items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-14">
                        Slot {slot}
                    </span>
                    {summary ? (
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                            <Sprite id={summary.id} className="h-8 w-8" />
                            <span className="font-medium truncate">{summary.displayName}</span>
                            <TypePill name={summary.type1} className="text-[10px]" />
                            {summary.type2 && <TypePill name={summary.type2} className="text-[10px]" />}
                            {value.nature && (
                                <span className="text-xs text-muted-foreground">{value.nature}</span>
                            )}
                        </div>
                    ) : (
                        <span className="flex-1 italic text-muted-foreground">empty slot</span>
                    )}
                    <span className={cn(
                        'text-xs tabular-nums',
                        totalOver ? 'text-destructive font-semibold' : 'text-muted-foreground',
                    )}>
                        {total} / {EV_TOTAL_CAP} EV
                    </span>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Pokemon</label>
                        <PokemonPicker value={value.pokemonId} onChange={handlePokemonChange} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Ability</label>
                            <AbilityPicker
                                pokemonId={value.pokemonId}
                                value={value.abilityId}
                                onChange={(id) => onChange({ ...value, abilityId: id })}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nature</label>
                            <NatureSelect
                                value={value.nature}
                                onChange={(n) => onChange({ ...value, nature: n })}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Held item</label>
                            <ItemPicker
                                value={value.itemId}
                                onChange={(id) => onChange({ ...value, itemId: id })}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Moves</label>
                        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                            {[0, 1, 2, 3].map((i) => (
                                <MovePicker
                                    key={i}
                                    pokemonId={value.pokemonId}
                                    value={value.moveIds[i]}
                                    onChange={(moveId) => {
                                        const next: [number | null, number | null, number | null, number | null] = [...value.moveIds];
                                        next[i] = moveId;
                                        onChange({ ...value, moveIds: next });
                                    }}
                                    excludeMoveIds={value.moveIds}
                                />
                            ))}
                        </div>
                    </div>

                    <EvInputs
                        value={value.evs}
                        onChange={(evs) => onChange({ ...value, evs })}
                    />
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

export function useSelectedPokemonSummary(pokemonId: number | null) {
    const { data } = useQuery({
        queryKey: ['pokemon', pokemonId],
        queryFn: () => getPokemonDetail(pokemonId!),
        enabled: pokemonId !== null,
    });
    return data;
}
