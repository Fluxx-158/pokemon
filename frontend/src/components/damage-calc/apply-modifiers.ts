// Bridge between ModifierState (UI) and DamageInput (lib). Computes the
// per-move concrete multipliers from the user's scenario flags so the lib
// stays decoupled from UI shape.

import {
    berryTriggers,
    defenderImmuneByAbility,
    screenMultiplier,
    weatherMultiplier,
    type DamageInput,
} from '@/lib/damage-calc';
import type { ModifierState } from './modifier-panel';

export interface ResolveContext {
    moveType: string;
    isPhysical: boolean;
    baseTypeMultiplier: number;
    isDoubles: boolean;
}

// The fields the caller already knows from the move + matchup, before the
// modifier panel layers on weather / screens / abilities / etc. Named so
// the function signature reads as base + mods + ctx instead of a 6-key Pick.
export type DamageBase = Pick<
    DamageInput,
    'level' | 'attackingStat' | 'defendingStat' | 'movePower' | 'isStab' | 'isCritical'
>;

export function applyModifiers(
    base: DamageBase,
    mods: ModifierState,
    ctx: ResolveContext,
): DamageInput {
    // Defender ability immunity short-circuits the type multiplier to 0.
    const immuneByAbility = defenderImmuneByAbility(mods.defenderImmunityAbility, ctx.moveType);
    const effectiveTypeMult = immuneByAbility ? 0 : ctx.baseTypeMultiplier;

    return {
        ...base,
        typeMultiplier: effectiveTypeMult,
        isPhysical: ctx.isPhysical,
        weatherMod: weatherMultiplier(mods.weather, ctx.moveType),
        isBurned: mods.burned,
        isSpread: mods.spread,
        screenMod: screenMultiplier(mods.screen, ctx.isPhysical, ctx.isDoubles),
        itemMod: mods.attackerItemBoost ? 1.2 : 1.0,
        adaptability: mods.adaptability,
        multiscale: mods.multiscale,
        filter: mods.filter,
        berryResist: berryTriggers(mods.defenderBerry, ctx.moveType, ctx.baseTypeMultiplier),
    };
}
