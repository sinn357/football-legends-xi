import { createSeededRandom, type SeededRandom } from "./random";
import { buildTeamSimulationProfile } from "./team-metrics";
import { applyTactics, defaultTactics, getTacticTempoMultiplier } from "./tactics";
import type {
  AppliedTeamProfile,
  MatchEvent,
  MatchEventType,
  MatchTeamStats,
  PlayerMatchRating,
  RandomnessLevel,
  SimulatedMatchResult,
  SimulateMatchOptions,
  SimulationTactics,
  SimulationTeamInput,
  TeamMetrics,
  TeamSimulationProfile,
} from "./types";

type MatchSide = "A" | "B";

type RunningPlayerRating = PlayerMatchRating & {
  involvement: number;
};

const eventTypes: MatchEventType[] = ["openPlay", "centralCombination", "wideAttack", "counter", "pressWin", "setPiece", "error", "lateMoment"];

export function simulateMatch(
  teamA: SimulationTeamInput,
  teamB: SimulationTeamInput,
  tacticsA: SimulationTactics = defaultTactics,
  tacticsB: SimulationTactics = defaultTactics,
  options: SimulateMatchOptions = {},
): SimulatedMatchResult {
  const matchSeed = options.seed ?? `${teamA.id}:${teamB.id}:${Date.now()}`;
  const random = createSeededRandom(matchSeed);
  const profileA = applyMatchContext(buildTeamSimulationProfile(teamA), tacticsA, options.homeTeamId === teamA.id);
  const profileB = applyMatchContext(buildTeamSimulationProfile(teamB), tacticsB, options.homeTeamId === teamB.id);
  const events = simulateEvents(profileA, profileB, random, options.randomness ?? "normal");
  const stats = buildMatchStats(profileA, profileB, events);
  const playerRatings = buildPlayerRatings(profileA, profileB, events, stats);
  const winnerTeamId = stats[teamA.id].goals === stats[teamB.id].goals ? null : stats[teamA.id].goals > stats[teamB.id].goals ? teamA.id : teamB.id;

  return {
    events,
    matchSeed,
    playerRatings,
    report: buildTacticalReport(profileA, profileB, stats, winnerTeamId, events, playerRatings),
    stats,
    teams: {
      [teamA.id]: profileA,
      [teamB.id]: profileB,
    },
    winnerTeamId,
  };
}

function applyMatchContext(profile: TeamSimulationProfile, tactics: SimulationTactics, isHome: boolean): AppliedTeamProfile {
  const adjustedMetrics = applyTactics(profile.metrics, tactics);

  if (isHome) {
    adjustedMetrics.midfieldControl += 2;
    adjustedMetrics.attackPower += 1;
    adjustedMetrics.chemistry += 1;
  }

  return {
    ...profile,
    adjustedMetrics,
    tactics,
  };
}

function simulateEvents(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile, random: SeededRandom, randomness: RandomnessLevel) {
  const tempoMultiplier = (getTacticTempoMultiplier(profileA.tactics) + getTacticTempoMultiplier(profileB.tactics)) / 2;
  const randomnessMultiplier = randomness === "controlled" ? 0.9 : randomness === "wild" ? 1.18 : 1;
  const baseEvents = Math.round(random.between(22, 32) * tempoMultiplier * randomnessMultiplier);
  const events: MatchEvent[] = [];

  for (let index = 0; index < baseEvents; index += 1) {
    const minute = Math.min(90, Math.max(1, Math.round(((index + random.next()) / baseEvents) * 90)));
    const side = pickAttackingSide(profileA.adjustedMetrics, profileB.adjustedMetrics, random);
    const attacking = side === "A" ? profileA : profileB;
    const defending = side === "A" ? profileB : profileA;
    const eventType = pickEventType(attacking.adjustedMetrics, defending.adjustedMetrics, minute, random);
    const xg = calculateXg(attacking.adjustedMetrics, defending.adjustedMetrics, eventType, random, randomness);
    const outcome = resolveOutcome(xg, attacking.adjustedMetrics, defending.adjustedMetrics, random);
    const scorer = outcome === "goal" || xg > 0.08 ? pickEventPlayer(attacking, eventType, "scorer", random) : undefined;
    const assister = scorer && random.chance(0.58) ? pickEventPlayer(attacking, eventType, "assister", random, scorer.player.id) : undefined;

    events.push({
      assisterId: assister?.player.id,
      defendingTeamId: defending.team.id,
      description: describeEvent(minute, attacking, defending, eventType, outcome, scorer?.player.name, assister?.player.name),
      eventType,
      minute,
      outcome,
      scorerId: scorer?.player.id,
      teamId: attacking.team.id,
      xg,
    });
  }

  return events.sort((a, b) => a.minute - b.minute || eventTypes.indexOf(a.eventType) - eventTypes.indexOf(b.eventType));
}

