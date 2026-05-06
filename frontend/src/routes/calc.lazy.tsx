import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
    getPokemonDetail,
    getPokemonList,
    getTypeChart,
} from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { EMPTY_MODIFIERS, ModifierPanel, type ModifierState } from '@/components/damage-calc/modifier-panel';
import { ResultCard } from '@/components/damage-calc/result-card';
import { dedupeDamagingMoves, runCalc } from '@/components/damage-calc/run-calc';
import { MoveClassIcon } from '@/components/move-class-icon';
import { PokemonPicker } from '@/components/pickers/pokemon-picker';
import { TypePill } from '@/components/type-pill';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    defaultHp,
    defaultStat,
} from '@/lib/damage-calc';
import { capitalize, clampInt, cn } from '@/lib/utils';

export const Route = createLazyFileRoute('/calc')({
    component: CalcPage,
});

function CalcPage() {
    const { data: pokemonList } = useQuery({
        queryKey: ['pokemon'],
        queryFn: getPokemonList,
    });
    const { data: typeChart } = useQuery({
        queryKey: ['types', 'chart'],
        queryFn: getTypeChart,
    });

    const [attackerId, setAttackerId] = useState<number | null>(null);
    const [defenderId, setDefenderId] = useState<number | null>(null);
    const [moveId, setMoveId] = useState<number | null>(null);
    const [level, setLevel] = useState(50);
    const [atk, setAtk] = useState(0);
    const [spa, setSpa] = useState(0);
    const [defenderHp, setDefenderHp] = useState(0);
    const [defenderDef, setDefenderDef] = useState(0);
    const [defenderSpd, setDefenderSpd] = useState(0);
    const [crit, setCrit] = useState(false);
    const [mods, setMods] = useState<ModifierState>(EMPTY_MODIFIERS);

    const attackerDetail = useQuery({
        queryKey: ['pokemon', attackerId],
        queryFn: () => getPokemonDetail(attackerId!),
        enabled: attackerId !== null,
    });

    const attackerSummary = useMemo(
        () => (pokemonList && attackerId !== null) ? pokemonList.find((p) => p.id === attackerId) ?? null : null,
        [pokemonList, attackerId],
    );
    const defenderSummary = useMemo(
        () => (pokemonList && defenderId !== null) ? pokemonList.find((p) => p.id === defenderId) ?? null : null,
        [pokemonList, defenderId],
    );

    // Attacker pokemon changes → reset move + recompute default Atk/SpA.
    useEffect(() => {
        setMoveId(null);
        if (attackerSummary) {
            setAtk(defaultStat(attackerSummary.stats.atk, level));
            setSpa(defaultStat(attackerSummary.stats.spa, level));
        } else {
            setAtk(0);
            setSpa(0);
        }
    }, [attackerSummary, level]);

    // Defender pokemon changes → recompute default HP/Def/SpD.
    useEffect(() => {
        if (defenderSummary) {
            setDefenderHp(defaultHp(defenderSummary.stats.hp, level));
            setDefenderDef(defaultStat(defenderSummary.stats.def, level));
            setDefenderSpd(defaultStat(defenderSummary.stats.spd, level));
        } else {
            setDefenderHp(0);
            setDefenderDef(0);
            setDefenderSpd(0);
        }
    }, [defenderSummary, level]);

    const damagingMoves = useMemo(
        () => attackerDetail.data ? dedupeDamagingMoves(attackerDetail.data.moves) : [],
        [attackerDetail.data],
    );

    const selectedMove = useMemo(
        () => damagingMoves.find((m) => m.id === moveId) ?? null,
        [damagingMoves, moveId],
    );

    const calc = useMemo(() => {
        if (!attackerSummary || !defenderSummary || !selectedMove) return null;
        const isPhysical = selectedMove.damageClass === 'physical';
        return runCalc({
            attackerType1: attackerSummary.type1,
            attackerType2: attackerSummary.type2,
            defenderType1: defenderSummary.type1,
            defenderType2: defenderSummary.type2,
            defenderHp,
            attackingStat: isPhysical ? atk : spa,
            defendingStat: isPhysical ? defenderDef : defenderSpd,
            level,
            move: selectedMove,
            isCritical: crit,
            mods,
            typeChart,
        });
    }, [attackerSummary, defenderSummary, selectedMove, typeChart, defenderHp, defenderDef, defenderSpd, atk, spa, level, crit, mods]);

    return (
        <section className="flex flex-col gap-6 px-6 py-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Damage calculator</h1>
                <p className="text-sm text-muted-foreground">
                    Applies STAB, dual-type effectiveness, critical hits, and the 0.85-1.00 random roll. Weather, screens, burn, items, and ability modifiers are in the modifier panel.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SideCard title="Attacker" tone="bg-orange-50 dark:bg-orange-900/20">
                    <Field label="Pokemon">
                        <PokemonPicker value={attackerId} onChange={setAttackerId} />
                    </Field>
                    <Field label="Move">
                        <Select
                            value={moveId !== null ? String(moveId) : ''}
                            onValueChange={(v) => setMoveId(v ? Number(v) : null)}
                            disabled={attackerId === null || damagingMoves.length === 0}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={
                                    attackerId === null ? 'Pick a Pokemon first'
                                        : damagingMoves.length === 0 ? 'No damaging moves'
                                        : 'Pick a move'
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {damagingMoves.map((m) => (
                                    <SelectItem key={m.id} value={String(m.id)}>
                                        <span className="flex items-center gap-2">
                                            <MoveClassIcon cls={m.damageClass} withTooltip={false} />
                                            <span>{m.displayName}</span>
                                            <TypePill name={capitalize(m.type)} className="text-[10px]" />
                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                {m.power}/{m.accuracy ?? '—'}
                                            </span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                        <Field label="Level">
                            <Input type="number" value={level} min={1} max={100}
                                onChange={(e) => setLevel(clampInt(e.target.value, 1, 100))} />
                        </Field>
                        <Field label="Attack">
                            <Input type="number" value={atk} min={0}
                                onChange={(e) => setAtk(clampInt(e.target.value, 0, 999))}
                                className={cn(selectedMove?.damageClass !== 'physical' && 'opacity-60')} />
                        </Field>
                        <Field label="Sp. Attack">
                            <Input type="number" value={spa} min={0}
                                onChange={(e) => setSpa(clampInt(e.target.value, 0, 999))}
                                className={cn(selectedMove?.damageClass !== 'special' && 'opacity-60')} />
                        </Field>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox checked={crit} onCheckedChange={(v) => setCrit(v === true)} />
                        <span className="text-sm">Critical hit (×1.5)</span>
                    </label>
                </SideCard>

                <SideCard title="Defender" tone="bg-blue-50 dark:bg-blue-900/20">
                    <Field label="Pokemon">
                        <PokemonPicker value={defenderId} onChange={setDefenderId} />
                    </Field>
                    {defenderSummary && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Sprite id={defenderSummary.id} className="h-8 w-8" />
                            <TypePill name={defenderSummary.type1} className="text-[10px]" />
                            {defenderSummary.type2 && <TypePill name={defenderSummary.type2} className="text-[10px]" />}
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                        <Field label="HP">
                            <Input type="number" value={defenderHp} min={1}
                                onChange={(e) => setDefenderHp(clampInt(e.target.value, 1, 9999))} />
                        </Field>
                        <Field label="Defense">
                            <Input type="number" value={defenderDef} min={1}
                                onChange={(e) => setDefenderDef(clampInt(e.target.value, 1, 999))}
                                className={cn(selectedMove?.damageClass !== 'physical' && 'opacity-60')} />
                        </Field>
                        <Field label="Sp. Def">
                            <Input type="number" value={defenderSpd} min={1}
                                onChange={(e) => setDefenderSpd(clampInt(e.target.value, 1, 999))}
                                className={cn(selectedMove?.damageClass !== 'special' && 'opacity-60')} />
                        </Field>
                    </div>
                </SideCard>
            </div>

            <ModifierPanel value={mods} onChange={setMods} />

            <ResultCard calc={calc} />
        </section>
    );
}

function SideCard({ title, tone, children }: { title: string; tone?: string; children: React.ReactNode }) {
    return (
        <div className={cn('rounded-md border p-4 flex flex-col gap-3', tone)}>
            <h2 className="dossier-eyebrow">{title}</h2>
            {children}
        </div>
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

