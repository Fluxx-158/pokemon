import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { getItems, type ItemListItem } from '@/modules/api/endpoints';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
    value: number | null;
    onChange: (id: number | null) => void;
}

export function ItemPicker({ value, onChange }: Props) {
    const [open, setOpen] = useState(false);

    const { data: items } = useQuery({
        queryKey: ['items', 'holdable', 'pc'],
        queryFn: () => getItems({ holdable: true, pcOnly: true }),
    });

    const selected = useMemo(
        () => items?.find((i: ItemListItem) => i.id === value) ?? null,
        [items, value],
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selected ? (
                        <span className="truncate">{selected.displayName}</span>
                    ) : (
                        <span className="text-muted-foreground">Pick an item…</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search items…" />
                    <CommandList>
                        <CommandEmpty>No items found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="none no-item"
                                onSelect={() => {
                                    onChange(null);
                                    setOpen(false);
                                }}
                            >
                                <span className="flex-1 italic text-muted-foreground">No item</span>
                                <Check
                                    className={cn(
                                        'ml-1 h-4 w-4',
                                        value === null ? 'opacity-100' : 'opacity-0',
                                    )}
                                />
                            </CommandItem>
                            {(items ?? []).map((item: ItemListItem) => (
                                <CommandItem
                                    key={item.id}
                                    value={`${item.displayName} ${item.category}`}
                                    onSelect={() => {
                                        onChange(item.id);
                                        setOpen(false);
                                    }}
                                >
                                    <span className="flex-1 truncate">{item.displayName}</span>
                                    <span className="text-[10px] text-muted-foreground capitalize">
                                        {item.category.replace(/-/g, ' ')}
                                    </span>
                                    <Check
                                        className={cn(
                                            'ml-1 h-4 w-4',
                                            value === item.id ? 'opacity-100' : 'opacity-0',
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