function pickAttackingSide(metricsA: TeamMetrics, metricsB: TeamMetrics, random: SeededRandom): MatchSide {
  const attackA = metricsA.midfieldControl * 0.34 + metricsA.progression * 0.25 + metricsA.attackPower * 0.25 + metricsA.pressingPower * 0.16 - metricsA.roleConflict * 0.12;
  const attackB = metricsB.midfieldControl * 0.34 + metricsB.progression * 0.25 + metricsB.attackPower * 0.25 + metricsB.pressingPower * 0.16 - metricsB.roleConflict * 0.12;
  return random.chance(attackA / Math.max(1, attackA + attackB)) ? "A" : "B";
}

function pickEventType(attacking: TeamMetrics, defending: TeamMetrics, minute: number, random: SeededRandom): MatchEventType {
  return selectByWeight(
    [
      { item: "openPlay" as const, weight: 18 + attacking.attackPower * 0.12 },
      { item: "centralCombination" as const, weight: 10 + attacking.chanceQuality * 0.18 + attacking.midfieldControl * 0.08 },
      { item: "wideAttack" as const, weight: 8 + attacking.progression * 0.11 + Math.max(0, 85 - defending.wideSecurity) * 0.08 },
      { item: "counter" as const, weight: 7 + attacking.transitionThreat * 0.16 + Math.max(0, 88 - defending.defensiveSecurity) * 0.08 },
      { item: "pressWin" as const, weight: 5 + attacking.pressingPower * 0.14 + Math.max(0, attacking.pressingPower - defending.midfieldControl) * 0.12 },
      { item: "setPiece" as const, weight: 5 + attacking.setPieceThreat * 0.11 },
      { item: "error" as const, weight: 2 + Math.max(0, attacking.pressingPower - defending.chemistry) * 0.08 + defending.roleConflict * 0.05 },
      { item: "lateMoment" as const, weight: minute > 75 ? 7 + attacking.attackPower * 0.05 + attacking.chemistry * 0.03 : 1 },
    ],
    random,
  );
}

function calculateXg(attacking: TeamMetrics, defending: TeamMetrics, eventType: MatchEventType, random: SeededRandom, randomness: RandomnessLevel) {
  const typeBase: Record<MatchEventType, number> = {
    centralCombination: 0.09,
    counter: 0.11,
    error: 0.14,
    lateMoment: 0.08,
    openPlay: 0.07,
    pressWin: 0.1,
    setPiece: 0.075,
    wideAttack: 0.065,
  };
  const quality = attacking.chanceQuality * 0.24 + attacking.attackPower * 0.18 + attacking.progression * 0.12 - defending.defensiveSecurity * 0.18 - defending.goalkeeperImpact * 0.08;
  const volatility = randomness === "controlled" ? 0.75 : randomness === "wild" ? 1.35 : 1;
  const randomBoost = random.between(-0.025, 0.085) * volatility;
  return round2(Math.max(0.015, Math.min(0.55, typeBase[eventType] + quality / 1000 + randomBoost)));
}

function resolveOutcome(xg: number, attacking: TeamMetrics, defending: TeamMetrics, random: SeededRandom): MatchEvent["outcome"] {
  const goalChance = Math.min(0.72, xg * (0.76 + attacking.finishing / 125) * (1.12 - defending.goalkeeperImpact / 240));

  if (random.chance(goalChance)) {
    return "goal";
  }

  const onTargetChance = Math.min(0.82, xg * 2.4 + attacking.finishing / 240);

  if (random.chance(onTargetChance)) {
    return "saved";
  }

  return random.chance(defending.defensiveSecurity / 170) ? "blocked" : "miss";
}

