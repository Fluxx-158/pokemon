// Bring/lead recommendation scorer. Pure module — given a team, the
// opponent's 6 (as PokemonListItem entries), and the type chart, ranks every
// (bring 4, lead 2) combination by:
//
//   offensive  : your SE coverage on opponents (uses your members' actual moves)
//   defensive  : negative of opponents' STAB coverage on you (uses opp types)
//   speed      : count of your bring members faster than each opposing default Spe
//   bonuses    : Fake Out lead, Intimidate lead, Prankster + Tailwind in lead
//   penalties  : hard rules (don't lead Incineroar vs Kingambit because of
//                Defiant; don't lead Vanilluxe vs a sun setter because Snow
//                gets overwritten)
//
// Scores are summed and ranked descending. Each recommendation carries a list
// of human-readable rationale bullets so the UI can explain *why* it's the pick.

import {
    defaultStat,
    typeEffectiveness,
} from '@/lib/damage-calc';
import type {
    PokemonListItem,
    TeamMemberDetail,
} from '@/modules/api/endpoints';

type TypeChart = Record<string, Record<string, number>>;

export interface Recommendation {
    bringIds: number[];
    leadIds: number[];
    bring: TeamMemberDetail[];
    lead: TeamMemberDetail[];
    scores: {
        offensive: number;
        defensive: number;
        speed: number;
        bonuses: number;
        penalties: number;
        total: number;
    };
    notes: string[];          // human-readable bullets, top of list = strongest reason
    hardBlocked: boolean;     // a hard rule fired (penalty too large to come back from)
}

const SUN_SETTERS = new Set(['Charizard Mega Y', 'Torkoal', 'Houndoom Mega', 'Vulpix']);

