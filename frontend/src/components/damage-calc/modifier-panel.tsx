import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DEFENDER_IMMUNITY_ABILITIES,
    TYPE_RESIST_BERRIES,
} from '@/lib/damage-calc';

export interface ModifierState {
    weather: 'clear' | 'sun' | 'rain' | 'snow' | 'sand';
    burned: boolean;
    spread: boolean;
    screen: 'none' | 'reflect' | 'light_screen' | 'aurora_veil';
    attackerItemBoost: boolean;
    adaptability: boolean;
    defenderImmunityAbility: string;
    multiscale: boolean;
    filter: boolean;
    defenderBerry: string;
}

export const EMPTY_MODIFIERS: ModifierState = {
    weather: 'clear',
    burned: false,
    spread: false,
    screen: 'none',
    attackerItemBoost: false,
    adaptability: false,
    defenderImmunityAbility: 'none',
    multiscale: false,
    filter: false,
    defenderBerry: 'none',
};

interface Props {
    value: ModifierState;
    onChange: (next: ModifierState) => void;
}

export function ModifierPanel({ value, onChange }: Props) {
    const set = <K extends keyof ModifierState>(key: K, v: ModifierState[K]) =>
        onChange({ ...value, [key]: v });

    return (
        <details className="rounded-md border p-3 group">
            <summary className="cursor-pointer text-sm font-semibold flex items-center justify-between">
                <span>Advanced modifiers</span>
                <span className="text-[10px] text-muted-foreground group-open:hidden">
                    weather · screens · burn · spread · items · abilities · berries
                </span>
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Weather">
                    <Select value={value.weather} onValueChange={(v) => set('weather', v as ModifierState['weather'])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="clear">Clear</SelectItem>
                            <SelectItem value="sun">Sun (Fire ×1.5, Water ×0.5)</SelectItem>
                            <SelectItem value="rain">Rain (Water ×1.5, Fire ×0.5)</SelectItem>
                            <SelectItem value="snow">Snow (no damage mod)</SelectItem>
                            <SelectItem value="sand">Sand (no damage mod)</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>

                <Field label="Defender screen">
                    <Select value={value.screen} onValueChange={(v) => set('screen', v as ModifierState['screen'])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="reflect">Reflect (physical only)</SelectItem>
                            <SelectItem value="light_screen">Light Screen (special only)</SelectItem>
                            <SelectItem value="aurora_veil">Aurora Veil (both)</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>

                <Field label="Defender immunity ability">
                    <Select
                        value={value.defenderImmunityAbility}
                        onValueChange={(v) => set('defenderImmunityAbility', v)}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {DEFENDER_IMMUNITY_ABILITIES.map((a) => (
                                <SelectItem key={a.name} value={a.name}>
                                    {a.name} (blocks {a.immuneTo})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field label="Defender resist berry">
                    <Select value={value.defenderBerry} onValueChange={(v) => set('defenderBerry', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {TYPE_RESIST_BERRIES.map((b) => (
                                <SelectItem key={b.name} value={b.name}>
                                    {b.name} ({b.resistType}{b.alwaysTrigger ? ' · any hit' : ''})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Toggles>
                    <Toggle label="Spread move (×0.75)" checked={value.spread} onChange={(v) => set('spread', v)} />
                    <Toggle label="Attacker burned (×0.5 physical)" checked={value.burned} onChange={(v) => set('burned', v)} />
                    <Toggle label="Attacker type-boost item (×1.2)" checked={value.attackerItemBoost} onChange={(v) => set('attackerItemBoost', v)} />
                    <Toggle label="Attacker Adaptability (STAB ×2)" checked={value.adaptability} onChange={(v) => set('adaptability', v)} />
                    <Toggle label="Defender Multiscale (×0.5 at full HP)" checked={value.multiscale} onChange={(v) => set('multiscale', v)} />
                    <Toggle label="Defender Filter / Solid Rock (×0.75 vs SE)" checked={value.filter} onChange={(v) => set('filter', v)} />
                </Toggles>
            </div>
        </details>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            {children}
        </div>
    );
}

function Toggles({ children }: { children: React.ReactNode }) {
    return (
        <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t">
            {children}
        </div>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
            <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
            <span>{label}</span>
        </label>
    );
}