function pickEventPlayer(
  profile: AppliedTeamProfile,
  eventType: MatchEventType,
  purpose: "assister" | "scorer",
  random: SeededRandom,
  excludePlayerId?: string,
) {
  const candidates = profile.playerAttributes.filter((entry) => entry.player.id !== excludePlayerId);
  const weightedCandidates = candidates.map((entry) => {
    const attributes = entry.attributes;
    const roleWeight = getRoleEventWeight(entry.role, eventType, purpose);
    const skillWeight =
      purpose === "scorer"
        ? attributes.scoring * 0.4 + attributes.finishing * 0.35 + attributes.bigMatch * 0.25
        : attributes.chanceCreation * 0.45 + attributes.ballProgression * 0.3 + attributes.control * 0.25;

    return {
      item: entry,
      weight: Math.max(1, skillWeight * roleWeight * entry.fit),
    };
  });

  return selectByWeight(weightedCandidates, random);
}

function getRoleEventWeight(role: string, eventType: MatchEventType, purpose: "assister" | "scorer") {
  if (purpose === "scorer") {
    if (role === "ST") return 1.45;
    if (role === "SS" || role === "LW" || role === "RW") return 1.22;
    if (role === "AM") return 1.08;
    if (eventType === "setPiece" && role === "CB") return 1.05;
    if (role === "GK") return 0.03;
    return 0.62;
  }

  if (role === "AM" || role === "CM" || role === "SS") return 1.36;
  if (role === "LW" || role === "RW" || role === "LB" || role === "RB") return 1.18;
  if (role === "DM") return 0.95;
  if (role === "GK") return 0.08;
  return 0.72;
}

function buildMatchStats(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile, events: MatchEvent[]) {
  const stats: Record<string, MatchTeamStats> = {
    [profileA.team.id]: createEmptyStats(profileA.adjustedMetrics),
    [profileB.team.id]: createEmptyStats(profileB.adjustedMetrics),
  };

  for (const event of events) {
    const teamStats = stats[event.teamId];
    teamStats.xg = round2(teamStats.xg + event.xg);
    teamStats.shots += 1;

    if (event.outcome === "goal") {
      teamStats.goals += 1;
      teamStats.shotsOnTarget += 1;
    } else if (event.outcome === "saved") {
      teamStats.shotsOnTarget += 1;
    }

    if (event.eventType === "pressWin") {
      teamStats.pressingWins += 1;
    }

    if (event.eventType === "setPiece") {
      teamStats.setPieceThreat = round2(teamStats.setPieceThreat + event.xg);
    }
  }

  const possessionA = calculatePossession(profileA.adjustedMetrics, profileB.adjustedMetrics);
  stats[profileA.team.id].possession = possessionA;
  stats[profileB.team.id].possession = 100 - possessionA;

  return stats;
}

function createEmptyStats(metrics: TeamMetrics): MatchTeamStats {
  return {
    goals: 0,
    passFlow: Math.round(metrics.midfieldControl * 0.55 + metrics.progression * 0.25 + metrics.chemistry * 0.2),
    possession: 50,
    pressingWins: 0,
    setPieceThreat: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
  };
}

function calculatePossession(metricsA: TeamMetrics, metricsB: TeamMetrics) {
  const controlA = metricsA.midfieldControl * 0.52 + metricsA.chemistry * 0.22 + metricsA.progression * 0.16 - metricsA.roleConflict * 0.1;
  const controlB = metricsB.midfieldControl * 0.52 + metricsB.chemistry * 0.22 + metricsB.progression * 0.16 - metricsB.roleConflict * 0.1;
  return Math.max(32, Math.min(68, Math.round((controlA / Math.max(1, controlA + controlB)) * 100)));
}

