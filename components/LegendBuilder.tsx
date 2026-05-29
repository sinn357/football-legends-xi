"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { Continent, LegendData, LegendPlayer, PlayerStatus, PositionCode, ScoreKey } from "@/lib/legend-data";

type TabId = "atlas" | "best-xi" | "rankings" | "compare";
type WeightMap = Record<ScoreKey, number>;
type FilterValue = "ALL";
type PitchRole = Exclude<PositionCode, "LEGEND">;

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

const scoreLabels: Record<ScoreKey, string> = {
  teamCareer: "팀 커리어",
  individualCareer: "개인 수상",
  primeSkill: "프라임 실력",
  teamImportance: "팀 내 비중",
  legacy: "100년 뒤 존재감",
};

const statusLabels: Record<PlayerStatus, string> = {
  confirmed: "확정",
  "active-hold": "현역보류",
  "active-legend": "현역확정",
  "delete-candidate": "삭제후보",
  watch: "검토",
};

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
  const [activeTab, setActiveTab] = useState<TabId>("atlas");
  const [atlasContinent, setAtlasContinent] = useState<Continent | null>("America");
  const [atlasCountry, setAtlasCountry] = useState(defaultCountry);
  const [formationId, setFormationId] = useState("4-3-3");
  const [weights, setWeights] = useState<WeightMap>(initialWeights);
  const [includeActiveHold, setIncludeActiveHold] = useState(true);
  const [includeDeleteCandidates, setIncludeDeleteCandidates] = useState(false);
  const [builderContinent, setBuilderContinent] = useState<Continent | FilterValue>("ALL");
  const [builderCountry, setBuilderCountry] = useState<string | FilterValue>("ALL");
  const [builderPosition, setBuilderPosition] = useState<PositionCode | FilterValue>("ALL");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [topOnly, setTopOnly] = useState(true);
  const [manualSlots, setManualSlots] = useState<Record<string, string>>({});
  const [selectedSlotId, setSelectedSlotId] = useState("st");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>([]);
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

  const statusFilteredPlayers = useMemo(
    () =>
      data.players
        .filter((player) => includeActiveHold || player.status !== "active-hold")
        .filter((player) => includeDeleteCandidates || player.status !== "delete-candidate"),
    [data.players, includeActiveHold, includeDeleteCandidates],
  );

  const builderCountries = useMemo(
    () =>
      data.countries.filter((country) => builderContinent === "ALL" || country.continent === builderContinent),
    [builderContinent, data.countries],
  );

  const candidatePlayers = useMemo(() => {
    const normalizedQuery = candidateQuery.trim().toLowerCase();
    return statusFilteredPlayers
      .filter((player) => builderContinent === "ALL" || player.continent === builderContinent)
      .filter((player) => builderCountry === "ALL" || player.country === builderCountry)
      .filter((player) => builderPosition === "ALL" || player.primaryPosition === builderPosition)
      .filter((player) => !topOnly || player.topTierRank !== null)
      .filter((player) => {
        if (!normalizedQuery) {
          return true;
        }
        return `${player.name} ${player.country} ${player.continent} ${player.primaryPosition} ${player.tags.join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .map((player) => ({ player, rating: ratePlayerForSlot(player, selectedSlot, weights) }))
      .sort((a, b) => b.rating - a.rating || (a.player.topTierRank ?? 999) - (b.player.topTierRank ?? 999))
      .slice(0, 80);
  }, [
    builderContinent,
    builderCountry,
    builderPosition,
    candidateQuery,
    selectedSlot,
    statusFilteredPlayers,
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

  const rankingPlayers = useMemo(
    () =>
      statusFilteredPlayers
        .map((player) => ({ player, rating: ratePlayer(player, weights) }))
        .sort((a, b) => b.rating - a.rating || (a.player.topTierRank ?? 999) - (b.player.topTierRank ?? 999))
        .slice(0, 100),
    [statusFilteredPlayers, weights],
  );

  const atlasPlayers = useMemo(
    () =>
      data.players
        .filter((player) => player.country === atlasCountry)
        .sort((a, b) => positionOptions.indexOf(a.primaryPosition) - positionOptions.indexOf(b.primaryPosition) || a.positionOrder - b.positionOrder),
    [atlasCountry, data.players],
  );

  const selectedCountrySummary = data.countries.find((country) => country.name === atlasCountry);
  const selectedCountryTop = atlasPlayers
    .map((player) => ({ player, rating: ratePlayer(player, weights) }))
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
    const saved: SavedSquad = {
      id: `${scope}-${formationId}-${now.getTime()}`,
      name: `${scope} ${formation.name} #${savedSquads.length + 1}`,
      scope,
      formationId,
      formationName: formation.name,
      createdAt: now.toISOString(),
      weights,
      slots,
    };

    setSavedSquads((current) => [saved, ...current].slice(0, 20));
  }

  function toggleCompare(playerId: string) {
    setCompareIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }

      return [playerId, ...current].slice(0, 4);
    });
  }

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
          weights={weights}
        />
      ) : null}

      {activeTab === "best-xi" ? (
        <BestXiView
          averageRating={averageRating}
          builderContinent={builderContinent}
          builderCountries={builderCountries}
          builderCountry={builderCountry}
          builderPosition={builderPosition}
          candidatePlayers={candidatePlayers}
          candidateQuery={candidateQuery}
          compareIds={compareIds}
          formation={{ name: formation.name, slots: effectiveSlots }}
          formationId={formationId}
          includeActiveHold={includeActiveHold}
          includeDeleteCandidates={includeDeleteCandidates}
          manualSlots={manualSlots}
          onAssignPlayer={assignPlayerToSelectedSlot}
          onCandidateQueryChange={setCandidateQuery}
          onContinentChange={(value) => {
            setBuilderContinent(value);
            setBuilderCountry("ALL");
          }}
          onCountryChange={setBuilderCountry}
          onFormationChange={setFormationId}
          onIncludeActiveHoldChange={setIncludeActiveHold}
          onIncludeDeleteCandidatesChange={setIncludeDeleteCandidates}
          onPlayerSelect={setSelectedPlayerId}
          onPositionChange={setBuilderPosition}
          onResetPositions={resetCurrentFormationPositions}
          onSave={saveCurrentSquad}
          onSelectedSlotChange={setSelectedSlotId}
          onToggleCompare={toggleCompare}
          onTopOnlyChange={setTopOnly}
          pitchRef={pitchRef}
          selectedSlotId={selectedSlot.id}
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
          weights={weights}
          onWeightChange={updateWeight}
        />
      ) : null}

      {activeTab === "rankings" ? (
        <RankingsView
          onPlayerSelect={setSelectedPlayerId}
          onToggleCompare={toggleCompare}
          rankings={rankingPlayers}
          weights={weights}
          onWeightChange={updateWeight}
        />
      ) : null}

      {activeTab === "compare" ? (
        <CompareView
          compareIds={compareIds}
          onPlayerSelect={setSelectedPlayerId}
          onToggleCompare={toggleCompare}
          players={data.players}
          playerById={playerById}
          weights={weights}
        />
      ) : null}

      <PlayerDetailDrawer player={selectedPlayer} onClose={() => setSelectedPlayerId(null)} onToggleCompare={toggleCompare} />
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
  weights: WeightMap;
}) {
  const groupedByPosition = groupPlayersByPosition(atlasPlayers);

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
          <Metric label="Top 10 평균" value={`${average(selectedCountryTop.map((item) => item.rating))}`} detail="현재 가중치" />
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
  candidatePlayers,
  candidateQuery,
  compareIds,
  dragStartPositionsRef,
  draggingSlotId,
  dropTargetRole,
  dropTargetSlotId,
  finalizeSlotDrag,
  formation,
  formationId,
  getSlotPositionsForDrag,
  includeActiveHold,
  includeDeleteCandidates,
  manualSlots,
  onAssignPlayer,
  onCandidateQueryChange,
  onContinentChange,
  onCountryChange,
  onFormationChange,
  onIncludeActiveHoldChange,
  onIncludeDeleteCandidatesChange,
  onPlayerSelect,
  onPositionChange,
  onResetPositions,
  onSave,
  onSelectedSlotChange,
  onToggleCompare,
  onTopOnlyChange,
  onWeightChange,
  pitchRef,
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
  candidatePlayers: Array<{ player: LegendPlayer; rating: number }>;
  candidateQuery: string;
  compareIds: string[];
  dragStartPositionsRef: MutableRefObject<Record<string, SlotPosition>>;
  draggingSlotId: string | null;
  dropTargetRole: PitchRole | null;
  dropTargetSlotId: string | null;
  finalizeSlotDrag: (slotId: string, event: DragPoint) => void;
  formation: { name: string; slots: FormationSlot[] };
  formationId: string;
  getSlotPositionsForDrag: () => Record<string, SlotPosition>;
  includeActiveHold: boolean;
  includeDeleteCandidates: boolean;
  manualSlots: Record<string, string>;
  onAssignPlayer: (playerId: string) => void;
  onCandidateQueryChange: (query: string) => void;
  onContinentChange: (value: Continent | FilterValue) => void;
  onCountryChange: (value: string | FilterValue) => void;
  onFormationChange: (formationId: string) => void;
  onIncludeActiveHoldChange: (value: boolean) => void;
  onIncludeDeleteCandidatesChange: (value: boolean) => void;
  onPlayerSelect: (playerId: string) => void;
  onPositionChange: (value: PositionCode | FilterValue) => void;
  onResetPositions: () => void;
  onSave: () => void;
  onSelectedSlotChange: (slotId: string) => void;
  onToggleCompare: (playerId: string) => void;
  onTopOnlyChange: (value: boolean) => void;
  onWeightChange: (key: ScoreKey, value: number) => void;
  pitchRef: RefObject<HTMLDivElement | null>;
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

  useEffect(() => {
    if (!draggingSlotId) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const slotId = activeDragSlotRef.current;
      if (slotId) {
        updateSlotPosition(slotId, event);
      }
    }

    function handleMouseUp(event: MouseEvent) {
      const slotId = activeDragSlotRef.current;
      if (slotId) {
        finalizeSlotDrag(slotId, event);
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
      <aside className="weights-panel">
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
        <div className="toggles vertical">
          <label>
            <input checked={topOnly} onChange={(event) => onTopOnlyChange(event.target.checked)} type="checkbox" />
            Top 50 기본 리스트
          </label>
          <label>
            <input checked={includeActiveHold} onChange={(event) => onIncludeActiveHoldChange(event.target.checked)} type="checkbox" />
            현역보류 포함
          </label>
          <label>
            <input
              checked={includeDeleteCandidates}
              onChange={(event) => onIncludeDeleteCandidatesChange(event.target.checked)}
              type="checkbox"
            />
            삭제후보 포함
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
                onClick={() => onSelectedSlotChange(slot.id)}
                onPointerCancel={() => {
                  activeDragSlotRef.current = null;
                  setDraggingSlotId(null);
                  setDropTargetSlotId(null);
                  setDropTargetRole(null);
                }}
                onPointerDown={(event) => {
                  activeDragSlotRef.current = slot.id;
                  dragStartPositionsRef.current = getSlotPositionsForDrag();
                  setDraggingSlotId(slot.id);
                  onSelectedSlotChange(slot.id);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateSlotPosition(slot.id, event);
                }}
                onPointerMove={(event) => {
                  if (activeDragSlotRef.current === slot.id) {
                    updateSlotPosition(slot.id, event);
                  }
                }}
                onPointerUp={(event) => {
                  finalizeSlotDrag(slot.id, event);
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
                onMouseDown={(event) => {
                  if (activeDragSlotRef.current) {
                    return;
                  }
                  activeDragSlotRef.current = slot.id;
                  dragStartPositionsRef.current = getSlotPositionsForDrag();
                  setDraggingSlotId(slot.id);
                  onSelectedSlotChange(slot.id);
                  updateSlotPosition(slot.id, event);
                }}
                role="button"
                style={{ left: `${position.left}%`, top: `${position.top}%` }}
                tabIndex={0}
                title="드래그해서 위치와 포지션 구역을 바꾸기"
              >
                <span className="slot-label">{slot.label}</span>
                <strong>{selected?.player.name ?? "비어 있음"}</strong>
                <small>{selected ? `${selected.player.country} · ${selected.rating}` : slot.accepts.join("/")}</small>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="candidate-panel">
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
                  {player.country} · {player.primaryPosition} · {rating}
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
      </aside>
    </section>
  );
}

function RankingsView({
  onPlayerSelect,
  onToggleCompare,
  onWeightChange,
  rankings,
  weights,
}: {
  onPlayerSelect: (playerId: string) => void;
  onToggleCompare: (playerId: string) => void;
  onWeightChange: (key: ScoreKey, value: number) => void;
  rankings: Array<{ player: LegendPlayer; rating: number }>;
  weights: WeightMap;
}) {
  return (
    <section className="rankings-grid">
      <aside className="weights-panel">
        <div className="section-heading">
          <p className="eyebrow">Ranking Lab</p>
          <h2>내 기준 랭킹</h2>
        </div>
        <div className="slider-stack">
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
      </aside>
      <section className="roster-panel">
        <div className="section-heading">
          <p className="eyebrow">Top 100</p>
          <h2>동적 레전드 랭킹</h2>
        </div>
        <div className="ranking-list">
          {rankings.map(({ player, rating }, index) => (
            <article className="ranking-item" key={player.id}>
              <span>{index + 1}</span>
              <button onClick={() => onPlayerSelect(player.id)} type="button">
                <strong>{player.name}</strong>
                <small>
                  {player.country} · {player.primaryPosition}
                </small>
              </button>
              <em>{rating}</em>
              <button onClick={() => onToggleCompare(player.id)} type="button">
                비교
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function CompareView({
  compareIds,
  onPlayerSelect,
  onToggleCompare,
  playerById,
  players,
  weights,
}: {
  compareIds: string[];
  onPlayerSelect: (playerId: string) => void;
  onToggleCompare: (playerId: string) => void;
  playerById: Map<string, LegendPlayer>;
  players: LegendPlayer[];
  weights: WeightMap;
}) {
  const comparedPlayers = compareIds.map((id) => playerById.get(id)).filter(Boolean) as LegendPlayer[];
  const quickChoices = players
    .filter((player) => player.topTierRank !== null)
    .sort((a, b) => (a.topTierRank ?? 999) - (b.topTierRank ?? 999))
    .slice(0, 80);

  return (
    <section className="compare-grid">
      <aside className="candidate-panel">
        <div className="section-heading">
          <p className="eyebrow">Compare</p>
          <h2>비교 선수 선택</h2>
        </div>
        <div className="candidate-list">
          {quickChoices.map((player) => (
            <article className="candidate-item" key={player.id}>
              <button onClick={() => onToggleCompare(player.id)} type="button">
                <strong>{player.name}</strong>
                <span>
                  {player.country} · {player.primaryPosition}
                </span>
              </button>
              <div>
                <button onClick={() => onPlayerSelect(player.id)} type="button">
                  정보
                </button>
              </div>
            </article>
          ))}
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
  if (!player) {
    return null;
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
      <div className="drawer-actions">
        <button className="primary-inline" onClick={() => onToggleCompare(player.id)} type="button">
          비교에 추가
        </button>
        <span className={`status ${player.status}`}>{statusLabels[player.status]}</span>
      </div>
      <ScoreBars player={player} />
      <div className="profile-section-stack">
        {(Object.keys(scoreLabels) as ScoreKey[]).map((key) => {
          const section = player.profile.sections[key];
          return (
            <section className="profile-section" key={key}>
              <div>
                <h3>{section.title}</h3>
                <strong>
                  {section.score} · {section.grade}
                </strong>
              </div>
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
            </section>
          );
        })}
      </div>
      {player.profile.sources.length ? (
        <section className="profile-section source-section">
          <div>
            <h3>출처</h3>
          </div>
          <ul>
            {player.profile.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} rel="noreferrer" target="_blank">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
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
        {player.primaryPosition} · {rating}
      </span>
      <em>{statusLabels[player.status]}</em>
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
          {player.country} · {player.primaryPosition}
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

function getDefaultSlotRole(slot: FormationSlot): PitchRole {
  return (slot.accepts.find((position) => position !== "LEGEND") ?? "CM") as PitchRole;
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
