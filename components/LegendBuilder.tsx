"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode, RefObject } from "react";
import type { Continent, LegendData, LegendPlayer, PositionCode, ScoreKey, ScoreMode } from "@/lib/legend-data";
import { defaultTactics, simulateMatch } from "@/lib/simulation";
import type { RandomnessLevel, SimulatedMatchResult, SimulationTactics, SimulationTeamInput } from "@/lib/simulation";

type TabId =
  | "atlas"
  | "hall"
  | "depth"
  | "battle"
  | "era"
  | "timeline"
  | "draft"
  | "challenge"
  | "quiz"
  | "shortlist"
  | "sim"
  | "tournament"
  | "season"
  | "best-xi"
  | "rankings"
  | "compare";
type WeightMap = Record<ScoreKey, number>;
type FilterValue = "ALL";
type PitchRole = Exclude<PositionCode, "LEGEND">;
type LegendTierId = "pantheon" | "all-time" | "national" | "borderline" | "watchlist" | "archive";
type SimTeamSource = "country" | "current" | "saved" | "world";
type SimMatchMode = "best-of-3" | "home-away" | "single";
type TournamentSize = 4 | 8;

type SimSeriesMatch = {
  homeTeamId: string;
  label: string;
  result: SimulatedMatchResult;
};

type SimSeriesPlayerLeader = {
  assists: number;
  averageRating: number;
  goals: number;
  matches: number;
  playerId: string;
  playerName: string;
  teamId: string;
};

type SimHistoryEntry = {
  createdAt: string;
  id: string;
  matchCount: number;
  mode: SimMatchMode;
  randomness: RandomnessLevel;
  seed: string;
  teamAGoals: number;
  teamAName: string;
  teamAWins: number;
  teamAXg: number;
  teamBGoals: number;
  teamBName: string;
  teamBWins: number;
  teamBXg: number;
  winnerName: string;
};

type TournamentMatch = {
  id: string;
  label: string;
  result: SimulatedMatchResult;
  stage: "Final" | "Quarterfinal" | "Semifinal";
  teamA: SimulationTeamInput;
  teamB: SimulationTeamInput;
  winner: SimulationTeamInput;
};

type TournamentRun = {
  champion: SimulationTeamInput;
  countries: string[];
  createdAt: string;
  matches: TournamentMatch[];
  seed: string;
  size: TournamentSize;
};

type SeasonMatch = {
  awayTeam: SimulationTeamInput;
  homeTeam: SimulationTeamInput;
  id: string;
  label: string;
  result: SimulatedMatchResult;
  round: number;
};

type SeasonStanding = {
  draws: number;
  ga: number;
  gd: number;
  gf: number;
  losses: number;
  played: number;
  points: number;
  rank: number;
  team: SimulationTeamInput;
  wins: number;
  xgAgainst: number;
  xgFor: number;
};

type SeasonPlayerLeader = SimSeriesPlayerLeader & {
  ratingTotal: number;
  teamName: string;
};

type SeasonRun = {
  champion: SimulationTeamInput;
  countries: string[];
  createdAt: string;
  leaders: {
    assists: SeasonPlayerLeader[];
    goals: SeasonPlayerLeader[];
    mvp: SeasonPlayerLeader[];
    rating: SeasonPlayerLeader[];
  };
  matches: SeasonMatch[];
  seed: string;
  standings: SeasonStanding[];
};

type LegendTier = {
  id: LegendTierId;
  label: string;
  range: string;
};

type EraId = "foundations" | "classic" | "global-tv" | "modern" | "current" | "unplaced";

type EraOption = {
  id: EraId;
  label: string;
  range: string;
  start: number;
  end: number;
};

type FormationSlot = {
  id: string;
  label: string;
  accepts: PositionCode[];
  left: number;
  top: number;
};

type SlotPosition = {
  left: number;
  top: number;
};

type DragPoint = {
  clientX: number;
  clientY: number;
};

type SavedSlot = {
  slotId: string;
  slotLabel: string;
  playerId: string;
  playerName: string;
  rating: number;
  position: SlotPosition;
};

type SavedSquad = {
  id: string;
  name: string;
  scope: string;
  formationId: string;
  formationName: string;
  createdAt: string;
  weights: WeightMap;
  slots: SavedSlot[];
};

type DepthPositionRow = {
  average: number;
  count: number;
  players: LegendPlayer[];
  position: PositionCode;
  topScore: number;
};

type BattleCountryProfile = {
  average: number;
  country: string;
  players: LegendPlayer[];
  rows: DepthPositionRow[];
  strengths: DepthPositionRow[];
  summary?: LegendData["countries"][number];
  topPlayers: LegendPlayer[];
  topScore: number;
  weaknesses: DepthPositionRow[];
  xiAverage: number;
  xiStarters: Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;
};

type PositionBattleRow = {
  advantage: "A" | "B" | "EVEN";
  left: DepthPositionRow;
  position: PositionCode;
  right: DepthPositionRow;
};

type DraftPick = {
  pickNumber: number;
  playerId: string;
  teamIndex: number;
};

type ChallengeId = "world-max" | "non-europe" | "africa-asia" | "americas" | "under-90" | "modern" | "classic";

type ChallengeOption = {
  description: string;
  difficulty: string;
  formationId: string;
  id: ChallengeId;
  label: string;
  target: number;
  test: (player: LegendPlayer) => boolean;
};

const scoreLabels: Record<ScoreKey, string> = {
  teamCareer: "팀 커리어",
  individualCareer: "개인 수상",
  primeSkill: "프라임 실력",
  teamImportance: "팀 내 비중",
  legacy: "100년 뒤 존재감",
};

const scoreModeLabels: Record<ScoreMode, string> = {
  anchor: "앵커",
  computed: "계산",
  adjusted: "보정",
};

const legendTiers: LegendTier[] = [
  { id: "pantheon", label: "Pantheon Legend", range: "95-100" },
  { id: "all-time", label: "All-Time Legend", range: "90-94" },
  { id: "national", label: "National / Continental Legend", range: "85-89" },
  { id: "borderline", label: "Cult / Borderline Legend", range: "80-84" },
  { id: "watchlist", label: "Watchlist", range: "75-79" },
  { id: "archive", label: "Archive / Remove Candidate", range: "0-74" },
];

const eraOptions: EraOption[] = [
  { id: "foundations", label: "Foundations", range: "1930-1959", start: 1930, end: 1959 },
  { id: "classic", label: "Classic Era", range: "1960-1979", start: 1960, end: 1979 },
  { id: "global-tv", label: "Global TV Era", range: "1980-1999", start: 1980, end: 1999 },
  { id: "modern", label: "Modern Elite", range: "2000-2015", start: 2000, end: 2015 },
  { id: "current", label: "Current Era", range: "2016-2026", start: 2016, end: 2026 },
  { id: "unplaced", label: "Unplaced", range: "needs years", start: 0, end: 0 },
];

const challengeOptions: ChallengeOption[] = [
  {
    id: "world-max",
    label: "World Max XI",
    description: "국가와 시대 제한 없이 현재 가중치에서 가장 높은 자동 XI를 만듭니다.",
    difficulty: "Baseline",
    formationId: "4-3-3",
    target: 96,
    test: () => true,
  },
  {
    id: "non-europe",
    label: "No Europe XI",
    description: "유럽 선수를 모두 제외하고 월드 클래스 XI를 구성합니다.",
    difficulty: "Hard",
    formationId: "4-2-3-1",
    target: 92,
    test: (player) => player.continent !== "Europe",
  },
  {
    id: "africa-asia",
    label: "Africa + Asia Union",
    description: "아프리카와 아시아 선수만으로 균형 잡힌 XI를 만듭니다.",
    difficulty: "Expert",
    formationId: "4-3-3",
    target: 87,
    test: (player) => player.continent === "Africa" || player.continent === "Asia",
  },
  {
    id: "americas",
    label: "Americas Only",
    description: "남북미 선수만으로 공격력과 창조성을 극대화합니다.",
    difficulty: "Medium",
    formationId: "3-4-3",
    target: 93,
    test: (player) => player.continent === "America",
  },
  {
    id: "under-90",
    label: "Sub-90 Legends",
    description: "90점 미만 선수만 골라 저평가 레전드 XI를 만듭니다.",
    difficulty: "Expert",
    formationId: "4-4-2",
    target: 86,
    test: (player) => player.overallScore < 90,
  },
  {
    id: "modern",
    label: "Modern + Current",
    description: "2000년대 이후 프라임 선수 중심으로 현시대형 XI를 만듭니다.",
    difficulty: "Medium",
    formationId: "4-2-3-1",
    target: 94,
    test: (player) => ["modern", "current"].includes(getPlayerEra(player).id),
  },
  {
    id: "classic",
    label: "Classic Memory",
    description: "1979년 이전 대표 연도 선수만으로 클래식 XI를 구성합니다.",
    difficulty: "Hard",
    formationId: "3-5-2",
    target: 90,
    test: (player) => ["foundations", "classic"].includes(getPlayerEra(player).id),
  },
];

const positionOptions: PositionCode[] = ["ST", "SS", "RW", "LW", "AM", "CM", "DM", "CB", "RB", "LB", "GK"];
const continentOptions: Continent[] = ["America", "Europe", "Asia", "Africa"];
const pitchZones: Array<{ role: PitchRole; left: number; top: number; width: number; height: number }> = [
  { role: "LW", left: 5, top: 8, width: 28, height: 34 },
  { role: "ST", left: 35, top: 8, width: 30, height: 20 },
  { role: "RW", left: 67, top: 8, width: 28, height: 34 },
  { role: "SS", left: 38, top: 28, width: 24, height: 12 },
  { role: "AM", left: 34, top: 42, width: 32, height: 12 },
  { role: "CM", left: 26, top: 54, width: 48, height: 12 },
  { role: "LB", left: 5, top: 64, width: 24, height: 22 },
  { role: "DM", left: 30, top: 66, width: 40, height: 10 },
  { role: "RB", left: 71, top: 64, width: 24, height: 22 },
  { role: "CB", left: 30, top: 76, width: 40, height: 10 },
  { role: "GK", left: 38, top: 86, width: 24, height: 8 },
];

const initialWeights: WeightMap = {
  teamCareer: 25,
  individualCareer: 20,
  primeSkill: 30,
  teamImportance: 20,
  legacy: 15,
};