function buildPlayerRatings(
  profileA: AppliedTeamProfile,
  profileB: AppliedTeamProfile,
  events: MatchEvent[],
  stats: Record<string, MatchTeamStats>,
): PlayerMatchRating[] {
  const running = new Map<string, RunningPlayerRating>();

  for (const profile of [profileA, profileB]) {
    for (const entry of profile.playerAttributes) {
      running.set(entry.player.id, {
        assists: 0,
        goals: 0,
        involvement: 0,
        playerId: entry.player.id,
        playerName: entry.player.name,
        rating: 6 + (entry.fit - 0.75) * 0.7 + (entry.attributes.bigMatch - 80) / 120,
        teamId: profile.team.id,
      });
    }
  }

  for (const event of events) {
    if (event.scorerId) {
      const scorer = running.get(event.scorerId);
      if (scorer) {
        scorer.goals += event.outcome === "goal" ? 1 : 0;
        scorer.involvement += event.xg;
        scorer.rating += event.outcome === "goal" ? 0.85 + event.xg : event.xg * 0.65;
      }
    }

    if (event.assisterId) {
      const assister = running.get(event.assisterId);
      if (assister) {
        assister.assists += event.outcome === "goal" ? 1 : 0;
        assister.involvement += event.xg * 0.8;
        assister.rating += event.outcome === "goal" ? 0.55 : event.xg * 0.45;
      }
    }
  }

  for (const playerRating of running.values()) {
    const teamStats = stats[playerRating.teamId];
    const goalDiff = teamStats.goals - Object.values(stats).find((item) => item !== teamStats)!.goals;
    playerRating.rating += goalDiff * 0.08 + Math.min(0.35, teamStats.possession / 300);
  }

  return [...running.values()]
    .map(({ involvement, ...rating }) => ({
      ...rating,
      rating: Math.max(4.8, Math.min(10, round1(rating.rating + Math.min(0.4, involvement)))),
    }))
    .sort((a, b) => b.rating - a.rating);
}

function buildTacticalReport(
  profileA: AppliedTeamProfile,
  profileB: AppliedTeamProfile,
  stats: Record<string, MatchTeamStats>,
  winnerTeamId: string | null,
  events: MatchEvent[],
  playerRatings: PlayerMatchRating[],
) {
  const winningProfile = winnerTeamId === profileA.team.id ? profileA : winnerTeamId === profileB.team.id ? profileB : null;
  const losingProfile = winnerTeamId === profileA.team.id ? profileB : winnerTeamId === profileB.team.id ? profileA : null;
  const notes = [
    ...summarizeProfile(profileA, profileB),
    ...summarizeProfile(profileB, profileA),
  ];
  const weakPoints = [
    ...profileA.balance.penalties.map((item) => `${profileA.team.name}: ${item}`),
    ...profileB.balance.penalties.map((item) => `${profileB.team.name}: ${item}`),
  ];
  const whyTheyWon =
    winningProfile && losingProfile
      ? [
          `${winningProfile.team.name}은 xG ${stats[winningProfile.team.id].xg.toFixed(2)}로 ${losingProfile.team.name}의 ${stats[losingProfile.team.id].xg.toFixed(2)}보다 좋은 찬스를 만들었습니다.`,
          getMetricEdgeText(winningProfile, losingProfile),
        ]
      : ["양 팀의 핵심 지표가 비슷해 단판에서는 승부가 갈리지 않았습니다."];

  return {
    balanceInsights: buildBalanceInsights(profileA, profileB),
    keyPlayerImpacts: buildKeyPlayerImpacts(profileA, profileB, playerRatings, events),
    notes,
    tacticalEdges: buildTacticalEdges(profileA, profileB, events),
    weakPoints,
    whyTheyWon,
  };
}

function summarizeProfile(profile: AppliedTeamProfile, opponent: AppliedTeamProfile) {
  const notes: string[] = [];

  if (profile.adjustedMetrics.midfieldControl - opponent.adjustedMetrics.midfieldControl >= 6) {
    notes.push(`${profile.team.name}은 중원 장악력에서 우위가 있습니다.`);
  }

  if (profile.adjustedMetrics.pressingPower - opponent.adjustedMetrics.midfieldControl >= 5) {
    notes.push(`${profile.team.name}의 압박은 상대 빌드업을 흔들 수 있습니다.`);
  }

  if (profile.adjustedMetrics.roleConflict >= 45) {
    notes.push(`${profile.team.name}은 역할 충돌이 커서 총점 대비 효율이 떨어질 수 있습니다.`);
  }

  return notes;
}

