import { useQuery } from '@tanstack/react-query';
import { getPokemonDetail, type PokemonAbilityEntry } from '@/modules/api/endpoints';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Props {
    pokemonId: number | null;
    value: number | null;
    onChange: (abilityId: number | null) => void;
}

export function AbilityPicker({ pokemonId, value, onChange }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['pokemon', pokemonId],
        queryFn: () => getPokemonDetail(pokemonId!),
        enabled: pokemonId !== null,
    });

    if (pokemonId === null) {
        return (
            <Select disabled>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pick a Pokemon first" /></SelectTrigger>
                <SelectContent />
            </Select>
        );
    }

    const abilities: PokemonAbilityEntry[] = data?.abilities ?? [];

    return (
        <Select
            value={value !== null ? String(value) : ''}
            onValueChange={(v) => onChange(v ? Number(v) : null)}
            disabled={isLoading || abilities.length === 0}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={isLoading ? 'Loading…' : 'Pick an ability'} />
            </SelectTrigger>
            <SelectContent>
                {abilities.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                        <span className="flex items-center gap-2">
                            {a.displayName}
                            {a.isHidden && (
                                <span className="rounded bg-purple-200 px-1 py-0.5 text-[10px] font-semibold text-purple-900 dark:bg-purple-900/60 dark:text-purple-200">
                                    Hidden
                                </span>
                            )}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
