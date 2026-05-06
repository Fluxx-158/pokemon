import { Injectable } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import { Datasource } from '../db/datasource';
import { AbilitiesTable } from '../db/schema/abilities';
import { ItemsTable } from '../db/schema/items';
import { MegaEvolutionsTable } from '../db/schema/mega-evolutions';
import { MovesTable } from '../db/schema/moves';
import { PokemonAbilitiesTable, PokemonMovesTable, PokemonTable } from '../db/schema/pokemon';
import { TypesTable } from '../db/schema/types';
import { BusinessException } from '../infrastructure/exceptions';

export interface PokemonStats {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
    bst: number;
}

export interface PokemonListAbility {
    id: number;
    displayName: string;
    isHidden: boolean;
}

export interface PokemonListItem {
    id: number;
    name: string;
    displayName: string;
    type1: string;
    type2: string | null;
    stats: PokemonStats;
    generation: number | null;
    isMega: boolean;
    isRegional: boolean;
    regionVariant: string | null;
    pcAvailable: boolean;
    abilities: PokemonListAbility[];
}

export interface PokemonAbilityEntry {
    id: number;
    name: string;
    displayName: string;
    slot: number;
    isHidden: boolean;
    shortEffect: string | null;
    effect: string | null;
    pcChanged: boolean;
    pcNotes: string | null;
}

export interface PokemonMoveEntry {
    id: number;
    name: string;
    displayName: string;
    type: string;
    damageClass: string;
    power: number | null;
    accuracy: number | null;
    ppPc: number;
    priority: number;
    effectChance: number | null;
    shortEffect: string | null;
    effect: string | null;
    learnMethod: string;
    levelLearnedAt: number;
    pcAvailable: boolean;
    pcNotes: string | null;
}

export interface PokemonMegaEvolutionEntry {
    megaPokemonId: number;
    megaPokemonName: string;
    megaPokemonDisplayName: string;
    megaStoneId: number;
    megaStoneName: string;
    megaStoneDisplayName: string;
    megaStonePcAvailable: boolean;
    notes: string | null;
}

export interface PokemonBaseForm {
    id: number;
    name: string;
    displayName: string;
    stats: PokemonStats;
}

export interface PokemonDetail extends PokemonListItem {
    isDefault: boolean;
    pcNotes: string | null;
    abilities: PokemonAbilityEntry[];
    moves: PokemonMoveEntry[];
    megaEvolutions: PokemonMegaEvolutionEntry[];
    baseForm: PokemonBaseForm | null;
}

@Injectable()
export class PokemonService {

    constructor(private readonly datasource: Datasource) {}

    private async loadTypeMap(): Promise<Record<number, string>> {
        const rows = await this.datasource.db
            .select({ id: TypesTable.id, name: TypesTable.name })
            .from(TypesTable);
        const map: Record<number, string> = {};
        for (const r of rows) {
            map[r.id] = r.name;
        }
        return map;
    }