function buildBalanceInsights(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile) {
  return [profileA, profileB].flatMap((profile) => {
    const bestStrengths = profile.balance.strengths.slice(0, 2).map((item) => `${profile.team.name}: ${item}`);
    const profileIssues = profile.balance.penalties.slice(0, 2).map((item) => `${profile.team.name}: ${item}`);
    const roleConflict =
      profile.adjustedMetrics.roleConflict >= 45
        ? [`${profile.team.name}: 역할 충돌 ${profile.adjustedMetrics.roleConflict}로 공격 재능 대비 팀 효율이 흔들립니다.`]
        : [];
    const chemistry =
      profile.adjustedMetrics.chemistry >= 88
        ? [`${profile.team.name}: 케미스트리 ${profile.adjustedMetrics.chemistry}로 전술 수행 안정성이 높습니다.`]
        : [];

    return [...bestStrengths, ...profileIssues, ...roleConflict, ...chemistry];
  }).slice(0, 8);
}

function buildKeyPlayerImpacts(
  profileA: AppliedTeamProfile,
  profileB: AppliedTeamProfile,
  playerRatings: PlayerMatchRating[],
  events: MatchEvent[],
) {
  const profiles = new Map([
    [profileA.team.id, profileA],
    [profileB.team.id, profileB],
  ]);
  const playerEntries = new Map(
    [profileA, profileB].flatMap((profile) =>
      profile.playerAttributes.map((entry) => [
        entry.player.id,
        {
          entry,
          teamName: profile.team.name,
        },
      ] as const),
    ),
  );
  const eventInvolvements = events.reduce<Record<string, { goals: number; highXg: number; xg: number }>>((summary, event) => {
    for (const playerId of [event.scorerId, event.assisterId]) {
      if (!playerId) {
        continue;
      }

      summary[playerId] ??= { goals: 0, highXg: 0, xg: 0 };
      summary[playerId].xg += event.xg;

      if (event.outcome === "goal" && playerId === event.scorerId) {
        summary[playerId].goals += 1;
      }

      if (event.xg >= 0.14) {
        summary[playerId].highXg += 1;
      }
    }

    return summary;
  }, {});

  return playerRatings.slice(0, 5).map((rating) => {
    const playerContext = playerEntries.get(rating.playerId);
    const profile = profiles.get(rating.teamId);
    const involvement = eventInvolvements[rating.playerId] ?? { goals: 0, highXg: 0, xg: 0 };
    const role = playerContext?.entry.role ?? "LEGEND";
    const strongestAttribute = playerContext
      ? Object.entries(playerContext.entry.attributes).sort((a, b) => b[1] - a[1])[0]
      : null;
    const attributeText = strongestAttribute ? `${attributeLabels[strongestAttribute[0] as keyof typeof attributeLabels]} ${Math.round(strongestAttribute[1])}점` : "핵심 능력";
    const tacticalText = profile ? getPlayerTacticImpactText(profile.tactics.style, role) : "경기 영향";

    return `${playerContext?.teamName ?? rating.teamId}: ${rating.playerName} ${rating.rating.toFixed(1)}점, ${rating.goals}G ${rating.assists}A. ${attributeText}과 ${tacticalText}이 결과에 반영됐습니다.`;
  });
}

function buildTacticalEdges(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile, events: MatchEvent[]) {
  const metricEdges = getMetricEdges(profileA, profileB)
    .filter((edge) => Math.abs(edge.value) >= 4)
    .slice(0, 4)
    .map((edge) => {
      const leader = edge.value > 0 ? profileA : profileB;
      const follower = edge.value > 0 ? profileB : profileA;
      return `${leader.team.name}은 ${edge.label}에서 ${Math.abs(Math.round(edge.value))}점 앞서 ${follower.team.name}보다 ${edge.effect} 측면이 더 좋았습니다.`;
    });
  const matchupNotes = [describeTacticMatchup(profileA, profileB), describeTacticMatchup(profileB, profileA)].filter(Boolean) as string[];
  const eventNotes = buildEventPatternNotes(profileA, profileB, events);

  return [...metricEdges, ...matchupNotes, ...eventNotes].slice(0, 8);
}

