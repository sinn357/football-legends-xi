"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { LegendData, LegendPlayer, PlayerStatus, PositionCode, ScoreKey } from "@/lib/legend-data";

type WeightMap = Record<ScoreKey, number>;

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
  country: string;
  formationId: string;
  formationName: string;
  createdAt: string;
  weights: WeightMap;
  slots: SavedSlot[];
};

const scoreLabels: Record<ScoreKey, string> = {
  teamCareer: "팀 커리어",
  individualCareer: "개인 커리어",
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

const storageKey = "football-legends-xi.saved-squads.v1";
const slotPositionsStorageKey = "football-legends-xi.slot-positions.v1";

export function LegendBuilder({ data }: { data: LegendData }) {
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const activeDragSlotRef = useRef<string | null>(null);
  const defaultCountry = data.countries.find((country) => country.name === "Brazil")?.name ?? data.countries[0]?.name ?? "";
  const [country, setCountry] = useState(defaultCountry);
  const [formationId, setFormationId] = useState("4-3-3");
  const [weights, setWeights] = useState<WeightMap>(initialWeights);
  const [includeActiveHold, setIncludeActiveHold] = useState(true);
  const [includeDeleteCandidates, setIncludeDeleteCandidates] = useState(false);
  const [query, setQuery] = useState("");
  const [manualSlots, setManualSlots] = useState<Record<string, string>>({});
  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [slotPositions, setSlotPositions] = useState<Record<string, Record<string, SlotPosition>>>({});
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);

  const formation = formations[formationId];
  const countries = data.countries;
  const currentSlotPositions = slotPositions[formationId] ?? {};

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as SavedSquad[];
      setSavedSquads(parsed);
      setCompareIds(parsed.slice(0, 3).map((squad) => squad.id));
    } catch {
      setSavedSquads([]);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(slotPositionsStorageKey);
      if (!raw) {
        return;
      }

      setSlotPositions(JSON.parse(raw) as Record<string, Record<string, SlotPosition>>);
    } catch {
      setSlotPositions({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(savedSquads));
  }, [savedSquads]);

  useEffect(() => {
    window.localStorage.setItem(slotPositionsStorageKey, JSON.stringify(slotPositions));
  }, [slotPositions]);

  useEffect(() => {
    setManualSlots({});
  }, [country, formationId, includeActiveHold, includeDeleteCandidates]);

  const countryPlayers = useMemo(
    () =>
      data.players
        .filter((player) => player.country === country)
        .filter((player) => includeActiveHold || player.status !== "active-hold")
        .filter((player) => includeDeleteCandidates || player.status !== "delete-candidate"),
    [country, data.players, includeActiveHold, includeDeleteCandidates],
  );

  const squad = useMemo(
    () => buildSquad(countryPlayers, formation.slots, weights, manualSlots),
    [countryPlayers, formation.slots, manualSlots, weights],
  );

  const starters = formation.slots
    .map((slot) => {
      const selected = squad[slot.id];
      return selected ? { slot, player: selected.player, rating: selected.rating } : null;
    })
    .filter(Boolean) as Array<{ slot: FormationSlot; player: LegendPlayer; rating: number }>;

  const selectedIds = new Set(starters.map((starter) => starter.player.id));
  const bench = countryPlayers
    .filter((player) => !selectedIds.has(player.id))
    .map((player) => ({ player, rating: ratePlayer(player, weights) }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 12);

  const roster = countryPlayers
    .filter((player) => {
      const searchable = `${player.name} ${player.primaryPosition} ${player.tags.join(" ")}`.toLowerCase();
      return searchable.includes(query.toLowerCase());
    })
    .map((player) => ({ player, rating: ratePlayer(player, weights) }))
    .sort((a, b) => b.rating - a.rating || a.player.positionOrder - b.player.positionOrder);

  const selectedCountry = countries.find((item) => item.name === country);
  const averageRating = starters.length
    ? Math.round(starters.reduce((sum, starter) => sum + starter.rating, 0) / starters.length)
    : 0;

  function updateWeight(key: ScoreKey, value: number) {
    setWeights((current) => ({ ...current, [key]: value }));
  }

  function getSlotPosition(slot: FormationSlot) {
    return currentSlotPositions[slot.id] ?? { left: slot.left, top: slot.top };
  }

  function updateSlotPosition(slotId: string, event: PointerEvent<HTMLElement>) {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const left = clamp(((event.clientX - rect.left) / rect.width) * 100, 7, 93);
    const top = clamp(((event.clientY - rect.top) / rect.height) * 100, 8, 92);

    setSlotPositions((current) => ({
      ...current,
      [formationId]: {
        ...(current[formationId] ?? {}),
        [slotId]: {
          left: Math.round(left * 10) / 10,
          top: Math.round(top * 10) / 10,
        },
      },
    }));
  }

  function resetCurrentFormationPositions() {
    setSlotPositions((current) => {
      const next = { ...current };
      delete next[formationId];
      return next;
    });
  }

  function saveCurrentSquad() {
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
      id: `${country}-${formationId}-${now.getTime()}`,
      name: `${country} ${formation.name} #${savedSquads.length + 1}`,
      country,
      formationId,
      formationName: formation.name,
      createdAt: now.toISOString(),
      weights,
      slots,
    };

    setSavedSquads((current) => [saved, ...current].slice(0, 20));
    setCompareIds((current) => [saved.id, ...current].slice(0, 3));
  }

  function removeSavedSquad(id: string) {
    setSavedSquads((current) => current.filter((squadItem) => squadItem.id !== id));
    setCompareIds((current) => current.filter((compareId) => compareId !== id));
  }

  function toggleComparison(id: string) {
    setCompareIds((current) => {
      if (current.includes(id)) {
        return current.filter((compareId) => compareId !== id);
      }

      return [id, ...current].slice(0, 3);
    });
  }

  return (
    <main className="app-shell">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Local XI Lab</p>
          <h1>Football Legends XI</h1>
          <p className="header-copy">
            원본 레전드 리스트를 바탕으로 국가, 가중치, 포메이션을 바꿔가며 역대 베스트11을 실험합니다.
          </p>
        </div>
        <div className="source-panel">
          <span>Source</span>
          <strong>{data.players.length.toLocaleString()} players</strong>
          <small>{data.sourcePath}</small>
        </div>
      </section>

      <section className="control-strip" aria-label="조합 설정">
        <label className="field">
          <span>국가</span>
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            {countries.map((countryItem) => (
              <option value={countryItem.name} key={countryItem.name}>
                {countryItem.name} ({countryItem.count})
              </option>
            ))}
          </select>
        </label>

        <div className="formation-tabs" role="tablist" aria-label="포메이션">
          {Object.entries(formations).map(([id, item]) => (
            <button
              className={id === formationId ? "tab active" : "tab"}
              key={id}
              onClick={() => setFormationId(id)}
              type="button"
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="toggles" aria-label="필터">
          <label>
            <input
              checked={includeActiveHold}
              onChange={(event) => setIncludeActiveHold(event.target.checked)}
              type="checkbox"
            />
            현역보류 포함
          </label>
          <label>
            <input
              checked={includeDeleteCandidates}
              onChange={(event) => setIncludeDeleteCandidates(event.target.checked)}
              type="checkbox"
            />
            삭제후보 포함
          </label>
        </div>
      </section>

      <section className="summary-grid">
        <Metric label="선수 풀" value={`${countryPlayers.length}명`} detail={selectedCountry?.region ?? "Core Nations"} />
        <Metric label="추천 XI 평균" value={`${averageRating}`} detail="현재 가중치 기준" />
        <Metric label="저장된 조합" value={`${savedSquads.length}`} detail="브라우저 로컬 저장" />
        <Metric label="수동 고정" value={`${Object.keys(manualSlots).length}`} detail="슬롯 오버라이드" />
      </section>

      <section className="main-grid">
        <aside className="weights-panel" aria-label="평가 가중치">
          <div className="section-heading">
            <p className="eyebrow">Scoring</p>
            <h2>평가 가중치</h2>
          </div>
          <p className="panel-note">
            현재 점수는 원본 문서 순서 기반 MVP 시드입니다. 실제 커리어 리서치 점수로 교체할 수 있게 축을 분리해두었습니다.
          </p>

          <div className="slider-stack">
            {(Object.keys(scoreLabels) as ScoreKey[]).map((key) => (
              <label className="slider-row" key={key}>
                <span>
                  {scoreLabels[key]}
                  <strong>{weights[key]}</strong>
                </span>
                <input
                  max="50"
                  min="0"
                  onChange={(event) => updateWeight(key, Number(event.target.value))}
                  type="range"
                  value={weights[key]}
                />
              </label>
            ))}
          </div>

          <button className="primary-button" onClick={saveCurrentSquad} type="button">
            현재 XI 저장
          </button>
          <button className="ghost-button" onClick={() => setManualSlots({})} type="button">
            수동 고정 초기화
          </button>
        </aside>

        <section className="pitch-panel" aria-label="추천 베스트 일레븐">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">{country}</p>
              <h2>{formation.name} 추천 XI</h2>
            </div>
            <div className="pitch-actions">
              <button className="small-button" onClick={resetCurrentFormationPositions} type="button">
                위치 초기화
              </button>
              <span className="rating-pill">{averageRating}</span>
            </div>
          </div>

          <div className="pitch" aria-label="축구장" ref={pitchRef}>
            <div className="center-circle" />
            <div className="box top-box" />
            <div className="box bottom-box" />
            {formation.slots.map((slot) => {
              const selected = squad[slot.id];
              const position = getSlotPosition(slot);

              return (
                <div
                  aria-label={`${slot.label} ${selected?.player.name ?? "비어 있음"} 위치 이동`}
                  className={draggingSlotId === slot.id ? "player-token dragging" : "player-token"}
                  key={slot.id}
                  onPointerDown={(event) => {
                    activeDragSlotRef.current = slot.id;
                    setDraggingSlotId(slot.id);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateSlotPosition(slot.id, event);
                  }}
                  onPointerMove={(event) => {
                    if (activeDragSlotRef.current === slot.id) {
                      updateSlotPosition(slot.id, event);
                    }
                  }}
                  onPointerCancel={() => {
                    activeDragSlotRef.current = null;
                    setDraggingSlotId(null);
                  }}
                  onPointerUp={(event) => {
                    activeDragSlotRef.current = null;
                    setDraggingSlotId(null);
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                  }}
                  role="button"
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  tabIndex={0}
                  title="드래그해서 위치 이동"
                >
                  <span className="slot-label">{slot.label}</span>
                  <strong>{selected?.player.name ?? "비어 있음"}</strong>
                  <small>
                    {selected ? `${selected.player.primaryPosition} · ${selected.rating}` : slot.accepts.join("/")}
                  </small>
                </div>
              );
            })}
          </div>

          <div className="slot-editor" aria-label="슬롯별 수동 교체">
            {formation.slots.map((slot) => {
              const selected = squad[slot.id];
              const candidates = rankCandidatesForSlot(countryPlayers, slot, weights);

              return (
                <label key={slot.id}>
                  <span>
                    {slot.label}
                    {selected ? <em>{selected.player.name}</em> : null}
                  </span>
                  <select
                    value={manualSlots[slot.id] ?? ""}
                    onChange={(event) =>
                      setManualSlots((current) => {
                        const next = { ...current };
                        if (event.target.value) {
                          next[slot.id] = event.target.value;
                        } else {
                          delete next[slot.id];
                        }
                        return next;
                      })
                    }
                  >
                    <option value="">자동 추천</option>
                    {candidates.map(({ player, rating, fit }) => (
                      <option value={player.id} key={player.id}>
                        {player.name} · {player.primaryPosition} · {rating} · 적합도 {Math.round(fit * 100)}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </section>

        <aside className="bench-panel" aria-label="후보 선수">
          <div className="section-heading">
            <p className="eyebrow">Bench</p>
            <h2>상위 후보</h2>
          </div>
          <div className="bench-list">
            {bench.map(({ player, rating }, index) => (
              <PlayerRow key={player.id} index={index + 1} player={player} rating={rating} />
            ))}
          </div>
        </aside>
      </section>

      <section className="data-grid">
        <div className="roster-panel">
          <div className="section-heading row">
            <div>
              <p className="eyebrow">Roster</p>
              <h2>선수 풀</h2>
            </div>
            <input
              aria-label="선수 검색"
              className="search-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="선수, 포지션, 태그 검색"
              type="search"
              value={query}
            />
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>선수</th>
                  <th>포지션</th>
                  <th>상태</th>
                  <th>종합</th>
                  <th>세부 점수</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(({ player, rating }) => (
                  <tr key={player.id}>
                    <td>
                      <strong>{player.name}</strong>
                    </td>
                    <td>{player.primaryPosition}</td>
                    <td>
                      <span className={`status ${player.status}`}>{statusLabels[player.status]}</span>
                    </td>
                    <td>{rating}</td>
                    <td>
                      <ScoreBars player={player} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="saved-panel">
          <div className="section-heading">
            <p className="eyebrow">Compare</p>
            <h2>저장 조합</h2>
          </div>

          {savedSquads.length === 0 ? (
            <p className="empty-state">아직 저장된 조합이 없습니다.</p>
          ) : (
            <div className="saved-list">
              {savedSquads.map((saved) => (
                <article className="saved-item" key={saved.id}>
                  <label>
                    <input
                      checked={compareIds.includes(saved.id)}
                      onChange={() => toggleComparison(saved.id)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{saved.name}</strong>
                      <small>
                        {saved.formationName} · {new Date(saved.createdAt).toLocaleString("ko-KR")}
                      </small>
                    </span>
                  </label>
                  <button onClick={() => removeSavedSquad(saved.id)} type="button">
                    삭제
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className="comparison-grid">
            {savedSquads
              .filter((saved) => compareIds.includes(saved.id))
              .map((saved) => (
                <article className="comparison-card" key={saved.id}>
                  <h3>{saved.name}</h3>
                  <p>
                    {saved.country} · {saved.formationName}
                  </p>
                  <ol>
                    {saved.slots.map((slot) => (
                      <li key={slot.slotId}>
                        <span>{slot.slotLabel}</span>
                        <strong>{slot.playerName}</strong>
                        <em>{slot.rating}</em>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
          </div>
        </div>
      </section>
    </main>
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

function PlayerRow({ index, player, rating }: { index: number; player: LegendPlayer; rating: number }) {
  return (
    <article className="player-row">
      <span className="row-index">{index}</span>
      <div>
        <strong>{player.name}</strong>
        <small>
          {player.primaryPosition} · {statusLabels[player.status]}
        </small>
      </div>
      <em>{rating}</em>
    </article>
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

function buildSquad(
  players: LegendPlayer[],
  slots: FormationSlot[],
  weights: WeightMap,
  manualSlots: Record<string, string>,
) {
  const selected = new Set<string>();
  const squad: Record<string, { player: LegendPlayer; rating: number }> = {};

  for (const slot of slots) {
    const manualPlayer = players.find((player) => player.id === manualSlots[slot.id]);
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

    const best = rankCandidatesForSlot(players, slot, weights).find((candidate) => !selected.has(candidate.player.id));
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
    .filter((candidate) => candidate.fit >= 0.68)
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
