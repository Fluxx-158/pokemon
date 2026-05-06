import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './api-client';

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export type SpriteVariant = 'default' | 'official';

export function spriteUrl(id: number, variant: SpriteVariant = 'default'): string {
    const sub = variant === 'official' ? 'official/' : '';
    return `${baseUrl}/sprites/pokemon/${sub}${id}.png`;
}

export interface TypeListItem {
    id: number;
    name: string;
}

export type TypeChart = Record<string, Record<string, number>>;

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

export function getTypes(): Promise<TypeListItem[]> {
    return apiGet<TypeListItem[]>('/types');
}

export function getTypeChart(): Promise<TypeChart> {
    return apiGet<TypeChart>('/types/chart');
}

export function getPokemonList(): Promise<PokemonListItem[]> {
    return apiGet<PokemonListItem[]>('/pokemon');
}

export function getPokemonDetail(id: number): Promise<PokemonDetail> {
    return apiGet<PokemonDetail>(`/pokemon/${id}`);
}

export interface TeamListMember {
    id: number;
    slot: number;
    pokemonId: number;
    pokemonDisplayName: string;
    isMegaHolder: boolean;
}

export interface TeamListItem {
    id: number;
    name: string;
    sourceFolder: string;
    memberCount: number;
    megaHolderSlot: number | null;
    members: TeamListMember[];
    createdAt: string;
}

export interface TeamNotes {
    lead_pair?: string;
    back_pair?: string;
    mega_holder?: string;
    other?: string[];
}

export interface TeamMoveEntry {
    slot: number;
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
    pcAvailable: boolean;
    pcNotes: string | null;
}

export interface TeamMemberDetail {
    id: number;
    slot: number;
    pokemon: {
        id: number;
        name: string;
        displayName: string;
        type1: string;
        type2: string | null;
        // No `bst` here — the team detail endpoint returns just the six base
        // stats; BST isn't useful for in-team computations.
        baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
        isMega: boolean;
        isRegional: boolean;
        regionVariant: string | null;
        pcAvailable: boolean;
    };
    ability: {
        id: number;
        name: string;
        displayName: string;
        shortEffect: string | null;
        effect: string | null;
        pcChanged: boolean;
        pcNotes: string | null;
    };
    item: {
        id: number;
        name: string;
        displayName: string;
        category: string;
        shortEffect: string | null;
        effect: string | null;
        pcAvailable: boolean;
        pcNotes: string | null;
        isMegaStone: boolean;
    } | null;
    nature: string;
    natureEffect: {
        plus: 'atk' | 'def' | 'spa' | 'spd' | 'spe' | null;
        minus: 'atk' | 'def' | 'spa' | 'spd' | 'spe' | null;
    };
    evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
    ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number } | null;
    finalStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
    moves: TeamMoveEntry[];
}

export interface MatchupFrontmatter {
    result: string | null;
    encountered: string | null;
    opponent_lead: string[] | null;
    opponent_brought: string[] | null;
    opponent_six: string[] | null;
}

export interface MatchupSummary {
    slug: string;
    title: string;
    frontmatter: MatchupFrontmatter;
}

export interface MatchupSearchResult {
    teamId: number;
    teamName: string;
    teamSourceFolder: string;
    slug: string;
    title: string;
    frontmatter: MatchupFrontmatter;
    excerpt?: string;
}

export function searchMatchups(opts: { q?: string; teamId?: number } = {}): Promise<MatchupSearchResult[]> {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.teamId !== undefined) params.set('teamId', String(opts.teamId));
    const qs = params.toString();
    return apiGet<MatchupSearchResult[]>(`/matchups${qs ? `?${qs}` : ''}`);
}

export interface MatchupDetail {
    slug: string;
    title: string;
    markdown: string;
    frontmatter: MatchupFrontmatter;
}

export interface TeamDetail {
    id: number;
    name: string;
    sourceFolder: string;
    notes: TeamNotes | null;
    megaHolderSlot: number | null;
    createdAt: string;
    updatedAt: string;
    members: TeamMemberDetail[];
    strategyMarkdown: string | null;
    matchups: MatchupSummary[];
}

export function getTeams(): Promise<TeamListItem[]> {
    return apiGet<TeamListItem[]>('/teams');
}

export function getTeamDetail(id: number): Promise<TeamDetail> {
    return apiGet<TeamDetail>(`/teams/${id}`);
}

export interface CreateTeamRequest {
    sourceFolder: string;
    markdown: string;
}

export function createTeam(req: CreateTeamRequest): Promise<TeamDetail> {
    return apiPost<TeamDetail>('/teams', req);
}

export function updateTeam(id: number, req: { markdown: string }): Promise<TeamDetail> {
    return apiPut<TeamDetail>(`/teams/${id}`, req);
}

export function renameTeam(id: number, req: { name?: string; sourceFolder?: string }): Promise<TeamDetail> {
    return apiPatch<TeamDetail>(`/teams/${id}`, req);
}

export function deleteTeam(id: number): Promise<void> {
    return apiDelete(`/teams/${id}`);
}

export function updateTeamStrategy(id: number, req: { markdown: string }): Promise<TeamDetail> {
    return apiPut<TeamDetail>(`/teams/${id}/strategy`, req);
}

export function getMatchup(id: number, slug: string): Promise<MatchupDetail> {
    return apiGet<MatchupDetail>(`/teams/${id}/matchups/${encodeURIComponent(slug)}`);
}

export function createMatchup(id: number, req: { slug: string; markdown: string }): Promise<MatchupDetail> {
    return apiPost<MatchupDetail>(`/teams/${id}/matchups`, req);
}

export function updateMatchup(id: number, slug: string, req: { markdown: string }): Promise<MatchupDetail> {
    return apiPut<MatchupDetail>(`/teams/${id}/matchups/${encodeURIComponent(slug)}`, req);
}

export function deleteMatchup(id: number, slug: string): Promise<void> {
    return apiDelete(`/teams/${id}/matchups/${encodeURIComponent(slug)}`);
}

export interface ItemListItem {
    id: number;
    name: string;
    displayName: string;
    category: string;
    isHoldable: boolean;
    pcAvailable: boolean;
    shortEffect: string | null;
    pcNotes: string | null;
}

export function getItems(opts: { holdable?: boolean; pcOnly?: boolean } = {}): Promise<ItemListItem[]> {
    const params = new URLSearchParams();
    if (opts.holdable) params.set('holdable', 'true');
    if (opts.pcOnly) params.set('pcOnly', 'true');
    const qs = params.toString();
    return apiGet<ItemListItem[]>(`/items${qs ? `?${qs}` : ''}`);
}

// ---- Backdrops ----
// User-uploaded image / video backdrops. The backend writes them to
// frontend/public/backdrops/ which Vite serves at /backdrops/<name>;
// the `url` returned here is a relative path the <Backdrop> component
// hands straight to <img> / <video>.

export interface BackdropEntry {
    name: string;
    kind: 'image' | 'video';
    mimeType: string;
    size: number;
    url: string;
    createdAt: number;
}

export function getBackdrops(): Promise<BackdropEntry[]> {
    return apiGet<BackdropEntry[]>('/backdrops');
}

export function uploadBackdrop(input: {
    filename: string;
    mimeType: string;
    dataBase64: string;
}): Promise<BackdropEntry> {
    return apiPost<BackdropEntry>('/backdrops', input);
}

export function deleteBackdrop(name: string): Promise<void> {
    return apiDelete(`/backdrops/${encodeURIComponent(name)}`);
}