function getMetricEdgeText(winningProfile: AppliedTeamProfile, losingProfile: AppliedTeamProfile) {
  const edges = getMetricEdges(winningProfile, losingProfile).sort((a, b) => b.value - a.value);
  const bestEdge = edges[0];

  if (bestEdge.value < 2) {
    return `${winningProfile.team.name}은 뚜렷한 지표 우위보다는 큰 장면 전환에서 앞섰습니다.`;
  }

  return `${winningProfile.team.name}의 가장 큰 우위는 ${bestEdge.label}입니다.`;
}

function getMetricEdges(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile) {
  return [
    {
      effect: "박스 근처 위협",
      label: "공격력",
      value: profileA.adjustedMetrics.attackPower - profileB.adjustedMetrics.attackPower,
    },
    {
      effect: "경기 템포 통제",
      label: "중원 장악",
      value: profileA.adjustedMetrics.midfieldControl - profileB.adjustedMetrics.midfieldControl,
    },
    {
      effect: "실점 억제",
      label: "수비 안정성",
      value: profileA.adjustedMetrics.defensiveSecurity - profileB.adjustedMetrics.defensiveSecurity,
    },
    {
      effect: "역습 찬스",
      label: "전환 위협",
      value: profileA.adjustedMetrics.transitionThreat - profileB.adjustedMetrics.transitionThreat,
    },
    {
      effect: "선방 기대값",
      label: "골키퍼 영향력",
      value: profileA.adjustedMetrics.goalkeeperImpact - profileB.adjustedMetrics.goalkeeperImpact,
    },
    {
      effect: "전방 탈취",
      label: "압박",
      value: profileA.adjustedMetrics.pressingPower - profileB.adjustedMetrics.pressingPower,
    },
    {
      effect: "측면 방어",
      label: "측면 안정성",
      value: profileA.adjustedMetrics.wideSecurity - profileB.adjustedMetrics.wideSecurity,
    },
  ];
}

function describeTacticMatchup(profile: AppliedTeamProfile, opponent: AppliedTeamProfile) {
  if (profile.tactics.style === "high-press" && profile.adjustedMetrics.pressingPower - opponent.adjustedMetrics.midfieldControl >= 6) {
    return `${profile.team.name}의 High Press는 ${opponent.team.name}의 빌드업 안정성보다 강해 실책성 찬스를 만들 조건이 좋습니다.`;
  }

  if (profile.tactics.style === "counter" && opponent.tactics.lineHeight === "high") {
    return `${profile.team.name}의 Counter는 ${opponent.team.name}의 높은 라인 뒤 공간을 직접 겨냥합니다.`;
  }

  if (profile.tactics.style === "possession" && profile.adjustedMetrics.midfieldControl - opponent.adjustedMetrics.pressingPower >= 6) {
    return `${profile.team.name}의 Possession은 상대 압박을 버티며 점유 흐름을 길게 가져갑니다.`;
  }

  if (profile.tactics.style === "low-block" && profile.adjustedMetrics.defensiveSecurity >= 88) {
    return `${profile.team.name}의 Low Block은 중앙 수비 안정성을 살려 상대 슈팅 품질을 낮춥니다.`;
  }

  if (profile.tactics.risk === "aggressive" && profile.adjustedMetrics.roleConflict >= 45) {
    return `${profile.team.name}은 공격적 위험 감수와 역할 충돌이 겹쳐 경기 후반 공간 노출 가능성이 큽니다.`;
  }

  return null;
}