    async findAll(opts: { pcOnly?: boolean } = {}): Promise<PokemonListItem[]> {
        const typeMap = await this.loadTypeMap();

        let query = this.datasource.db
            .select({
                id: PokemonTable.id,
                name: PokemonTable.name,
                displayName: PokemonTable.displayName,
                type1Id: PokemonTable.type1Id,
                type2Id: PokemonTable.type2Id,
                generation: PokemonTable.generation,
                isMega: PokemonTable.isMega,
                isRegional: PokemonTable.isRegional,
                regionVariant: PokemonTable.regionVariant,
                pcAvailable: PokemonTable.pcAvailable,
                baseHp: PokemonTable.baseHp,
                baseAtk: PokemonTable.baseAtk,
                baseDef: PokemonTable.baseDef,
                baseSpa: PokemonTable.baseSpa,
                baseSpd: PokemonTable.baseSpd,
                baseSpe: PokemonTable.baseSpe,
                bst: PokemonTable.bst,
            })
            .from(PokemonTable)
            .$dynamic();

        if (opts.pcOnly) {
            query = query.where(eq(PokemonTable.pcAvailable, 1));
        }

        const rows = await query.orderBy(asc(PokemonTable.id));

        // Pull every (pokemon, ability) row and group by pokemon for the list
        // response. Two queries total instead of one-per-pokemon.
        const abilityRows = await this.datasource.db
            .select({
                pokemonId: PokemonAbilitiesTable.pokemonId,
                slot: PokemonAbilitiesTable.slot,
                isHidden: PokemonAbilitiesTable.isHidden,
                id: AbilitiesTable.id,
                displayName: AbilitiesTable.displayName,
            })
            .from(PokemonAbilitiesTable)
            .innerJoin(AbilitiesTable, eq(AbilitiesTable.id, PokemonAbilitiesTable.abilityId))
            .orderBy(asc(PokemonAbilitiesTable.pokemonId), asc(PokemonAbilitiesTable.slot));
        const abilitiesByPokemon = new Map<number, PokemonListAbility[]>();
        for (const a of abilityRows) {
            const list = abilitiesByPokemon.get(a.pokemonId) ?? [];
            list.push({ id: a.id, displayName: a.displayName, isHidden: a.isHidden === 1 });
            abilitiesByPokemon.set(a.pokemonId, list);
        }

        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            displayName: r.displayName,
            type1: typeMap[r.type1Id],
            type2: r.type2Id !== null ? typeMap[r.type2Id] : null,
            stats: {
                hp: r.baseHp,
                atk: r.baseAtk,
                def: r.baseDef,
                spa: r.baseSpa,
                spd: r.baseSpd,
                spe: r.baseSpe,
                bst: r.bst,
            },
            generation: r.generation,
            isMega: r.isMega === 1,
            isRegional: r.isRegional === 1,
            regionVariant: r.regionVariant,
            pcAvailable: r.pcAvailable === 1,
            abilities: abilitiesByPokemon.get(r.id) ?? [],
        }));
    }

    async findById(id: number): Promise<PokemonDetail> {
        const baseRows = await this.datasource.db
            .select({
                id: PokemonTable.id,
                name: PokemonTable.name,
                displayName: PokemonTable.displayName,
                type1Id: PokemonTable.type1Id,
                type2Id: PokemonTable.type2Id,
                generation: PokemonTable.generation,
                isDefault: PokemonTable.isDefault,
                isMega: PokemonTable.isMega,
                isRegional: PokemonTable.isRegional,
                regionVariant: PokemonTable.regionVariant,
                pcAvailable: PokemonTable.pcAvailable,
                pcNotes: PokemonTable.pcNotes,
                baseHp: PokemonTable.baseHp,
                baseAtk: PokemonTable.baseAtk,
                baseDef: PokemonTable.baseDef,
                baseSpa: PokemonTable.baseSpa,
                baseSpd: PokemonTable.baseSpd,
                baseSpe: PokemonTable.baseSpe,
                bst: PokemonTable.bst,
            })
            .from(PokemonTable)
            .where(eq(PokemonTable.id, id))
            .limit(1);

        if (baseRows.length === 0) {
            throw new BusinessException({
                message: `Pokemon not found: ${id}`,
                code: 'POKEMON_NOT_FOUND',
                httpStatus: 404,
            });
        }
        const base = baseRows[0];

        // For mega forms, look up the canonical base form (a single mega can come
        // from multiple bases — e.g. Floette + Floette-Eternal share Mega Floette —
        // so prefer the default species when more than one is on file).
        const baseFormPromise = base.isMega === 1
            ? this.datasource.db
                .select({
                    id: PokemonTable.id,
                    name: PokemonTable.name,
                    displayName: PokemonTable.displayName,
                    baseHp: PokemonTable.baseHp,
                    baseAtk: PokemonTable.baseAtk,
                    baseDef: PokemonTable.baseDef,
                    baseSpa: PokemonTable.baseSpa,
                    baseSpd: PokemonTable.baseSpd,
                    baseSpe: PokemonTable.baseSpe,
                    bst: PokemonTable.bst,
                    isDefault: PokemonTable.isDefault,
                })
                .from(MegaEvolutionsTable)
                .innerJoin(PokemonTable, eq(PokemonTable.id, MegaEvolutionsTable.basePokemonId))
                .where(eq(MegaEvolutionsTable.megaPokemonId, id))
                .orderBy(desc(PokemonTable.isDefault), asc(PokemonTable.id))
                .limit(1)
            : Promise.resolve([] as Array<{
                id: number; name: string; displayName: string;
                baseHp: number; baseAtk: number; baseDef: number;
                baseSpa: number; baseSpd: number; baseSpe: number;
                bst: number; isDefault: number;
            }>);

        const [typeMap, abilityRows, moveRows, megaRows, baseFormRows] = await Promise.all([
            this.loadTypeMap(),
            this.datasource.db
                .select({
                    id: AbilitiesTable.id,
                    name: AbilitiesTable.name,
                    displayName: AbilitiesTable.displayName,
                    slot: PokemonAbilitiesTable.slot,
                    isHidden: PokemonAbilitiesTable.isHidden,
                    shortEffect: AbilitiesTable.shortEffect,
                    effect: AbilitiesTable.effect,
                    pcChanged: AbilitiesTable.pcChanged,
                    pcNotes: AbilitiesTable.pcNotes,
                })
                .from(PokemonAbilitiesTable)
                .innerJoin(AbilitiesTable, eq(AbilitiesTable.id, PokemonAbilitiesTable.abilityId))
                .where(eq(PokemonAbilitiesTable.pokemonId, id))
                .orderBy(asc(PokemonAbilitiesTable.slot)),
            this.datasource.db
                .select({
                    id: MovesTable.id,
                    name: MovesTable.name,
                    displayName: MovesTable.displayName,
                    type: MovesTable.typeName,
                    damageClass: MovesTable.damageClass,
                    power: MovesTable.power,
                    accuracy: MovesTable.accuracy,
                    ppPc: MovesTable.ppPc,
                    priority: MovesTable.priority,
                    effectChance: MovesTable.effectChance,
                    shortEffect: MovesTable.shortEffect,
                    effect: MovesTable.effect,
                    learnMethod: PokemonMovesTable.learnMethod,
                    levelLearnedAt: PokemonMovesTable.levelLearnedAt,
                    pcAvailable: PokemonMovesTable.pcAvailable,
                    pcNotes: PokemonMovesTable.pcNotes,
                })
                .from(PokemonMovesTable)
                .innerJoin(MovesTable, eq(MovesTable.id, PokemonMovesTable.moveId))
                .where(eq(PokemonMovesTable.pokemonId, id))
                .orderBy(asc(MovesTable.name)),
            this.datasource.db
                .select({
                    megaPokemonId: PokemonTable.id,
                    megaPokemonName: PokemonTable.name,
                    megaPokemonDisplayName: PokemonTable.displayName,
                    megaStoneId: ItemsTable.id,
                    megaStoneName: ItemsTable.name,
                    megaStoneDisplayName: ItemsTable.displayName,
                    megaStonePcAvailable: ItemsTable.pcAvailable,
                    notes: MegaEvolutionsTable.notes,
                })
                .from(MegaEvolutionsTable)
                .innerJoin(PokemonTable, eq(PokemonTable.id, MegaEvolutionsTable.megaPokemonId))
                .innerJoin(ItemsTable, eq(ItemsTable.id, MegaEvolutionsTable.megaStoneId))
                .where(eq(MegaEvolutionsTable.basePokemonId, id)),
            baseFormPromise,
        ]);

        const baseForm: PokemonBaseForm | null = baseFormRows.length > 0
            ? {
                id: baseFormRows[0].id,
                name: baseFormRows[0].name,
                displayName: baseFormRows[0].displayName,
                stats: {
                    hp: baseFormRows[0].baseHp,
                    atk: baseFormRows[0].baseAtk,
                    def: baseFormRows[0].baseDef,
                    spa: baseFormRows[0].baseSpa,
                    spd: baseFormRows[0].baseSpd,
                    spe: baseFormRows[0].baseSpe,
                    bst: baseFormRows[0].bst,
                },
            }
            : null;

        return {
            id: base.id,
            name: base.name,
            displayName: base.displayName,
            type1: typeMap[base.type1Id],
            type2: base.type2Id !== null ? typeMap[base.type2Id] : null,
            stats: {
                hp: base.baseHp,
                atk: base.baseAtk,
                def: base.baseDef,
                spa: base.baseSpa,
                spd: base.baseSpd,
                spe: base.baseSpe,
                bst: base.bst,
            },
            generation: base.generation,
            isDefault: base.isDefault === 1,
            isMega: base.isMega === 1,
            isRegional: base.isRegional === 1,
            regionVariant: base.regionVariant,
            pcAvailable: base.pcAvailable === 1,
            pcNotes: base.pcNotes,
            abilities: abilityRows.map((a) => ({
                id: a.id,
                name: a.name,
                displayName: a.displayName,
                slot: a.slot,
                isHidden: a.isHidden === 1,
                shortEffect: a.shortEffect,
                effect: a.effect,
                pcChanged: a.pcChanged === 1,
                pcNotes: a.pcNotes,
            })),
            moves: moveRows.map((m) => ({
                id: m.id,
                name: m.name,
                displayName: m.displayName,
                type: m.type,
                damageClass: m.damageClass,
                power: m.power,
                accuracy: m.accuracy,
                ppPc: m.ppPc,
                priority: m.priority,
                effectChance: m.effectChance,
                shortEffect: m.shortEffect,
                effect: m.effect,
                learnMethod: m.learnMethod,
                levelLearnedAt: m.levelLearnedAt,
                pcAvailable: m.pcAvailable === 1,
                pcNotes: m.pcNotes,
            })),
            baseForm,
            megaEvolutions: megaRows.map((me) => ({
                megaPokemonId: me.megaPokemonId,
                megaPokemonName: me.megaPokemonName,
                megaPokemonDisplayName: me.megaPokemonDisplayName,
                megaStoneId: me.megaStoneId,
                megaStoneName: me.megaStoneName,
                megaStoneDisplayName: me.megaStoneDisplayName,
                megaStonePcAvailable: me.megaStonePcAvailable === 1,
                notes: me.notes,
            })),
        };
    }
}
