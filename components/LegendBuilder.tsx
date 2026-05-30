"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode, RefObject } from "react";
import type { Continent, LegendData, LegendPlayer, PositionCode, ScoreKey, ScoreMode } from "@/lib/legend-data";

type TabId = "atlas" | "hall" | "depth" | "battle" | "era" | "best-xi" | "rankings" | "compare";
type WeightMap = Record<ScoreKey, number>;
type FilterValue = "ALL";
type PitchRole = Exclude<PositionCode, "LEGEND">;
type LegendTierId = "pantheon" | "all-time" | "national" | "borderline" | "watchlist" | "archive";

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

export function LegendBuilder({ data }: { data: LegendData }) {
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const activeDragSlotRef = useRef<string | null>(null);
  const dragStartPositionsRef = useRef<Record<string, SlotPosition>>({});
  const defaultCountry = data.countries.find((country) => country.name === "Brazil")?.name ?? data.countries[0]?.name ?? "";
  const defaultBattleCountry = data.countries.find((country) => country.name === "Argentina")?.name ?? data.countries[1]?.name ?? defaultCountry;
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

  function toggleCompare(playerId: string) {
    setCompareIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }

      return [playerId, ...current].slice(0, 4);
    });
  }

  const inspector = <PlayerDetailDrawer player={selectedPlayer} onClose={() => setSelectedPlayerId(null)} onToggleCompare={toggleCompare} />;

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
  onClose,
  onToggleCompare,
  player,
}: {
  onClose: () => void;
  onToggleCompare: (playerId: string) => void;
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