function buildEventPatternNotes(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile, events: MatchEvent[]) {
  return [profileA, profileB].flatMap((profile) => {
    const profileEvents = events.filter((event) => event.teamId === profile.team.id);
    const goals = profileEvents.filter((event) => event.outcome === "goal").length;
    const counters = profileEvents.filter((event) => event.eventType === "counter").length;
    const pressWins = profileEvents.filter((event) => event.eventType === "pressWin").length;
    const setPieces = profileEvents.filter((event) => event.eventType === "setPiece").length;
    const highXg = profileEvents.filter((event) => event.xg >= 0.14).length;
    const notes: string[] = [];

    if (counters >= 4) {
      notes.push(`${profile.team.name}은 역습 이벤트 ${counters}회로 전환 공격이 반복적으로 열렸습니다.`);
    }

    if (pressWins >= 3) {
      notes.push(`${profile.team.name}은 압박 탈취 ${pressWins}회로 상대 전개를 짧게 끊었습니다.`);
    }

    if (setPieces >= 3) {
      notes.push(`${profile.team.name}은 세트피스 ${setPieces}회로 공중전/세컨볼 루트를 확보했습니다.`);
    }

    if (goals > 0 && highXg >= goals) {
      notes.push(`${profile.team.name}의 득점은 낮은 확률 난사가 아니라 높은 xG 장면에서 나왔습니다.`);
    }

    return notes;
  });
}

const attributeLabels = {
  aerial: "제공권",
  ballProgression: "전진",
  bigMatch: "큰 경기",
  chanceCreation: "찬스 창출",
  control: "점유 안정",
  defending: "수비 기여",
  finishing: "결정력",
  goalkeeper: "GK 영향",
  leadership: "리더십",
  pressing: "압박",
  scoring: "득점력",
  versatility: "유연성",
};

function getPlayerTacticImpactText(style: SimulationTactics["style"], role: string) {
  if (style === "possession" && ["CM", "AM", "DM"].includes(role)) {
    return "점유 전술의 연결 역할";
  }

  if (style === "counter" && ["ST", "SS", "LW", "RW"].includes(role)) {
    return "역습 전술의 전방 실행력";
  }

  if (style === "high-press" && ["LW", "RW", "AM", "CM", "DM"].includes(role)) {
    return "압박 전술의 탈취/재압박";
  }

  if (style === "low-block" && ["GK", "CB", "DM", "LB", "RB"].includes(role)) {
    return "낮은 블록의 수비 안정";
  }

  if (style === "direct" && ["ST", "CB", "CM", "DM"].includes(role)) {
    return "직선 전개의 타깃/전진 역할";
  }

  return "팀 전술 내 역할 수행";
}

function describeEvent(
  minute: number,
  attacking: AppliedTeamProfile,
  defending: AppliedTeamProfile,
  eventType: MatchEventType,
  outcome: MatchEvent["outcome"],
  scorerName?: string,
  assisterName?: string,
) {
  const subject = scorerName ?? attacking.team.name;
  const creator = assisterName ? `${assisterName}의 전개 이후 ` : "";
  const outcomeText: Record<MatchEvent["outcome"], string> = {
    blocked: "수비에 막혔습니다.",
    goal: "골로 연결했습니다.",
    miss: "마무리가 빗나갔습니다.",
    saved: "골키퍼 선방에 막혔습니다.",
  };
  const typeText: Record<MatchEventType, string> = {
    centralCombination: "중앙 연계로 박스 근처를 열었고",
    counter: "빠른 역습으로 수비 뒷공간을 찔렀고",
    error: `${defending.team.name}의 실수를 놓치지 않았고`,
    lateMoment: "후반 막판 집중력으로 결정적인 장면을 만들었고",
    openPlay: "일반 공격 흐름에서 찬스를 만들었고",
    pressWin: "전방 압박 성공 직후 찬스를 잡았고",
    setPiece: "세트피스에서 위협적인 장면을 만들었고",
    wideAttack: "측면 공격으로 수비를 흔들었고",
  };

  return `${minute}' ${creator}${subject}이 ${typeText[eventType]} ${outcomeText[outcome]}`;
}

function selectByWeight<T>(items: Array<{ item: T; weight: number }>, random: SeededRandom): T {
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let cursor = random.between(0, total);

  for (const entry of items) {
    cursor -= Math.max(0, entry.weight);

    if (cursor <= 0) {
      return entry.item;
    }
  }

  return items[items.length - 1].item;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