function combinations<T>(arr: T[], k: number): T[][] {
    const out: T[][] = [];
    const n = arr.length;
    if (k > n || k < 0) return out;
    const idx = Array.from({ length: k }, (_, i) => i);
    while (true) {
        out.push(idx.map((i) => arr[i]));
        let i = k - 1;
        while (i >= 0 && idx[i] === n - k + i) i--;
        if (i < 0) break;
        idx[i]++;
        for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
    return out;
}

// log base 2 — converts type multipliers (1, 2, 4, 0.5, 0.25) into additive
// scores so we can sum them without a 4× advantage being collapsed into the
// same bucket as a 2× one.
function effScore(eff: number): number {
    if (eff === 0) return -2;
    return Math.log2(eff);
}

export function rankRecommendations(
    members: TeamMemberDetail[],
    opponents: PokemonListItem[],
    typeChart: TypeChart,
): Recommendation[] {
    if (members.length < 4 || opponents.length === 0) return [];

    const brings = combinations(members, 4);
    const out: Recommendation[] = [];

    for (const bring of brings) {
        const leadPairs = combinations(bring, 2);
        for (const lead of leadPairs) {
            const rec = scoreCombination(bring, lead, opponents, typeChart);
            out.push(rec);
        }
    }

    out.sort((a, b) => b.scores.total - a.scores.total);
    return out;
}

function scoreCombination(
    bring: TeamMemberDetail[],
    lead: TeamMemberDetail[],
    opponents: PokemonListItem[],
    typeChart: TypeChart,
): Recommendation {
    const notes: string[] = [];
    const opponentNames = new Set(opponents.map((o) => o.displayName));

    // Offensive: best move-type effectiveness any of your bring members has
    // against each opponent. Uses actual moves so a Greninja's Low Kick gets
    // credit for hitting Tyranitar 4×, not just its STAB types.
    let offensive = 0;
    const offensiveBest: Array<{ opp: string; mult: number; via: string | null }> = [];
    for (const opp of opponents) {
        let best = 1;
        let via: string | null = null;
        let viaMember: string | null = null;
        for (const m of bring) {
            for (const move of m.moves) {
                if (move.power === null) continue;
                const eff = typeEffectiveness(move.type, opp.type1, opp.type2, typeChart);
                if (eff > best) {
                    best = eff;
                    via = move.displayName;
                    viaMember = m.pokemon.displayName;
                }
            }
        }
        offensive += effScore(best);
        offensiveBest.push({
            opp: opp.displayName,
            mult: best,
            via: via && viaMember ? `${via} (${viaMember})` : null,
        });
    }
    const seHits = offensiveBest.filter((e) => e.mult >= 2).length;
    if (seHits >= 4) notes.push(`Strong offensive: ${seHits}/${opponents.length} opponents hit SE`);
    if (offensiveBest.some((e) => e.mult >= 4)) {
        const opp4x = offensiveBest.find((e) => e.mult >= 4);
        if (opp4x?.via) notes.push(`4× answer for ${opp4x.opp}: ${opp4x.via}`);
    }

    // Defensive: opponents' best STAB type vs each of your bring members.
    // We only have their declared types (no moves), so STAB is the closest
    // proxy for how badly they'll hurt you.
    let defensive = 0;
    let weakCount = 0;
    let weakestMember: { name: string; mult: number } | null = null;
    for (const m of bring) {
        let worst = 1;
        for (const opp of opponents) {
            const oppTypes = [opp.type1, opp.type2].filter((t): t is string => Boolean(t));
            for (const oppType of oppTypes) {
                const eff = typeEffectiveness(oppType, m.pokemon.type1, m.pokemon.type2, typeChart);
                if (eff > worst) worst = eff;
            }
        }
        defensive -= effScore(worst);
        if (worst >= 2) weakCount++;
        if (!weakestMember || worst > weakestMember.mult) {
            weakestMember = { name: m.pokemon.displayName, mult: worst };
        }
    }
    if (weakCount >= 3) notes.push(`Defensive risk: ${weakCount}/${bring.length} weak to opponent STAB`);
    if (weakestMember && weakestMember.mult >= 4) {
        notes.push(`Keep ${weakestMember.name} off field; 4× weak to opp STAB`);
    }

    // Speed: count of your bring members faster than the slowest expected
    // speed of each opponent (opp default at level 50, neutral, max IV, 0 EV).
    let speedScore = 0;
    let outsped = 0;
    for (const opp of opponents) {
        const oppSpe = defaultStat(opp.stats.spe, 50);
        for (const m of bring) {
            if (m.finalStats.spe > oppSpe) {
                speedScore += 0.5;
                outsped++;
            }
        }
    }
    if (outsped >= bring.length * opponents.length * 0.6) {
        notes.push(`Speed advantage: outspeeds ${outsped}/${bring.length * opponents.length} matchups`);
    }

    // Lead bonuses & penalties
    let bonuses = 0;
    let penalties = 0;
    let hardBlocked = false;

    const leadHasFakeOut = lead.some((m) => m.moves.some((mv) => mv.name === 'fake-out'));
    if (leadHasFakeOut) {
        bonuses += 1;
        notes.push('Fake Out lead: turn 1 tempo');
    }

    const leadHasIntimidate = lead.some((m) => m.ability.name === 'intimidate');
    if (leadHasIntimidate) {
        bonuses += 1;
        notes.push('Intimidate lead: drops both opponents Atk -1');
    }

    const leadHasPrankster = lead.some((m) => m.ability.name === 'prankster');
    const leadHasTailwind = lead.some((m) => m.moves.some((mv) => mv.name === 'tailwind'));
    if (leadHasPrankster && leadHasTailwind) {
        bonuses += 2;
        notes.push('Prankster + Tailwind in lead: guaranteed turn 1 speed');
    }

    // Hard rules: penalize so harshly the candidate falls out of top picks.
    if (opponentNames.has('Kingambit') && lead.some((m) => m.pokemon.displayName === 'Incineroar')) {
        penalties += 100;
        hardBlocked = true;
        notes.unshift('🚫 Hard rule: never lead Incineroar vs Kingambit (Defiant +2 Atk on Intimidate)');
    }
    const oppHasSunSetter = opponents.some((o) => SUN_SETTERS.has(o.displayName));
    if (oppHasSunSetter && lead.some((m) => m.pokemon.displayName === 'Vanilluxe')) {
        penalties += 100;
        hardBlocked = true;
        notes.unshift('🚫 Hard rule: never lead Vanilluxe vs sun setter (Snow gets overwritten)');
    }

    const total = offensive + defensive + speedScore + bonuses - penalties;

    return {
        bringIds: bring.map((m) => m.id),
        leadIds: lead.map((m) => m.id),
        bring,
        lead,
        scores: {
            offensive: Math.round(offensive * 100) / 100,
            defensive: Math.round(defensive * 100) / 100,
            speed: Math.round(speedScore * 100) / 100,
            bonuses,
            penalties,
            total: Math.round(total * 100) / 100,
        },
        notes,
        hardBlocked,
    };
}