const formations: Record<string, { name: string; slots: FormationSlot[] }> = {
  "4-3-3": {
    name: "4-3-3",
    slots: [
      { id: "gk", label: "GK", accepts: ["GK"], left: 50, top: 88 },
      { id: "lb", label: "LB", accepts: ["LB", "CB"], left: 16, top: 70 },
      { id: "lcb", label: "CB", accepts: ["CB", "DM"], left: 38, top: 72 },
      { id: "rcb", label: "CB", accepts: ["CB", "DM"], left: 62, top: 72 },
      { id: "rb", label: "RB", accepts: ["RB", "CB"], left: 84, top: 70 },
      { id: "dm", label: "DM", accepts: ["DM", "CM"], left: 50, top: 56 },
      { id: "lcm", label: "CM", accepts: ["CM", "AM", "DM"], left: 32, top: 45 },
      { id: "rcm", label: "CM", accepts: ["CM", "AM", "DM"], left: 68, top: 45 },
      { id: "lw", label: "LW", accepts: ["LW", "SS", "AM"], left: 20, top: 24 },
      { id: "st", label: "ST", accepts: ["ST", "SS"], left: 50, top: 18 },
      { id: "rw", label: "RW", accepts: ["RW", "SS", "AM"], left: 80, top: 24 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    slots: [
      { id: "gk", label: "GK", accepts: ["GK"], left: 50, top: 88 },
      { id: "lb", label: "LB", accepts: ["LB", "CB"], left: 16, top: 70 },
      { id: "lcb", label: "CB", accepts: ["CB", "DM"], left: 38, top: 72 },
      { id: "rcb", label: "CB", accepts: ["CB", "DM"], left: 62, top: 72 },
      { id: "rb", label: "RB", accepts: ["RB", "CB"], left: 84, top: 70 },
      { id: "ldm", label: "DM", accepts: ["DM", "CM"], left: 38, top: 55 },
      { id: "rdm", label: "DM", accepts: ["DM", "CM"], left: 62, top: 55 },
      { id: "lam", label: "LW", accepts: ["LW", "AM", "SS"], left: 22, top: 34 },
      { id: "am", label: "AM", accepts: ["AM", "SS", "CM"], left: 50, top: 32 },
      { id: "ram", label: "RW", accepts: ["RW", "AM", "SS"], left: 78, top: 34 },
      { id: "st", label: "ST", accepts: ["ST", "SS"], left: 50, top: 16 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    slots: [
      { id: "gk", label: "GK", accepts: ["GK"], left: 50, top: 88 },
      { id: "lb", label: "LB", accepts: ["LB", "CB"], left: 16, top: 70 },
      { id: "lcb", label: "CB", accepts: ["CB", "DM"], left: 38, top: 72 },
      { id: "rcb", label: "CB", accepts: ["CB", "DM"], left: 62, top: 72 },
      { id: "rb", label: "RB", accepts: ["RB", "CB"], left: 84, top: 70 },
      { id: "lm", label: "LW", accepts: ["LW", "AM", "CM"], left: 18, top: 47 },
      { id: "lcm", label: "CM", accepts: ["CM", "DM", "AM"], left: 40, top: 50 },
      { id: "rcm", label: "CM", accepts: ["CM", "DM", "AM"], left: 60, top: 50 },
      { id: "rm", label: "RW", accepts: ["RW", "AM", "CM"], left: 82, top: 47 },
      { id: "lst", label: "ST", accepts: ["ST", "SS"], left: 39, top: 22 },
      { id: "rst", label: "SS", accepts: ["SS", "ST", "AM"], left: 61, top: 22 },
    ],
  },
  "3-4-3": {
    name: "3-4-3",
    slots: [
      { id: "gk", label: "GK", accepts: ["GK"], left: 50, top: 88 },
      { id: "lcb", label: "CB", accepts: ["CB", "LB", "DM"], left: 30, top: 72 },
      { id: "cb", label: "CB", accepts: ["CB", "DM"], left: 50, top: 74 },
      { id: "rcb", label: "CB", accepts: ["CB", "RB", "DM"], left: 70, top: 72 },
      { id: "lwb", label: "LWB", accepts: ["LB", "LW", "CM"], left: 16, top: 50 },
      { id: "lcm", label: "CM", accepts: ["CM", "DM", "AM"], left: 40, top: 50 },
      { id: "rcm", label: "CM", accepts: ["CM", "DM", "AM"], left: 60, top: 50 },
      { id: "rwb", label: "RWB", accepts: ["RB", "RW", "CM"], left: 84, top: 50 },
      { id: "lw", label: "LW", accepts: ["LW", "SS", "AM"], left: 20, top: 24 },
      { id: "st", label: "ST", accepts: ["ST", "SS"], left: 50, top: 16 },
      { id: "rw", label: "RW", accepts: ["RW", "SS", "AM"], left: 80, top: 24 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    slots: [
      { id: "gk", label: "GK", accepts: ["GK"], left: 50, top: 88 },
      { id: "lcb", label: "CB", accepts: ["CB", "LB", "DM"], left: 30, top: 72 },
      { id: "cb", label: "CB", accepts: ["CB", "DM"], left: 50, top: 74 },
      { id: "rcb", label: "CB", accepts: ["CB", "RB", "DM"], left: 70, top: 72 },
      { id: "lm", label: "LWB", accepts: ["LB", "LW", "CM"], left: 14, top: 49 },
      { id: "dm", label: "DM", accepts: ["DM", "CM"], left: 50, top: 56 },
      { id: "lcm", label: "CM", accepts: ["CM", "AM", "DM"], left: 34, top: 43 },
      { id: "rcm", label: "CM", accepts: ["CM", "AM", "DM"], left: 66, top: 43 },
      { id: "rm", label: "RWB", accepts: ["RB", "RW", "CM"], left: 86, top: 49 },
      { id: "lst", label: "ST", accepts: ["ST", "SS"], left: 39, top: 20 },
      { id: "rst", label: "SS", accepts: ["SS", "ST", "AM"], left: 61, top: 20 },
    ],
  },
};

const storageKey = "football-legends-xi.saved-squads.v2";
const slotPositionsStorageKey = "football-legends-xi.slot-positions.v1";
const slotRolesStorageKey = "football-legends-xi.slot-roles.v1";
const shortlistStorageKey = "football-legends-xi.shortlist.v1";
const simHistoryStorageKey = "football-legends-xi.sim-history.v1";

export function LegendBuilder({ data }: { data: LegendData }) {
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const activeDragSlotRef = useRef<string | null>(null);
  const dragStartPositionsRef = useRef<Record<string, SlotPosition>>({});
  const defaultCountry = data.countries.find((country) => country.name === "Brazil")?.name ?? data.countries[0]?.name ?? "";
  const defaultBattleCountry = data.countries.find((country) => country.name === "Argentina")?.name ?? data.countries[1]?.name ?? defaultCountry;
  const defaultTournamentCountries = getDefaultTournamentCountries(data.countries);
  const [activeTab, setActiveTab] = useState<TabId>("atlas");
  const [atlasContinent, setAtlasContinent] = useState<Continent | null>("America");
  const [atlasCountry, setAtlasCountry] = useState(defaultCountry);
  const [formationId, setFormationId] = useState("4-3-3");
  const [weights, setWeights] = useState<WeightMap>(initialWeights);
  const [builderContinent, setBuilderContinent] = useState<Continent | FilterValue>("ALL");
  const [builderCountry, setBuilderCountry] = useState<string | FilterValue>("ALL");
  const [builderPosition, setBuilderPosition] = useState<PositionCode | FilterValue>("ALL");
  const [builderTier, setBuilderTier] = useState<LegendTierId | FilterValue>("ALL");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [hallContinent, setHallContinent] = useState<Continent | FilterValue>("ALL");
  const [hallCountry, setHallCountry] = useState<string | FilterValue>("ALL");
  const [hallPosition, setHallPosition] = useState<PositionCode | FilterValue>("ALL");
  const [hallTier, setHallTier] = useState<LegendTierId | FilterValue>("ALL");
  const [hallQuery, setHallQuery] = useState("");
  const [depthContinent, setDepthContinent] = useState<Continent | FilterValue>("America");
  const [depthCountry, setDepthCountry] = useState(defaultCountry);
  const [depthPosition, setDepthPosition] = useState<PositionCode | FilterValue>("ALL");
  const [depthQuery, setDepthQuery] = useState("");
  const [battleContinentA, setBattleContinentA] = useState<Continent | FilterValue>("America");
  const [battleCountryA, setBattleCountryA] = useState(defaultCountry);
  const [battleContinentB, setBattleContinentB] = useState<Continent | FilterValue>("America");
  const [battleCountryB, setBattleCountryB] = useState(defaultBattleCountry);
  const [eraA, setEraA] = useState<EraId>("classic");
  const [eraB, setEraB] = useState<EraId>("modern");
  const [draftTeamCount, setDraftTeamCount] = useState(2);
  const [draftRounds, setDraftRounds] = useState(11);
  const [draftContinent, setDraftContinent] = useState<Continent | FilterValue>("ALL");
  const [draftCountry, setDraftCountry] = useState<string | FilterValue>("ALL");
  const [draftPosition, setDraftPosition] = useState<PositionCode | FilterValue>("ALL");
  const [draftTier, setDraftTier] = useState<LegendTierId | FilterValue>("ALL");
  const [draftQuery, setDraftQuery] = useState("");
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [challengeId, setChallengeId] = useState<ChallengeId>("non-europe");
  const [simTeamASource, setSimTeamASource] = useState<SimTeamSource>("current");
  const [simTeamBSource, setSimTeamBSource] = useState<SimTeamSource>("country");
  const [simTeamACountry, setSimTeamACountry] = useState(defaultCountry);
  const [simTeamBCountry, setSimTeamBCountry] = useState(defaultBattleCountry);
  const [simTeamASavedId, setSimTeamASavedId] = useState("");
  const [simTeamBSavedId, setSimTeamBSavedId] = useState("");
  const [simTacticsA, setSimTacticsA] = useState<SimulationTactics>({ ...defaultTactics, style: "possession" });
  const [simTacticsB, setSimTacticsB] = useState<SimulationTactics>({ ...defaultTactics, style: "counter" });
  const [simMatchMode, setSimMatchMode] = useState<SimMatchMode>("single");
  const [simSeed, setSimSeed] = useState("legends-match-1");
  const [simRandomness, setSimRandomness] = useState<RandomnessLevel>("normal");
  const [simResult, setSimResult] = useState<SimulatedMatchResult | null>(null);
  const [simSeriesResults, setSimSeriesResults] = useState<SimSeriesMatch[]>([]);
  const [simHistory, setSimHistory] = useState<SimHistoryEntry[]>([]);
  const [tournamentSize, setTournamentSize] = useState<TournamentSize>(4);
  const [tournamentCountries, setTournamentCountries] = useState<string[]>(defaultTournamentCountries);
  const [tournamentRun, setTournamentRun] = useState<TournamentRun | null>(null);
  const [seasonCountries, setSeasonCountries] = useState<string[]>(defaultTournamentCountries.slice(0, 4));
  const [seasonRun, setSeasonRun] = useState<SeasonRun | null>(null);
  const [compareQuery, setCompareQuery] = useState("");
  const [rankingContinent, setRankingContinent] = useState<Continent | FilterValue>("ALL");
  const [rankingCountry, setRankingCountry] = useState<string | FilterValue>("ALL");
  const [rankingPosition, setRankingPosition] = useState<PositionCode | FilterValue>("ALL");
  const [rankingTier, setRankingTier] = useState<LegendTierId | FilterValue>("ALL");
  const [rankingQuery, setRankingQuery] = useState("");
  const [topOnly, setTopOnly] = useState(true);
  const [manualSlots, setManualSlots] = useState<Record<string, string>>({});
  const [selectedSlotId, setSelectedSlotId] = useState("st");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>([]);
  const [exportedSquadText, setExportedSquadText] = useState("");
  const [slotPositions, setSlotPositions] = useState<Record<string, Record<string, SlotPosition>>>({});
  const [slotRoles, setSlotRoles] = useState<Record<string, Record<string, PitchRole>>>({});
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [dropTargetSlotId, setDropTargetSlotId] = useState<string | null>(null);
  const [dropTargetRole, setDropTargetRole] = useState<PitchRole | null>(null);

  const formation = formations[formationId];
  const effectiveSlots = useMemo(
    () =>
      formation.slots.map((slot) => {
        const role = slotRoles[formationId]?.[slot.id] ?? getDefaultSlotRole(slot);
        return { ...slot, label: role, accepts: [role] };
      }),
    [formation.slots, formationId, slotRoles],
  );
  const currentSlotPositions = slotPositions[formationId] ?? {};
  const playerById = useMemo(() => new Map(data.players.map((player) => [player.id, player])), [data.players]);
  const selectedPlayer = selectedPlayerId ? playerById.get(selectedPlayerId) ?? null : null;
  const selectedSlot = effectiveSlots.find((slot) => slot.id === selectedSlotId) ?? effectiveSlots[0];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        setSavedSquads(JSON.parse(raw) as SavedSquad[]);
      }
    } catch {
      setSavedSquads([]);
    }

    try {
      const raw = window.localStorage.getItem(slotPositionsStorageKey);
      if (raw) {
        setSlotPositions(JSON.parse(raw) as Record<string, Record<string, SlotPosition>>);
      }
    } catch {
      setSlotPositions({});
    }

    try {
      const raw = window.localStorage.getItem(slotRolesStorageKey);
      if (raw) {
        setSlotRoles(JSON.parse(raw) as Record<string, Record<string, PitchRole>>);
      }
    } catch {
      setSlotRoles({});
    }

    try {
      const raw = window.localStorage.getItem(shortlistStorageKey);
      if (raw) {
        setShortlistIds(JSON.parse(raw) as string[]);
      }
    } catch {
      setShortlistIds([]);
    }

    try {
      const raw = window.localStorage.getItem(simHistoryStorageKey);
      if (raw) {
        setSimHistory(JSON.parse(raw) as SimHistoryEntry[]);
      }
    } catch {
      setSimHistory([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(savedSquads));
  }, [savedSquads]);

  useEffect(() => {
    window.localStorage.setItem(slotPositionsStorageKey, JSON.stringify(slotPositions));
  }, [slotPositions]);

  useEffect(() => {
    window.localStorage.setItem(slotRolesStorageKey, JSON.stringify(slotRoles));
  }, [slotRoles]);

  useEffect(() => {
    window.localStorage.setItem(shortlistStorageKey, JSON.stringify(shortlistIds));
  }, [shortlistIds]);

  useEffect(() => {
    window.localStorage.setItem(simHistoryStorageKey, JSON.stringify(simHistory));
  }, [simHistory]);

  useEffect(() => {
    if (atlasContinent && !data.countries.some((country) => country.name === atlasCountry && country.continent === atlasContinent)) {
      setAtlasCountry(data.countries.find((country) => country.continent === atlasContinent)?.name ?? defaultCountry);
    }
  }, [atlasContinent, atlasCountry, data.countries, defaultCountry]);

  useEffect(() => {
    if (depthContinent === "ALL") {
      if (!data.countries.some((country) => country.name === depthCountry)) {
        setDepthCountry(defaultCountry);
      }
      return;
    }

    if (!data.countries.some((country) => country.name === depthCountry && country.continent === depthContinent)) {
      setDepthCountry(data.countries.find((country) => country.continent === depthContinent)?.name ?? defaultCountry);
    }
  }, [data.countries, defaultCountry, depthContinent, depthCountry]);

  useEffect(() => {
    if (battleContinentA !== "ALL" && !data.countries.some((country) => country.name === battleCountryA && country.continent === battleContinentA)) {
      setBattleCountryA(data.countries.find((country) => country.continent === battleContinentA)?.name ?? defaultCountry);
    }

    if (battleContinentB !== "ALL" && !data.countries.some((country) => country.name === battleCountryB && country.continent === battleContinentB)) {
      setBattleCountryB(data.countries.find((country) => country.continent === battleContinentB)?.name ?? defaultBattleCountry);
    }
  }, [battleContinentA, battleContinentB, battleCountryA, battleCountryB, data.countries, defaultBattleCountry, defaultCountry]);

  const builderCountries = useMemo(
    () =>
      data.countries.filter((country) => builderContinent === "ALL" || country.continent === builderContinent),
    [builderContinent, data.countries],
  );

  const hallCountries = useMemo(
    () =>
      data.countries.filter((country) => hallContinent === "ALL" || country.continent === hallContinent),
    [data.countries, hallContinent],
  );

  const depthCountries = useMemo(
    () =>
      data.countries.filter((country) => depthContinent === "ALL" || country.continent === depthContinent),
    [data.countries, depthContinent],
  );

  const battleCountriesA = useMemo(
    () =>
      data.countries.filter((country) => battleContinentA === "ALL" || country.continent === battleContinentA),
    [battleContinentA, data.countries],
  );

  const battleCountriesB = useMemo(
    () =>
      data.countries.filter((country) => battleContinentB === "ALL" || country.continent === battleContinentB),
    [battleContinentB, data.countries],
  );

  const draftCountries = useMemo(
    () =>
      data.countries.filter((country) => draftContinent === "ALL" || country.continent === draftContinent),
    [data.countries, draftContinent],
  );

  const rankingCountries = useMemo(
    () =>
      data.countries.filter((country) => rankingContinent === "ALL" || country.continent === rankingContinent),
    [data.countries, rankingContinent],
  );

  const candidatePlayers = useMemo(() => {
    const normalizedQuery = candidateQuery.trim().toLowerCase();
    return data.players
      .filter((player) => builderContinent === "ALL" || player.continent === builderContinent)
      .filter((player) => builderCountry === "ALL" || player.country === builderCountry)
      .filter((player) => builderPosition === "ALL" || player.primaryPosition === builderPosition)
      .filter((player) => builderTier === "ALL" || getLegendTier(player.overallScore).id === builderTier)
      .filter((player) => !topOnly || player.topTierRank !== null)
      .filter((player) => !normalizedQuery || matchesPlayerSearch(player, normalizedQuery))
      .map((player) => ({ player, rating: ratePlayerForSlot(player, selectedSlot, weights) }))
      .sort(
        (a, b) =>
          getPlayerSearchRank(a.player, normalizedQuery) - getPlayerSearchRank(b.player, normalizedQuery) ||
          b.rating - a.rating ||
          (a.player.topTierRank ?? 999) - (b.player.topTierRank ?? 999),
      )
      .slice(0, 80);
  }, [
    builderContinent,
    builderCountry,
    builderPosition,
    builderTier,
    candidateQuery,
    selectedSlot,
    data.players,
    topOnly,
    weights,
  ]);

  const squad = useMemo(
    () => buildSquad(candidatePlayers.map(({ player }) => player), data.players, effectiveSlots, weights, manualSlots),
    [candidatePlayers, data.players, effectiveSlots, manualSlots, weights],
  );

  const starters = effectiveSlots
    .map((slot) => {
      const selected = squad[slot.id];
      return selected ? { slot, player: selected.player, rating: selected.rating } : null;
    })
    .filter(Boolean) as Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;

  const averageRating = starters.length
    ? Math.round(starters.reduce((sum, starter) => sum + starter.rating, 0) / starters.length)
    : 0;

  const simTeamA = useMemo(
    () =>
      createSimulationTeam(
        "team-a",
        simTeamASource,
        simTeamACountry,
        simTeamASavedId,
        starters,
        data.players,
        savedSquads,
        playerById,
        weights,
        formation.name,
      ),
    [data.players, formation.name, playerById, savedSquads, simTeamACountry, simTeamASavedId, simTeamASource, starters, weights],
  );
  const simTeamB = useMemo(
    () =>
      createSimulationTeam(
        "team-b",
        simTeamBSource,
        simTeamBCountry,
        simTeamBSavedId,
        starters,
        data.players,
        savedSquads,
        playerById,
        weights,
        formation.name,
      ),
    [data.players, formation.name, playerById, savedSquads, simTeamBCountry, simTeamBSavedId, simTeamBSource, starters, weights],
  );

  const rankingPool = useMemo(() => {
    const normalizedQuery = rankingQuery.trim().toLowerCase();
    return data.players
      .filter((player) => rankingContinent === "ALL" || player.continent === rankingContinent)
      .filter((player) => rankingCountry === "ALL" || player.country === rankingCountry)
      .filter((player) => rankingPosition === "ALL" || player.primaryPosition === rankingPosition)
      .filter((player) => rankingTier === "ALL" || getLegendTier(player.overallScore).id === rankingTier)
      .filter((player) => !normalizedQuery || matchesPlayerSearch(player, normalizedQuery))
      .map((player) => ({ player, rating: ratePlayer(player, weights) }))
      .sort(
        (a, b) =>
          getPlayerSearchRank(a.player, normalizedQuery) - getPlayerSearchRank(b.player, normalizedQuery) ||
          b.rating - a.rating ||
          (a.player.topTierRank ?? 999) - (b.player.topTierRank ?? 999),
      );
  }, [data.players, rankingContinent, rankingCountry, rankingPosition, rankingQuery, rankingTier, weights]);

  const rankingPlayers = rankingPool.slice(0, 150);
  const rankingSummary = {
    average: average(rankingPool.map((item) => item.rating)),
    count: rankingPool.length,
    topScore: rankingPool[0]?.rating ?? 0,
  };

  const hallPlayers = useMemo(() => {
    const normalizedQuery = hallQuery.trim().toLowerCase();
    return data.players
      .filter((player) => hallContinent === "ALL" || player.continent === hallContinent)
      .filter((player) => hallCountry === "ALL" || player.country === hallCountry)
      .filter((player) => hallPosition === "ALL" || player.primaryPosition === hallPosition)
      .filter((player) => hallTier === "ALL" || getLegendTier(player.overallScore).id === hallTier)
      .filter((player) => !normalizedQuery || matchesPlayerSearch(player, normalizedQuery))
      .sort(
        (a, b) =>
          getPlayerSearchRank(a, normalizedQuery) - getPlayerSearchRank(b, normalizedQuery) ||
          b.overallScore - a.overallScore ||
          (a.topTierRank ?? 999) - (b.topTierRank ?? 999) ||
          a.name.localeCompare(b.name),
      );
  }, [data.players, hallContinent, hallCountry, hallPosition, hallQuery, hallTier]);

  const hallTierCounts = useMemo(
    () =>
      data.players.reduce<Record<LegendTierId, number>>(
        (counts, player) => {
          counts[getLegendTier(player.overallScore).id] += 1;
          return counts;
        },
        {
          pantheon: 0,
          "all-time": 0,
          national: 0,
          borderline: 0,
          watchlist: 0,
          archive: 0,
        },
      ),
    [data.players],
  );

  const hallSummary = {
    average: average(hallPlayers.map((player) => player.overallScore)),
    count: hallPlayers.length,
    topScore: hallPlayers[0]?.overallScore ?? 0,
  };

  const depthCountryPlayers = useMemo(
    () =>
      data.players
        .filter((player) => player.country === depthCountry)
        .sort((a, b) => b.overallScore - a.overallScore || a.positionOrder - b.positionOrder || a.name.localeCompare(b.name)),
    [data.players, depthCountry],
  );

  const depthPlayers = useMemo(() => {
    const normalizedQuery = depthQuery.trim().toLowerCase();
    return depthCountryPlayers
      .filter((player) => depthPosition === "ALL" || player.primaryPosition === depthPosition)
      .filter((player) => !normalizedQuery || matchesPlayerSearch(player, normalizedQuery));
  }, [depthCountryPlayers, depthPosition, depthQuery]);

  const depthRows = useMemo<DepthPositionRow[]>(
    () =>
      positionOptions.map((position) => {
        const players = depthCountryPlayers.filter((player) => player.primaryPosition === position);
        const topPlayers = players.slice(0, 3);
        return {
          average: average(topPlayers.map((player) => player.overallScore)),
          count: players.length,
          players,
          position,
          topScore: players[0]?.overallScore ?? 0,
        };
      }),
    [depthCountryPlayers],
  );

  const depthCountrySummary = data.countries.find((country) => country.name === depthCountry);
  const strongestDepthRows = depthRows.filter((row) => row.count > 0).sort((a, b) => b.average - a.average || b.count - a.count).slice(0, 3);
  const weakestDepthRows = depthRows.filter((row) => row.count > 0).sort((a, b) => a.average - b.average || a.count - b.count).slice(0, 3);
  const emptyDepthRows = depthRows.filter((row) => row.count === 0);
  const depthSummary = {
    average: average(depthCountryPlayers.slice(0, 10).map((player) => player.overallScore)),
    count: depthCountryPlayers.length,
    topScore: depthCountryPlayers[0]?.overallScore ?? 0,
  };

  const battleLeftProfile = useMemo(
    () => buildBattleCountryProfile(battleCountryA, data.players, data.countries, weights),
    [battleCountryA, data.countries, data.players, weights],
  );
  const battleRightProfile = useMemo(
    () => buildBattleCountryProfile(battleCountryB, data.players, data.countries, weights),
    [battleCountryB, data.countries, data.players, weights],
  );
  const battleRows = useMemo(
    () =>
      positionOptions.map((position) => {
        const left = battleLeftProfile.rows.find((row) => row.position === position) ?? createEmptyDepthRow(position);
        const right = battleRightProfile.rows.find((row) => row.position === position) ?? createEmptyDepthRow(position);
        const gap = left.average - right.average;
        return {
          advantage: Math.abs(gap) <= 1 ? "EVEN" : gap > 0 ? "A" : "B",
          left,
          position,
          right,
        } satisfies PositionBattleRow;
      }),
    [battleLeftProfile.rows, battleRightProfile.rows],
  );
  const battleWinner =
    battleLeftProfile.xiAverage === battleRightProfile.xiAverage
      ? "Even"
      : battleLeftProfile.xiAverage > battleRightProfile.xiAverage
        ? battleLeftProfile.country
        : battleRightProfile.country;

  const eraCounts = useMemo(
    () =>
      data.players.reduce<Record<EraId, number>>(
        (counts, player) => {
          counts[getPlayerEra(player).id] += 1;
          return counts;
        },
        {
          foundations: 0,
          classic: 0,
          "global-tv": 0,
          modern: 0,
          current: 0,
          unplaced: 0,
        },
      ),
    [data.players],
  );
  const eraLeftProfile = useMemo(
    () => buildBattleEraProfile(eraA, data.players, weights),
    [data.players, eraA, weights],
  );
  const eraRightProfile = useMemo(
    () => buildBattleEraProfile(eraB, data.players, weights),
    [data.players, eraB, weights],
  );
  const eraRows = useMemo(
    () =>
      positionOptions.map((position) => {
        const left = eraLeftProfile.rows.find((row) => row.position === position) ?? createEmptyDepthRow(position);
        const right = eraRightProfile.rows.find((row) => row.position === position) ?? createEmptyDepthRow(position);
        const gap = left.average - right.average;
        return {
          advantage: Math.abs(gap) <= 1 ? "EVEN" : gap > 0 ? "A" : "B",
          left,
          position,
          right,
        } satisfies PositionBattleRow;
      }),
    [eraLeftProfile.rows, eraRightProfile.rows],
  );
  const eraWinner =
    eraLeftProfile.xiAverage === eraRightProfile.xiAverage
      ? "Even"
      : eraLeftProfile.xiAverage > eraRightProfile.xiAverage
        ? eraLeftProfile.country
        : eraRightProfile.country;

  const draftPickedIds = useMemo(() => new Set(draftPicks.map((pick) => pick.playerId)), [draftPicks]);
  const draftCandidates = useMemo(() => {
    const normalizedQuery = draftQuery.trim().toLowerCase();
    return data.players
      .filter((player) => !draftPickedIds.has(player.id))
      .filter((player) => draftContinent === "ALL" || player.continent === draftContinent)
      .filter((player) => draftCountry === "ALL" || player.country === draftCountry)
      .filter((player) => draftPosition === "ALL" || player.primaryPosition === draftPosition)
      .filter((player) => draftTier === "ALL" || getLegendTier(player.overallScore).id === draftTier)
      .filter((player) => !normalizedQuery || matchesPlayerSearch(player, normalizedQuery))
      .map((player) => ({ player, rating: ratePlayer(player, weights) }))
      .sort(
        (a, b) =>
          getPlayerSearchRank(a.player, normalizedQuery) - getPlayerSearchRank(b.player, normalizedQuery) ||
          b.rating - a.rating ||
          (a.player.topTierRank ?? 999) - (b.player.topTierRank ?? 999) ||
          a.player.name.localeCompare(b.player.name),
      )
      .slice(0, 120);
  }, [data.players, draftContinent, draftCountry, draftPickedIds, draftPosition, draftQuery, draftTier, weights]);

  function draftPlayer(playerId: string) {
    setDraftPicks((current) => {
      const maxPicks = draftTeamCount * draftRounds;
      if (current.length >= maxPicks || current.some((pick) => pick.playerId === playerId)) {
        return current;
      }

      return [
        ...current,
        {
          pickNumber: current.length + 1,
          playerId,
          teamIndex: getSnakeDraftTeamIndex(current.length, draftTeamCount),
        },
      ];
    });
    setSelectedPlayerId(playerId);
  }

  const atlasPlayers = useMemo(
    () =>
      data.players
        .filter((player) => player.country === atlasCountry)
        .sort((a, b) => positionOptions.indexOf(a.primaryPosition) - positionOptions.indexOf(b.primaryPosition) || a.positionOrder - b.positionOrder),
    [atlasCountry, data.players],
  );

  const selectedCountrySummary = data.countries.find((country) => country.name === atlasCountry);
  const selectedCountryTop = atlasPlayers
    .map((player) => ({ player, rating: player.overallScore }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);

  function updateWeight(key: ScoreKey, value: number) {
    setWeights((current) => ({ ...current, [key]: value }));
  }

  function getSlotPosition(slot: FormationSlot) {
    return currentSlotPositions[slot.id] ?? { left: slot.left, top: slot.top };
  }

  function getSlotPositionsForDrag() {
    return formation.slots.reduce<Record<string, SlotPosition>>((positions, slot) => {
      positions[slot.id] = getSlotPosition(slot);
      return positions;
    }, {});
  }

  function getPointerPitchPosition(event: DragPoint) {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    return {
      left: clamp(((event.clientX - rect.left) / rect.width) * 100, 7, 93),
      top: clamp(((event.clientY - rect.top) / rect.height) * 100, 8, 92),
    };
  }

  function findDropTargetSlotId(sourceSlotId: string, position: SlotPosition) {
    const referencePositions = dragStartPositionsRef.current;
    let nearest: { id: string; distance: number } | null = null;

    for (const slot of formation.slots) {
      if (slot.id === sourceSlotId) {
        continue;
      }

      const slotPosition = referencePositions[slot.id] ?? { left: slot.left, top: slot.top };
      const distance = Math.hypot(position.left - slotPosition.left, (position.top - slotPosition.top) * 1.25);

      if (!nearest || distance < nearest.distance) {
        nearest = { id: slot.id, distance };
      }
    }

    return nearest && nearest.distance <= 9 ? nearest.id : null;
  }

  function updateSlotPosition(slotId: string, event: DragPoint) {
    const position = getPointerPitchPosition(event);
    if (!position) {
      return;
    }

    const nextPosition = {
      left: Math.round(position.left * 10) / 10,
      top: Math.round(position.top * 10) / 10,
    };

    setSlotPositions((current) => ({
      ...current,
      [formationId]: {
        ...(current[formationId] ?? {}),
        [slotId]: nextPosition,
      },
    }));
    setDropTargetSlotId(findDropTargetSlotId(slotId, nextPosition));
    setDropTargetRole(findPitchRole(nextPosition));
  }

  function finalizeSlotDrag(slotId: string, event: DragPoint) {
    const position = getPointerPitchPosition(event);
    const targetSlotId = position ? findDropTargetSlotId(slotId, position) : null;
    const targetRole = position ? findPitchRole(position) : null;
    activeDragSlotRef.current = null;
    setDraggingSlotId(null);
    setDropTargetSlotId(null);
    setDropTargetRole(null);

    if (!targetSlotId || targetSlotId === slotId) {
      const sourcePlayer = squad[slotId]?.player;

      if (targetRole) {
        setSlotRoles((current) => ({
          ...current,
          [formationId]: {
            ...(current[formationId] ?? {}),
            [slotId]: targetRole,
          },
        }));
      }

      if (sourcePlayer) {
        setManualSlots((current) => ({ ...current, [slotId]: sourcePlayer.id }));
      }
      return;
    }

    const sourcePlayer = squad[slotId]?.player;
    const targetPlayer = squad[targetSlotId]?.player;

    if (!sourcePlayer) {
      return;
    }

    setManualSlots((current) => {
      const next = { ...current };
      next[targetSlotId] = sourcePlayer.id;

      if (targetPlayer) {
        next[slotId] = targetPlayer.id;
      } else {
        delete next[slotId];
      }

      return next;
    });
    setSelectedSlotId(targetSlotId);
    setSlotPositions((current) => ({
      ...current,
      [formationId]: dragStartPositionsRef.current,
    }));
  }

  function assignPlayerToSelectedSlot(playerId: string) {
    setManualSlots((current) => ({ ...current, [selectedSlot.id]: playerId }));
    setSelectedPlayerId(playerId);
  }

  function resetCurrentFormationPositions() {
    setSlotPositions((current) => {
      const next = { ...current };
      delete next[formationId];
      return next;
    });
    setSlotRoles((current) => {
      const next = { ...current };
      delete next[formationId];
      return next;
    });
  }

  function saveCurrentSquad() {
    const scope = builderCountry !== "ALL" ? builderCountry : builderContinent !== "ALL" ? builderContinent : "World";
    const slots: SavedSlot[] = starters.map(({ slot, player, rating }) => ({
      slotId: slot.id,
      slotLabel: slot.label,
      playerId: player.id,
      playerName: player.name,
      rating,
      position: getSlotPosition(slot),
    }));

    const now = new Date();
    setSavedSquads((current) => {
      const saved: SavedSquad = {
        id: `${scope}-${formationId}-${now.getTime()}`,
        name: `${scope} ${formation.name} #${current.length + 1}`,
        scope,
        formationId,
        formationName: formation.name,
        createdAt: now.toISOString(),
        weights,
        slots,
      };

      return [saved, ...current].slice(0, 20);
    });
  }

  function loadSavedSquad(saved: SavedSquad) {
    const nextManualSlots = saved.slots.reduce<Record<string, string>>((slots, slot) => {
      slots[slot.slotId] = slot.playerId;
      return slots;
    }, {});
    const nextPositions = saved.slots.reduce<Record<string, SlotPosition>>((positions, slot) => {
      positions[slot.slotId] = slot.position;
      return positions;
    }, {});
    const nextRoles = saved.slots.reduce<Record<string, PitchRole>>((roles, slot) => {
      if (isPitchRole(slot.slotLabel)) {
        roles[slot.slotId] = slot.slotLabel;
      }
      return roles;
    }, {});

    setFormationId(saved.formationId);
    setWeights(saved.weights);
    setManualSlots(nextManualSlots);
    setSlotPositions((current) => ({ ...current, [saved.formationId]: nextPositions }));
    setSlotRoles((current) => ({ ...current, [saved.formationId]: nextRoles }));
    setSelectedSlotId(saved.slots[0]?.slotId ?? formations[saved.formationId]?.slots[0]?.id ?? "st");
    setSelectedPlayerId(saved.slots[0]?.playerId ?? null);
    setActiveTab("best-xi");
  }

  function deleteSavedSquad(savedId: string) {
    setSavedSquads((current) => current.filter((saved) => saved.id !== savedId));
  }

  function renameSavedSquad(savedId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setSavedSquads((current) => current.map((saved) => (saved.id === savedId ? { ...saved, name: trimmed } : saved)));
  }

  function exportCurrentSquad() {
    const scope = builderCountry !== "ALL" ? builderCountry : builderContinent !== "ALL" ? builderContinent : "World";
    setExportedSquadText(formatSquadExport(scope, formation.name, starters, averageRating));
  }

  function getDraftTeamStarters(teamIndex: number) {
    const draftFormation = formations["4-3-3"];
    const players = draftPicks
      .filter((pick) => pick.teamIndex === teamIndex)
      .map((pick) => playerById.get(pick.playerId))
      .filter(Boolean) as LegendPlayer[];
    const draftSquad = buildSquad(players, players, draftFormation.slots, weights, {});

    return draftFormation.slots
      .map((slot) => {
        const selected = draftSquad[slot.id];
        return selected ? { slot, player: selected.player, rating: selected.rating } : null;
      })
      .filter(Boolean) as Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;
  }

  function openDraftTeamBestXi(teamIndex: number) {
    const draftFormation = formations["4-3-3"];
    const draftStarters = getDraftTeamStarters(teamIndex);
    const nextManualSlots = draftStarters.reduce<Record<string, string>>((slots, starter) => {
      slots[starter.slot.id] = starter.player.id;
      return slots;
    }, {});

    setFormationId("4-3-3");
    setBuilderContinent("ALL");
    setBuilderCountry("ALL");
    setBuilderPosition("ALL");
    setBuilderTier("ALL");
    setCandidateQuery("");
    setTopOnly(false);
    setManualSlots(nextManualSlots);
    setSelectedSlotId(draftStarters[0]?.slot.id ?? draftFormation.slots[0]?.id ?? "st");
    setSelectedPlayerId(draftStarters[0]?.player.id ?? null);
    setActiveTab("best-xi");
  }

  function saveDraftTeamBestXi(teamIndex: number) {
    const draftFormation = formations["4-3-3"];
    const draftStarters = getDraftTeamStarters(teamIndex);
    if (!draftStarters.length) {
      return;
    }

    const now = new Date();
    const slots: SavedSlot[] = draftStarters.map(({ player, rating, slot }) => ({
      slotId: slot.id,
      slotLabel: slot.label,
      playerId: player.id,
      playerName: player.name,
      rating,
      position: { left: slot.left, top: slot.top },
    }));

    setSavedSquads((current) => {
      const saved: SavedSquad = {
        id: `Draft-Team-${teamIndex + 1}-${now.getTime()}`,
        name: `Draft Team ${teamIndex + 1} ${draftFormation.name}`,
        scope: `Draft Team ${teamIndex + 1}`,
        formationId: "4-3-3",
        formationName: draftFormation.name,
        createdAt: now.toISOString(),
        weights,
        slots,
      };

      return [saved, ...current].slice(0, 20);
    });
  }

  function openStartersInBestXi(startersToOpen: Array<{ slot: FormationSlot; player: LegendPlayer }>, source: string, sourceFormationId: string) {
    const sourceFormation = formations[sourceFormationId] ?? formations["4-3-3"];
    const nextManualSlots = startersToOpen.reduce<Record<string, string>>((slots, starter) => {
      slots[starter.slot.id] = starter.player.id;
      return slots;
    }, {});

    setFormationId(sourceFormationId);
    setBuilderContinent("ALL");
    setBuilderCountry("ALL");
    setBuilderPosition("ALL");
    setBuilderTier("ALL");
    setCandidateQuery(source);
    setTopOnly(false);
    setManualSlots(nextManualSlots);
    setSelectedSlotId(startersToOpen[0]?.slot.id ?? sourceFormation.slots[0]?.id ?? "st");
    setSelectedPlayerId(startersToOpen[0]?.player.id ?? null);
    setActiveTab("best-xi");
  }

  function saveStartersAsSquad(
    startersToSave: Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>,
    source: string,
    sourceFormationId: string,
  ) {
    if (!startersToSave.length) {
      return;
    }

    const sourceFormation = formations[sourceFormationId] ?? formations["4-3-3"];
    const now = new Date();
    const slots: SavedSlot[] = startersToSave.map(({ player, rating, slot }) => ({
      slotId: slot.id,
      slotLabel: slot.label,
      playerId: player.id,
      playerName: player.name,
      rating,
      position: { left: slot.left, top: slot.top },
    }));

    setSavedSquads((current) => {
      const saved: SavedSquad = {
        id: `${source}-${sourceFormationId}-${now.getTime()}`,
        name: `${source} ${sourceFormation.name}`,
        scope: source,
        formationId: sourceFormationId,
        formationName: sourceFormation.name,
        createdAt: now.toISOString(),
        weights,
        slots,
      };

      return [saved, ...current].slice(0, 20);
    });
  }

  function runSimulation(nextSeed?: string) {
    if (simTeamA.slots.length < 7 || simTeamB.slots.length < 7) {
      return;
    }

    const seed = nextSeed ?? (simSeed.trim() || `legends-match-${Date.now()}`);
    const matches = runSimulationSeries(simTeamA, simTeamB, simTacticsA, simTacticsB, simRandomness, seed, simMatchMode);
    const historyEntry = createSimHistoryEntry(matches, simTeamA, simTeamB, simMatchMode, simRandomness, seed);
    setSimSeed(seed);
    setSimSeriesResults(matches);
    setSimResult(matches[matches.length - 1]?.result ?? null);
    setSimHistory((current) => [historyEntry, ...current].slice(0, 30));
  }

  function updateSimMatchMode(value: SimMatchMode) {
    setSimMatchMode(value);
    setSimSeriesResults([]);
    setSimResult(null);
  }

  function clearSimHistory() {
    setSimHistory([]);
  }

  function updateTournamentCountry(index: number, country: string) {
    setTournamentCountries((current) => current.map((item, itemIndex) => (itemIndex === index ? country : item)));
    setTournamentRun(null);
  }

  function updateTournamentSize(value: TournamentSize) {
    setTournamentSize(value);
    setTournamentCountries((current) => ensureUniqueTournamentCountries(current, data.countries, value));
    setTournamentRun(null);
  }

  function runTournament() {
    const countries = ensureUniqueTournamentCountries(tournamentCountries, data.countries, tournamentSize);
    const teams = countries.map((country, index) =>
      createSimulationTeam(`tournament-${index + 1}`, "country", country, "", starters, data.players, savedSquads, playerById, weights, formation.name),
    );

    if (teams.some((team) => team.slots.length < 7)) {
      return;
    }

    const seed = `tournament-${Date.now()}`;
    const run = createTournamentRun(teams, countries, tournamentSize, seed, simRandomness);

    setTournamentCountries(countries);
    setTournamentRun(run);
  }

  function updateSeasonCountry(index: number, country: string) {
    setSeasonCountries((current) => current.map((item, itemIndex) => (itemIndex === index ? country : item)));
    setSeasonRun(null);
  }

  function runSeason() {
    const countries = ensureUniqueTournamentCountries(seasonCountries, data.countries, 4);
    const teams = countries.map((country, index) =>
      createSimulationTeam(`season-${index + 1}`, "country", country, "", starters, data.players, savedSquads, playerById, weights, formation.name),
    );

    if (teams.some((team) => team.slots.length < 7)) {
      return;
    }

    const seed = `season-${Date.now()}`;
    const run = createSeasonRun(teams, countries, seed, simRandomness);

    setSeasonCountries(countries);
    setSeasonRun(run);
  }

  function toggleShortlist(playerId: string) {
    setShortlistIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }

      return [playerId, ...current].slice(0, 100);
    });
  }

  function toggleCompare(playerId: string) {
    setCompareIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }

      return [playerId, ...current].slice(0, 4);
    });
  }

  const inspector = (
    <PlayerDetailDrawer
      isShortlisted={selectedPlayer ? shortlistIds.includes(selectedPlayer.id) : false}
      onClose={() => setSelectedPlayerId(null)}
      onToggleCompare={toggleCompare}
      onToggleShortlist={toggleShortlist}
      player={selectedPlayer}
    />
  );

  return (
    <main className="app-shell">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Football Legends Atlas</p>
          <h1>Football Legends XI</h1>
          <p className="header-copy">
            국가별 레전드 아카이브를 탐색하고, 랭킹과 비교를 거쳐 월드 베스트 일레븐까지 직접 구성합니다.
          </p>
        </div>
        <div className="source-panel">
          <span>Archive</span>
          <strong>{data.players.length.toLocaleString()} players</strong>
          <small>
            {data.continents.length} continents · {data.countries.length} countries
          </small>
        </div>
      </section>

      <nav className="app-tabs" aria-label="주요 기능">
        {[
          ["atlas", "Atlas"],
          ["hall", "Hall"],
          ["depth", "Depth"],
          ["battle", "Battle"],
          ["era", "Era"],
          ["timeline", "Timeline"],
          ["draft", "Draft"],
          ["challenge", "Challenge"],
          ["quiz", "Quiz"],
          ["shortlist", "Shortlist"],
          ["sim", "Sim"],
          ["tournament", "Tournament"],
          ["season", "Season"],
          ["best-xi", "Best XI"],
          ["rankings", "Rankings"],
          ["compare", "Compare"],
        ].map(([id, label]) => (
          <button
            className={activeTab === id ? "tab active" : "tab"}
            key={id}
            onClick={() => setActiveTab(id as TabId)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "atlas" ? (
        <AtlasView
          atlasContinent={atlasContinent}
          atlasCountry={atlasCountry}
          atlasPlayers={atlasPlayers}
          continents={data.continents}
          countries={data.countries}
          onContinentChange={(continent) => {
            setAtlasContinent((current) => (current === continent ? null : continent));
          }}
          onCountryChange={setAtlasCountry}
          onOpenBestXi={() => {
            setBuilderContinent(selectedCountrySummary?.continent ?? "ALL");
            setBuilderCountry(atlasCountry);
            setTopOnly(false);
            setActiveTab("best-xi");
          }}
          onPlayerSelect={setSelectedPlayerId}
          selectedCountryTop={selectedCountryTop}
          selectedCountrySummary={selectedCountrySummary}
          inspector={inspector}
          weights={weights}
        />
      ) : null}

      {activeTab === "hall" ? (
        <HallOfFameView
          countries={hallCountries}
          continent={hallContinent}
          country={hallCountry}
          inspector={inspector}
          onContinentChange={(value) => {
            setHallContinent(value);
            setHallCountry("ALL");
          }}
          onCountryChange={setHallCountry}
          onPlayerSelect={setSelectedPlayerId}
          onPositionChange={setHallPosition}
          onQueryChange={setHallQuery}
          onResetFilters={() => {
            setHallContinent("ALL");
            setHallCountry("ALL");
            setHallPosition("ALL");
            setHallTier("ALL");
            setHallQuery("");
          }}
          onTierChange={setHallTier}
          players={hallPlayers}
          position={hallPosition}
          query={hallQuery}
          summary={hallSummary}
          tier={hallTier}
          tierCounts={hallTierCounts}
        />
      ) : null}

      {activeTab === "depth" ? (
        <CountryDepthView
          continent={depthContinent}
          countries={depthCountries}
          country={depthCountry}
          countrySummary={depthCountrySummary}
          emptyRows={emptyDepthRows}
          filteredPlayers={depthPlayers}
          inspector={inspector}
          onContinentChange={(value) => {
            setDepthContinent(value);
            setDepthCountry(data.countries.find((country) => value === "ALL" || country.continent === value)?.name ?? defaultCountry);
          }}
          onCountryChange={setDepthCountry}
          onOpenBestXi={() => {
            setBuilderContinent(depthCountrySummary?.continent ?? "ALL");
            setBuilderCountry(depthCountry);
            setTopOnly(false);
            setActiveTab("best-xi");
          }}
          onPlayerSelect={setSelectedPlayerId}
          onPositionChange={setDepthPosition}
          onQueryChange={setDepthQuery}
          onResetFilters={() => {
            setDepthContinent("America");
            setDepthCountry(defaultCountry);
            setDepthPosition("ALL");
            setDepthQuery("");
          }}
          position={depthPosition}
          query={depthQuery}
          rows={depthRows}
          strongestRows={strongestDepthRows}
          summary={depthSummary}
          weakestRows={weakestDepthRows}
        />
      ) : null}

      {activeTab === "battle" ? (
        <NationBattleView
          countriesA={battleCountriesA}
          countriesB={battleCountriesB}
          countryA={battleCountryA}
          countryB={battleCountryB}
          continentA={battleContinentA}
          continentB={battleContinentB}
          inspector={inspector}
          leftProfile={battleLeftProfile}
          onContinentAChange={(value) => {
            setBattleContinentA(value);
            setBattleCountryA(data.countries.find((country) => value === "ALL" || country.continent === value)?.name ?? defaultCountry);
          }}
          onContinentBChange={(value) => {
            setBattleContinentB(value);
            setBattleCountryB(data.countries.find((country) => value === "ALL" || country.continent === value)?.name ?? defaultBattleCountry);
          }}
          onCountryAChange={setBattleCountryA}
          onCountryBChange={setBattleCountryB}
          onOpenBestXi={(country, continent) => {
            setBuilderContinent(continent ?? "ALL");
            setBuilderCountry(country);
            setTopOnly(false);
            setActiveTab("best-xi");
          }}
          onPlayerSelect={setSelectedPlayerId}
          onSwapCountries={() => {
            setBattleContinentA(battleContinentB);
            setBattleCountryA(battleCountryB);
            setBattleContinentB(battleContinentA);
            setBattleCountryB(battleCountryA);
          }}
          rightProfile={battleRightProfile}
          rows={battleRows}
          winner={battleWinner}
        />
      ) : null}

      {activeTab === "era" ? (
        <EraBattleView
          counts={eraCounts}
          eraA={eraA}
          eraB={eraB}
          inspector={inspector}
          leftProfile={eraLeftProfile}
          onEraAChange={setEraA}
          onEraBChange={setEraB}
          onPlayerSelect={setSelectedPlayerId}
          onSwapEras={() => {
            setEraA(eraB);
            setEraB(eraA);
          }}
          rightProfile={eraRightProfile}
          rows={eraRows}
          winner={eraWinner}
        />
      ) : null}

      {activeTab === "timeline" ? (
        <LegendTimelineView
          inspector={inspector}
          onOpenEra={(eraId) => {
            setEraA(eraId);
            setEraB(eraId === "modern" ? "classic" : "modern");
            setActiveTab("era");
          }}
          onPlayerSelect={setSelectedPlayerId}
          players={data.players}
        />
      ) : null}

      {activeTab === "draft" ? (
        <LegendDraftView
          candidates={draftCandidates}
          continent={draftContinent}
          countries={draftCountries}
          country={draftCountry}
          inspector={inspector}
          onAutoPick={() => {
            const nextCandidate = draftCandidates[0];
            if (nextCandidate) {
              draftPlayer(nextCandidate.player.id);
            }
          }}
          onContinentChange={(value) => {
            setDraftContinent(value);
            setDraftCountry("ALL");
          }}
          onCountryChange={setDraftCountry}
          onOpenTeamBestXi={openDraftTeamBestXi}
          onPickPlayer={draftPlayer}
          onPlayerSelect={setSelectedPlayerId}
          onPositionChange={setDraftPosition}
          onQueryChange={setDraftQuery}
          onResetDraft={() => setDraftPicks([])}
          onResetFilters={() => {
            setDraftContinent("ALL");
            setDraftCountry("ALL");
            setDraftPosition("ALL");
            setDraftTier("ALL");
            setDraftQuery("");
          }}
          onRoundsChange={(value) => {
            setDraftRounds(value);
            setDraftPicks((current) => current.slice(0, draftTeamCount * value));
          }}
          onSaveTeamBestXi={saveDraftTeamBestXi}
          onTeamCountChange={(value) => {
            setDraftTeamCount(value);
            setDraftPicks([]);
          }}
          onTierChange={setDraftTier}
          onUndoPick={() => setDraftPicks((current) => current.slice(0, -1))}
          picks={draftPicks}
          playerById={playerById}
          position={draftPosition}
          query={draftQuery}
          rounds={draftRounds}
          teamCount={draftTeamCount}
          tier={draftTier}
          weights={weights}
        />
      ) : null}

      {activeTab === "challenge" ? (
        <LegendChallengeView
          challengeId={challengeId}
          inspector={inspector}
          onChallengeChange={setChallengeId}
          onOpenBestXi={(startersToOpen, challenge) => openStartersInBestXi(startersToOpen, challenge.label, challenge.formationId)}
          onPlayerSelect={setSelectedPlayerId}
          onRandomChallenge={() => {
            const currentIndex = challengeOptions.findIndex((challenge) => challenge.id === challengeId);
            const nextIndex = (currentIndex + 1 + Math.floor(Math.random() * (challengeOptions.length - 1))) % challengeOptions.length;
            setChallengeId(challengeOptions[nextIndex].id);
          }}
          onSaveSquad={(startersToSave, challenge) => saveStartersAsSquad(startersToSave, challenge.label, challenge.formationId)}
          players={data.players}
          weights={weights}
        />
      ) : null}

      {activeTab === "quiz" ? (
        <LegendQuizView inspector={inspector} onPlayerSelect={setSelectedPlayerId} players={data.players} />
      ) : null}

      {activeTab === "shortlist" ? (
        <ShortlistView
          compareIds={compareIds}
          inspector={inspector}
          onClear={() => setShortlistIds([])}
          onPlayerSelect={setSelectedPlayerId}
          onToggleCompare={toggleCompare}
          onToggleShortlist={toggleShortlist}
          players={data.players}
          shortlistIds={shortlistIds}
          weights={weights}
        />
      ) : null}

      {activeTab === "sim" ? (
        <MatchSimulatorView
          countries={data.countries}
          inspector={inspector}
          matchMode={simMatchMode}
          onClearHistory={clearSimHistory}
          onMatchModeChange={updateSimMatchMode}
          onPlayerSelect={setSelectedPlayerId}
          onRandomSeed={() => runSimulation(`legends-match-${Date.now()}`)}
          onRandomnessChange={setSimRandomness}
          onRun={() => runSimulation()}
          onSeedChange={setSimSeed}
          onTeamACountryChange={setSimTeamACountry}
          onTeamASavedSquadChange={setSimTeamASavedId}
          onTeamASourceChange={setSimTeamASource}
          onTeamBCountryChange={setSimTeamBCountry}
          onTeamBSavedSquadChange={setSimTeamBSavedId}
          onTeamBSourceChange={setSimTeamBSource}
          onTacticsAChange={setSimTacticsA}
          onTacticsBChange={setSimTacticsB}
          randomness={simRandomness}
          result={simResult}
          seed={simSeed}
          savedSquads={savedSquads}
          seriesResults={simSeriesResults}
          simHistory={simHistory}
          teamA={simTeamA}
          teamACountry={simTeamACountry}
          teamASavedSquadId={simTeamASavedId}
          teamASource={simTeamASource}
          teamB={simTeamB}
          teamBCountry={simTeamBCountry}
          teamBSavedSquadId={simTeamBSavedId}
          teamBSource={simTeamBSource}
          tacticsA={simTacticsA}
          tacticsB={simTacticsB}
        />
      ) : null}

      {activeTab === "tournament" ? (
        <TournamentView
          countries={data.countries}
          inspector={inspector}
          onCountryChange={updateTournamentCountry}
          onRun={runTournament}
          onSizeChange={updateTournamentSize}
          run={tournamentRun}
          selectedCountries={tournamentCountries}
          size={tournamentSize}
        />
      ) : null}

      {activeTab === "season" ? (
        <SeasonView
          countries={data.countries}
          inspector={inspector}
          onCountryChange={updateSeasonCountry}
          onPlayerSelect={setSelectedPlayerId}
          onRun={runSeason}
          run={seasonRun}
          selectedCountries={seasonCountries}
        />
      ) : null}

      {activeTab === "best-xi" ? (
        <BestXiView
          averageRating={averageRating}
          builderContinent={builderContinent}
          builderCountries={builderCountries}
          builderCountry={builderCountry}
          builderPosition={builderPosition}
          builderTier={builderTier}
          candidatePlayers={candidatePlayers}
          candidateQuery={candidateQuery}
          compareIds={compareIds}
          formation={{ name: formation.name, slots: effectiveSlots }}
          formationId={formationId}
          exportedSquadText={exportedSquadText}
          manualSlots={manualSlots}
          onAssignPlayer={assignPlayerToSelectedSlot}
          onCandidateQueryChange={setCandidateQuery}
          onContinentChange={(value) => {
            setBuilderContinent(value);
            setBuilderCountry("ALL");
          }}
          onCountryChange={setBuilderCountry}
          onFormationChange={setFormationId}
          onDeleteSavedSquad={deleteSavedSquad}
          onExport={exportCurrentSquad}
          onExportDismiss={() => setExportedSquadText("")}
          onLoadSavedSquad={loadSavedSquad}
          onPlayerSelect={setSelectedPlayerId}
          onPositionChange={setBuilderPosition}
          onTierChange={setBuilderTier}
          onRenameSavedSquad={renameSavedSquad}
          onResetPositions={resetCurrentFormationPositions}
          onSave={saveCurrentSquad}
          onSelectedSlotChange={setSelectedSlotId}
          onToggleCompare={toggleCompare}
          onTopOnlyChange={setTopOnly}
          pitchRef={pitchRef}
          selectedSlotId={selectedSlot.id}
          savedSquads={savedSquads}
          setDraggingSlotId={setDraggingSlotId}
          setDropTargetSlotId={setDropTargetSlotId}
          setDropTargetRole={setDropTargetRole}
          slotPositions={currentSlotPositions}
          squad={squad}
          topOnly={topOnly}
          finalizeSlotDrag={finalizeSlotDrag}
          getSlotPositionsForDrag={getSlotPositionsForDrag}
          updateSlotPosition={updateSlotPosition}
          activeDragSlotRef={activeDragSlotRef}
          dragStartPositionsRef={dragStartPositionsRef}
          draggingSlotId={draggingSlotId}
          dropTargetSlotId={dropTargetSlotId}
          dropTargetRole={dropTargetRole}
          inspector={inspector}
          weights={weights}
          onWeightChange={updateWeight}
        />
      ) : null}

      {activeTab === "rankings" ? (
        <RankingsView
          countries={rankingCountries}
          continent={rankingContinent}
          country={rankingCountry}
          tier={rankingTier}
          onPlayerSelect={setSelectedPlayerId}
          onContinentChange={(value) => {
            setRankingContinent(value);
            setRankingCountry("ALL");
          }}
          onCountryChange={setRankingCountry}
          onPositionChange={setRankingPosition}
          onTierChange={setRankingTier}
          onQueryChange={setRankingQuery}
          onResetFilters={() => {
            setRankingContinent("ALL");
            setRankingCountry("ALL");
            setRankingPosition("ALL");
            setRankingTier("ALL");
            setRankingQuery("");
          }}
          onToggleCompare={toggleCompare}
          rankings={rankingPlayers}
          position={rankingPosition}
          query={rankingQuery}
          summary={rankingSummary}
          inspector={inspector}
          weights={weights}
          onWeightChange={updateWeight}
        />
      ) : null}

      {activeTab === "compare" ? (
        <CompareView
          compareIds={compareIds}
          compareQuery={compareQuery}
          onPlayerSelect={setSelectedPlayerId}
          onCompareQueryChange={setCompareQuery}
          onToggleCompare={toggleCompare}
          players={data.players}
          playerById={playerById}
          inspector={inspector}
          weights={weights}
        />
      ) : null}
    </main>
  );
}

function AtlasView({
  atlasContinent,
  atlasCountry,
  atlasPlayers,
  continents,
  countries,
  onContinentChange,
  onCountryChange,
  onOpenBestXi,
  onPlayerSelect,
  selectedCountryTop,
  selectedCountrySummary,
  inspector,
  weights,
}: {
  atlasContinent: Continent | null;
  atlasCountry: string;
  atlasPlayers: LegendPlayer[];
  continents: LegendData["continents"];
  countries: LegendData["countries"];
  onContinentChange: (continent: Continent) => void;
  onCountryChange: (country: string) => void;
  onOpenBestXi: () => void;
  onPlayerSelect: (playerId: string) => void;
  selectedCountryTop: Array<{ player: LegendPlayer; rating: number }>;
  selectedCountrySummary?: LegendData["countries"][number];
  inspector: ReactNode;
  weights: WeightMap;
}) {
  const groupedByPosition = groupPlayersByPosition(atlasPlayers);
  const countryFormation = formations["4-3-3"];
  const countrySquad = buildSquad(atlasPlayers, atlasPlayers, countryFormation.slots, weights, {});
  const countryXiStarters = countryFormation.slots
    .map((slot) => {
      const selected = countrySquad[slot.id];
      return selected ? { slot, player: selected.player, rating: selected.rating } : null;
    })
    .filter(Boolean) as Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;
  const countryXiAverage = average(countryXiStarters.map((starter) => starter.rating));
  const positionRows = ([...positionOptions, "LEGEND"] as PositionCode[])
    .map((position) => {
      const count = selectedCountrySummary?.positions[position] ?? 0;
      const total = selectedCountrySummary?.count ?? 0;
      return {
        count,
        percent: total ? Math.round((count / total) * 100) : 0,
        position,
      };
    })
    .filter((item) => item.count > 0);

  return (
    <section className="atlas-grid">
      <aside className="atlas-sidebar">
        <div className="section-heading">
          <p className="eyebrow">Continents</p>
          <h2>대륙별 국가</h2>
        </div>
        <div className="continent-stack">
          {continents.map((continent) => {
            const isOpen = atlasContinent === continent.name;

            return (
              <section className="continent-block" key={continent.name}>
                <button
                  aria-expanded={isOpen}
                  className={isOpen ? "continent-button active" : "continent-button"}
                onClick={() => onContinentChange(continent.name)}
                type="button"
              >
                <span>{continent.name}</span>
                <span className="continent-meta">
                  <em>{continent.count}</em>
                  <i aria-hidden="true">{isOpen ? "-" : "+"}</i>
                </span>
              </button>
              {atlasContinent === continent.name ? (
                <div className="country-list">
                  {countries
                    .filter((country) => country.continent === continent.name)
                    .map((country) => (
                      <button
                        className={country.name === atlasCountry ? "country-button active" : "country-button"}
                        key={country.name}
                        onClick={() => onCountryChange(country.name)}
                        type="button"
                      >
                        {country.name}
                        <span>{country.count}</span>
                      </button>
                  ))}
                </div>
              ) : null}
              </section>
            );
          })}
        </div>
      </aside>

      <section className="atlas-main">
        <div className="section-heading row">
          <div>
            <p className="eyebrow">{selectedCountrySummary?.continent ?? atlasContinent}</p>
            <h2>{atlasCountry} Legend Archive</h2>
          </div>
          <button className="primary-inline" onClick={onOpenBestXi} type="button">
            이 국가로 XI 만들기
          </button>
        </div>

        <section className="summary-grid compact">
          <Metric label="선수 풀" value={`${selectedCountrySummary?.count ?? 0}명`} detail="원본 리스트 기준" />
          <Metric label="포지션 수" value={`${Object.keys(selectedCountrySummary?.positions ?? {}).length}`} detail="분류된 포지션" />
          <Metric label="Top 10 평균" value={`${average(selectedCountryTop.map((item) => item.rating))}`} detail="공식 총점" />
          <Metric label="자동 XI 평균" value={`${countryXiAverage}`} detail="4-3-3 기준" />
        </section>

        <section className="country-insights-grid">
          <article className="atlas-insight-card">
            <div className="section-heading">
              <p className="eyebrow">Position Map</p>
              <h2>포지션 분포</h2>
            </div>
            <div className="position-distribution-list">
              {positionRows.map((item) => (
                <div className="position-distribution-row" key={item.position}>
                  <span>{item.position}</span>
                  <i aria-hidden="true">
                    <b style={{ width: `${item.percent}%` }} />
                  </i>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="atlas-insight-card">
            <div className="section-heading row">
              <div>
                <p className="eyebrow">Auto XI</p>
                <h2>{countryFormation.name} 국가 XI</h2>
              </div>
              <span className="rating-pill small">{countryXiAverage}</span>
            </div>
            <div className="country-xi-list">
              {countryXiStarters.map(({ player, rating, slot }) => (
                <button key={slot.id} onClick={() => onPlayerSelect(player.id)} type="button">
                  <span>{slot.label}</span>
                  <strong>{player.name}</strong>
                  <em>{rating}</em>
                </button>
              ))}
            </div>
          </article>
        </section>

        <div className="nation-dashboard">
          <div className="roster-section">
            {positionOptions.map((position) => {
              const players = groupedByPosition[position] ?? [];
              if (!players.length) {
                return null;
              }

              return (
                <section className="position-group" key={position}>
                  <h3>{position}</h3>
                  <div className="player-card-grid">
                    {players.map((player) => (
                      <PlayerMiniCard
                        key={player.id}
                        onClick={() => onPlayerSelect(player.id)}
                        player={player}
                        rating={ratePlayer(player, weights)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="top-list-panel">
            <div className="section-heading">
              <p className="eyebrow">Country Top 10</p>
              <h2>국가 핵심 선수</h2>
            </div>
            <div className="bench-list">
              {selectedCountryTop.map(({ player, rating }, index) => (
                <PlayerRow key={player.id} index={index + 1} player={player} rating={rating} onClick={() => onPlayerSelect(player.id)} />
              ))}
            </div>
          </aside>
        </div>
      </section>
      {inspector}
    </section>
  );
}

function HallOfFameView({
  continent,
  countries,
  country,
  inspector,
  onContinentChange,
  onCountryChange,
  onPlayerSelect,
  onPositionChange,
  onQueryChange,
  onResetFilters,
  onTierChange,
  players,
  position,
  query,
  summary,
  tier,
  tierCounts,
}: {
  continent: Continent | FilterValue;
  countries: LegendData["countries"];
  country: string | FilterValue;
  inspector: ReactNode;
  onContinentChange: (value: Continent | FilterValue) => void;
  onCountryChange: (value: string | FilterValue) => void;
  onPlayerSelect: (playerId: string) => void;
  onPositionChange: (value: PositionCode | FilterValue) => void;
  onQueryChange: (query: string) => void;
  onResetFilters: () => void;
  onTierChange: (value: LegendTierId | FilterValue) => void;
  players: LegendPlayer[];
  position: PositionCode | FilterValue;
  query: string;
  summary: {
    average: number;
    count: number;
    topScore: number;
  };
  tier: LegendTierId | FilterValue;
  tierCounts: Record<LegendTierId, number>;
}) {
  const groupedPlayers = legendTiers.map((item) => ({
    tier: item,
    players: players.filter((player) => getLegendTier(player.overallScore).id === item.id).slice(0, 18),
  }));
  const spotlightPlayers = players.slice(0, 6);

  return (
    <section className="hall-grid">
      <aside className="hall-sidebar">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Hall Filters</p>
            <h2>전당 탐색</h2>
          </div>
          <label className="field">
            <span>검색</span>
            <input
              className="search-input"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="선수, 국가, 포지션 검색"
              type="search"
              value={query}
            />
          </label>
          <label className="field">
            <span>레전드 티어</span>
            <select value={tier} onChange={(event) => onTierChange(event.target.value as LegendTierId | FilterValue)}>
              <option value="ALL">전체</option>
              {legendTiers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.range})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>대륙</span>
            <select value={continent} onChange={(event) => onContinentChange(event.target.value as Continent | FilterValue)}>
              <option value="ALL">전체</option>
              {continentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>국가</span>
            <select value={country} onChange={(event) => onCountryChange(event.target.value)}>
              <option value="ALL">전체</option>
              {countries.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>포지션</span>
            <select value={position} onChange={(event) => onPositionChange(event.target.value as PositionCode | FilterValue)}>
              <option value="ALL">전체</option>
              {positionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button className="ghost-button compact-button" onClick={onResetFilters} type="button">
            필터 초기화
          </button>
        </section>

        <section className="hall-tier-list">
          <div className="section-heading">
            <p className="eyebrow">Tier Map</p>
            <h2>전체 분포</h2>
          </div>
          {legendTiers.map((item) => (
            <button
              className={tier === item.id ? "hall-tier-button active" : "hall-tier-button"}
              key={item.id}
              onClick={() => onTierChange(tier === item.id ? "ALL" : item.id)}
              type="button"
            >
              <span>
                <strong>{item.label}</strong>
                <small>{item.range}</small>
              </span>
              <em>{tierCounts[item.id]}</em>
            </button>
          ))}
        </section>
      </aside>

      <section className="hall-main">
        <div className="section-heading row">
          <div>
            <p className="eyebrow">Hall of Fame</p>
            <h2>레전드 전당</h2>
          </div>
          <div className="ranking-summary">
            <span>{summary.count}명</span>
            <span>평균 {summary.average}</span>
            <strong>최고 {summary.topScore}</strong>
          </div>
        </div>

        <section className="hall-spotlight">
          {spotlightPlayers.map((player, index) => (
            <button className={index === 0 ? "hall-hero-card featured" : "hall-hero-card"} key={player.id} onClick={() => onPlayerSelect(player.id)} type="button">
              <span className={`tier-badge ${getLegendTier(player.overallScore).id}`}>{getLegendTier(player.overallScore).label}</span>
              <strong>{player.name}</strong>
              <small>
                {player.country} · {player.primaryPosition}
              </small>
              <em>{player.overallScore}</em>
            </button>
          ))}
          {spotlightPlayers.length === 0 ? <p className="empty-state">조건에 맞는 선수가 없습니다.</p> : null}
        </section>

        <div className="hall-tier-sections">
          {groupedPlayers.map(({ players: tierPlayers, tier: item }) => {
            if (!tierPlayers.length) {
              return null;
            }

            return (
              <section className="hall-tier-section" key={item.id}>
                <div className="section-heading row">
                  <div>
                    <p className="eyebrow">{item.range}</p>
                    <h2>{item.label}</h2>
                  </div>
                  <span className={`tier-badge ${item.id}`}>{tierPlayers.length} shown</span>
                </div>
                <div className="hall-card-grid">
                  {tierPlayers.map((player) => (
                    <HallPlayerCard key={player.id} onClick={() => onPlayerSelect(player.id)} player={player} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {inspector}
    </section>
  );
}

function HallPlayerCard({ onClick, player }: { onClick: () => void; player: LegendPlayer }) {
  const primaryScoreKey = getPrimaryScoreKey(player);

  return (
    <button className="hall-player-card" onClick={onClick} type="button">
      <span className={`tier-badge ${getLegendTier(player.overallScore).id}`}>{getLegendTier(player.overallScore).label}</span>
      <strong>{player.name}</strong>
      <small>
        {player.country} · {player.continent} · {player.primaryPosition}
      </small>
      <div className="hall-card-footer">
        <span>
          {scoreLabels[primaryScoreKey]} {player.scores[primaryScoreKey]}
        </span>
        <em>{player.overallScore}</em>
      </div>
    </button>
  );
}

function CountryDepthView({
  continent,
  countries,
  country,
  countrySummary,
  emptyRows,
  filteredPlayers,
  inspector,
  onContinentChange,
  onCountryChange,
  onOpenBestXi,
  onPlayerSelect,
  onPositionChange,
  onQueryChange,
  onResetFilters,
  position,
  query,
  rows,
  strongestRows,
  summary,
  weakestRows,
}: {
  continent: Continent | FilterValue;
  countries: LegendData["countries"];
  country: string;
  countrySummary?: LegendData["countries"][number];
  emptyRows: DepthPositionRow[];
  filteredPlayers: LegendPlayer[];
  inspector: ReactNode;
  onContinentChange: (value: Continent | FilterValue) => void;
  onCountryChange: (value: string) => void;
  onOpenBestXi: () => void;
  onPlayerSelect: (playerId: string) => void;
  onPositionChange: (value: PositionCode | FilterValue) => void;
  onQueryChange: (query: string) => void;
  onResetFilters: () => void;
  position: PositionCode | FilterValue;
  query: string;
  rows: DepthPositionRow[];
  strongestRows: DepthPositionRow[];
  summary: {
    average: number;
    count: number;
    topScore: number;
  };
  weakestRows: DepthPositionRow[];
}) {
  const filteredPreview = filteredPlayers.slice(0, 24);

  return (
    <section className="depth-grid">
      <aside className="depth-sidebar">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Country Depth</p>
            <h2>국가 선택</h2>
          </div>
          <label className="field">
            <span>대륙</span>
            <select value={continent} onChange={(event) => onContinentChange(event.target.value as Continent | FilterValue)}>
              <option value="ALL">전체</option>
              {continentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>국가</span>
            <select value={country} onChange={(event) => onCountryChange(event.target.value)}>
              {countries.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>포지션</span>
            <select value={position} onChange={(event) => onPositionChange(event.target.value as PositionCode | FilterValue)}>
              <option value="ALL">전체</option>
              {positionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>검색</span>
            <input
              className="search-input"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="선수, 포지션 검색"
              type="search"
              value={query}
            />
          </label>
          <button className="primary-button" onClick={onOpenBestXi} type="button">
            이 국가로 XI 만들기
          </button>
          <button className="ghost-button compact-button" onClick={onResetFilters} type="button">
            브라질 기준으로 초기화
          </button>
        </section>

        <section className="depth-snapshot-panel">
          <div className="section-heading">
            <p className="eyebrow">Snapshot</p>
            <h2>{country}</h2>
          </div>
          <div className="depth-snapshot-list">
            <span>
              <strong>{summary.count}</strong>
              선수 풀
            </span>
            <span>
              <strong>{summary.average}</strong>
              Top 10 평균
            </span>
            <span>
              <strong>{countrySummary?.continent ?? "-"}</strong>
              대륙
            </span>
            <span>
              <strong>{emptyRows.length}</strong>
              공백 포지션
            </span>
          </div>
        </section>
      </aside>

      <section className="depth-main">
        <div className="section-heading row">
          <div>
            <p className="eyebrow">{countrySummary?.continent ?? continent}</p>
            <h2>{country} Depth Chart</h2>
          </div>
          <div className="ranking-summary">
            <span>{summary.count}명</span>
            <span>Top 10 평균 {summary.average}</span>
            <strong>최고 {summary.topScore}</strong>
          </div>
        </div>

        <section className="depth-insight-grid">
          <DepthInsightCard label="강점 포지션" rows={strongestRows} />
          <DepthInsightCard label="보강 필요" rows={weakestRows} />
          <article className="depth-insight-card">
            <p className="eyebrow">Empty Slots</p>
            <h3>공백 포지션</h3>
            <div className="depth-chip-row">
              {emptyRows.length ? emptyRows.map((row) => <span key={row.position}>{row.position}</span>) : <span>없음</span>}
            </div>
          </article>
        </section>

        <section className="depth-board">
          {rows.map((row) => (
            <article className={row.count ? "depth-position-card" : "depth-position-card empty"} key={row.position}>
              <div className="depth-position-head">
                <span>{row.position}</span>
                <strong>{row.count}</strong>
              </div>
              <div className="depth-strength-bar" aria-label={`${row.position} strength`}>
                <b style={{ width: `${row.average}%` }} />
              </div>
              <small>Top 3 평균 {row.average || "-"}</small>
              <div className="depth-player-stack">
                {row.players.slice(0, 6).map((player, index) => (
                  <button key={player.id} onClick={() => onPlayerSelect(player.id)} type="button">
                    <em>{index + 1}</em>
                    <span>
                      <strong>{player.name}</strong>
                      <small>
                        {getLegendTier(player.overallScore).label} · {player.overallScore}
                      </small>
                    </span>
                  </button>
                ))}
                {row.count === 0 ? <p>등록 선수 없음</p> : null}
              </div>
            </article>
          ))}
        </section>

        <section className="depth-filtered-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Filtered Board</p>
              <h2>선택 조건 선수</h2>
            </div>
            <span className="saved-count">{filteredPlayers.length}명</span>
          </div>
          <div className="depth-filtered-grid">
            {filteredPreview.map((player) => (
              <HallPlayerCard key={player.id} onClick={() => onPlayerSelect(player.id)} player={player} />
            ))}
            {filteredPreview.length === 0 ? <p className="empty-state">조건에 맞는 선수가 없습니다.</p> : null}
          </div>
        </section>
      </section>

      {inspector}
    </section>
  );
}

function DepthInsightCard({ label, rows }: { label: string; rows: DepthPositionRow[] }) {
  return (
    <article className="depth-insight-card">
      <p className="eyebrow">{label}</p>
      <h3>{rows[0]?.position ?? "-"}</h3>
      <div className="depth-insight-list">
        {rows.map((row) => (
          <span key={row.position}>
            <strong>{row.position}</strong>
            <em>{row.average}</em>
            <small>{row.count}명</small>
          </span>
        ))}
      </div>
    </article>
  );
}

function NationBattleView({
  continentA,
  continentB,
  countriesA,
  countriesB,
  countryA,
  countryB,
  inspector,
  leftProfile,
  onContinentAChange,
  onContinentBChange,
  onCountryAChange,
  onCountryBChange,
  onOpenBestXi,
  onPlayerSelect,
  onSwapCountries,
  rightProfile,
  rows,
  winner,
}: {
  continentA: Continent | FilterValue;
  continentB: Continent | FilterValue;
  countriesA: LegendData["countries"];
  countriesB: LegendData["countries"];
  countryA: string;
  countryB: string;
  inspector: ReactNode;
  leftProfile: BattleCountryProfile;
  onContinentAChange: (value: Continent | FilterValue) => void;
  onContinentBChange: (value: Continent | FilterValue) => void;
  onCountryAChange: (value: string) => void;
  onCountryBChange: (value: string) => void;
  onOpenBestXi: (country: string, continent?: Continent) => void;
  onPlayerSelect: (playerId: string) => void;
  onSwapCountries: () => void;
  rightProfile: BattleCountryProfile;
  rows: PositionBattleRow[];
  winner: string;
}) {
  const matchups = Array.from({ length: 5 }, (_, index) => ({
    left: leftProfile.topPlayers[index],
    right: rightProfile.topPlayers[index],
  })).filter((matchup) => matchup.left || matchup.right);

  return (
    <section className="battle-grid">
      <aside className="battle-sidebar">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Nation Battle</p>
            <h2>국가 대결</h2>
          </div>
          <BattleCountryPicker
            continent={continentA}
            countries={countriesA}
            country={countryA}
            label="국가 A"
            onContinentChange={onContinentAChange}
            onCountryChange={onCountryAChange}
          />
          <button className="ghost-button compact-button" onClick={onSwapCountries} type="button">
            좌우 바꾸기
          </button>
          <BattleCountryPicker
            continent={continentB}
            countries={countriesB}
            country={countryB}
            label="국가 B"
            onContinentChange={onContinentBChange}
            onCountryChange={onCountryBChange}
          />
        </section>

        <section className="battle-verdict-card">
          <p className="eyebrow">Verdict</p>
          <h2>{winner}</h2>
          <span>
            XI 평균 {leftProfile.xiAverage} : {rightProfile.xiAverage}
          </span>
        </section>
      </aside>

      <section className="battle-main">
        <div className="battle-scoreboard">
          <BattleProfileCard onOpenBestXi={onOpenBestXi} onPlayerSelect={onPlayerSelect} profile={leftProfile} />
          <div className="battle-versus">
            <strong>VS</strong>
            <span>{winner === "Even" ? "균형" : `${winner} 우세`}</span>
          </div>
          <BattleProfileCard onOpenBestXi={onOpenBestXi} onPlayerSelect={onPlayerSelect} profile={rightProfile} />
        </div>

        <section className="battle-position-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Position Advantage</p>
              <h2>포지션별 우위</h2>
            </div>
            <div className="ranking-summary">
              <span>{rows.filter((row) => row.advantage === "A").length} : {rows.filter((row) => row.advantage === "B").length}</span>
              <strong>{rows.filter((row) => row.advantage === "EVEN").length} 동률</strong>
            </div>
          </div>
          <div className="battle-position-list">
            {rows.map((row) => (
              <article className="battle-position-row" key={row.position}>
                <BattlePositionSide row={row.left} side={row.advantage === "A" ? "win" : row.advantage === "EVEN" ? "even" : "lose"} />
                <span className="battle-position-code">{row.position}</span>
                <BattlePositionSide row={row.right} side={row.advantage === "B" ? "win" : row.advantage === "EVEN" ? "even" : "lose"} />
              </article>
            ))}
          </div>
        </section>

        <section className="battle-lower-grid">
          <article className="battle-xi-panel">
            <div className="section-heading">
              <p className="eyebrow">Auto XI</p>
              <h2>{leftProfile.country}</h2>
            </div>
            <BattleXiList onPlayerSelect={onPlayerSelect} starters={leftProfile.xiStarters} />
          </article>
          <article className="battle-xi-panel">
            <div className="section-heading">
              <p className="eyebrow">Matchups</p>
              <h2>대표 매치업</h2>
            </div>
            <div className="battle-matchup-list">
              {matchups.map((matchup, index) => (
                <div className="battle-matchup-row" key={`${matchup.left?.id ?? "left"}-${matchup.right?.id ?? "right"}-${index}`}>
                  {matchup.left ? <button onClick={() => onPlayerSelect(matchup.left.id)} type="button">{matchup.left.name}<span>{matchup.left.overallScore}</span></button> : <span />}
                  <em>{index + 1}</em>
                  {matchup.right ? <button onClick={() => onPlayerSelect(matchup.right.id)} type="button">{matchup.right.name}<span>{matchup.right.overallScore}</span></button> : <span />}
                </div>
              ))}
            </div>
          </article>
          <article className="battle-xi-panel">
            <div className="section-heading">
              <p className="eyebrow">Auto XI</p>
              <h2>{rightProfile.country}</h2>
            </div>
            <BattleXiList onPlayerSelect={onPlayerSelect} starters={rightProfile.xiStarters} />
          </article>
        </section>
      </section>

      {inspector}
    </section>
  );
}

function BattleCountryPicker({
  continent,
  countries,
  country,
  label,
  onContinentChange,
  onCountryChange,
}: {
  continent: Continent | FilterValue;
  countries: LegendData["countries"];
  country: string;
  label: string;
  onContinentChange: (value: Continent | FilterValue) => void;
  onCountryChange: (value: string) => void;
}) {
  return (
    <div className="battle-picker">
      <p>{label}</p>
      <label className="field">
        <span>대륙</span>
        <select value={continent} onChange={(event) => onContinentChange(event.target.value as Continent | FilterValue)}>
          <option value="ALL">전체</option>
          {continentOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>국가</span>
        <select value={country} onChange={(event) => onCountryChange(event.target.value)}>
          {countries.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.count})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function EraBattleView({
  counts,
  eraA,
  eraB,
  inspector,
  leftProfile,
  onEraAChange,
  onEraBChange,
  onPlayerSelect,
  onSwapEras,
  rightProfile,
  rows,
  winner,
}: {
  counts: Record<EraId, number>;
  eraA: EraId;
  eraB: EraId;
  inspector: ReactNode;
  leftProfile: BattleCountryProfile;
  onEraAChange: (value: EraId) => void;
  onEraBChange: (value: EraId) => void;
  onPlayerSelect: (playerId: string) => void;
  onSwapEras: () => void;
  rightProfile: BattleCountryProfile;
  rows: PositionBattleRow[];
  winner: string;
}) {
  const matchups = Array.from({ length: 5 }, (_, index) => ({
    left: leftProfile.topPlayers[index],
    right: rightProfile.topPlayers[index],
  })).filter((matchup) => matchup.left || matchup.right);

  return (
    <section className="battle-grid era-grid">
      <aside className="battle-sidebar">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Era Battle</p>
            <h2>시대 대결</h2>
          </div>
          <EraPicker counts={counts} era={eraA} label="시대 A" onEraChange={onEraAChange} />
          <button className="ghost-button compact-button" onClick={onSwapEras} type="button">
            좌우 바꾸기
          </button>
          <EraPicker counts={counts} era={eraB} label="시대 B" onEraChange={onEraBChange} />
        </section>

        <section className="battle-verdict-card">
          <p className="eyebrow">Verdict</p>
          <h2>{winner}</h2>
          <span>
            XI 평균 {leftProfile.xiAverage} : {rightProfile.xiAverage}
          </span>
        </section>

        <section className="era-note-card">
          <p className="eyebrow">Era Rule</p>
          <h2>대표 연도 기준</h2>
          <p>프로필의 프라임/커리어 설명과 수상 목록에서 연도를 추출해 중앙값으로 시대를 배정합니다.</p>
        </section>
      </aside>

      <section className="battle-main">
        <div className="battle-scoreboard">
          <BattleProfileCard onPlayerSelect={onPlayerSelect} profile={leftProfile} />
          <div className="battle-versus">
            <strong>VS</strong>
            <span>{winner === "Even" ? "균형" : `${winner} 우세`}</span>
          </div>
          <BattleProfileCard onPlayerSelect={onPlayerSelect} profile={rightProfile} />
        </div>

        <section className="battle-position-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Position Advantage</p>
              <h2>포지션별 시대 우위</h2>
            </div>
            <div className="ranking-summary">
              <span>{rows.filter((row) => row.advantage === "A").length} : {rows.filter((row) => row.advantage === "B").length}</span>
              <strong>{rows.filter((row) => row.advantage === "EVEN").length} 동률</strong>
            </div>
          </div>
          <div className="battle-position-list">
            {rows.map((row) => (
              <article className="battle-position-row" key={row.position}>
                <BattlePositionSide row={row.left} side={row.advantage === "A" ? "win" : row.advantage === "EVEN" ? "even" : "lose"} />
                <span className="battle-position-code">{row.position}</span>
                <BattlePositionSide row={row.right} side={row.advantage === "B" ? "win" : row.advantage === "EVEN" ? "even" : "lose"} />
              </article>
            ))}
          </div>
        </section>

        <section className="battle-lower-grid">
          <article className="battle-xi-panel">
            <div className="section-heading">
              <p className="eyebrow">Auto XI</p>
              <h2>{leftProfile.country}</h2>
            </div>
            <BattleXiList onPlayerSelect={onPlayerSelect} starters={leftProfile.xiStarters} />
          </article>
          <article className="battle-xi-panel">
            <div className="section-heading">
              <p className="eyebrow">Matchups</p>
              <h2>대표 매치업</h2>
            </div>
            <div className="battle-matchup-list">
              {matchups.map((matchup, index) => (
                <div className="battle-matchup-row" key={`${matchup.left?.id ?? "left"}-${matchup.right?.id ?? "right"}-${index}`}>
                  {matchup.left ? <button onClick={() => onPlayerSelect(matchup.left.id)} type="button">{matchup.left.name}<span>{matchup.left.overallScore}</span></button> : <span />}
                  <em>{index + 1}</em>
                  {matchup.right ? <button onClick={() => onPlayerSelect(matchup.right.id)} type="button">{matchup.right.name}<span>{matchup.right.overallScore}</span></button> : <span />}
                </div>
              ))}
            </div>
          </article>
          <article className="battle-xi-panel">
            <div className="section-heading">
              <p className="eyebrow">Auto XI</p>
              <h2>{rightProfile.country}</h2>
            </div>
            <BattleXiList onPlayerSelect={onPlayerSelect} starters={rightProfile.xiStarters} />
          </article>
        </section>
      </section>

      {inspector}
    </section>
  );
}

function EraPicker({
  counts,
  era,
  label,
  onEraChange,
}: {
  counts: Record<EraId, number>;
  era: EraId;
  label: string;
  onEraChange: (value: EraId) => void;
}) {
  return (
    <div className="battle-picker">
      <p>{label}</p>
      <label className="field">
        <span>시대</span>
        <select value={era} onChange={(event) => onEraChange(event.target.value as EraId)}>
          {eraOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.range}) · {counts[item.id]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function LegendTimelineView({
  inspector,
  onOpenEra,
  onPlayerSelect,
  players,
}: {
  inspector: ReactNode;
  onOpenEra: (eraId: EraId) => void;
  onPlayerSelect: (playerId: string) => void;
  players: LegendPlayer[];
}) {
  const [continent, setContinent] = useState<Continent | FilterValue>("ALL");
  const [era, setEra] = useState<EraId | FilterValue>("ALL");
  const [position, setPosition] = useState<PositionCode | FilterValue>("ALL");
  const [tier, setTier] = useState<LegendTierId | FilterValue>("ALL");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const timelineItems = useMemo(
    () =>
      players
        .map((player) => {
          const year = getPlayerRepresentativeYear(player);
          const playerEra = getPlayerEra(player);
          return {
            decade: year ? Math.floor(year / 10) * 10 : 0,
            era: playerEra,
            player,
            year,
          };
        })
        .filter((item) => continent === "ALL" || item.player.continent === continent)
        .filter((item) => era === "ALL" || item.era.id === era)
        .filter((item) => position === "ALL" || item.player.primaryPosition === position)
        .filter((item) => tier === "ALL" || getLegendTier(item.player.overallScore).id === tier)
        .filter((item) => !normalizedQuery || matchesPlayerSearch(item.player, normalizedQuery))
        .sort(
          (a, b) =>
            (a.year ?? 9999) - (b.year ?? 9999) ||
            b.player.overallScore - a.player.overallScore ||
            (a.player.topTierRank ?? 999) - (b.player.topTierRank ?? 999),
        ),
    [continent, era, normalizedQuery, players, position, tier],
  );
  const decadeGroups = useMemo(() => {
    const groups = new Map<number, typeof timelineItems>();
    for (const item of timelineItems) {
      const key = item.decade || 0;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    return [...groups.entries()]
      .sort(([a], [b]) => (a || 9999) - (b || 9999))
      .map(([decade, items]) => ({ decade, items }));
  }, [timelineItems]);
  const topPlayers = [...timelineItems].sort((a, b) => b.player.overallScore - a.player.overallScore || (a.year ?? 9999) - (b.year ?? 9999)).slice(0, 12);
  const placedItems = timelineItems.filter((item) => item.year);
  const earliest = placedItems[0];
  const latest = placedItems[placedItems.length - 1];
  const eraCounts = eraOptions.reduce<Record<EraId, number>>((counts, item) => {
    counts[item.id] = timelineItems.filter((timelineItem) => timelineItem.era.id === item.id).length;
    return counts;
  }, {
    foundations: 0,
    classic: 0,
    "global-tv": 0,
    modern: 0,
    current: 0,
    unplaced: 0,
  });

  return (
    <section className="timeline-grid">
      <aside className="timeline-sidebar">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Legacy Timeline</p>
            <h2>시대별 레전드 흐름</h2>
          </div>
          <label className="field">
            <span>검색</span>
            <input className="search-input" onChange={(event) => setQuery(event.target.value)} placeholder="선수, 국가, 포지션 검색" type="search" value={query} />
          </label>
          <label className="field">
            <span>대륙</span>
            <select value={continent} onChange={(event) => setContinent(event.target.value as Continent | FilterValue)}>
              <option value="ALL">전체</option>
              {continentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>시대</span>
            <select value={era} onChange={(event) => setEra(event.target.value as EraId | FilterValue)}>
              <option value="ALL">전체</option>
              {eraOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.range})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>포지션</span>
            <select value={position} onChange={(event) => setPosition(event.target.value as PositionCode | FilterValue)}>
              <option value="ALL">전체</option>
              {positionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>티어</span>
            <select value={tier} onChange={(event) => setTier(event.target.value as LegendTierId | FilterValue)}>
              <option value="ALL">전체</option>
              {legendTiers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.range})
                </option>
              ))}
            </select>
          </label>
          <button
            className="ghost-button compact-button"
            onClick={() => {
              setContinent("ALL");
              setEra("ALL");
              setPosition("ALL");
              setTier("ALL");
              setQuery("");
            }}
            type="button"
          >
            필터 초기화
          </button>
        </section>

        <section className="timeline-era-card">
          <p className="eyebrow">Era Counts</p>
          <div className="timeline-era-list">
            {eraOptions.map((item) => (
              <button key={item.id} onClick={() => onOpenEra(item.id)} type="button">
                <span>{item.label}</span>
                <strong>{eraCounts[item.id]}</strong>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="timeline-main">
        <section className="timeline-hero-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Archive Flow</p>
              <h2>대표 연도 타임라인</h2>
            </div>
            <div className="ranking-summary">
              <span>{timelineItems.length}명</span>
              <span>{earliest?.year ?? "-"} 시작</span>
              <strong>{latest?.year ?? "-"} 최신</strong>
            </div>
          </div>
          <div className="timeline-spotlight-grid">
            {topPlayers.slice(0, 4).map(({ player, year }) => (
              <button key={player.id} onClick={() => onPlayerSelect(player.id)} type="button">
                <span>{year ?? "?"}</span>
                <strong>{player.name}</strong>
                <small>
                  {player.country} · {player.primaryPosition} · {player.overallScore}
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="timeline-decade-panel">
          <div className="section-heading">
            <p className="eyebrow">Decades</p>
            <h2>10년대별 대표 선수</h2>
          </div>
          <div className="timeline-decade-list">
            {decadeGroups.map((group) => (
              <article className="timeline-decade-row" key={group.decade}>
                <div className="timeline-decade-label">
                  <strong>{formatDecadeLabel(group.decade)}</strong>
                  <span>{group.items.length}명</span>
                </div>
                <div className="timeline-player-strip">
                  {group.items.slice(0, 10).map(({ player, year }) => (
                    <button key={player.id} onClick={() => onPlayerSelect(player.id)} type="button">
                      <span>{year ?? "?"}</span>
                      <strong>{player.name}</strong>
                      <small>{player.country}</small>
                    </button>
                  ))}
                </div>
              </article>
            ))}
            {decadeGroups.length === 0 ? <p className="empty-state">조건에 맞는 선수가 없습니다.</p> : null}
          </div>
        </section>
      </section>

      {inspector}
    </section>
  );
}

function BattleProfileCard({
  onOpenBestXi,
  onPlayerSelect,
  profile,
}: {
  onOpenBestXi?: (country: string, continent?: Continent) => void;
  onPlayerSelect: (playerId: string) => void;
  profile: BattleCountryProfile;
}) {
  return (
    <article className="battle-profile-card">
      <div className="section-heading row">
        <div>
          <p className="eyebrow">{profile.summary?.continent ?? "World"}</p>
          <h2>{profile.country}</h2>
        </div>
        <span className="rating-pill small">{profile.xiAverage}</span>
      </div>
      <div className="battle-metric-grid">
        <span><strong>{profile.players.length}</strong>선수 풀</span>
        <span><strong>{profile.average}</strong>Top 10</span>
        <span><strong>{profile.topScore}</strong>최고점</span>
      </div>
      <div className="battle-top-list">
        {profile.topPlayers.slice(0, 5).map((player, index) => (
          <button key={player.id} onClick={() => onPlayerSelect(player.id)} type="button">
            <em>{index + 1}</em>
            <span>{player.name}</span>
            <strong>{player.overallScore}</strong>
          </button>
        ))}
      </div>
      {onOpenBestXi ? (
        <button className="primary-inline" onClick={() => onOpenBestXi(profile.country, profile.summary?.continent)} type="button">
          이 국가로 XI 만들기
        </button>
      ) : null}
    </article>
  );
}

function BattlePositionSide({ row, side }: { row: DepthPositionRow; side: "win" | "even" | "lose" }) {
  const leader = row.players[0];

  return (
    <div className={`battle-position-side ${side}`}>
      <strong>{row.average || "-"}</strong>
      <span>{leader?.name ?? "등록 선수 없음"}</span>
      <small>{row.count}명 · 최고 {row.topScore || "-"}</small>
    </div>
  );
}

function BattleXiList({
  onPlayerSelect,
  starters,
}: {
  onPlayerSelect: (playerId: string) => void;
  starters: Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;
}) {
  return (
    <div className="battle-xi-list">
      {starters.map(({ player, rating, slot }) => (
        <button key={slot.id} onClick={() => onPlayerSelect(player.id)} type="button">
          <span>{slot.label}</span>
          <strong>{player.name}</strong>
          <em>{rating}</em>
        </button>
      ))}
    </div>
  );
}

function LegendDraftView({
  candidates,
  continent,
  countries,
  country,
  inspector,
  onAutoPick,
  onContinentChange,
  onCountryChange,
  onOpenTeamBestXi,
  onPickPlayer,
  onPlayerSelect,
  onPositionChange,
  onQueryChange,
  onResetDraft,
  onResetFilters,
  onRoundsChange,
  onSaveTeamBestXi,
  onTeamCountChange,
  onTierChange,
  onUndoPick,
  picks,
  playerById,
  position,
  query,
  rounds,
  teamCount,
  tier,
  weights,
}: {
  candidates: Array<{ player: LegendPlayer; rating: number }>;
  continent: Continent | FilterValue;
  countries: LegendData["countries"];
  country: string | FilterValue;
  inspector: ReactNode;
  onAutoPick: () => void;
  onContinentChange: (value: Continent | FilterValue) => void;
  onCountryChange: (value: string | FilterValue) => void;
  onOpenTeamBestXi: (teamIndex: number) => void;
  onPickPlayer: (playerId: string) => void;
  onPlayerSelect: (playerId: string) => void;
  onPositionChange: (value: PositionCode | FilterValue) => void;
  onQueryChange: (query: string) => void;
  onResetDraft: () => void;
  onResetFilters: () => void;
  onRoundsChange: (value: number) => void;
  onSaveTeamBestXi: (teamIndex: number) => void;
  onTeamCountChange: (value: number) => void;
  onTierChange: (value: LegendTierId | FilterValue) => void;
  onUndoPick: () => void;
  picks: DraftPick[];
  playerById: Map<string, LegendPlayer>;
  position: PositionCode | FilterValue;
  query: string;
  rounds: number;
  teamCount: number;
  tier: LegendTierId | FilterValue;
  weights: WeightMap;
}) {
  const [exportedDraftText, setExportedDraftText] = useState("");
  const maxPicks = teamCount * rounds;
  const isComplete = picks.length >= maxPicks;
  const currentRound = Math.min(Math.floor(picks.length / teamCount) + 1, rounds);
  const currentTeamIndex = isComplete ? null : getSnakeDraftTeamIndex(picks.length, teamCount);
  const selectedPlayers = picks.map((pick) => playerById.get(pick.playerId)).filter(Boolean) as LegendPlayer[];
  const draftAverage = average(selectedPlayers.map((player) => ratePlayer(player, weights)));
  const teamSummaries = Array.from({ length: teamCount }, (_, teamIndex) => {
    const teamPicks = picks.filter((pick) => pick.teamIndex === teamIndex);
    const players = teamPicks.map((pick) => playerById.get(pick.playerId)).filter(Boolean) as LegendPlayer[];
    const positionCounts = positionOptions.reduce<Record<string, number>>((counts, item) => {
      counts[item] = players.filter((player) => player.primaryPosition === item).length;
      return counts;
    }, {});
    const formation = formations["4-3-3"];
    const squad = buildSquad(players, players, formation.slots, weights, {});
    const starters = formation.slots
      .map((slot) => {
        const selected = squad[slot.id];
        return selected ? { slot, player: selected.player, rating: selected.rating } : null;
      })
      .filter(Boolean) as Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;

    return {
      average: average(players.map((player) => ratePlayer(player, weights))),
      players,
      positionCounts,
      starters,
      teamIndex,
      topPlayer: players.slice().sort((a, b) => ratePlayer(b, weights) - ratePlayer(a, weights))[0],
      xiAverage: average(starters.map((starter) => starter.rating)),
    };
  });
  const leader = teamSummaries
    .filter((team) => team.players.length > 0)
    .sort((a, b) => b.xiAverage - a.xiAverage || b.average - a.average)[0];

  function exportDraftBoard() {
    setExportedDraftText(formatDraftExport(teamSummaries, picks, playerById, weights, rounds));
  }

  return (
    <section className="draft-grid">
      <aside className="draft-sidebar">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Legend Draft</p>
            <h2>스네이크 드래프트</h2>
          </div>
          <label className="field">
            <span>팀 수</span>
            <select value={teamCount} onChange={(event) => onTeamCountChange(Number(event.target.value))}>
              {[2, 3, 4].map((item) => (
                <option key={item} value={item}>
                  {item}팀
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>라운드</span>
            <select value={rounds} onChange={(event) => onRoundsChange(Number(event.target.value))}>
              {[5, 7, 11, 15].map((item) => (
                <option key={item} value={item}>
                  {item}라운드
                </option>
              ))}
            </select>
          </label>
          <div className="draft-action-grid">
            <button className="primary-inline" disabled={!candidates.length || isComplete} onClick={onAutoPick} type="button">
              자동 픽
            </button>
            <button className="small-button" disabled={!picks.length} onClick={exportDraftBoard} type="button">
              내보내기
            </button>
            <button className="small-button" disabled={!picks.length} onClick={onUndoPick} type="button">
              되돌리기
            </button>
            <button className="small-button" disabled={!picks.length} onClick={onResetDraft} type="button">
              초기화
            </button>
          </div>
        </section>

        <section className="draft-status-card">
          <p className="eyebrow">Pick Clock</p>
          <h2>{isComplete ? "Draft Complete" : `Team ${(currentTeamIndex ?? 0) + 1}`}</h2>
          <div className="draft-progress">
            <span>
              {picks.length}/{maxPicks}
            </span>
            <i>
              <b style={{ width: `${Math.round((picks.length / maxPicks) * 100)}%` }} />
            </i>
          </div>
          <small>
            {isComplete ? `우세 팀 ${leader ? `Team ${leader.teamIndex + 1}` : "-"}` : `${currentRound}라운드 · 스네이크 순서`}
          </small>
        </section>

        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Pool Filter</p>
            <h2>후보 찾기</h2>
          </div>
          <label className="field">
            <span>검색</span>
            <input className="search-input" onChange={(event) => onQueryChange(event.target.value)} placeholder="선수, 국가, 포지션 검색" type="search" value={query} />
          </label>
          <label className="field">
            <span>대륙</span>
            <select value={continent} onChange={(event) => onContinentChange(event.target.value as Continent | FilterValue)}>
              <option value="ALL">전체</option>
              {continentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>국가</span>
            <select value={country} onChange={(event) => onCountryChange(event.target.value)}>
              <option value="ALL">전체</option>
              {countries.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>포지션</span>
            <select value={position} onChange={(event) => onPositionChange(event.target.value as PositionCode | FilterValue)}>
              <option value="ALL">전체</option>
              {positionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>레전드 티어</span>
            <select value={tier} onChange={(event) => onTierChange(event.target.value as LegendTierId | FilterValue)}>
              <option value="ALL">전체</option>
              {legendTiers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.range})
                </option>
              ))}
            </select>
          </label>
          <button className="ghost-button compact-button" onClick={onResetFilters} type="button">
            필터 초기화
          </button>
        </section>
      </aside>

      <section className="draft-main">
        <section className="draft-board-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Draft Board</p>
              <h2>팀별 픽 현황</h2>
            </div>
            <div className="ranking-summary">
              <span>평균 {draftAverage}</span>
              <strong>{leader ? `Leader Team ${leader.teamIndex + 1}` : "No Pick"}</strong>
            </div>
          </div>
          <div className="draft-team-grid">
            {teamSummaries.map((team) => (
              <article className={currentTeamIndex === team.teamIndex ? "draft-team-card active" : "draft-team-card"} key={team.teamIndex}>
                <div className="draft-team-head">
                  <div>
                    <p className="eyebrow">Team {team.teamIndex + 1}</p>
                    <h3>{team.topPlayer?.name ?? "첫 픽 대기"}</h3>
                  </div>
                  <span>{team.xiAverage || team.average || "-"}</span>
                </div>
                <div className="draft-position-strip">
                  {["ST", "AM", "CM", "DM", "CB", "GK"].map((item) => (
                    <em key={item}>
                      {item} {team.positionCounts[item] ?? 0}
                    </em>
                  ))}
                </div>
                <div className="draft-pick-list">
                  {picks
                    .filter((pick) => pick.teamIndex === team.teamIndex)
                    .map((pick) => {
                      const player = playerById.get(pick.playerId);
                      if (!player) {
                        return null;
                      }

                      return (
                        <button key={pick.pickNumber} onClick={() => onPlayerSelect(player.id)} type="button">
                          <span>#{pick.pickNumber}</span>
                          <strong>{player.name}</strong>
                          <em>{player.primaryPosition}</em>
                        </button>
                      );
                    })}
                  {team.players.length === 0 ? <p className="empty-state">아직 선택한 선수가 없습니다.</p> : null}
                </div>
                <div className="draft-team-actions">
                  <button disabled={!team.players.length} onClick={() => onOpenTeamBestXi(team.teamIndex)} type="button">
                    Best XI로 열기
                  </button>
                  <button disabled={!team.players.length} onClick={() => onSaveTeamBestXi(team.teamIndex)} type="button">
                    XI 저장
                  </button>
                </div>
                {team.starters.length ? <BattleXiList onPlayerSelect={onPlayerSelect} starters={team.starters} /> : null}
              </article>
            ))}
          </div>
        </section>

        {exportedDraftText ? (
          <section className="draft-export-panel">
            <div className="section-heading row">
              <div>
                <p className="eyebrow">Export</p>
                <h2>드래프트 보드 텍스트</h2>
              </div>
              <button className="small-button" onClick={() => setExportedDraftText("")} type="button">
                닫기
              </button>
            </div>
            <textarea readOnly value={exportedDraftText} />
          </section>
        ) : null}

        <section className="draft-candidate-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Available Pool</p>
              <h2>다음 픽 후보</h2>
            </div>
            <span className="saved-count">{candidates.length} shown</span>
          </div>
          <div className="draft-candidate-list">
            {candidates.length ? (
              candidates.map(({ player, rating }, index) => (
                <article className="draft-candidate-item" key={player.id}>
                  <button onClick={() => onPlayerSelect(player.id)} type="button">
                    <span>{index + 1}</span>
                    <div>
                      <strong>{player.name}</strong>
                      <small>
                        {player.country} · {player.continent} · {player.primaryPosition} · {getLegendTier(player.overallScore).label}
                      </small>
                    </div>
                    <em>{rating}</em>
                  </button>
                  <button className="primary-inline" disabled={isComplete} onClick={() => onPickPlayer(player.id)} type="button">
                    픽
                  </button>
                </article>
              ))
            ) : (
              <p className="empty-state">조건에 맞는 남은 선수가 없습니다.</p>
            )}
          </div>
        </section>
      </section>

      {inspector}
    </section>
  );
}

function LegendChallengeView({
  challengeId,
  inspector,
  onChallengeChange,
  onOpenBestXi,
  onPlayerSelect,
  onRandomChallenge,
  onSaveSquad,
  players,
  weights,
}: {
  challengeId: ChallengeId;
  inspector: ReactNode;
  onChallengeChange: (challengeId: ChallengeId) => void;
  onOpenBestXi: (starters: Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>, challenge: ChallengeOption) => void;
  onPlayerSelect: (playerId: string) => void;
  onRandomChallenge: () => void;
  onSaveSquad: (starters: Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>, challenge: ChallengeOption) => void;
  players: LegendPlayer[];
  weights: WeightMap;
}) {
  const [exportText, setExportText] = useState("");
  const challenge = challengeOptions.find((item) => item.id === challengeId) ?? challengeOptions[0];
  const formation = formations[challenge.formationId] ?? formations["4-3-3"];
  const challengePool = useMemo(
    () =>
      players
        .filter(challenge.test)
        .map((player) => ({ player, rating: ratePlayer(player, weights) }))
        .sort((a, b) => b.rating - a.rating || (a.player.topTierRank ?? 999) - (b.player.topTierRank ?? 999) || a.player.name.localeCompare(b.player.name)),
    [challenge, players, weights],
  );
  const squad = useMemo(
    () => buildSquad(challengePool.map(({ player }) => player), challengePool.map(({ player }) => player), formation.slots, weights, {}),
    [challengePool, formation.slots, weights],
  );
  const starters = formation.slots
    .map((slot) => {
      const selected = squad[slot.id];
      return selected ? { slot, player: selected.player, rating: selected.rating } : null;
    })
    .filter(Boolean) as Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;
  const starterIds = new Set(starters.map((starter) => starter.player.id));
  const bench = challengePool.filter(({ player }) => !starterIds.has(player.id)).slice(0, 12);
  const averageRating = average(starters.map((starter) => starter.rating));
  const targetGap = averageRating - challenge.target;
  const continentMix = continentOptions
    .map((continent) => ({
      continent,
      count: starters.filter((starter) => starter.player.continent === continent).length,
    }))
    .filter((item) => item.count > 0);
  const topCountries = Object.entries(
    starters.reduce<Record<string, number>>((counts, starter) => {
      counts[starter.player.country] = (counts[starter.player.country] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4);

  return (
    <section className="challenge-grid">
      <aside className="challenge-sidebar">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Legend Challenge</p>
            <h2>제약 조건 XI</h2>
          </div>
          <label className="field">
            <span>챌린지</span>
            <select value={challenge.id} onChange={(event) => onChallengeChange(event.target.value as ChallengeId)}>
              {challengeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · {item.difficulty}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" onClick={onRandomChallenge} type="button">
            랜덤 챌린지
          </button>
          <p className="challenge-description">{challenge.description}</p>
        </section>

        <section className="challenge-score-card">
          <p className="eyebrow">Target</p>
          <h2>{averageRating}</h2>
          <span className={targetGap >= 0 ? "challenge-pass" : "challenge-fail"}>
            목표 {challenge.target} · {targetGap >= 0 ? `+${targetGap}` : targetGap}
          </span>
          <div className="draft-progress">
            <i>
              <b style={{ width: `${clamp(Math.round((averageRating / Math.max(challenge.target, 1)) * 100), 0, 100)}%` }} />
            </i>
          </div>
        </section>

        <section className="challenge-meta-card">
          <p className="eyebrow">Pool</p>
          <h2>{challengePool.length} players</h2>
          <div className="challenge-chip-list">
            <span>{formation.name}</span>
            <span>{challenge.difficulty}</span>
            <span>{starters.length}/11 starters</span>
          </div>
        </section>
      </aside>

      <section className="challenge-main">
        <section className="challenge-hero-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">{challenge.difficulty}</p>
              <h2>{challenge.label}</h2>
            </div>
            <div className="pitch-actions">
              <button className="small-button" disabled={!starters.length} onClick={() => setExportText(formatChallengeExport(challenge, formation.name, starters, averageRating))} type="button">
                텍스트 내보내기
              </button>
              <button className="small-button" disabled={!starters.length} onClick={() => onSaveSquad(starters, challenge)} type="button">
                XI 저장
              </button>
              <button className="primary-inline" disabled={!starters.length} onClick={() => onOpenBestXi(starters, challenge)} type="button">
                Best XI로 열기
              </button>
            </div>
          </div>
          <div className="challenge-summary-grid">
            <article>
              <span>평균</span>
              <strong>{averageRating}</strong>
              <small>{targetGap >= 0 ? "목표 달성" : "목표 미달"}</small>
            </article>
            <article>
              <span>후보 풀</span>
              <strong>{challengePool.length}</strong>
              <small>조건 충족 선수</small>
            </article>
            <article>
              <span>포메이션</span>
              <strong>{formation.name}</strong>
              <small>{starters.length}명 배치</small>
            </article>
          </div>
        </section>

        <section className="challenge-board-grid">
          <article className="challenge-xi-panel">
            <div className="section-heading">
              <p className="eyebrow">Auto XI</p>
              <h2>챌린지 베스트</h2>
            </div>
            <BattleXiList onPlayerSelect={onPlayerSelect} starters={starters} />
          </article>
          <article className="challenge-xi-panel">
            <div className="section-heading">
              <p className="eyebrow">Balance</p>
              <h2>구성 분석</h2>
            </div>
            <div className="challenge-analysis-list">
              {continentMix.map((item) => (
                <span key={item.continent}>
                  {item.continent}
                  <strong>{item.count}</strong>
                </span>
              ))}
              {topCountries.map(([country, count]) => (
                <span key={country}>
                  {country}
                  <strong>{count}</strong>
                </span>
              ))}
            </div>
          </article>
        </section>

        {exportText ? (
          <section className="challenge-export-panel">
            <div className="section-heading row">
              <div>
                <p className="eyebrow">Export</p>
                <h2>챌린지 XI 텍스트</h2>
              </div>
              <button className="small-button" onClick={() => setExportText("")} type="button">
                닫기
              </button>
            </div>
            <textarea readOnly value={exportText} />
          </section>
        ) : null}

        <section className="challenge-bench-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Bench</p>
              <h2>남은 주요 후보</h2>
            </div>
            <span className="saved-count">{bench.length}</span>
          </div>
          <div className="challenge-bench-grid">
            {bench.map(({ player, rating }) => (
              <PlayerMiniCard key={player.id} onClick={() => onPlayerSelect(player.id)} player={player} rating={rating} />
            ))}
          </div>
        </section>
      </section>

      {inspector}
    </section>
  );
}

function LegendQuizView({
  inspector,
  onPlayerSelect,
  players,
}: {
  inspector: ReactNode;
  onPlayerSelect: (playerId: string) => void;
  players: LegendPlayer[];
}) {
  const [targetId, setTargetId] = useState(() => chooseQuizPlayer(players)?.id ?? "");
  const [revealedCount, setRevealedCount] = useState(2);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<"playing" | "correct" | "wrong" | "revealed">("playing");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const target = players.find((player) => player.id === targetId) ?? players[0];
  const normalizedGuess = normalizeQuizAnswer(guess);
  const suggestions = useMemo(() => {
    if (!normalizedGuess) {
      return players
        .filter((player) => player.topTierRank !== null)
        .sort((a, b) => (a.topTierRank ?? 999) - (b.topTierRank ?? 999))
        .slice(0, 8);
    }

    return players
      .filter((player) => normalizeQuizAnswer(player.name).includes(normalizedGuess))
      .sort((a, b) => getPlayerSearchRank(a, guess.trim().toLowerCase()) - getPlayerSearchRank(b, guess.trim().toLowerCase()) || b.overallScore - a.overallScore)
      .slice(0, 8);
  }, [guess, normalizedGuess, players]);

  if (!target) {
    return (
      <section className="quiz-grid">
        <section className="quiz-main">
          <p className="empty-state">퀴즈에 사용할 선수가 없습니다.</p>
        </section>
        {inspector}
      </section>
    );
  }

  const strongestKey = getPrimaryScoreKey(target);
  const targetEra = getPlayerEra(target);
  const clues = [
    { label: "포지션", value: target.primaryPosition },
    { label: "대륙", value: target.continent },
    { label: "티어", value: `${getLegendTier(target.overallScore).label} (${getLegendTier(target.overallScore).range})` },
    { label: "최고 강점", value: `${scoreLabels[strongestKey]} ${target.scores[strongestKey]}` },
    { label: "대표 시대", value: `${targetEra.label} · ${targetEra.range}` },
    { label: "국가", value: target.country },
    { label: "프로필", value: maskQuizAnswer(target.profile.summary, target.name) },
  ];
  const visibleClues = clues.slice(0, revealedCount);
  const isFinished = status === "correct" || status === "revealed";

  function startNextQuiz() {
    const nextPlayer = chooseQuizPlayer(players, target.id);
    setTargetId(nextPlayer?.id ?? "");
    setRevealedCount(2);
    setGuess("");
    setAttempts(0);
    setStatus("playing");
  }

  function submitGuess(value = guess) {
    const normalizedValue = normalizeQuizAnswer(value);
    if (!normalizedValue || isFinished) {
      return;
    }

    if (normalizeQuizAnswer(target.name) === normalizedValue) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((current) => Math.max(current, nextStreak));
      setStatus("correct");
      setGuess(target.name);
      return;
    }

    setAttempts((current) => current + 1);
    setStatus("wrong");
  }

  function revealAnswer() {
    setStatus("revealed");
    setStreak(0);
    setGuess(target.name);
  }

  return (
    <section className="quiz-grid">
      <aside className="quiz-sidebar">
        <section className="quiz-score-card">
          <p className="eyebrow">Legend Quiz</p>
          <h2>{isFinished ? target.name : "Who is it?"}</h2>
          <div className="quiz-stat-grid">
            <span>
              연속
              <strong>{streak}</strong>
            </span>
            <span>
              최고
              <strong>{bestStreak}</strong>
            </span>
            <span>
              시도
              <strong>{attempts}</strong>
            </span>
          </div>
        </section>

        <section className="quiz-control-card">
          <button className="primary-button" onClick={startNextQuiz} type="button">
            다음 문제
          </button>
          <button className="ghost-button compact-button" disabled={revealedCount >= clues.length || isFinished} onClick={() => setRevealedCount((current) => Math.min(current + 1, clues.length))} type="button">
            힌트 더 보기
          </button>
          <button className="ghost-button compact-button" disabled={isFinished} onClick={revealAnswer} type="button">
            정답 공개
          </button>
        </section>
      </aside>

      <section className="quiz-main">
        <section className="quiz-play-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Guess Player</p>
              <h2>힌트로 선수 맞히기</h2>
            </div>
            <span className={status === "correct" ? "quiz-status correct" : status === "wrong" ? "quiz-status wrong" : status === "revealed" ? "quiz-status revealed" : "quiz-status"}>
              {status === "correct" ? "정답" : status === "wrong" ? "오답" : status === "revealed" ? "공개됨" : "진행 중"}
            </span>
          </div>
          <div className="quiz-clue-grid">
            {visibleClues.map((clue) => (
              <article className="quiz-clue-card" key={clue.label}>
                <span>{clue.label}</span>
                <strong>{clue.value}</strong>
              </article>
            ))}
          </div>
          <form
            className="quiz-answer-row"
            onSubmit={(event) => {
              event.preventDefault();
              submitGuess();
            }}
          >
            <input className="search-input" disabled={isFinished} onChange={(event) => setGuess(event.target.value)} placeholder="선수 이름 입력" type="search" value={guess} />
            <button className="primary-inline" disabled={isFinished || !guess.trim()} type="submit">
              제출
            </button>
          </form>
          {isFinished ? (
            <div className="quiz-answer-card">
              <div>
                <p className="eyebrow">{target.country} · {target.primaryPosition}</p>
                <h2>{target.name}</h2>
                <span className={`tier-badge ${getLegendTier(target.overallScore).id}`}>{getLegendTier(target.overallScore).label}</span>
              </div>
              <button className="primary-inline" onClick={() => onPlayerSelect(target.id)} type="button">
                선수 정보 보기
              </button>
            </div>
          ) : null}
        </section>

        <section className="quiz-suggestion-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Quick Picks</p>
              <h2>후보 선택</h2>
            </div>
            <span className="saved-count">{suggestions.length}</span>
          </div>
          <div className="quiz-suggestion-grid">
            {suggestions.map((player) => (
              <button disabled={isFinished} key={player.id} onClick={() => submitGuess(player.name)} type="button">
                <strong>{player.name}</strong>
                <span>
                  {player.country} · {player.primaryPosition} · {getLegendTier(player.overallScore).label}
                </span>
              </button>
            ))}
          </div>
        </section>
      </section>

      {inspector}
    </section>
  );
}

function BestXiView({
  activeDragSlotRef,
  averageRating,
  builderContinent,
  builderCountries,
  builderCountry,
  builderPosition,
  builderTier,
  candidatePlayers,
  candidateQuery,
  compareIds,
  dragStartPositionsRef,
  draggingSlotId,
  dropTargetRole,
  dropTargetSlotId,
  exportedSquadText,
  finalizeSlotDrag,
  formation,
  formationId,
  getSlotPositionsForDrag,
  inspector,
  manualSlots,
  onAssignPlayer,
  onCandidateQueryChange,
  onContinentChange,
  onCountryChange,
  onDeleteSavedSquad,
  onExport,
  onExportDismiss,
  onFormationChange,
  onLoadSavedSquad,
  onPlayerSelect,
  onPositionChange,
  onTierChange,
  onRenameSavedSquad,
  onResetPositions,
  onSave,
  onSelectedSlotChange,
  onToggleCompare,
  onTopOnlyChange,
  onWeightChange,
  pitchRef,
  savedSquads,
  selectedSlotId,
  setDraggingSlotId,
  setDropTargetSlotId,
  setDropTargetRole,
  slotPositions,
  squad,
  topOnly,
  updateSlotPosition,
  weights,
}: {
  activeDragSlotRef: MutableRefObject<string | null>;
  averageRating: number;
  builderContinent: Continent | FilterValue;
  builderCountries: LegendData["countries"];
  builderCountry: string | FilterValue;
  builderPosition: PositionCode | FilterValue;
  builderTier: LegendTierId | FilterValue;
  candidatePlayers: Array<{ player: LegendPlayer; rating: number }>;
  candidateQuery: string;
  compareIds: string[];
  dragStartPositionsRef: MutableRefObject<Record<string, SlotPosition>>;
  draggingSlotId: string | null;
  dropTargetRole: PitchRole | null;
  dropTargetSlotId: string | null;
  exportedSquadText: string;
  finalizeSlotDrag: (slotId: string, event: DragPoint) => void;
  formation: { name: string; slots: FormationSlot[] };
  formationId: string;
  getSlotPositionsForDrag: () => Record<string, SlotPosition>;
  inspector: ReactNode;
  manualSlots: Record<string, string>;
  onAssignPlayer: (playerId: string) => void;
  onCandidateQueryChange: (query: string) => void;
  onContinentChange: (value: Continent | FilterValue) => void;
  onCountryChange: (value: string | FilterValue) => void;
  onDeleteSavedSquad: (savedId: string) => void;
  onExport: () => void;
  onExportDismiss: () => void;
  onFormationChange: (formationId: string) => void;
  onLoadSavedSquad: (saved: SavedSquad) => void;
  onPlayerSelect: (playerId: string) => void;
  onPositionChange: (value: PositionCode | FilterValue) => void;
  onTierChange: (value: LegendTierId | FilterValue) => void;
  onRenameSavedSquad: (savedId: string, name: string) => void;
  onResetPositions: () => void;
  onSave: () => void;
  onSelectedSlotChange: (slotId: string) => void;
  onToggleCompare: (playerId: string) => void;
  onTopOnlyChange: (value: boolean) => void;
  onWeightChange: (key: ScoreKey, value: number) => void;
  pitchRef: RefObject<HTMLDivElement | null>;
  savedSquads: SavedSquad[];
  selectedSlotId: string;
  setDraggingSlotId: (slotId: string | null) => void;
  setDropTargetSlotId: (slotId: string | null) => void;
  setDropTargetRole: (role: PitchRole | null) => void;
  slotPositions: Record<string, SlotPosition>;
  squad: Record<string, { player: LegendPlayer; rating: number }>;
  topOnly: boolean;
  updateSlotPosition: (slotId: string, event: DragPoint) => void;
  weights: WeightMap;
}) {
  const selectedSlot = formation.slots.find((slot) => slot.id === selectedSlotId) ?? formation.slots[0];
  const dragPointerStartRef = useRef<DragPoint | null>(null);

  function isDraggingPastThreshold(event: DragPoint) {
    const start = dragPointerStartRef.current;
    if (!start) {
      return true;
    }

    return Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > 4;
  }

  function clearDragState() {
    activeDragSlotRef.current = null;
    dragPointerStartRef.current = null;
    setDraggingSlotId(null);
    setDropTargetSlotId(null);
    setDropTargetRole(null);
  }

  useEffect(() => {
    if (!draggingSlotId) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const slotId = activeDragSlotRef.current;
      if (slotId) {
        if (!isDraggingPastThreshold(event)) {
          return;
        }
        updateSlotPosition(slotId, event);
      }
    }

    function handleMouseUp(event: MouseEvent) {
      const slotId = activeDragSlotRef.current;
      if (slotId) {
        if (!isDraggingPastThreshold(event)) {
          clearDragState();
          return;
        }
        finalizeSlotDrag(slotId, event);
        dragPointerStartRef.current = null;
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeDragSlotRef, draggingSlotId, finalizeSlotDrag, updateSlotPosition]);

  return (
    <section className="builder-grid">
      <aside className="builder-finder-panel">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">World Builder</p>
            <h2>필터와 기준</h2>
          </div>
          <label className="field">
            <span>대륙</span>
            <select value={builderContinent} onChange={(event) => onContinentChange(event.target.value as Continent | FilterValue)}>
              <option value="ALL">전체</option>
              {continentOptions.map((continent) => (
                <option key={continent} value={continent}>
                  {continent}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>국가</span>
            <select value={builderCountry} onChange={(event) => onCountryChange(event.target.value)}>
              <option value="ALL">전체</option>
              {builderCountries.map((country) => (
                <option key={country.name} value={country.name}>
                  {country.name} ({country.count})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>포지션</span>
            <select value={builderPosition} onChange={(event) => onPositionChange(event.target.value as PositionCode | FilterValue)}>
              <option value="ALL">전체</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>레전드 티어</span>
            <select value={builderTier} onChange={(event) => onTierChange(event.target.value as LegendTierId | FilterValue)}>
              <option value="ALL">전체</option>
              {legendTiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.label} ({tier.range})
                </option>
              ))}
            </select>
          </label>
          <div className="toggles vertical">
            <label>
              <input checked={topOnly} onChange={(event) => onTopOnlyChange(event.target.checked)} type="checkbox" />
              Top 50 기본 리스트
            </label>
          </div>
          <div className="slider-stack compact">
            {(Object.keys(scoreLabels) as ScoreKey[]).map((key) => (
              <label className="slider-row" key={key}>
                <span>
                  {scoreLabels[key]}
                  <strong>{weights[key]}</strong>
                </span>
                <input max="50" min="0" onChange={(event) => onWeightChange(key, Number(event.target.value))} type="range" value={weights[key]} />
              </label>
            ))}
          </div>
        </section>
        <section className="candidate-panel">
          <div className="section-heading">
            <p className="eyebrow">Selected Slot</p>
            <h2>{selectedSlot.label} 후보</h2>
          </div>
          <input
            className="search-input"
            onChange={(event) => onCandidateQueryChange(event.target.value)}
            placeholder="선수, 국가, 포지션 검색"
            type="search"
            value={candidateQuery}
          />
          <div className="candidate-list">
            {candidatePlayers.map(({ player, rating }) => (
              <article className="candidate-item" key={player.id}>
                <button onClick={() => onAssignPlayer(player.id)} type="button">
                  <strong>{player.name}</strong>
                  <span>
                    {player.country} · {player.primaryPosition} · {rating} · {getLegendTier(player.overallScore).label}
                  </span>
                </button>
                <div>
                  <button onClick={() => onPlayerSelect(player.id)} type="button">
                    정보
                  </button>
                  <button
                    className={compareIds.includes(player.id) ? "active" : ""}
                    onClick={() => onToggleCompare(player.id)}
                    type="button"
                  >
                    비교
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </aside>

      <section className="pitch-panel">
        <div className="section-heading row">
          <div>
            <p className="eyebrow">Best XI</p>
            <h2>{formation.name} Custom XI</h2>
          </div>
          <div className="pitch-actions">
            <button className="small-button" onClick={onSave} type="button">
              XI 저장
            </button>
            <button className="small-button" onClick={onExport} type="button">
              텍스트 내보내기
            </button>
            <button className="small-button" onClick={onResetPositions} type="button">
              위치 초기화
            </button>
            <span className="rating-pill">{averageRating}</span>
          </div>
        </div>
        <div className="formation-tabs compact-tabs">
          {Object.entries(formations).map(([id, item]) => (
            <button className={id === formationId ? "tab active" : "tab"} key={id} onClick={() => onFormationChange(id)} type="button">
              {item.name}
            </button>
          ))}
        </div>
        <div className="pitch" aria-label="축구장" ref={pitchRef}>
          <div className="center-circle" />
          <div className="box top-box" />
          <div className="box bottom-box" />
          {pitchZones.map((zone) => (
            <div
              aria-hidden="true"
              className={dropTargetRole === zone.role ? "pitch-zone active" : "pitch-zone"}
              key={zone.role}
              style={{
                height: `${zone.height}%`,
                left: `${zone.left}%`,
                top: `${zone.top}%`,
                width: `${zone.width}%`,
              }}
            >
              {zone.role}
            </div>
          ))}
          {formation.slots.map((slot) => {
            const selected = squad[slot.id];
            const position = slotPositions[slot.id] ?? { left: slot.left, top: slot.top };
            const fit = selected ? positionFit(selected.player.primaryPosition, slot.accepts) : null;
            return (
              <div
                aria-label={`${slot.label} ${selected?.player.name ?? "비어 있음"} 위치 이동`}
                className={[
                  "player-token",
                  selectedSlotId === slot.id ? "selected" : "",
                  dropTargetSlotId === slot.id ? "drop-target" : "",
                  draggingSlotId === slot.id ? "dragging" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={slot.id}
                onClick={() => {
                  onSelectedSlotChange(slot.id);
                  if (selected) {
                    onPlayerSelect(selected.player.id);
                  }
                }}
                onPointerCancel={() => {
                  clearDragState();
                }}
                onPointerDown={(event) => {
                  activeDragSlotRef.current = slot.id;
                  dragPointerStartRef.current = { clientX: event.clientX, clientY: event.clientY };
                  dragStartPositionsRef.current = getSlotPositionsForDrag();
                  setDraggingSlotId(slot.id);
                  onSelectedSlotChange(slot.id);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (activeDragSlotRef.current === slot.id) {
                    if (!isDraggingPastThreshold(event)) {
                      return;
                    }
                    updateSlotPosition(slot.id, event);
                  }
                }}
                onPointerUp={(event) => {
                  if (!isDraggingPastThreshold(event)) {
                    clearDragState();
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    return;
                  }
                  finalizeSlotDrag(slot.id, event);
                  dragPointerStartRef.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
                onMouseDown={(event) => {
                  if (activeDragSlotRef.current) {
                    return;
                  }
                  activeDragSlotRef.current = slot.id;
                  dragPointerStartRef.current = { clientX: event.clientX, clientY: event.clientY };
                  dragStartPositionsRef.current = getSlotPositionsForDrag();
                  setDraggingSlotId(slot.id);
                  onSelectedSlotChange(slot.id);
                }}
                role="button"
                style={{ left: `${position.left}%`, top: `${position.top}%` }}
                tabIndex={0}
                title="드래그해서 위치와 포지션 구역을 바꾸기"
              >
                <span className="slot-label">{slot.label}</span>
                <strong>{selected?.player.name ?? "비어 있음"}</strong>
                <small>{selected ? `${selected.player.country} · ${selected.rating}` : slot.accepts.join("/")}</small>
                {fit !== null ? <span className={`fit-badge ${getFitLevel(fit)}`}>적합 {Math.round(fit * 100)}%</span> : null}
              </div>
            );
          })}
        </div>
        {exportedSquadText ? <SquadExportPanel exportText={exportedSquadText} onDismiss={onExportDismiss} /> : null}
        <SavedSquadsPanel savedSquads={savedSquads} onDelete={onDeleteSavedSquad} onLoad={onLoadSavedSquad} onRename={onRenameSavedSquad} />
      </section>

      {inspector}
    </section>
  );
}

function SquadExportPanel({ exportText, onDismiss }: { exportText: string; onDismiss: () => void }) {
  return (
    <section className="saved-panel squad-export-panel">
      <div className="section-heading row">
        <div>
          <p className="eyebrow">Export</p>
          <h2>현재 XI 텍스트</h2>
        </div>
        <button className="small-button" onClick={onDismiss} type="button">
          닫기
        </button>
      </div>
      <textarea readOnly value={exportText} />
    </section>
  );
}

function SavedSquadsPanel({
  onDelete,
  onLoad,
  onRename,
  savedSquads,
}: {
  onDelete: (savedId: string) => void;
  onLoad: (saved: SavedSquad) => void;
  onRename: (savedId: string, name: string) => void;
  savedSquads: SavedSquad[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  function beginEdit(saved: SavedSquad) {
    setEditingId(saved.id);
    setDraftName(saved.name);
  }

  function commitEdit(savedId: string) {
    onRename(savedId, draftName);
    setEditingId(null);
    setDraftName("");
  }

  return (
    <section className="saved-panel saved-xi-panel">
      <div className="section-heading row">
        <div>
          <p className="eyebrow">Saved XI</p>
          <h2>저장한 조합</h2>
        </div>
        <span className="saved-count">{savedSquads.length}/20</span>
      </div>
      {savedSquads.length === 0 ? (
        <p className="empty-state">마음에 드는 XI를 저장하면 여기서 다시 불러올 수 있습니다.</p>
      ) : (
        <div className="saved-list">
          {savedSquads.map((saved) => (
            <article className="saved-item" key={saved.id}>
              <div className="saved-main">
                {editingId === saved.id ? (
                  <label className="saved-name-editor">
                    <span>이름</span>
                    <input onChange={(event) => setDraftName(event.target.value)} type="text" value={draftName} />
                  </label>
                ) : (
                  <button className="saved-load-button" onClick={() => onLoad(saved)} type="button">
                    <span>
                      <strong>{saved.name}</strong>
                      <small>
                        {saved.scope} · {saved.formationName} · {formatSavedDate(saved.createdAt)}
                      </small>
                    </span>
                    <em>{Math.round(saved.slots.reduce((sum, slot) => sum + slot.rating, 0) / Math.max(saved.slots.length, 1))}</em>
                  </button>
                )}
              </div>
              <div className="saved-preview" aria-label={`${saved.name} 선수 목록`}>
                {saved.slots.slice(0, 6).map((slot) => (
                  <span key={`${saved.id}-${slot.slotId}`}>
                    {slot.slotLabel} {slot.playerName}
                  </span>
                ))}
              </div>
              <div className="saved-actions">
                {editingId === saved.id ? (
                  <>
                    <button onClick={() => commitEdit(saved.id)} type="button">
                      저장
                    </button>
                    <button onClick={() => setEditingId(null)} type="button">
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => beginEdit(saved)} type="button">
                      이름
                    </button>
                    <button onClick={() => onDelete(saved.id)} type="button">
                      삭제
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MatchSimulatorView({
  countries,
  inspector,
  matchMode,
  onClearHistory,
  onMatchModeChange,
  onPlayerSelect,
  onRandomSeed,
  onRandomnessChange,
  onRun,
  onSeedChange,
  onTeamACountryChange,
  onTeamASavedSquadChange,
  onTeamASourceChange,
  onTeamBCountryChange,
  onTeamBSavedSquadChange,
  onTeamBSourceChange,
  onTacticsAChange,
  onTacticsBChange,
  randomness,
  result,
  seed,
  savedSquads,
  seriesResults,
  simHistory,
  teamA,
  teamACountry,
  teamASavedSquadId,
  teamASource,
  teamB,
  teamBCountry,
  teamBSavedSquadId,
  teamBSource,
  tacticsA,
  tacticsB,
}: {
  countries: LegendData["countries"];
  inspector: ReactNode;
  matchMode: SimMatchMode;
  onClearHistory: () => void;
  onMatchModeChange: (value: SimMatchMode) => void;
  onPlayerSelect: (playerId: string) => void;
  onRandomSeed: () => void;
  onRandomnessChange: (value: RandomnessLevel) => void;
  onRun: () => void;
  onSeedChange: (value: string) => void;
  onTeamACountryChange: (value: string) => void;
  onTeamASavedSquadChange: (value: string) => void;
  onTeamASourceChange: (value: SimTeamSource) => void;
  onTeamBCountryChange: (value: string) => void;
  onTeamBSavedSquadChange: (value: string) => void;
  onTeamBSourceChange: (value: SimTeamSource) => void;
  onTacticsAChange: (value: SimulationTactics) => void;
  onTacticsBChange: (value: SimulationTactics) => void;
  randomness: RandomnessLevel;
  result: SimulatedMatchResult | null;
  seed: string;
  savedSquads: SavedSquad[];
  seriesResults: SimSeriesMatch[];
  simHistory: SimHistoryEntry[];
  teamA: SimulationTeamInput;
  teamACountry: string;
  teamASavedSquadId: string;
  teamASource: SimTeamSource;
  teamB: SimulationTeamInput;
  teamBCountry: string;
  teamBSavedSquadId: string;
  teamBSource: SimTeamSource;
  tacticsA: SimulationTactics;
  tacticsB: SimulationTactics;
}) {
  const statsA = result?.stats[teamA.id] ?? null;
  const statsB = result?.stats[teamB.id] ?? null;
  const topEvents = result?.events.filter((event) => event.outcome === "goal" || event.xg >= 0.1).slice(0, 12) ?? [];
  const topRatings = result?.playerRatings.slice(0, 10) ?? [];
  const seriesSummary = seriesResults.length ? getSeriesSummary(seriesResults, teamA, teamB, matchMode) : null;
  const historySummary = getSimHistorySummary(simHistory);

  return (
    <section className="sim-grid">
      <aside className="sim-sidebar">
        <div className="section-heading">
          <p className="eyebrow">Match Sim</p>
          <h2>경기 설정</h2>
        </div>
        <TeamSimControl
          countries={countries}
          label="Team A"
          onCountryChange={onTeamACountryChange}
          onSavedSquadChange={onTeamASavedSquadChange}
          onSourceChange={onTeamASourceChange}
          onTacticsChange={onTacticsAChange}
          savedSquads={savedSquads}
          selectedCountry={teamACountry}
          selectedSavedSquadId={teamASavedSquadId}
          source={teamASource}
          tactics={tacticsA}
          team={teamA}
        />
        <TeamSimControl
          countries={countries}
          label="Team B"
          onCountryChange={onTeamBCountryChange}
          onSavedSquadChange={onTeamBSavedSquadChange}
          onSourceChange={onTeamBSourceChange}
          onTacticsChange={onTacticsBChange}
          savedSquads={savedSquads}
          selectedCountry={teamBCountry}
          selectedSavedSquadId={teamBSavedSquadId}
          source={teamBSource}
          tactics={tacticsB}
          team={teamB}
        />
        <label className="field">
          <span>랜덤성</span>
          <select value={randomness} onChange={(event) => onRandomnessChange(event.target.value as RandomnessLevel)}>
            <option value="controlled">Controlled</option>
            <option value="normal">Normal</option>
            <option value="wild">Wild</option>
          </select>
        </label>
        <label className="field">
          <span>경기 방식</span>
          <select value={matchMode} onChange={(event) => onMatchModeChange(event.target.value as SimMatchMode)}>
            <option value="single">Single Match</option>
            <option value="best-of-3">Best of 3</option>
            <option value="home-away">Home & Away</option>
          </select>
        </label>
        <label className="field">
          <span>Seed</span>
          <input className="search-input" onChange={(event) => onSeedChange(event.target.value)} type="text" value={seed} />
        </label>
        <div className="sim-actions">
          <button className="primary-button" disabled={teamA.slots.length < 7 || teamB.slots.length < 7} onClick={onRun} type="button">
            시뮬레이션 실행
          </button>
          <button className="ghost-button" disabled={teamA.slots.length < 7 || teamB.slots.length < 7} onClick={onRandomSeed} type="button">
            새 경기 다시 돌리기
          </button>
        </div>
        <section className="sim-history-panel">
          <div className="section-heading row compact-heading">
            <div>
              <p className="eyebrow">History</p>
              <h3>전적 보드</h3>
            </div>
            <button disabled={simHistory.length === 0} onClick={onClearHistory} type="button">
              Clear
            </button>
          </div>
          <div className="sim-history-summary">
            <span>
              <strong>{historySummary.total}</strong>
              <small>runs</small>
            </span>
            <span>
              <strong>{historySummary.averageGoals}</strong>
              <small>avg goals</small>
            </span>
            <span>
              <strong>{historySummary.topWinner}</strong>
              <small>top winner</small>
            </span>
          </div>
          {simHistory.length ? (
            <div className="sim-history-list">
              {simHistory.slice(0, 6).map((entry) => (
                <article key={entry.id}>
                  <div>
                    <strong>{entry.winnerName}</strong>
                    <small>
                      {entry.teamAName} {entry.teamAGoals}-{entry.teamBGoals} {entry.teamBName}
                    </small>
                  </div>
                  <span>{formatSimMode(entry.mode)}</span>
                  <em>{formatSavedDate(entry.createdAt)}</em>
                </article>
              ))}
            </div>
          ) : (
            <p className="sim-inline-empty">아직 저장된 시뮬레이션 기록이 없습니다.</p>
          )}
        </section>
      </aside>

      <section className="sim-main">
        <div className="sim-scoreboard">
          <div>
            <span>{teamA.name}</span>
            <strong>{statsA?.goals ?? "-"}</strong>
            <small>{statsA ? `xG ${statsA.xg.toFixed(2)} · 점유 ${statsA.possession}%` : `${teamA.slots.length} players`}</small>
          </div>
          <em>vs</em>
          <div>
            <span>{teamB.name}</span>
            <strong>{statsB?.goals ?? "-"}</strong>
            <small>{statsB ? `xG ${statsB.xg.toFixed(2)} · 점유 ${statsB.possession}%` : `${teamB.slots.length} players`}</small>
          </div>
        </div>

        {result ? (
          <>
            <LiveMatchViewer onPlayerSelect={onPlayerSelect} result={result} tacticsA={tacticsA} tacticsB={tacticsB} teamA={teamA} teamB={teamB} />
            {seriesSummary ? (
              <section className="sim-panel">
                <div className="section-heading row">
                  <div>
                    <p className="eyebrow">Series</p>
                    <h2>{seriesSummary.title}</h2>
                  </div>
                  <span className="saved-count">{seriesResults.length} matches</span>
                </div>
                <div className="sim-series-grid">
                  <Metric label="Winner" value={seriesSummary.winnerName} detail={seriesSummary.method} />
                  <Metric label="Record" value={`${seriesSummary.teamAWins}-${seriesSummary.teamBWins}`} detail={`${teamA.name} - ${teamB.name}`} />
                  <Metric label="Goals" value={`${seriesSummary.teamAGoals}-${seriesSummary.teamBGoals}`} detail="시리즈 합산 득점" />
                  <Metric label="xG" value={`${seriesSummary.teamAXg.toFixed(2)}-${seriesSummary.teamBXg.toFixed(2)}`} detail="시리즈 합산 xG" />
                </div>
                <div className="sim-series-list">
                  {seriesResults.map((match) => {
                    const matchStatsA = match.result.stats[teamA.id];
                    const matchStatsB = match.result.stats[teamB.id];
                    return (
                      <article key={match.label}>
                        <span>{match.label}</span>
                        <strong>
                          {matchStatsA.goals}-{matchStatsB.goals}
                        </strong>
                        <small>
                          xG {matchStatsA.xg.toFixed(2)}-{matchStatsB.xg.toFixed(2)} · 홈 {match.homeTeamId === teamA.id ? teamA.name : teamB.name}
                        </small>
                      </article>
                    );
                  })}
                </div>
                <div className="sim-series-leaders">
                  {seriesSummary.leaders.map((leader) => (
                    <button key={`${leader.label}-${leader.player.playerId}`} onClick={() => onPlayerSelect(leader.player.playerId)} type="button">
                      <span>{leader.label}</span>
                      <strong>{leader.player.playerName}</strong>
                      <small>
                        {leader.teamName} · {leader.detail}
                      </small>
                      <em>{leader.value}</em>
                    </button>
                  ))}
                </div>
                <div className="sim-report-grid">
                  <ReportList title="Series Read" items={seriesSummary.insights} />
                  <ReportList title="Control" items={seriesSummary.controlNotes} />
                  <ReportList title="Players" items={seriesSummary.playerNotes} />
                  <ReportList title="Swing" items={seriesSummary.swingNotes} />
                </div>
              </section>
            ) : null}
            <div className="sim-metric-grid">
              <Metric label="Shots" value={`${statsA?.shots ?? 0}-${statsB?.shots ?? 0}`} detail="전체 슈팅" />
              <Metric label="SOT" value={`${statsA?.shotsOnTarget ?? 0}-${statsB?.shotsOnTarget ?? 0}`} detail="유효 슈팅" />
              <Metric label="Press" value={`${statsA?.pressingWins ?? 0}-${statsB?.pressingWins ?? 0}`} detail="압박 탈취" />
              <Metric label="Seed" value={result.matchSeed.slice(-8)} detail="동일 seed 재현 가능" />
            </div>

            <section className="sim-panel">
              <div className="section-heading">
                <p className="eyebrow">Tactical Report</p>
                <h2>경기 해석</h2>
              </div>
              <div className="sim-report-grid">
                <ReportList title="Why" items={result.report.whyTheyWon} />
                <ReportList title="Edges" items={result.report.tacticalEdges} />
                <ReportList title="Key" items={result.report.keyPlayerImpacts} />
                <ReportList title="Notes" items={result.report.notes} />
                <ReportList title="Balance" items={result.report.balanceInsights} />
                <ReportList title="Weak" items={result.report.weakPoints} />
              </div>
            </section>

            <section className="sim-panel">
              <div className="section-heading row">
                <div>
                  <p className="eyebrow">Timeline</p>
                  <h2>주요 장면</h2>
                </div>
                <span className="saved-count">{result.events.length} events</span>
              </div>
              <div className="sim-event-list">
                {topEvents.map((event, index) => (
                  <article className={event.outcome === "goal" ? "sim-event goal" : "sim-event"} key={`${event.minute}-${event.teamId}-${index}`}>
                    <span>{event.minute}'</span>
                    <div>
                      <strong>
                        {event.outcome.toUpperCase()} · xG {event.xg.toFixed(2)}
                      </strong>
                      <p>{event.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="sim-panel">
              <div className="section-heading">
                <p className="eyebrow">Ratings</p>
                <h2>선수 평점</h2>
              </div>
              <div className="sim-rating-list">
                {topRatings.map((rating) => (
                  <button key={rating.playerId} onClick={() => onPlayerSelect(rating.playerId)} type="button">
                    <span>{rating.teamId === teamA.id ? "A" : "B"}</span>
                    <strong>{rating.playerName}</strong>
                    <small>
                      {rating.goals}G · {rating.assists}A
                    </small>
                    <em>{rating.rating.toFixed(1)}</em>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="sim-panel">
            <div className="section-heading">
              <p className="eyebrow">Ready</p>
              <h2>첫 경기를 실행하세요</h2>
            </div>
            <p className="empty-state">전술과 seed를 고른 뒤 시뮬레이션을 실행하면 스코어, xG, 이벤트, 평점, 전술 리포트가 생성됩니다.</p>
          </section>
        )}
      </section>

      {inspector}
    </section>
  );
}

function LiveMatchViewer({
  onPlayerSelect,
  result,
  tacticsA,
  tacticsB,
  teamA,
  teamB,
}: {
  onPlayerSelect: (playerId: string) => void;
  result: SimulatedMatchResult;
  tacticsA: SimulationTactics;
  tacticsB: SimulationTactics;
  teamA: SimulationTeamInput;
  teamB: SimulationTeamInput;
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [sceneStep, setSceneStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const events = result.events;
  const activeEvent = frameIndex > 0 ? events[Math.min(frameIndex - 1, events.length - 1)] : null;
  const completedEventCount = frameIndex === 0 ? 0 : Math.max(0, Math.min(events.length, frameIndex - (sceneStep < 2 ? 1 : 0)));
  const visibleEvents = events.slice(0, completedEventCount);
  const liveScoreA = visibleEvents.filter((event) => event.teamId === teamA.id && event.outcome === "goal").length;
  const liveScoreB = visibleEvents.filter((event) => event.teamId === teamB.id && event.outcome === "goal").length;
  const currentMinute = activeEvent?.minute ?? (frameIndex >= events.length ? 90 : 0);
  const progress = events.length ? Math.round((Math.min(events.length * 3, (frameIndex === 0 ? 0 : (frameIndex - 1) * 3 + sceneStep + 1)) / (events.length * 3)) * 100) : 0;
  const activeTactic = activeEvent?.teamId === teamA.id ? tacticsA : activeEvent?.teamId === teamB.id ? tacticsB : tacticsA;
  const defendingTactic = activeEvent?.defendingTeamId === teamA.id ? tacticsA : activeEvent?.defendingTeamId === teamB.id ? tacticsB : tacticsB;
  const ballPosition = getLiveBallPosition(activeEvent, teamA.id, sceneStep, frameIndex, events.length, activeTactic);
  const eventPath = activeEvent ? getLiveEventPath(activeEvent, teamA.id, activeTactic) : null;
  const pressurePoint = activeEvent ? getLivePressurePoint(activeEvent, teamA.id) : null;
  const latestEvents = visibleEvents.slice(-5).reverse();
  const playerNameById = new Map([...teamA.slots, ...teamB.slots].map((slot) => [slot.player.id, slot.player.name]));
  const possessionTeam = activeEvent?.teamId === teamA.id ? teamA.name : activeEvent?.teamId === teamB.id ? teamB.name : "Neutral";
  const primaryActor = activeEvent?.scorerId ? playerNameById.get(activeEvent.scorerId) : null;
  const secondaryActor = activeEvent?.assisterId ? playerNameById.get(activeEvent.assisterId) : null;

  useEffect(() => {
    setFrameIndex(0);
    setIsPlaying(true);
    setSceneStep(0);
  }, [result.matchSeed]);

  useEffect(() => {
    if (!isPlaying || (frameIndex >= events.length && sceneStep >= 2)) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (frameIndex === 0) {
        setFrameIndex(1);
        setSceneStep(0);
        return;
      }

      if (sceneStep < 2) {
        setSceneStep((current) => Math.min(2, current + 1));
        return;
      }

      setFrameIndex((current) => Math.min(events.length, current + 1));
      setSceneStep(0);
    }, Math.round(520 / speed));

    return () => window.clearTimeout(timer);
  }, [events.length, frameIndex, isPlaying, sceneStep, speed]);

  return (
    <section className="live-match-panel">
      <div className="section-heading row">
        <div>
          <p className="eyebrow">Watch Match</p>
          <h2>실시간 경기 보기</h2>
        </div>
        <span className="saved-count">{currentMinute}'</span>
      </div>
      <div className="live-match-shell">
        <div className="live-pitch-wrap">
          <div className="live-scoreline">
            <span>{teamA.name}</span>
            <strong>
              {liveScoreA}-{liveScoreB}
            </strong>
            <span>{teamB.name}</span>
          </div>
          <div className="live-possession-row">
            <span>Possession</span>
            <strong>{possessionTeam}</strong>
            <em>{secondaryActor && primaryActor ? `${secondaryActor} -> ${primaryActor}` : primaryActor ?? "Shape reset"}</em>
          </div>
          <div className="live-tactic-row">
            <span>{teamA.name}: {formatTacticStyle(tacticsA.style)}</span>
            <strong>{activeEvent ? `${formatTacticStyle(activeTactic.style)} ${getLiveSceneStepLabel(sceneStep)}` : "Pre-match shape"}</strong>
            <span>{teamB.name}: {formatTacticStyle(tacticsB.style)}</span>
          </div>
          <div className={`live-pitch live-step-${sceneStep}`} aria-label="Animated match pitch">
            <div className="live-pitch-line halfway" />
            <div className="live-pitch-line center-circle" />
            <div className="live-box left" />
            <div className="live-box right" />
            {activeEvent && defendingTactic.style === "low-block" ? (
              <div className={`live-low-block-zone ${activeEvent.defendingTeamId === teamA.id ? "left" : "right"}`} />
            ) : null}
            {eventPath ? (
              <svg className="live-action-layer" key={`${activeEvent?.minute}-${activeEvent?.teamId}-${activeEvent?.eventType}-${frameIndex}-${sceneStep}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path className="live-pass-path" d={eventPath.passPath} />
                {eventPath.shotPath && sceneStep >= 2 ? <path className={`live-shot-path ${activeEvent?.outcome === "goal" ? "goal" : ""}`} d={eventPath.shotPath} /> : null}
                {activeTactic.style === "possession" ? <path className="live-support-path" d={eventPath.supportPath} /> : null}
                {activeTactic.style === "counter" || activeTactic.style === "direct" ? <path className="live-direct-path" d={eventPath.directPath} /> : null}
                <circle className="live-path-start" cx={eventPath.start.x} cy={eventPath.start.y} r="1.4" />
                <circle className="live-path-end" cx={eventPath.end.x} cy={eventPath.end.y} r="1.7" />
              </svg>
            ) : null}
            {activeEvent && defendingTactic.style === "high-press" && pressurePoint ? <span className="live-press-ring" style={{ left: `${pressurePoint.x}%`, top: `${pressurePoint.y}%` }} /> : null}
            {[
              ...teamA.slots.map((slot) => ({ side: "A" as const, slot, teamId: teamA.id })),
              ...teamB.slots.map((slot) => ({ side: "B" as const, slot, teamId: teamB.id })),
            ].map(({ side, slot, teamId }) => {
              const position = getLivePlayerPosition(slot, side, activeEvent, teamA.id, frameIndex, side === "A" ? tacticsA : tacticsB);
              const isActor = activeEvent?.scorerId === slot.player.id || activeEvent?.assisterId === slot.player.id;

              return (
                <button
                  className={`live-player-dot ${side === "A" ? "team-a" : "team-b"} ${isActor ? "actor" : ""}`}
                  key={`${teamId}-${slot.id}-${slot.player.id}`}
                  onClick={() => onPlayerSelect(slot.player.id)}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  title={`${slot.role} ${slot.player.name}`}
                  type="button"
                >
                  <span>{slot.role}</span>
                  <em>{getShortName(slot.player.name)}</em>
                </button>
              );
            })}
            <span className={activeEvent?.outcome === "goal" ? "live-ball goal" : "live-ball"} style={{ left: `${ballPosition.x}%`, top: `${ballPosition.y}%` }} />
            {activeEvent ? (
              <div className={`live-event-flash ${activeEvent.outcome === "goal" ? "goal" : ""}`}>
                <span>{activeEvent.eventType}</span>
                <strong>{sceneStep < 2 ? getLiveSceneStepLabel(sceneStep) : activeEvent.outcome.toUpperCase()}</strong>
              </div>
            ) : null}
          </div>
          <div className="live-scene-steps" aria-label="장면 단계">
            {["Build", "Connect", "Finish"].map((label, index) => (
              <span className={activeEvent && sceneStep === index ? "active" : ""} key={label}>
                {label}
              </span>
            ))}
          </div>
          <div className="live-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="live-controls">
            <button onClick={() => setIsPlaying((current) => !current)} type="button">
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => {
                setFrameIndex(0);
                setSceneStep(0);
              }}
              type="button"
            >
              Restart
            </button>
            <button
              disabled={frameIndex >= events.length && sceneStep >= 2}
              onClick={() => {
                if (frameIndex === 0) {
                  setFrameIndex(1);
                  setSceneStep(0);
                  return;
                }

                if (sceneStep < 2) {
                  setSceneStep((current) => Math.min(2, current + 1));
                  return;
                }

                setFrameIndex((current) => Math.min(events.length, current + 1));
                setSceneStep(0);
              }}
              type="button"
            >
              Step
            </button>
            <label>
              <span>Speed</span>
              <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </label>
          </div>
        </div>
        <aside className="live-event-board">
          <div>
            <span>Current</span>
            <strong>{activeEvent ? `${activeEvent.minute}' ${activeEvent.outcome.toUpperCase()}` : frameIndex >= events.length ? "Full Time" : "Kickoff"}</strong>
            <p>{activeEvent?.description ?? "경기 시작 전 포메이션이 정렬되어 있습니다."}</p>
          </div>
          <div className="live-event-feed">
            {latestEvents.length ? (
              latestEvents.map((event, index) => (
                <article className={event.outcome === "goal" ? "goal" : ""} key={`${event.minute}-${event.teamId}-${index}`}>
                  <span>{event.minute}'</span>
                  <p>{event.description}</p>
                </article>
              ))
            ) : (
              <p className="sim-inline-empty">재생이 시작되면 주요 장면이 쌓입니다.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

type LivePoint = {
  x: number;
  y: number;
};

type LiveMatchEvent = SimulatedMatchResult["events"][number];

type LiveEventPath = {
  directPath: string;
  end: LivePoint;
  passPath: string;
  shotPath: string | null;
  start: LivePoint;
  supportPath: string;
};

function getLivePlayerPosition(
  slot: SimulationTeamInput["slots"][number],
  side: "A" | "B",
  activeEvent: LiveMatchEvent | null,
  teamAId: string,
  frameIndex: number,
  tactics: SimulationTactics,
): LivePoint {
  const base = getRolePitchPoint(slot.role, side);

  if (!activeEvent) {
    return base;
  }

  const attackingSide: "A" | "B" = activeEvent.teamId === teamAId ? "A" : "B";
  const isAttacking = side === attackingSide;
  const direction = side === "A" ? 1 : -1;
  const lane = getEventLane(activeEvent);
  const wave = ((frameIndex + slot.player.id.length) % 4) - 1.5;
  const tacticShift = getLiveTacticShift(tactics, isAttacking, direction, activeEvent, slot.role);
  let point: LivePoint = {
    x: base.x + (isAttacking ? direction * 8 : direction * 4) + tacticShift.x,
    y: base.y + wave * 1.6 + tacticShift.y,
  };

  if (activeEvent.assisterId === slot.player.id) {
    point = {
      x: (activeEvent.teamId === teamAId ? lane.buildX : 100 - lane.buildX) + tacticShift.x * 0.35,
      y: lane.y + tacticShift.y * 0.35 + (slot.role === "LW" || slot.role === "LB" ? -4 : slot.role === "RW" || slot.role === "RB" ? 4 : 0),
    };
  }

  if (activeEvent.scorerId === slot.player.id) {
    point = {
      x: (activeEvent.teamId === teamAId ? lane.targetX : 100 - lane.targetX) + tacticShift.x * 0.25,
      y: lane.y + tacticShift.y * 0.25,
    };
  }

  if (!isAttacking && (slot.role === "CB" || slot.role === "DM" || slot.role === "GK")) {
    point = {
      x: base.x - direction * (activeEvent.xg >= 0.16 ? 8 : 4) + tacticShift.x,
      y: base.y + (lane.y - 50) * (tactics.style === "low-block" ? 0.08 : 0.16) + tacticShift.y,
    };
  }

  return clampPoint(point);
}

function getLiveBallPosition(activeEvent: LiveMatchEvent | null, teamAId: string, sceneStep: number, frameIndex: number, totalFrames: number, tactics: SimulationTactics): LivePoint {
  if (!activeEvent) {
    return {
      x: frameIndex >= totalFrames ? 50 : 50,
      y: 50,
    };
  }

  const lane = getEventLane(activeEvent);
  const toRight = activeEvent.teamId === teamAId;
  const phase = sceneStep / 2;
  const startX = toRight ? lane.buildX : 100 - lane.buildX;
  const tacticReach = tactics.style === "counter" || tactics.style === "direct" ? 5 : tactics.style === "possession" ? -3 : 0;
  const endX = (toRight ? lane.targetX : 100 - lane.targetX) + (toRight ? tacticReach : -tacticReach);
  const shotBoost = sceneStep < 2 ? 0 : activeEvent.outcome === "goal" ? 4 : activeEvent.outcome === "saved" ? 1 : -2;

  return clampPoint({
    x: startX + (endX - startX) * phase + (toRight ? shotBoost : -shotBoost),
    y: lane.y + Math.sin(frameIndex + sceneStep) * 2.2,
  });
}

function getLiveEventPath(event: LiveMatchEvent, teamAId: string, tactics: SimulationTactics): LiveEventPath {
  const lane = getEventLane(event);
  const toRight = event.teamId === teamAId;
  const reach = tactics.style === "counter" || tactics.style === "direct" ? 5 : tactics.style === "possession" ? -4 : 0;
  const curveMultiplier = tactics.style === "direct" ? 0.35 : tactics.style === "counter" ? 0.55 : tactics.style === "possession" ? 1.35 : 1;
  const start = clampPoint({
    x: toRight ? lane.buildX : 100 - lane.buildX,
    y: lane.y + getLaneCurveOffset(event) * 0.35,
  });
  const end = clampPoint({
    x: (toRight ? lane.targetX : 100 - lane.targetX) + (toRight ? reach : -reach),
    y: lane.y,
  });
  const passControl = clampPoint({
    x: (start.x + end.x) / 2,
    y: lane.y + getLaneCurveOffset(event) * curveMultiplier,
  });
  const goalPoint = clampPoint({
    x: toRight ? 94 : 6,
    y: event.outcome === "goal" ? 50 : lane.y + (event.outcome === "blocked" ? 8 : event.outcome === "saved" ? -4 : 12),
  });
  const shotControl = clampPoint({
    x: (end.x + goalPoint.x) / 2,
    y: (end.y + goalPoint.y) / 2 - 5,
  });
  const shouldShowShot = Boolean(event.scorerId) || event.xg >= 0.08;

  return {
    directPath: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    end,
    passPath: `M ${start.x} ${start.y} Q ${passControl.x} ${passControl.y} ${end.x} ${end.y}`,
    shotPath: shouldShowShot ? `M ${end.x} ${end.y} Q ${shotControl.x} ${shotControl.y} ${goalPoint.x} ${goalPoint.y}` : null,
    start,
    supportPath: getLiveSupportPath(start, end, lane.y, toRight),
  };
}

function getLiveSupportPath(start: LivePoint, end: LivePoint, laneY: number, toRight: boolean) {
  const supportA = clampPoint({
    x: start.x + (toRight ? 8 : -8),
    y: laneY > 50 ? laneY - 14 : laneY + 14,
  });
  const supportB = clampPoint({
    x: end.x + (toRight ? -8 : 8),
    y: laneY > 50 ? laneY - 10 : laneY + 10,
  });

  return `M ${start.x} ${start.y} L ${supportA.x} ${supportA.y} L ${supportB.x} ${supportB.y} Z`;
}

function getLivePressurePoint(event: LiveMatchEvent, teamAId: string): LivePoint {
  const lane = getEventLane(event);
  const toRight = event.teamId === teamAId;

  return clampPoint({
    x: toRight ? lane.buildX - 4 : 100 - lane.buildX + 4,
    y: lane.y,
  });
}

function getLiveTacticShift(tactics: SimulationTactics, isAttacking: boolean, direction: number, event: LiveMatchEvent, role: PositionCode): LivePoint {
  const lane = getEventLane(event);
  let x = 0;
  let y = 0;

  if (tactics.style === "high-press") {
    x += isAttacking ? direction * 3 : direction * 10;
    y += isAttacking ? 0 : (lane.y - 50) * 0.18;
  }

  if (tactics.style === "low-block") {
    x += isAttacking ? direction * 1 : -direction * 10;
    y += isAttacking ? 0 : (50 - getRolePitchPoint(role, direction === 1 ? "A" : "B").y) * 0.18;
  }

  if (tactics.style === "possession" && isAttacking) {
    x += direction * 3;
    y += (lane.y - 50) * 0.12;
  }

  if ((tactics.style === "counter" || tactics.style === "direct") && isAttacking) {
    x += direction * (tactics.style === "counter" ? 9 : 7);
    y += (lane.y - 50) * 0.1;
  }

  return { x, y };
}

function formatTacticStyle(style: SimulationTactics["style"]) {
  return style
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function getLiveSceneStepLabel(sceneStep: number) {
  if (sceneStep === 0) {
    return "Build";
  }

  if (sceneStep === 1) {
    return "Connect";
  }

  return "Finish";
}

function getLaneCurveOffset(event: LiveMatchEvent) {
  if (event.eventType === "wideAttack") {
    return event.minute % 2 === 0 ? -10 : 10;
  }

  if (event.eventType === "counter") {
    return event.minute % 2 === 0 ? -7 : 7;
  }

  if (event.eventType === "setPiece") {
    return event.minute % 2 === 0 ? -13 : 13;
  }

  return event.minute % 2 === 0 ? -4 : 4;
}

function getEventLane(event: LiveMatchEvent) {
  const laneByType: Record<LiveMatchEvent["eventType"], { buildX: number; targetX: number; y: number }> = {
    centralCombination: { buildX: 54, targetX: 80, y: 50 },
    counter: { buildX: 44, targetX: 84, y: event.minute % 2 === 0 ? 38 : 62 },
    error: { buildX: 60, targetX: 78, y: 50 },
    lateMoment: { buildX: 58, targetX: 84, y: 50 },
    openPlay: { buildX: 52, targetX: 78, y: event.minute % 2 === 0 ? 45 : 55 },
    pressWin: { buildX: 58, targetX: 76, y: event.minute % 2 === 0 ? 42 : 58 },
    setPiece: { buildX: 66, targetX: 82, y: event.minute % 2 === 0 ? 35 : 65 },
    wideAttack: { buildX: 57, targetX: 80, y: event.minute % 2 === 0 ? 22 : 78 },
  };

  return laneByType[event.eventType];
}

function getRolePitchPoint(role: PositionCode, side: "A" | "B"): LivePoint {
  const byRole: Record<PositionCode, LivePoint> = {
    AM: { x: 57, y: 50 },
    CB: { x: 24, y: 50 },
    CM: { x: 46, y: 50 },
    DM: { x: 38, y: 50 },
    GK: { x: 8, y: 50 },
    LB: { x: 27, y: 25 },
    LEGEND: { x: 50, y: 50 },
    LW: { x: 66, y: 24 },
    RB: { x: 27, y: 75 },
    RW: { x: 66, y: 76 },
    SS: { x: 63, y: 50 },
    ST: { x: 74, y: 50 },
  };
  const point = byRole[role] ?? byRole.LEGEND;

  if (side === "A") {
    return point;
  }

  return {
    x: 100 - point.x,
    y: 100 - point.y,
  };
}

function clampPoint(point: LivePoint): LivePoint {
  return {
    x: Math.max(5, Math.min(95, point.x)),
    y: Math.max(9, Math.min(91, point.y)),
  };
}

function getShortName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 3);
  }

  return parts[parts.length - 1]?.slice(0, 4) ?? name.slice(0, 3);
}

function TeamSimControl({
  countries,
  label,
  onCountryChange,
  onSavedSquadChange,
  onSourceChange,
  onTacticsChange,
  savedSquads,
  selectedCountry,
  selectedSavedSquadId,
  source,
  tactics,
  team,
}: {
  countries: LegendData["countries"];
  label: string;
  onCountryChange: (value: string) => void;
  onSavedSquadChange: (value: string) => void;
  onSourceChange: (value: SimTeamSource) => void;
  onTacticsChange: (value: SimulationTactics) => void;
  savedSquads: SavedSquad[];
  selectedCountry: string;
  selectedSavedSquadId: string;
  source: SimTeamSource;
  tactics: SimulationTactics;
  team: SimulationTeamInput;
}) {
  const effectiveSavedSquadId = selectedSavedSquadId || savedSquads[0]?.id || "";

  return (
    <section className="sim-team-control">
      <div className="section-heading compact-heading">
        <p className="eyebrow">{label}</p>
        <h3>{team.name}</h3>
      </div>
      <label className="field">
        <span>팀 소스</span>
        <select value={source} onChange={(event) => onSourceChange(event.target.value as SimTeamSource)}>
          <option value="current">현재 Best XI</option>
          <option disabled={savedSquads.length === 0} value="saved">
            저장한 XI
          </option>
          <option value="world">World Auto XI</option>
          <option value="country">국가 Auto XI</option>
        </select>
      </label>
      {source === "saved" ? (
        savedSquads.length ? (
          <label className="field">
            <span>저장 조합</span>
            <select value={effectiveSavedSquadId} onChange={(event) => onSavedSquadChange(event.target.value)}>
              {savedSquads.map((saved) => (
                <option key={saved.id} value={saved.id}>
                  {saved.name} · {saved.formationName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="sim-inline-empty">저장한 XI가 없습니다. Best XI에서 먼저 조합을 저장하세요.</p>
        )
      ) : null}
      {source === "country" ? (
        <label className="field">
          <span>국가</span>
          <select value={selectedCountry} onChange={(event) => onCountryChange(event.target.value)}>
            {countries.map((country) => (
              <option key={country.name} value={country.name}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="sim-team-preview">
        {team.slots.length ? (
          team.slots.slice(0, 5).map((slot) => (
            <span key={slot.id}>
              {slot.role} {slot.player.name}
            </span>
          ))
        ) : (
          <span>선택 가능한 선수가 없습니다</span>
        )}
      </div>
      <div className="sim-tactics-grid">
        <label className="field">
          <span>Style</span>
          <select value={tactics.style} onChange={(event) => onTacticsChange({ ...tactics, style: event.target.value as SimulationTactics["style"] })}>
            <option value="balanced">Balanced</option>
            <option value="possession">Possession</option>
            <option value="direct">Direct</option>
            <option value="counter">Counter</option>
            <option value="high-press">High Press</option>
            <option value="low-block">Low Block</option>
          </select>
        </label>
        <label className="field">
          <span>Tempo</span>
          <select value={tactics.tempo} onChange={(event) => onTacticsChange({ ...tactics, tempo: event.target.value as SimulationTactics["tempo"] })}>
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <label className="field">
          <span>Line</span>
          <select value={tactics.lineHeight} onChange={(event) => onTacticsChange({ ...tactics, lineHeight: event.target.value as SimulationTactics["lineHeight"] })}>
            <option value="low">Low</option>
            <option value="mid">Mid</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="field">
          <span>Risk</span>
          <select value={tactics.risk} onChange={(event) => onTacticsChange({ ...tactics, risk: event.target.value as SimulationTactics["risk"] })}>
            <option value="conservative">Conservative</option>
            <option value="normal">Normal</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function TournamentView({
  countries,
  inspector,
  onCountryChange,
  onRun,
  onSizeChange,
  run,
  selectedCountries,
  size,
}: {
  countries: LegendData["countries"];
  inspector: ReactNode;
  onCountryChange: (index: number, country: string) => void;
  onRun: () => void;
  onSizeChange: (value: TournamentSize) => void;
  run: TournamentRun | null;
  selectedCountries: string[];
  size: TournamentSize;
}) {
  const activeCountries = selectedCountries.slice(0, size);
  const duplicateCount = activeCountries.length - new Set(activeCountries).size;
  const roundOrder: TournamentMatch["stage"][] = size === 8 ? ["Quarterfinal", "Semifinal", "Final"] : ["Semifinal", "Final"];

  return (
    <section className="tournament-grid">
      <aside className="sim-sidebar">
        <div className="section-heading">
          <p className="eyebrow">Tournament</p>
          <h2>{size}팀 토너먼트</h2>
        </div>
        <label className="field">
          <span>대회 규모</span>
          <select value={size} onChange={(event) => onSizeChange(Number(event.target.value) as TournamentSize)}>
            <option value={4}>4 Teams</option>
            <option value={8}>8 Teams</option>
          </select>
        </label>
        <div className="tournament-seed-list">
          {activeCountries.map((country, index) => (
            <label className="field" key={`tournament-seed-${index}`}>
              <span>Seed {index + 1}</span>
              <select value={country} onChange={(event) => onCountryChange(index, event.target.value)}>
                {countries.map((item) => (
                  <option key={`${index}-${item.name}`} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button className="primary-button" disabled={duplicateCount > 0} onClick={onRun} type="button">
          토너먼트 실행
        </button>
        {duplicateCount > 0 ? <p className="sim-inline-empty">같은 국가는 한 번만 참가할 수 있습니다.</p> : null}
      </aside>

      <section className="tournament-main">
        {run ? (
          <>
            <div className="tournament-champion">
              <span>Champion</span>
              <strong>{run.champion.name}</strong>
              <small>
                {run.size} teams · {run.countries.join(" · ")} · {formatSavedDate(run.createdAt)}
              </small>
            </div>
            <div className="tournament-rounds">
              {roundOrder.map((stage) => {
                const stageMatches = run.matches.filter((match) => match.stage === stage);
                return (
                  <section className="tournament-round" key={stage}>
                    <div className="section-heading compact-heading">
                      <p className="eyebrow">{stage}</p>
                      <h3>{stageMatches.length} matches</h3>
                    </div>
                    <div className="tournament-bracket">
                      {stageMatches.map((match) => (
                        <TournamentMatchCard featured={stage === "Final"} key={match.id} match={match} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        ) : (
          <section className="sim-panel">
            <div className="section-heading">
              <p className="eyebrow">Ready</p>
              <h2>국가 {size}개를 고르고 실행하세요</h2>
            </div>
            <p className="empty-state">각 국가는 4-3-3 Auto XI로 구성되고, 모든 라운드를 단판으로 시뮬레이션합니다.</p>
          </section>
        )}
      </section>

      {inspector}
    </section>
  );
}

function TournamentMatchCard({ featured = false, match }: { featured?: boolean; match: TournamentMatch }) {
  const statsA = match.result.stats[match.teamA.id];
  const statsB = match.result.stats[match.teamB.id];

  return (
    <article className={featured ? "tournament-match-card featured" : "tournament-match-card"}>
      <span>{match.label}</span>
      <div>
        <strong className={match.winner.id === match.teamA.id ? "winner" : ""}>{match.teamA.name}</strong>
        <em>{statsA.goals}</em>
      </div>
      <div>
        <strong className={match.winner.id === match.teamB.id ? "winner" : ""}>{match.teamB.name}</strong>
        <em>{statsB.goals}</em>
      </div>
      <small>
        xG {statsA.xg.toFixed(2)}-{statsB.xg.toFixed(2)} · Winner {match.winner.name}
      </small>
    </article>
  );
}

function SeasonView({
  countries,
  inspector,
  onCountryChange,
  onPlayerSelect,
  onRun,
  run,
  selectedCountries,
}: {
  countries: LegendData["countries"];
  inspector: ReactNode;
  onCountryChange: (index: number, country: string) => void;
  onPlayerSelect: (playerId: string) => void;
  onRun: () => void;
  run: SeasonRun | null;
  selectedCountries: string[];
}) {
  const activeCountries = selectedCountries.slice(0, 4);
  const duplicateCount = activeCountries.length - new Set(activeCountries).size;
  const rounds = run
    ? Array.from(new Set(run.matches.map((match) => match.round))).map((round) => ({
        matches: run.matches.filter((match) => match.round === round),
        round,
      }))
    : [];

  return (
    <section className="season-grid">
      <aside className="sim-sidebar">
        <div className="section-heading">
          <p className="eyebrow">Season</p>
          <h2>4팀 미니 리그</h2>
        </div>
        <p className="sim-inline-empty">4개 국가 Auto XI가 홈/원정 더블 라운드로빈 12경기를 치릅니다.</p>
        <div className="tournament-seed-list">
          {activeCountries.map((country, index) => (
            <label className="field" key={`season-seed-${index}`}>
              <span>Club {index + 1}</span>
              <select value={country} onChange={(event) => onCountryChange(index, event.target.value)}>
                {countries.map((item) => (
                  <option key={`${index}-${item.name}`} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button className="primary-button" disabled={duplicateCount > 0} onClick={onRun} type="button">
          시즌 실행
        </button>
        {duplicateCount > 0 ? <p className="sim-inline-empty">같은 국가는 한 번만 참가할 수 있습니다.</p> : null}
      </aside>

      <section className="season-main">
        {run ? (
          <>
            <div className="tournament-champion">
              <span>Champion</span>
              <strong>{run.champion.name}</strong>
              <small>
                {run.matches.length} matches · {run.countries.join(" · ")} · {formatSavedDate(run.createdAt)}
              </small>
            </div>
            <section className="season-table-panel">
              <div className="section-heading row">
                <div>
                  <p className="eyebrow">League Table</p>
                  <h2>최종 순위표</h2>
                </div>
                <span className="saved-count">Pts / GD / GF</span>
              </div>
              <div className="season-table-wrap">
                <table className="season-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GF</th>
                      <th>GA</th>
                      <th>GD</th>
                      <th>Pts</th>
                      <th>xG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.standings.map((row) => (
                      <tr key={row.team.id}>
                        <td>{row.rank}</td>
                        <td>{row.team.name}</td>
                        <td>{row.played}</td>
                        <td>{row.wins}</td>
                        <td>{row.draws}</td>
                        <td>{row.losses}</td>
                        <td>{row.gf}</td>
                        <td>{row.ga}</td>
                        <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                        <td>{row.points}</td>
                        <td>{row.xgFor.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="sim-panel">
              <div className="section-heading">
                <p className="eyebrow">Awards</p>
                <h2>시즌 개인상</h2>
              </div>
              <div className="sim-series-leaders">
                <SeasonLeaderCard label="MVP" leaders={run.leaders.mvp} metric={(leader) => leader.averageRating.toFixed(1)} onPlayerSelect={onPlayerSelect} />
                <SeasonLeaderCard label="Scorer" leaders={run.leaders.goals} metric={(leader) => `${leader.goals}G`} onPlayerSelect={onPlayerSelect} />
                <SeasonLeaderCard label="Creator" leaders={run.leaders.assists} metric={(leader) => `${leader.assists}A`} onPlayerSelect={onPlayerSelect} />
                <SeasonLeaderCard label="Rating" leaders={run.leaders.rating} metric={(leader) => leader.averageRating.toFixed(1)} onPlayerSelect={onPlayerSelect} />
              </div>
            </section>
            <section className="season-rounds">
              {rounds.map(({ matches, round }) => (
                <div className="season-round" key={round}>
                  <div className="section-heading compact-heading">
                    <p className="eyebrow">Round {round}</p>
                    <h3>{matches.length} matches</h3>
                  </div>
                  <div className="tournament-bracket">
                    {matches.map((match) => (
                      <SeasonMatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="sim-panel">
            <div className="section-heading">
              <p className="eyebrow">Ready</p>
              <h2>국가 4개를 고르고 시즌을 실행하세요</h2>
            </div>
            <p className="empty-state">승점표, 득점/도움/평점 리더보드, 라운드별 결과가 한 번에 생성됩니다.</p>
          </section>
        )}
      </section>

      {inspector}
    </section>
  );
}

function SeasonLeaderCard({
  label,
  leaders,
  metric,
  onPlayerSelect,
}: {
  label: string;
  leaders: SeasonPlayerLeader[];
  metric: (leader: SeasonPlayerLeader) => string;
  onPlayerSelect: (playerId: string) => void;
}) {
  const leader = leaders[0] ?? null;

  return (
    <button disabled={!leader} onClick={() => leader && onPlayerSelect(leader.playerId)} type="button">
      <span>{label}</span>
      <strong>{leader?.playerName ?? "-"}</strong>
      <small>{leader ? `${leader.teamName} · ${leader.goals}G ${leader.assists}A · ${leader.matches} apps` : "No result"}</small>
      <em>{leader ? metric(leader) : "-"}</em>
    </button>
  );
}

function SeasonMatchCard({ match }: { match: SeasonMatch }) {
  const statsHome = match.result.stats[match.homeTeam.id];
  const statsAway = match.result.stats[match.awayTeam.id];

  return (
    <article className="tournament-match-card">
      <span>{match.label}</span>
      <div>
        <strong className={match.result.winnerTeamId === match.homeTeam.id ? "winner" : ""}>{match.homeTeam.name}</strong>
        <em>{statsHome.goals}</em>
      </div>
      <div>
        <strong className={match.result.winnerTeamId === match.awayTeam.id ? "winner" : ""}>{match.awayTeam.name}</strong>
        <em>{statsAway.goals}</em>
      </div>
      <small>
        xG {statsHome.xg.toFixed(2)}-{statsAway.xg.toFixed(2)} · Poss {statsHome.possession}-{statsAway.possession}
      </small>
    </article>
  );
}

function ReportList({ items, title }: { items: string[]; title: string }) {
  return (
    <article className="sim-report-card">
      <strong>{title}</strong>
      {items.length ? (
        <ul>
          {items.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>특이 사항 없음</p>
      )}
    </article>
  );
}

function runSimulationSeries(
  teamA: SimulationTeamInput,
  teamB: SimulationTeamInput,
  tacticsA: SimulationTactics,
  tacticsB: SimulationTactics,
  randomness: RandomnessLevel,
  seed: string,
  mode: SimMatchMode,
): SimSeriesMatch[] {
  if (mode === "single") {
    return [
      {
        homeTeamId: teamA.id,
        label: "Match 1",
        result: simulateMatch(teamA, teamB, tacticsA, tacticsB, {
          homeTeamId: teamA.id,
          randomness,
          seed,
        }),
      },
    ];
  }

  if (mode === "home-away") {
    return [
      {
        homeTeamId: teamA.id,
        label: "1st Leg",
        result: simulateMatch(teamA, teamB, tacticsA, tacticsB, {
          homeTeamId: teamA.id,
          randomness,
          seed: `${seed}-leg-1`,
        }),
      },
      {
        homeTeamId: teamB.id,
        label: "2nd Leg",
        result: simulateMatch(teamA, teamB, tacticsA, tacticsB, {
          homeTeamId: teamB.id,
          randomness,
          seed: `${seed}-leg-2`,
        }),
      },
    ];
  }

  const matches: SimSeriesMatch[] = [];
  let teamAWins = 0;
  let teamBWins = 0;

  for (let index = 0; index < 3; index += 1) {
    const homeTeamId = index === 1 ? teamB.id : teamA.id;
    const result = simulateMatch(teamA, teamB, tacticsA, tacticsB, {
      homeTeamId,
      randomness,
      seed: `${seed}-game-${index + 1}`,
    });

    matches.push({
      homeTeamId,
      label: `Game ${index + 1}`,
      result,
    });

    if (result.winnerTeamId === teamA.id) {
      teamAWins += 1;
    } else if (result.winnerTeamId === teamB.id) {
      teamBWins += 1;
    }

    if (teamAWins === 2 || teamBWins === 2) {
      break;
    }
  }

  return matches;
}

function createTournamentRun(
  teams: SimulationTeamInput[],
  countries: string[],
  size: TournamentSize,
  seed: string,
  randomness: RandomnessLevel,
): TournamentRun {
  const matches: TournamentMatch[] = [];

  if (size === 8) {
    const quarterfinalPairs: Array<[number, number]> = [
      [0, 7],
      [3, 4],
      [1, 6],
      [2, 5],
    ];
    const quarterfinals = quarterfinalPairs.map(([homeIndex, awayIndex], index) =>
      runTournamentMatch(`qf-${index + 1}`, `Quarterfinal ${index + 1}`, "Quarterfinal", teams[homeIndex], teams[awayIndex], `${seed}-qf-${index + 1}`, randomness),
    );
    const semifinalA = runTournamentMatch("semi-1", "Semifinal 1", "Semifinal", quarterfinals[0].winner, quarterfinals[1].winner, `${seed}-semi-1`, randomness);
    const semifinalB = runTournamentMatch("semi-2", "Semifinal 2", "Semifinal", quarterfinals[2].winner, quarterfinals[3].winner, `${seed}-semi-2`, randomness);
    const final = runTournamentMatch("final", "Final", "Final", semifinalA.winner, semifinalB.winner, `${seed}-final`, randomness);

    matches.push(...quarterfinals, semifinalA, semifinalB, final);

    return {
      champion: final.winner,
      countries,
      createdAt: new Date().toISOString(),
      matches,
      seed,
      size,
    };
  }

  const semifinalA = runTournamentMatch("semi-1", "Semifinal 1", "Semifinal", teams[0], teams[3], `${seed}-semi-1`, randomness);
  const semifinalB = runTournamentMatch("semi-2", "Semifinal 2", "Semifinal", teams[1], teams[2], `${seed}-semi-2`, randomness);
  const final = runTournamentMatch("final", "Final", "Final", semifinalA.winner, semifinalB.winner, `${seed}-final`, randomness);

  matches.push(semifinalA, semifinalB, final);

  return {
    champion: final.winner,
    countries,
    createdAt: new Date().toISOString(),
    matches,
    seed,
    size,
  };
}

function runTournamentMatch(
  id: string,
  label: string,
  stage: TournamentMatch["stage"],
  teamA: SimulationTeamInput,
  teamB: SimulationTeamInput,
  seed: string,
  randomness: RandomnessLevel,
): TournamentMatch {
  const [match] = runSimulationSeries(teamA, teamB, defaultTactics, defaultTactics, randomness, seed, "single");
  const result = match.result;
  const winner = getTournamentWinner(result, teamA, teamB);

  return {
    id,
    label,
    result,
    stage,
    teamA,
    teamB,
    winner,
  };
}

function getTournamentWinner(result: SimulatedMatchResult, teamA: SimulationTeamInput, teamB: SimulationTeamInput) {
  if (result.winnerTeamId === teamA.id) {
    return teamA;
  }

  if (result.winnerTeamId === teamB.id) {
    return teamB;
  }

  const statsA = result.stats[teamA.id];
  const statsB = result.stats[teamB.id];

  if (statsA.xg !== statsB.xg) {
    return statsA.xg > statsB.xg ? teamA : teamB;
  }

  return getTeamOverallAverage(teamA) >= getTeamOverallAverage(teamB) ? teamA : teamB;
}

function getTeamOverallAverage(team: SimulationTeamInput) {
  return team.slots.reduce((sum, slot) => sum + slot.player.overallScore, 0) / Math.max(team.slots.length, 1);
}

function createSeasonRun(teams: SimulationTeamInput[], countries: string[], seed: string, randomness: RandomnessLevel): SeasonRun {
  const schedule: Array<{ awayIndex: number; homeIndex: number; round: number }> = [
    { awayIndex: 1, homeIndex: 0, round: 1 },
    { awayIndex: 3, homeIndex: 2, round: 1 },
    { awayIndex: 2, homeIndex: 0, round: 2 },
    { awayIndex: 3, homeIndex: 1, round: 2 },
    { awayIndex: 3, homeIndex: 0, round: 3 },
    { awayIndex: 2, homeIndex: 1, round: 3 },
    { awayIndex: 0, homeIndex: 1, round: 4 },
    { awayIndex: 2, homeIndex: 3, round: 4 },
    { awayIndex: 0, homeIndex: 2, round: 5 },
    { awayIndex: 1, homeIndex: 3, round: 5 },
    { awayIndex: 0, homeIndex: 3, round: 6 },
    { awayIndex: 1, homeIndex: 2, round: 6 },
  ];
  const standingMap = new Map<string, SeasonStanding>();
  const playerMap = new Map<string, SeasonPlayerLeader>();
  const teamNameMap = new Map(teams.map((team) => [team.id, team.name]));

  teams.forEach((team) => {
    standingMap.set(team.id, {
      draws: 0,
      ga: 0,
      gd: 0,
      gf: 0,
      losses: 0,
      played: 0,
      points: 0,
      rank: 0,
      team,
      wins: 0,
      xgAgainst: 0,
      xgFor: 0,
    });
  });

  const matches = schedule.map(({ awayIndex, homeIndex, round }, index) => {
    const homeTeam = teams[homeIndex];
    const awayTeam = teams[awayIndex];
    const result = simulateMatch(homeTeam, awayTeam, defaultTactics, defaultTactics, {
      homeTeamId: homeTeam.id,
      randomness,
      seed: `${seed}-round-${round}-match-${index + 1}`,
    });
    const homeStats = result.stats[homeTeam.id];
    const awayStats = result.stats[awayTeam.id];
    const homeStanding = standingMap.get(homeTeam.id);
    const awayStanding = standingMap.get(awayTeam.id);

    if (homeStanding && awayStanding) {
      homeStanding.played += 1;
      awayStanding.played += 1;
      homeStanding.gf += homeStats.goals;
      homeStanding.ga += awayStats.goals;
      awayStanding.gf += awayStats.goals;
      awayStanding.ga += homeStats.goals;
      homeStanding.xgFor += homeStats.xg;
      homeStanding.xgAgainst += awayStats.xg;
      awayStanding.xgFor += awayStats.xg;
      awayStanding.xgAgainst += homeStats.xg;

      if (homeStats.goals > awayStats.goals) {
        homeStanding.wins += 1;
        homeStanding.points += 3;
        awayStanding.losses += 1;
      } else if (awayStats.goals > homeStats.goals) {
        awayStanding.wins += 1;
        awayStanding.points += 3;
        homeStanding.losses += 1;
      } else {
        homeStanding.draws += 1;
        awayStanding.draws += 1;
        homeStanding.points += 1;
        awayStanding.points += 1;
      }
    }

    result.playerRatings.forEach((rating) => {
      const current = playerMap.get(rating.playerId) ?? {
        assists: 0,
        averageRating: 0,
        goals: 0,
        matches: 0,
        playerId: rating.playerId,
        playerName: rating.playerName,
        ratingTotal: 0,
        teamId: rating.teamId,
        teamName: teamNameMap.get(rating.teamId) ?? rating.teamId,
      };
      current.assists += rating.assists;
      current.goals += rating.goals;
      current.matches += 1;
      current.ratingTotal += rating.rating;
      current.averageRating = current.ratingTotal / current.matches;
      playerMap.set(rating.playerId, current);
    });

    return {
      awayTeam,
      homeTeam,
      id: `season-${round}-${index + 1}`,
      label: `Round ${round}`,
      result,
      round,
    };
  });

  const standings = Array.from(standingMap.values())
    .map((standing) => ({
      ...standing,
      gd: standing.gf - standing.ga,
      xgAgainst: roundTo(standing.xgAgainst, 2),
      xgFor: roundTo(standing.xgFor, 2),
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        b.xgFor - a.xgFor ||
        getTeamOverallAverage(b.team) - getTeamOverallAverage(a.team),
    )
    .map((standing, index) => ({
      ...standing,
      rank: index + 1,
    }));
  const players = Array.from(playerMap.values());
  const mvp = [...players].sort((a, b) => b.averageRating + b.goals * 0.35 + b.assists * 0.25 - (a.averageRating + a.goals * 0.35 + a.assists * 0.25));
  const goals = [...players].sort((a, b) => b.goals - a.goals || b.averageRating - a.averageRating);
  const assists = [...players].sort((a, b) => b.assists - a.assists || b.averageRating - a.averageRating);
  const rating = [...players].sort((a, b) => b.averageRating - a.averageRating || b.goals + b.assists - (a.goals + a.assists));

  return {
    champion: standings[0].team,
    countries,
    createdAt: new Date().toISOString(),
    leaders: {
      assists,
      goals,
      mvp,
      rating,
    },
    matches,
    seed,
    standings,
  };
}

function createSimHistoryEntry(
  seriesResults: SimSeriesMatch[],
  teamA: SimulationTeamInput,
  teamB: SimulationTeamInput,
  mode: SimMatchMode,
  randomness: RandomnessLevel,
  seed: string,
): SimHistoryEntry {
  const totals = seriesResults.reduce(
    (summary, match) => {
      const statsA = match.result.stats[teamA.id];
      const statsB = match.result.stats[teamB.id];
      summary.teamAGoals += statsA.goals;
      summary.teamBGoals += statsB.goals;
      summary.teamAXg += statsA.xg;
      summary.teamBXg += statsB.xg;

      if (match.result.winnerTeamId === teamA.id) {
        summary.teamAWins += 1;
      } else if (match.result.winnerTeamId === teamB.id) {
        summary.teamBWins += 1;
      }

      return summary;
    },
    {
      teamAGoals: 0,
      teamAWins: 0,
      teamAXg: 0,
      teamBGoals: 0,
      teamBWins: 0,
      teamBXg: 0,
    },
  );
  const winner =
    mode === "home-away"
      ? totals.teamAGoals === totals.teamBGoals
        ? null
        : totals.teamAGoals > totals.teamBGoals
          ? teamA
          : teamB
      : totals.teamAWins === totals.teamBWins
        ? null
        : totals.teamAWins > totals.teamBWins
          ? teamA
          : teamB;

  return {
    ...totals,
    createdAt: new Date().toISOString(),
    id: `${seed}-${mode}-${Date.now()}`,
    matchCount: seriesResults.length,
    mode,
    randomness,
    seed,
    teamAName: teamA.name,
    teamAXg: roundTo(totals.teamAXg, 2),
    teamBName: teamB.name,
    teamBXg: roundTo(totals.teamBXg, 2),
    winnerName: winner?.name ?? "Draw",
  };
}

function getSimHistorySummary(history: SimHistoryEntry[]) {
  if (!history.length) {
    return {
      averageGoals: "-",
      topWinner: "-",
      total: 0,
    };
  }

  const winnerCounts = history.reduce<Record<string, number>>((summary, entry) => {
    if (entry.winnerName !== "Draw") {
      summary[entry.winnerName] = (summary[entry.winnerName] ?? 0) + 1;
    }

    return summary;
  }, {});
  const topWinner = Object.entries(winnerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Draw";
  const averageGoals = roundTo(history.reduce((sum, entry) => sum + entry.teamAGoals + entry.teamBGoals, 0) / history.length, 1).toFixed(1);

  return {
    averageGoals,
    topWinner,
    total: history.length,
  };
}

function formatSimMode(mode: SimMatchMode) {
  if (mode === "best-of-3") {
    return "Bo3";
  }

  if (mode === "home-away") {
    return "H/A";
  }

  return "Single";
}

function roundTo(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function getSeriesSummary(seriesResults: SimSeriesMatch[], teamA: SimulationTeamInput, teamB: SimulationTeamInput, mode: SimMatchMode) {
  const playerMap = new Map<string, SimSeriesPlayerLeader & { ratingTotal: number }>();
  const totals = seriesResults.reduce(
    (summary, match) => {
      const statsA = match.result.stats[teamA.id];
      const statsB = match.result.stats[teamB.id];
      summary.teamAGoals += statsA.goals;
      summary.teamBGoals += statsB.goals;
      summary.teamAXg += statsA.xg;
      summary.teamBXg += statsB.xg;
      summary.teamAPossession += statsA.possession;
      summary.teamBPossession += statsB.possession;
      summary.teamAPressingWins += statsA.pressingWins;
      summary.teamBPressingWins += statsB.pressingWins;
      summary.teamAShots += statsA.shots;
      summary.teamBShots += statsB.shots;
      summary.teamAShotsOnTarget += statsA.shotsOnTarget;
      summary.teamBShotsOnTarget += statsB.shotsOnTarget;

      if (match.result.winnerTeamId === teamA.id) {
        summary.teamAWins += 1;
      } else if (match.result.winnerTeamId === teamB.id) {
        summary.teamBWins += 1;
      }

      match.result.playerRatings.forEach((rating) => {
        const current = playerMap.get(rating.playerId) ?? {
          assists: 0,
          averageRating: 0,
          goals: 0,
          matches: 0,
          playerId: rating.playerId,
          playerName: rating.playerName,
          ratingTotal: 0,
          teamId: rating.teamId,
        };
        current.assists += rating.assists;
        current.goals += rating.goals;
        current.matches += 1;
        current.ratingTotal += rating.rating;
        current.averageRating = current.ratingTotal / current.matches;
        playerMap.set(rating.playerId, current);
      });

      return summary;
    },
    {
      teamAGoals: 0,
      teamAPossession: 0,
      teamAPressingWins: 0,
      teamAShots: 0,
      teamAShotsOnTarget: 0,
      teamAWins: 0,
      teamAXg: 0,
      teamBGoals: 0,
      teamBPossession: 0,
      teamBPressingWins: 0,
      teamBShots: 0,
      teamBShotsOnTarget: 0,
      teamBWins: 0,
      teamBXg: 0,
    },
  );
  const matchCount = Math.max(seriesResults.length, 1);
  const winnerTeam =
    mode === "home-away"
      ? totals.teamAGoals === totals.teamBGoals
        ? null
        : totals.teamAGoals > totals.teamBGoals
          ? teamA
          : teamB
      : totals.teamAWins === totals.teamBWins
        ? null
        : totals.teamAWins > totals.teamBWins
          ? teamA
          : teamB;
  const teamAPossessionAverage = Math.round(totals.teamAPossession / matchCount);
  const teamBPossessionAverage = Math.round(totals.teamBPossession / matchCount);
  const teamAEfficiency = totals.teamAXg > 0 ? totals.teamAGoals / totals.teamAXg : 0;
  const teamBEfficiency = totals.teamBXg > 0 ? totals.teamBGoals / totals.teamBXg : 0;
  const sortedPlayers = Array.from(playerMap.values()).sort((a, b) => {
    const impactA = a.averageRating + a.goals * 0.35 + a.assists * 0.25;
    const impactB = b.averageRating + b.goals * 0.35 + b.assists * 0.25;
    return impactB - impactA;
  });
  const topScorers = [...sortedPlayers].sort((a, b) => b.goals - a.goals || b.averageRating - a.averageRating);
  const topCreators = [...sortedPlayers].sort((a, b) => b.assists - a.assists || b.averageRating - a.averageRating);
  const topRatings = [...sortedPlayers].sort((a, b) => b.averageRating - a.averageRating || b.goals + b.assists - (a.goals + a.assists));
  const mvp = sortedPlayers[0] ?? null;
  const topScorer = topScorers[0] ?? null;
  const topCreator = topCreators[0] ?? null;
  const ratingLeader = topRatings[0] ?? null;
  const leaders = [
    mvp
      ? {
          detail: `${mvp.goals}G · ${mvp.assists}A`,
          label: "MVP",
          player: mvp,
          teamName: getSimulationTeamName(mvp.teamId, teamA, teamB),
          value: mvp.averageRating.toFixed(1),
        }
      : null,
    topScorer
      ? {
          detail: `${topScorer.averageRating.toFixed(1)} avg · ${topScorer.assists}A`,
          label: "Scorer",
          player: topScorer,
          teamName: getSimulationTeamName(topScorer.teamId, teamA, teamB),
          value: `${topScorer.goals}G`,
        }
      : null,
    topCreator
      ? {
          detail: `${topCreator.averageRating.toFixed(1)} avg · ${topCreator.goals}G`,
          label: "Creator",
          player: topCreator,
          teamName: getSimulationTeamName(topCreator.teamId, teamA, teamB),
          value: `${topCreator.assists}A`,
        }
      : null,
    ratingLeader
      ? {
          detail: `${ratingLeader.goals}G · ${ratingLeader.assists}A · ${ratingLeader.matches} apps`,
          label: "Rating",
          player: ratingLeader,
          teamName: getSimulationTeamName(ratingLeader.teamId, teamA, teamB),
          value: ratingLeader.averageRating.toFixed(1),
        }
      : null,
  ].filter((leader): leader is NonNullable<typeof leader> => Boolean(leader));
  const swingMatch = seriesResults
    .map((match) => {
      const statsA = match.result.stats[teamA.id];
      const statsB = match.result.stats[teamB.id];
      return {
        label: match.label,
        score: `${statsA.goals}-${statsB.goals}`,
        swing: Math.abs(statsA.goals - statsB.goals) * 2 + Math.abs(statsA.xg - statsB.xg),
        xg: `${statsA.xg.toFixed(2)}-${statsB.xg.toFixed(2)}`,
      };
    })
    .sort((a, b) => b.swing - a.swing)[0];
  const xgLeader =
    totals.teamAXg === totals.teamBXg
      ? "xG는 사실상 균형이었다."
      : totals.teamAXg > totals.teamBXg
        ? `${teamA.name}가 xG를 ${totals.teamAXg.toFixed(2)}-${totals.teamBXg.toFixed(2)}로 앞섰다.`
        : `${teamB.name}가 xG를 ${totals.teamBXg.toFixed(2)}-${totals.teamAXg.toFixed(2)}로 앞섰다.`;
  const shotLeader =
    totals.teamAShots === totals.teamBShots
      ? "슈팅 생산량은 동률이었다."
      : totals.teamAShots > totals.teamBShots
        ? `${teamA.name}가 슈팅 ${totals.teamAShots}-${totals.teamBShots}로 더 많은 장면을 만들었다.`
        : `${teamB.name}가 슈팅 ${totals.teamBShots}-${totals.teamAShots}로 더 많은 장면을 만들었다.`;
  const pressLeader =
    totals.teamAPressingWins === totals.teamBPressingWins
      ? "압박 탈취는 큰 차이가 없었다."
      : totals.teamAPressingWins > totals.teamBPressingWins
        ? `${teamA.name}가 압박 탈취 ${totals.teamAPressingWins}-${totals.teamBPressingWins}로 전진 수비 우위를 보였다.`
        : `${teamB.name}가 압박 탈취 ${totals.teamBPressingWins}-${totals.teamAPressingWins}로 전진 수비 우위를 보였다.`;

  return {
    ...totals,
    controlNotes: [
      `${teamA.name} 평균 점유 ${teamAPossessionAverage}% · ${teamB.name} 평균 점유 ${teamBPossessionAverage}%.`,
      shotLeader,
      pressLeader,
      `${teamA.name} 유효슈팅 ${totals.teamAShotsOnTarget} · ${teamB.name} 유효슈팅 ${totals.teamBShotsOnTarget}.`,
    ],
    insights: [
      winnerTeam ? `${winnerTeam.name}가 ${mode === "home-away" ? "합산 득점" : "승수"} 기준으로 시리즈를 가져갔다.` : "시리즈는 무승부로 끝났다.",
      xgLeader,
      `${teamA.name} 결정력 ${teamAEfficiency.toFixed(2)} G/xG · ${teamB.name} 결정력 ${teamBEfficiency.toFixed(2)} G/xG.`,
      swingMatch ? `${swingMatch.label}가 가장 큰 분기점이었다. 스코어 ${swingMatch.score}, xG ${swingMatch.xg}.` : "뚜렷한 분기점은 없었다.",
    ],
    leaders,
    method: mode === "home-away" ? "합산 득점 기준" : mode === "best-of-3" ? "승수 기준" : "단판 결과",
    playerNotes: sortedPlayers.slice(0, 4).map((player, index) => `${index + 1}. ${player.playerName} (${getSimulationTeamName(player.teamId, teamA, teamB)}) ${player.averageRating.toFixed(1)} avg · ${player.goals}G ${player.assists}A.`),
    swingNotes: seriesResults.map((match) => {
      const statsA = match.result.stats[teamA.id];
      const statsB = match.result.stats[teamB.id];
      const winnerName = match.result.winnerTeamId ? getSimulationTeamName(match.result.winnerTeamId, teamA, teamB) : "Draw";
      return `${match.label}: ${statsA.goals}-${statsB.goals}, winner ${winnerName}, xG ${statsA.xg.toFixed(2)}-${statsB.xg.toFixed(2)}.`;
    }),
    title: mode === "home-away" ? "Home & Away 결과" : mode === "best-of-3" ? "Best of 3 결과" : "Single Match 결과",
    winnerName: winnerTeam?.name ?? "Draw",
  };
}

function getSimulationTeamName(teamId: string, teamA: SimulationTeamInput, teamB: SimulationTeamInput) {
  if (teamId === teamA.id) {
    return teamA.name;
  }

  if (teamId === teamB.id) {
    return teamB.name;
  }

  return teamId;
}

function ShortlistView({
  compareIds,
  inspector,
  onClear,
  onPlayerSelect,
  onToggleCompare,
  onToggleShortlist,
  players,
  shortlistIds,
  weights,
}: {
  compareIds: string[];
  inspector: ReactNode;
  onClear: () => void;
  onPlayerSelect: (playerId: string) => void;
  onToggleCompare: (playerId: string) => void;
  onToggleShortlist: (playerId: string) => void;
  players: LegendPlayer[];
  shortlistIds: string[];
  weights: WeightMap;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const shortlistSet = useMemo(() => new Set(shortlistIds), [shortlistIds]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const shortlistedPlayers = shortlistIds.map((id) => playerById.get(id)).filter(Boolean) as LegendPlayer[];
  const candidatePlayers = players
    .filter((player) => !shortlistSet.has(player.id))
    .filter((player) => {
      if (!normalizedQuery) {
        return player.topTierRank !== null;
      }

      return matchesPlayerSearch(player, normalizedQuery);
    })
    .sort(
      (a, b) =>
        getPlayerSearchRank(a, normalizedQuery) - getPlayerSearchRank(b, normalizedQuery) ||
        (a.topTierRank ?? 999) - (b.topTierRank ?? 999) ||
        b.overallScore - a.overallScore,
    )
    .slice(0, 36);
  const averageScore = shortlistedPlayers.length
    ? Math.round(shortlistedPlayers.reduce((sum, player) => sum + player.overallScore, 0) / shortlistedPlayers.length)
    : null;
  const highestPlayer = shortlistedPlayers.slice().sort((a, b) => b.overallScore - a.overallScore)[0];
  const comparedCount = shortlistedPlayers.filter((player) => compareIds.includes(player.id)).length;

  return (
    <section className="shortlist-grid">
      <aside className="shortlist-sidebar">
        <div className="section-heading">
          <p className="eyebrow">Shortlist</p>
          <h2>선수 찾기</h2>
        </div>
        <input
          className="search-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="선수, 국가, 포지션 검색"
          type="search"
          value={query}
        />
        <div className="shortlist-help">
          <span>{normalizedQuery ? "검색 결과" : "Top 50 기본 추천"}</span>
          <strong>{candidatePlayers.length}</strong>
        </div>
        <div className="shortlist-suggestion-list">
          {candidatePlayers.map((player) => (
            <article className="shortlist-suggestion-item" key={player.id}>
              <button className="shortlist-suggestion-main" onClick={() => onPlayerSelect(player.id)} type="button">
                <strong>{player.name}</strong>
                <span>
                  {player.country} · {player.primaryPosition} · {getLegendTier(player.overallScore).label}
                </span>
              </button>
              <button className="small-button" onClick={() => onToggleShortlist(player.id)} type="button">
                추가
              </button>
            </article>
          ))}
          {candidatePlayers.length === 0 ? <p className="empty-state">추가할 선수가 없습니다.</p> : null}
        </div>
      </aside>

      <section className="shortlist-main">
        <div className="shortlist-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Collection</p>
              <h2>관심 선수 목록</h2>
            </div>
            <button className="small-button" disabled={shortlistedPlayers.length === 0} onClick={onClear} type="button">
              전체 해제
            </button>
          </div>
          <div className="shortlist-summary-grid">
            <Metric label="Players" value={`${shortlistedPlayers.length}`} detail="저장된 관심 선수" />
            <Metric label="Average" value={averageScore === null ? "-" : `${averageScore}`} detail="공식 총점 평균" />
            <Metric label="Compare" value={`${comparedCount}`} detail="비교 목록에 포함" />
          </div>
          {highestPlayer ? (
            <div className="shortlist-leader">
              <span>최고 점수</span>
              <strong>
                {highestPlayer.name} · {highestPlayer.overallScore}
              </strong>
              <button className="small-button" onClick={() => onPlayerSelect(highestPlayer.id)} type="button">
                정보
              </button>
            </div>
          ) : null}
        </div>

        <div className="shortlist-panel">
          {shortlistedPlayers.length === 0 ? (
            <p className="empty-state">왼쪽 검색 목록에서 관심 선수를 추가하면 여기에 모입니다.</p>
          ) : (
            <div className="shortlist-player-grid">
              {shortlistedPlayers.map((player) => {
                const tier = getLegendTier(player.overallScore);
                const rating = ratePlayer(player, weights);

                return (
                  <article className="shortlist-card" key={player.id}>
                    <div>
                      <span className={`tier-badge ${tier.id}`}>{tier.label}</span>
                      <strong>{player.name}</strong>
                      <small>
                        {player.country} · {player.continent} · {player.primaryPosition}
                      </small>
                    </div>
                    <p>{player.profile.summary}</p>
                    <div className="shortlist-card-meta">
                      <span>공식 {player.overallScore}</span>
                      <span>기준 {rating}</span>
                      <span>{player.scoreMode === "computed" ? "산식" : "고정"}</span>
                    </div>
                    <div className="shortlist-card-actions">
                      <button onClick={() => onPlayerSelect(player.id)} type="button">
                        정보
                      </button>
                      <button className={compareIds.includes(player.id) ? "active" : ""} onClick={() => onToggleCompare(player.id)} type="button">
                        {compareIds.includes(player.id) ? "비교 해제" : "비교"}
                      </button>
                      <button onClick={() => onToggleShortlist(player.id)} type="button">
                        제거
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {inspector}
    </section>
  );
}

function RankingsView({
  continent,
  countries,
  country,
  tier,
  onPlayerSelect,
  onContinentChange,
  onCountryChange,
  onPositionChange,
  onTierChange,
  onQueryChange,
  onResetFilters,
  onToggleCompare,
  onWeightChange,
  inspector,
  position,
  query,
  rankings,
  summary,
  weights,
}: {
  continent: Continent | FilterValue;
  countries: LegendData["countries"];
  country: string | FilterValue;
  tier: LegendTierId | FilterValue;
  onPlayerSelect: (playerId: string) => void;
  onContinentChange: (value: Continent | FilterValue) => void;
  onCountryChange: (value: string | FilterValue) => void;
  onPositionChange: (value: PositionCode | FilterValue) => void;
  onTierChange: (value: LegendTierId | FilterValue) => void;
  onQueryChange: (query: string) => void;
  onResetFilters: () => void;
  onToggleCompare: (playerId: string) => void;
  onWeightChange: (key: ScoreKey, value: number) => void;
  inspector: ReactNode;
  position: PositionCode | FilterValue;
  query: string;
  rankings: Array<{ player: LegendPlayer; rating: number }>;
  summary: {
    average: number;
    count: number;
    topScore: number;
  };
  weights: WeightMap;
}) {
  return (
    <section className="rankings-grid">
      <aside className="ranking-finder-panel">
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Ranking Lab</p>
            <h2>내 기준 랭킹</h2>
          </div>
          <label className="field">
            <span>검색</span>
            <input
              className="search-input"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="선수, 국가, 포지션 검색"
              type="search"
              value={query}
            />
          </label>
          <label className="field">
            <span>대륙</span>
            <select value={continent} onChange={(event) => onContinentChange(event.target.value as Continent | FilterValue)}>
              <option value="ALL">전체</option>
              {continentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>국가</span>
            <select value={country} onChange={(event) => onCountryChange(event.target.value)}>
              <option value="ALL">전체</option>
              {countries.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>포지션</span>
            <select value={position} onChange={(event) => onPositionChange(event.target.value as PositionCode | FilterValue)}>
              <option value="ALL">전체</option>
              {positionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>레전드 티어</span>
            <select value={tier} onChange={(event) => onTierChange(event.target.value as LegendTierId | FilterValue)}>
              <option value="ALL">전체</option>
              {legendTiers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.range})
                </option>
              ))}
            </select>
          </label>
          <button className="ghost-button compact-button" onClick={onResetFilters} type="button">
            필터 초기화
          </button>
        </section>
        <section className="weights-panel">
          <div className="section-heading">
            <p className="eyebrow">Weights</p>
            <h2>평가 가중치</h2>
          </div>
          <div className="slider-stack compact">
            {(Object.keys(scoreLabels) as ScoreKey[]).map((key) => (
              <label className="slider-row" key={key}>
                <span>
                  {scoreLabels[key]}
                  <strong>{weights[key]}</strong>
                </span>
                <input max="50" min="0" onChange={(event) => onWeightChange(key, Number(event.target.value))} type="range" value={weights[key]} />
              </label>
            ))}
          </div>
        </section>
      </aside>
      <section className="roster-panel">
        <div className="section-heading row">
          <div>
            <p className="eyebrow">Top {Math.min(summary.count, 150)}</p>
            <h2>동적 레전드 랭킹</h2>
          </div>
          <div className="ranking-summary">
            <span>{summary.count}명</span>
            <span>평균 {summary.average}</span>
            <strong>최고 {summary.topScore}</strong>
          </div>
        </div>
        <div className="ranking-list">
          {rankings.length ? (
            rankings.map(({ player, rating }, index) => (
              <article className="ranking-item" key={player.id}>
                <span>{index + 1}</span>
                <button onClick={() => onPlayerSelect(player.id)} type="button">
                  <strong>{player.name}</strong>
                  <small>
                    {player.country} · {player.continent} · {player.primaryPosition} · {getLegendTier(player.overallScore).label}
                  </small>
                </button>
                <em>{rating}</em>
                <button onClick={() => onToggleCompare(player.id)} type="button">
                  비교
                </button>
              </article>
            ))
          ) : (
            <p className="empty-state">조건에 맞는 선수가 없습니다.</p>
          )}
        </div>
      </section>
      {inspector}
    </section>
  );
}

function CompareView({
  compareIds,
  compareQuery,
  onCompareQueryChange,
  onPlayerSelect,
  onToggleCompare,
  playerById,
  players,
  inspector,
  weights,
}: {
  compareIds: string[];
  compareQuery: string;
  onCompareQueryChange: (query: string) => void;
  onPlayerSelect: (playerId: string) => void;
  onToggleCompare: (playerId: string) => void;
  playerById: Map<string, LegendPlayer>;
  players: LegendPlayer[];
  inspector: ReactNode;
  weights: WeightMap;
}) {
  const comparedPlayers = compareIds.map((id) => playerById.get(id)).filter(Boolean) as LegendPlayer[];
  const normalizedQuery = compareQuery.trim().toLowerCase();
  const quickChoices = players
    .filter((player) => {
      if (!normalizedQuery) {
        return player.topTierRank !== null;
      }

      return matchesPlayerSearch(player, normalizedQuery);
    })
    .sort(
      (a, b) =>
        getPlayerSearchRank(a, normalizedQuery) - getPlayerSearchRank(b, normalizedQuery) ||
        (a.topTierRank ?? 999) - (b.topTierRank ?? 999) ||
        b.overallScore - a.overallScore,
    )
    .slice(0, 80);

  return (
    <section className="compare-grid">
      <aside className="candidate-panel">
        <div className="section-heading">
          <p className="eyebrow">Compare</p>
          <h2>비교 선수 선택</h2>
        </div>
        <input
          className="search-input"
          onChange={(event) => onCompareQueryChange(event.target.value)}
          placeholder="선수, 국가, 포지션 검색"
          type="search"
          value={compareQuery}
        />
        <div className="candidate-list">
          {quickChoices.map((player) => (
            <article className="candidate-item" key={player.id}>
              <button onClick={() => onPlayerSelect(player.id)} type="button">
                <strong>{player.name}</strong>
                <span>
                  {player.country} · {player.primaryPosition} · {getLegendTier(player.overallScore).label}
                </span>
              </button>
              <div>
                <button
                  className={compareIds.includes(player.id) ? "active" : ""}
                  onClick={() => onToggleCompare(player.id)}
                  type="button"
                >
                  {compareIds.includes(player.id) ? "해제" : "비교"}
                </button>
                <button onClick={() => onPlayerSelect(player.id)} type="button">
                  정보
                </button>
              </div>
            </article>
          ))}
          {quickChoices.length === 0 ? <p className="empty-state">검색 결과가 없습니다.</p> : null}
        </div>
      </aside>
      <section className="comparison-table-panel">
        <div className="section-heading">
          <p className="eyebrow">Max 4</p>
          <h2>선수 비교</h2>
        </div>
        {comparedPlayers.length === 0 ? (
          <p className="empty-state">비교할 선수를 선택하세요.</p>
        ) : (
          <div className="compare-cards">
            {comparedPlayers.map((player) => (
              <article className="profile-card" key={player.id}>
                <button className="remove-button" onClick={() => onToggleCompare(player.id)} type="button">
                  제거
                </button>
                <h3>{player.name}</h3>
                <p>
                  {player.country} · {player.primaryPosition} · {ratePlayer(player, weights)}
                </p>
                <span className={`tier-badge ${getLegendTier(player.overallScore).id}`}>{getLegendTier(player.overallScore).label}</span>
                <ScoreBars player={player} />
                {(Object.keys(scoreLabels) as ScoreKey[]).map((key) => (
                  <div className="compare-row" key={key}>
                    <span>{scoreLabels[key]}</span>
                    <strong>{player.scores[key]}</strong>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
      {inspector}
    </section>
  );
}

function PlayerDetailDrawer({
  isShortlisted,
  onClose,
  onToggleCompare,
  onToggleShortlist,
  player,
}: {
  isShortlisted: boolean;
  onClose: () => void;
  onToggleCompare: (playerId: string) => void;
  onToggleShortlist: (playerId: string) => void;
  player: LegendPlayer | null;
}) {
  const profileKeys = Object.keys(scoreLabels) as ScoreKey[];
  const [activeSection, setActiveSection] = useState<ScoreKey>("teamCareer");
  const [openSections, setOpenSections] = useState<Record<ScoreKey, boolean>>(getOpenProfileSections(true));

  useEffect(() => {
    setActiveSection("teamCareer");
    setOpenSections(getOpenProfileSections(true));
  }, [player?.id]);

  if (!player) {
    return (
      <aside className="player-drawer inspector-empty" aria-label="선수 상세">
        <div className="section-heading">
          <p className="eyebrow">Inspector</p>
          <h2>선수 정보</h2>
        </div>
        <p className="empty-state">선수를 선택하면 총점, 세부 점수, 커리어 근거가 이 패널에 표시됩니다.</p>
      </aside>
    );
  }

  return (
    <aside className="player-drawer" aria-label="선수 상세">
      <div className="drawer-header">
        <div>
          <p className="eyebrow">
            {player.continent} · {player.country} · {player.primaryPosition}
          </p>
          <h2>{player.name}</h2>
        </div>
        <button onClick={onClose} type="button">
          닫기
        </button>
      </div>
      <p className="drawer-summary">{player.profile.summary}</p>
      <div className="drawer-meta-chips" aria-label="선수 메타 정보">
        <span>{player.continent}</span>
        <span>{player.country}</span>
        <span>{player.primaryPosition}</span>
        <span className={`tier-badge ${getLegendTier(player.overallScore).id}`}>{getLegendTier(player.overallScore).label}</span>
      </div>
      <div className="official-score-panel">
        <span>공식 총점</span>
        <strong>{player.overallScore}</strong>
        <em>
          {scoreModeLabels[player.scoreMode]} · {getLegendTier(player.overallScore).range}
        </em>
      </div>
      <div className="drawer-actions">
        <button className={isShortlisted ? "primary-inline active" : "primary-inline"} onClick={() => onToggleShortlist(player.id)} type="button">
          {isShortlisted ? "관심 선수 해제" : "관심 선수 추가"}
        </button>
        <button className="primary-inline" onClick={() => onToggleCompare(player.id)} type="button">
          비교에 추가
        </button>
      </div>
      <div className="inspector-score-grid" aria-label="세부 점수">
        {profileKeys.map((key) => (
          <button
            className={activeSection === key ? "score-tile active" : "score-tile"}
            key={key}
            onClick={() => {
              setActiveSection(key);
              setOpenSections((current) => ({ ...current, [key]: true }));
            }}
            type="button"
          >
            <span>{scoreLabels[key]}</span>
            <strong>{player.scores[key]}</strong>
            <i aria-hidden="true">
              <b style={{ width: `${player.scores[key]}%` }} />
            </i>
          </button>
        ))}
      </div>
      <div className="profile-tools" aria-label="프로필 섹션 제어">
        <button onClick={() => setOpenSections(getOpenProfileSections(true))} type="button">
          전체 열기
        </button>
        <button onClick={() => setOpenSections(getOpenProfileSections(false))} type="button">
          전체 접기
        </button>
      </div>
      <div className="profile-section-stack">
        {profileKeys.map((key) => {
          const section = player.profile.sections[key];
          const isOpen = openSections[key];
          return (
            <section className={activeSection === key ? "profile-section active" : "profile-section"} key={key}>
              <button
                aria-expanded={isOpen}
                className="profile-section-toggle"
                onClick={() => {
                  setActiveSection(key);
                  setOpenSections((current) => ({ ...current, [key]: !current[key] }));
                }}
                type="button"
              >
                <span>
                  <em>{scoreLabels[key]}</em>
                  <strong>{section.title}</strong>
                </span>
                <b>
                  {section.score} · {section.grade}
                </b>
              </button>
              {isOpen ? (
                <div className="profile-section-body">
                  <p>{section.explanation}</p>
                  {section.verdict ? <p className="profile-verdict">{section.verdict}</p> : null}
                  {section.facts?.length ? (
                    <div className="fact-group-stack">
                      {section.facts.map((fact) => (
                        <article className="fact-group" key={fact.label}>
                          <h4>{fact.label}</h4>
                          <ul>
                            {fact.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  {section.caveat ? <p className="profile-caveat">{section.caveat}</p> : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      {player.profile.sources.length ? (
        <section className="profile-section source-section">
          <div className="profile-section-header">
            <h3>출처</h3>
          </div>
          <div className="source-link-grid">
            {player.profile.sources.map((source) => (
              <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                {source.label}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PlayerMiniCard({ onClick, player, rating }: { onClick: () => void; player: LegendPlayer; rating: number }) {
  return (
    <button className="player-mini-card" onClick={onClick} type="button">
      <strong>{player.name}</strong>
      <span>
        {player.primaryPosition} · 공식 {player.overallScore} · 기준 {rating}
      </span>
      <span className={`tier-badge ${getLegendTier(player.overallScore).id}`}>{getLegendTier(player.overallScore).label}</span>
    </button>
  );
}

function PlayerRow({
  index,
  onClick,
  player,
  rating,
}: {
  index: number;
  onClick: () => void;
  player: LegendPlayer;
  rating: number;
}) {
  return (
    <button className="player-row as-button" onClick={onClick} type="button">
      <span className="row-index">{index}</span>
      <div>
        <strong>{player.name}</strong>
        <small>
          {player.country} · {player.primaryPosition} · {getLegendTier(player.overallScore).label}
        </small>
      </div>
      <em>{rating}</em>
    </button>
  );
}

function ScoreBars({ player }: { player: LegendPlayer }) {
  return (
    <div className="score-bars">
      {(Object.keys(scoreLabels) as ScoreKey[]).map((key) => (
        <span key={key} title={`${scoreLabels[key]} ${player.scores[key]}`}>
          <i style={{ width: `${player.scores[key]}%` }} />
        </span>
      ))}
    </div>
  );
}

function getSnakeDraftTeamIndex(pickIndex: number, teamCount: number) {
  const roundIndex = Math.floor(pickIndex / teamCount);
  const slotIndex = pickIndex % teamCount;
  return roundIndex % 2 === 0 ? slotIndex : teamCount - 1 - slotIndex;
}

function chooseQuizPlayer(players: LegendPlayer[], currentPlayerId?: string) {
  const pool = players.filter((player) => player.id !== currentPlayerId && player.overallScore >= 85);
  const candidates = pool.length ? pool : players.filter((player) => player.id !== currentPlayerId);
  if (!candidates.length) {
    return players[0] ?? null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function normalizeQuizAnswer(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");
}

function maskQuizAnswer(value: string, answer: string) {
  return value.replaceAll(answer, "이 선수");
}

function formatDecadeLabel(decade: number) {
  return decade ? `${decade}s` : "Unplaced";
}

function getDefaultTournamentCountries(countries: LegendData["countries"]) {
  const preferred = ["Brazil", "Argentina", "France", "Germany", "Italy", "Netherlands", "Spain", "England"];
  const selected = preferred.map((name) => countries.find((country) => country.name === name)?.name).filter(Boolean) as string[];

  for (const country of countries) {
    if (selected.length >= 8) {
      break;
    }

    if (!selected.includes(country.name)) {
      selected.push(country.name);
    }
  }

  return selected.slice(0, 8);
}

function ensureUniqueTournamentCountries(selectedCountries: string[], countries: LegendData["countries"], size: TournamentSize) {
  const next = selectedCountries.filter(Boolean);

  for (const country of countries) {
    if (next.length >= size) {
      break;
    }

    if (!next.includes(country.name)) {
      next.push(country.name);
    }
  }

  return next.slice(0, size);
}

function getPrimaryScoreKey(player: LegendPlayer) {
  return (Object.keys(scoreLabels) as ScoreKey[]).sort((a, b) => player.scores[b] - player.scores[a])[0];
}

function getLegendTier(score: number): LegendTier {
  if (score >= 95) {
    return legendTiers[0];
  }

  if (score >= 90) {
    return legendTiers[1];
  }

  if (score >= 85) {
    return legendTiers[2];
  }

  if (score >= 80) {
    return legendTiers[3];
  }

  if (score >= 75) {
    return legendTiers[4];
  }

  return legendTiers[5];
}

function getOpenProfileSections(value: boolean): Record<ScoreKey, boolean> {
  return {
    teamCareer: value,
    individualCareer: value,
    primeSkill: value,
    teamImportance: value,
    legacy: value,
  };
}

function matchesPlayerSearch(player: LegendPlayer, normalizedQuery: string) {
  return getPlayerSearchFields(player).some((field) => field.includes(normalizedQuery));
}

function getPlayerSearchRank(player: LegendPlayer, normalizedQuery: string) {
  if (!normalizedQuery) {
    return 0;
  }

  const name = player.name.toLowerCase();
  const country = player.country.toLowerCase();
  const position = player.primaryPosition.toLowerCase();
  const tags = player.tags.join(" ").toLowerCase();

  if (name === normalizedQuery) {
    return 0;
  }

  if (name.startsWith(normalizedQuery)) {
    return 1;
  }

  if (name.includes(normalizedQuery)) {
    return 2;
  }

  if (country.startsWith(normalizedQuery)) {
    return 3;
  }

  if (country.includes(normalizedQuery)) {
    return 4;
  }

  if (position === normalizedQuery) {
    return 5;
  }

  if (tags.includes(normalizedQuery)) {
    return 6;
  }

  return 9;
}

function getPlayerSearchFields(player: LegendPlayer) {
  return [
    player.name,
    player.country,
    player.continent,
    player.primaryPosition,
    ...player.tags,
  ].map((value) => value.toLowerCase());
}

function getDefaultSlotRole(slot: FormationSlot): PitchRole {
  return (slot.accepts.find((position) => position !== "LEGEND") ?? "CM") as PitchRole;
}

function isPitchRole(value: string): value is PitchRole {
  return positionOptions.includes(value as PositionCode) && value !== "LEGEND";
}

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSquadExport(
  scope: string,
  formationName: string,
  starters: Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>,
  averageRating: number,
) {
  const lines = starters.map(({ player, rating, slot }) => `${slot.label}: ${player.name} (${player.country}, ${rating})`);
  return [`${scope} ${formationName} XI`, `Average: ${averageRating}`, "", ...lines].join("\n");
}

function createSimulationTeam(
  id: string,
  source: SimTeamSource,
  country: string,
  savedSquadId: string,
  currentStarters: Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>,
  players: LegendPlayer[],
  savedSquads: SavedSquad[],
  playerById: Map<string, LegendPlayer>,
  weights: WeightMap,
  currentFormationName: string,
): SimulationTeamInput {
  if (source === "current") {
    return {
      id,
      name: `Current ${currentFormationName}`,
      slots: currentStarters.map(({ player, slot }) => ({
        id: slot.id,
        label: slot.label,
        player,
        role: isPitchRole(slot.label) ? slot.label : slot.accepts[0],
      })),
    };
  }

  if (source === "saved") {
    const saved = savedSquads.find((item) => item.id === savedSquadId) ?? savedSquads[0];

    if (!saved) {
      return {
        id,
        name: "Saved XI",
        slots: [],
      };
    }

    return {
      id,
      name: saved.name,
      slots: saved.slots
        .map((savedSlot) => {
          const player = playerById.get(savedSlot.playerId);
          if (!player) {
            return null;
          }

          const formationSlot = formations[saved.formationId]?.slots.find((slot) => slot.id === savedSlot.slotId);

          return {
            id: savedSlot.slotId,
            label: savedSlot.slotLabel,
            player,
            role: isPitchRole(savedSlot.slotLabel) ? savedSlot.slotLabel : formationSlot?.accepts[0] ?? player.primaryPosition,
          };
        })
        .filter(Boolean) as SimulationTeamInput["slots"],
    };
  }

  const formation = formations["4-3-3"];
  const pool = source === "country" ? players.filter((player) => player.country === country) : players;
  const squad = buildSquad(pool, pool, formation.slots, weights, {});

  return {
    id,
    name: source === "country" ? `${country} Auto XI` : "World Auto XI",
    slots: formation.slots
      .map((slot) => {
        const selected = squad[slot.id];
        return selected
          ? {
              id: slot.id,
              label: slot.label,
              player: selected.player,
              role: slot.accepts[0],
            }
          : null;
      })
      .filter(Boolean) as SimulationTeamInput["slots"],
  };
}

function formatDraftExport(
  teams: Array<{
    average: number;
    players: LegendPlayer[];
    teamIndex: number;
    xiAverage: number;
  }>,
  picks: DraftPick[],
  playerById: Map<string, LegendPlayer>,
  weights: WeightMap,
  rounds: number,
) {
  const header = [`Legend Draft`, `${teams.length} teams · ${rounds} rounds · ${picks.length} picks`, ""];
  const teamBlocks = teams.flatMap((team) => {
    const teamPicks = picks
      .filter((pick) => pick.teamIndex === team.teamIndex)
      .map((pick) => {
        const player = playerById.get(pick.playerId);
        return player ? `#${pick.pickNumber} ${player.name} (${player.country}, ${player.primaryPosition}, ${ratePlayer(player, weights)})` : null;
      })
      .filter(Boolean) as string[];

    return [
      `Team ${team.teamIndex + 1}`,
      `Average: ${team.average || "-"} · XI: ${team.xiAverage || "-"}`,
      ...teamPicks,
      "",
    ];
  });

  return [...header, ...teamBlocks].join("\n").trim();
}

function formatChallengeExport(
  challenge: ChallengeOption,
  formationName: string,
  starters: Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>,
  averageRating: number,
) {
  const lines = starters.map(({ player, rating, slot }) => `${slot.label}: ${player.name} (${player.country}, ${player.primaryPosition}, ${rating})`);
  return [
    `Legend Challenge: ${challenge.label}`,
    `Formation: ${formationName}`,
    `Average: ${averageRating} / Target ${challenge.target}`,
    `Difficulty: ${challenge.difficulty}`,
    "",
    ...lines,
  ].join("\n");
}

function createEmptyDepthRow(position: PositionCode): DepthPositionRow {
  return {
    average: 0,
    count: 0,
    players: [],
    position,
    topScore: 0,
  };
}

function buildBattleCountryProfile(
  country: string,
  players: LegendPlayer[],
  countries: LegendData["countries"],
  weights: WeightMap,
): BattleCountryProfile {
  const countryPlayers = players
    .filter((player) => player.country === country)
    .sort((a, b) => b.overallScore - a.overallScore || a.positionOrder - b.positionOrder || a.name.localeCompare(b.name));
  const rows = positionOptions.map((position) => {
    const positionPlayers = countryPlayers.filter((player) => player.primaryPosition === position);
    const topPlayers = positionPlayers.slice(0, 3);
    return {
      average: average(topPlayers.map((player) => player.overallScore)),
      count: positionPlayers.length,
      players: positionPlayers,
      position,
      topScore: positionPlayers[0]?.overallScore ?? 0,
    };
  });
  const countryFormation = formations["4-3-3"];
  const countrySquad = buildSquad(countryPlayers, countryPlayers, countryFormation.slots, weights, {});
  const xiStarters = countryFormation.slots
    .map((slot) => {
      const selected = countrySquad[slot.id];
      return selected ? { slot, player: selected.player, rating: selected.rating } : null;
    })
    .filter(Boolean) as Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;
  const nonEmptyRows = rows.filter((row) => row.count > 0);

  return {
    average: average(countryPlayers.slice(0, 10).map((player) => player.overallScore)),
    country,
    players: countryPlayers,
    rows,
    strengths: [...nonEmptyRows].sort((a, b) => b.average - a.average || b.count - a.count).slice(0, 3),
    summary: countries.find((item) => item.name === country),
    topPlayers: countryPlayers.slice(0, 10),
    topScore: countryPlayers[0]?.overallScore ?? 0,
    weaknesses: [...nonEmptyRows].sort((a, b) => a.average - b.average || a.count - b.count).slice(0, 3),
    xiAverage: average(xiStarters.map((starter) => starter.rating)),
    xiStarters,
  };
}

function buildBattleEraProfile(eraId: EraId, players: LegendPlayer[], weights: WeightMap): BattleCountryProfile {
  const era = eraOptions.find((item) => item.id === eraId) ?? eraOptions[0];
  const eraPlayers = players
    .filter((player) => getPlayerEra(player).id === era.id)
    .sort((a, b) => b.overallScore - a.overallScore || a.positionOrder - b.positionOrder || a.name.localeCompare(b.name));
  const rows = positionOptions.map((position) => {
    const positionPlayers = eraPlayers.filter((player) => player.primaryPosition === position);
    const topPlayers = positionPlayers.slice(0, 3);
    return {
      average: average(topPlayers.map((player) => player.overallScore)),
      count: positionPlayers.length,
      players: positionPlayers,
      position,
      topScore: positionPlayers[0]?.overallScore ?? 0,
    };
  });
  const eraFormation = formations["4-3-3"];
  const eraSquad = buildSquad(eraPlayers, eraPlayers, eraFormation.slots, weights, {});
  const xiStarters = eraFormation.slots
    .map((slot) => {
      const selected = eraSquad[slot.id];
      return selected ? { slot, player: selected.player, rating: selected.rating } : null;
    })
    .filter(Boolean) as Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;
  const nonEmptyRows = rows.filter((row) => row.count > 0);

  return {
    average: average(eraPlayers.slice(0, 10).map((player) => player.overallScore)),
    country: `${era.label} (${era.range})`,
    players: eraPlayers,
    rows,
    strengths: [...nonEmptyRows].sort((a, b) => b.average - a.average || b.count - a.count).slice(0, 3),
    topPlayers: eraPlayers.slice(0, 10),
    topScore: eraPlayers[0]?.overallScore ?? 0,
    weaknesses: [...nonEmptyRows].sort((a, b) => a.average - b.average || a.count - b.count).slice(0, 3),
    xiAverage: average(xiStarters.map((starter) => starter.rating)),
    xiStarters,
  };
}

function getPlayerEra(player: LegendPlayer): EraOption {
  const year = getPlayerRepresentativeYear(player);
  if (!year) {
    return eraOptions.find((era) => era.id === "unplaced") ?? eraOptions[eraOptions.length - 1];
  }

  return eraOptions.find((era) => year >= era.start && year <= era.end) ?? eraOptions.find((era) => era.id === "unplaced") ?? eraOptions[eraOptions.length - 1];
}

function getPlayerRepresentativeYear(player: LegendPlayer) {
  const primeYears = extractYearsFromText([
    player.profile.sections.primeSkill.explanation,
    ...player.profile.sections.primeSkill.bullets,
    ...(player.profile.sections.primeSkill.facts?.flatMap((fact) => fact.items) ?? []),
  ].join(" "));
  const candidateYears = primeYears.length ? primeYears : extractYearsFromText(getPlayerProfileText(player));

  if (!candidateYears.length) {
    return null;
  }

  const sorted = [...candidateYears].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function extractYearsFromText(value: string) {
  const matches = value.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  return matches
    .map((year) => Number(year))
    .filter((year) => year >= 1930 && year <= 2026);
}

function getPlayerProfileText(player: LegendPlayer) {
  const sections = Object.values(player.profile.sections);
  return [
    player.profile.summary,
    ...sections.flatMap((section) => [
      section.title,
      section.verdict ?? "",
      section.explanation,
      section.caveat ?? "",
      ...section.bullets,
      ...(section.facts?.flatMap((fact) => [fact.label, ...fact.items]) ?? []),
    ]),
  ].join(" ");
}

function getFitLevel(fit: number) {
  if (fit >= 0.94) {
    return "high";
  }

  if (fit >= 0.78) {
    return "mid";
  }

  return "low";
}

function findPitchRole(position: SlotPosition): PitchRole {
  const containingZone = pitchZones.find(
    (zone) =>
      position.left >= zone.left &&
      position.left <= zone.left + zone.width &&
      position.top >= zone.top &&
      position.top <= zone.top + zone.height,
  );

  if (containingZone) {
    return containingZone.role;
  }

  return pitchZones
    .map((zone) => {
      const centerLeft = zone.left + zone.width / 2;
      const centerTop = zone.top + zone.height / 2;
      return {
        role: zone.role,
        distance: Math.hypot(position.left - centerLeft, (position.top - centerTop) * 1.15),
      };
    })
    .sort((a, b) => a.distance - b.distance)[0].role;
}

function buildSquad(
  autoPlayers: LegendPlayer[],
  allPlayers: LegendPlayer[],
  slots: FormationSlot[],
  weights: WeightMap,
  manualSlots: Record<string, string>,
) {
  const selected = new Set<string>();
  const squad: Record<string, { player: LegendPlayer; rating: number }> = {};

  for (const slot of slots) {
    const manualPlayer = allPlayers.find((player) => player.id === manualSlots[slot.id]);
    if (!manualPlayer || selected.has(manualPlayer.id)) {
      continue;
    }

    selected.add(manualPlayer.id);
    squad[slot.id] = {
      player: manualPlayer,
      rating: ratePlayerForSlot(manualPlayer, slot, weights),
    };
  }

  for (const slot of slots) {
    if (squad[slot.id]) {
      continue;
    }

    const best = rankCandidatesForSlot(autoPlayers, slot, weights).find((candidate) => !selected.has(candidate.player.id));
    if (!best) {
      continue;
    }

    selected.add(best.player.id);
    squad[slot.id] = {
      player: best.player,
      rating: best.rating,
    };
  }

  return squad;
}

function rankCandidatesForSlot(players: LegendPlayer[], slot: FormationSlot, weights: WeightMap) {
  return players
    .map((player) => {
      const fit = positionFit(player.primaryPosition, slot.accepts);
      return {
        player,
        fit,
        rating: ratePlayerForSlot(player, slot, weights),
      };
    })
    .filter((candidate) => candidate.fit >= 0.5)
    .sort((a, b) => b.rating - a.rating || b.fit - a.fit || a.player.positionOrder - b.player.positionOrder);
}

function ratePlayerForSlot(player: LegendPlayer, slot: FormationSlot, weights: WeightMap) {
  const weighted = ratePlayer(player, weights);
  const fit = positionFit(player.primaryPosition, slot.accepts);
  return Math.min(100, Math.round(weighted * fit + (slot.accepts[0] === player.primaryPosition ? 3 : 0)));
}

function ratePlayer(player: LegendPlayer, weights: WeightMap) {
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const weighted = (Object.keys(weights) as ScoreKey[]).reduce(
    (sum, key) => sum + player.scores[key] * weights[key],
    0,
  );

  return Math.round(weighted / totalWeight);
}

function positionFit(position: PositionCode, accepts: PositionCode[]) {
  if (accepts.includes(position)) {
    return accepts[0] === position ? 1 : 0.94;
  }

  const attacking = new Set(["ST", "SS", "RW", "LW", "AM"]);
  const midfield = new Set(["AM", "CM", "DM"]);
  const defense = new Set(["CB", "RB", "LB", "DM"]);
  const acceptsAttack = accepts.some((item) => attacking.has(item));
  const acceptsMidfield = accepts.some((item) => midfield.has(item));
  const acceptsDefense = accepts.some((item) => defense.has(item));

  if (attacking.has(position) && acceptsAttack) {
    return 0.82;
  }

  if (midfield.has(position) && acceptsMidfield) {
    return 0.8;
  }

  if (defense.has(position) && acceptsDefense) {
    return 0.78;
  }

  return position === "LEGEND" ? 0.7 : 0.55;
}

function groupPlayersByPosition(players: LegendPlayer[]) {
  return players.reduce<Partial<Record<PositionCode, LegendPlayer[]>>>((groups, player) => {
    groups[player.primaryPosition] = [...(groups[player.primaryPosition] ?? []), player];
    return groups;
  }, {});
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
