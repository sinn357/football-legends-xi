import { createSeededRandom, type SeededRandom } from "./random";
import { buildTeamSimulationProfile } from "./team-metrics";
import { applyTactics, defaultTactics, getTacticTempoMultiplier } from "./tactics";
import type {
  AppliedTeamProfile,
  CardDecision,
  MatchEvent,
  MatchEventType,
  MatchTeamStats,
  PlayerMatchRating,
  RandomnessLevel,
  SetPieceSituation,
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

const eventTypes: MatchEventType[] = [
  "openPlay",
  "centralCombination",
  "wideAttack",
  "counter",
  "pressWin",
  "setPiece",
  "error",
  "lateMoment",
  "circulation",
  "switchPlay",
  "secondBall",
  "interception",
  "tackle",
  "keeperClaim",
  "foul",
  "offside",
  "clearance",
];
const chanceEventTypes = new Set<MatchEventType>(["openPlay", "centralCombination", "wideAttack", "counter", "pressWin", "setPiece", "error", "lateMoment"]);
const defensiveFlowEventTypes = new Set<MatchEventType>(["clearance", "interception", "keeperClaim", "secondBall", "tackle"]);
const flowEventTypes: MatchEventType[] = ["circulation", "switchPlay", "secondBall", "interception", "tackle", "keeperClaim", "foul", "offside", "clearance", "setPiece"];

export function simulateMatch(
  teamA: SimulationTeamInput,
  teamB: SimulationTeamInput,
  tacticsA: SimulationTactics = defaultTactics,
  tacticsB: SimulationTactics = defaultTactics,
  options: SimulateMatchOptions = {},
): SimulatedMatchResult {
  const matchSeed = options.seed ?? `${teamA.id}:${teamB.id}:${Date.now()}`;
  const random = createSeededRandom(matchSeed);
  const baseProfileA = applyMatchContext(buildTeamSimulationProfile(teamA), tacticsA, options.homeTeamId === teamA.id);
  const baseProfileB = applyMatchContext(buildTeamSimulationProfile(teamB), tacticsB, options.homeTeamId === teamB.id);
  const [profileA, profileB] = applyHeadToHeadContext(baseProfileA, baseProfileB);
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

function applyHeadToHeadContext(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile): [AppliedTeamProfile, AppliedTeamProfile] {
  return [applyOpponentSpecificModifiers(profileA, profileB), applyOpponentSpecificModifiers(profileB, profileA)];
}

function applyOpponentSpecificModifiers(profile: AppliedTeamProfile, opponent: AppliedTeamProfile): AppliedTeamProfile {
  const next = { ...profile.adjustedMetrics };
  const shape = getTeamShape(profile);
  const opponentShape = getTeamShape(opponent);

  if (profile.tactics.style === "counter") {
    if (opponent.tactics.lineHeight === "high" || opponent.tactics.risk === "aggressive") {
      next.transitionThreat += 7;
      next.chanceQuality += 3;
      next.attackPower += 2;
    }

    if (opponentShape.centerBacks < 2 || opponentShape.defensiveMidfielders === 0) {
      next.transitionThreat += 4;
      next.finishing += 2;
    }
  }

  if (profile.tactics.style === "possession") {
    if (profile.adjustedMetrics.midfieldControl + profile.adjustedMetrics.chemistry - opponent.adjustedMetrics.pressingPower >= 6) {
      next.midfieldControl += 5;
      next.chanceQuality += 4;
      next.roleConflict -= 3;
    } else if (opponent.tactics.style === "high-press") {
      next.midfieldControl -= 4;
      next.roleConflict += 4;
      next.defensiveSecurity -= 2;
    }

    if (shape.centralMidfielders >= 3) {
      next.midfieldControl += 3;
    }
  }

  if (profile.tactics.style === "high-press") {
    if (opponent.tactics.style === "possession" || opponent.tactics.tempo === "slow") {
      next.pressingPower += 5;
      next.transitionThreat += 3;
      next.chanceQuality += 2;
    }

    if (opponent.adjustedMetrics.chemistry >= 92 && opponent.adjustedMetrics.midfieldControl >= 92) {
      next.pressingPower -= 4;
      next.defensiveSecurity -= 2;
    }
  }

  if (profile.tactics.style === "low-block") {
    if (opponent.tactics.style === "direct" || opponent.tactics.style === "high-press") {
      next.defensiveSecurity += 4;
      next.wideSecurity += 2;
      next.midfieldControl -= 2;
    }

    if (opponent.adjustedMetrics.setPieceThreat >= 90) {
      next.defensiveSecurity -= 3;
    }
  }

  if (profile.tactics.style === "direct") {
    if (opponent.tactics.style === "low-block") {
      next.setPieceThreat += 6;
      next.progression += 3;
      next.chanceQuality -= 2;
    }

    if (opponentShape.centerBacks < 2) {
      next.attackPower += 4;
      next.finishing += 2;
    }
  }

  if (profile.tactics.lineHeight === "high" && opponent.tactics.style === "counter") {
    next.defensiveSecurity -= 5;
    next.wideSecurity -= 3;
    next.roleConflict += 2;
  }

  if (shape.centerBacks >= 3) {
    next.defensiveSecurity += 4;
    next.setPieceThreat += 3;
    next.wideSecurity -= opponentShape.wideAttackers >= 2 ? 3 : 1;
  }

  if (shape.fullbacks < 2 && opponentShape.wideThreat >= 3) {
    next.wideSecurity -= 6;
    next.defensiveSecurity -= 2;
  }

  if (shape.defensiveMidfielders >= 1 && opponent.tactics.style === "counter") {
    next.defensiveSecurity += 3;
    next.transitionThreat -= 1;
  }

  if (shape.centralMidfielders >= 3 && opponent.tactics.style !== "low-block") {
    next.midfieldControl += 3;
    next.chanceQuality += 1;
  }

  if (shape.attackers >= 5 && profile.tactics.risk === "aggressive") {
    next.attackPower += 2;
    next.roleConflict += 5;
    next.defensiveSecurity -= 3;
  }

  if (shape.wideThreat >= 3 && opponentShape.fullbacks < 2) {
    next.progression += 4;
    next.chanceQuality += 2;
  }

  return {
    ...profile,
    adjustedMetrics: normalizeMatchupMetrics(next),
  };
}

function getTeamShape(profile: AppliedTeamProfile) {
  const count = (roles: string[]) => profile.team.slots.filter((slot) => roles.includes(slot.role)).length;
  const centerBacks = count(["CB"]);
  const fullbacks = count(["LB", "RB"]);
  const defensiveMidfielders = count(["DM"]);
  const centralMidfielders = count(["DM", "CM", "AM"]);
  const wideAttackers = count(["LW", "RW"]);
  const attackers = count(["ST", "SS", "LW", "RW", "AM"]);

  return {
    attackers,
    centerBacks,
    centralMidfielders,
    defensiveMidfielders,
    fullbacks,
    wideAttackers,
    wideThreat: fullbacks + wideAttackers,
  };
}

function normalizeMatchupMetrics(metrics: TeamMetrics): TeamMetrics {
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [key, key === "roleConflict" ? Math.max(0, Math.min(100, Math.round(value))) : Math.max(35, Math.min(105, Math.round(value)))]),
  ) as TeamMetrics;
}

function simulateEvents(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile, random: SeededRandom, randomness: RandomnessLevel) {
  const tempoMultiplier = (getTacticTempoMultiplier(profileA.tactics) + getTacticTempoMultiplier(profileB.tactics)) / 2;
  const randomnessMultiplier = randomness === "controlled" ? 0.9 : randomness === "wild" ? 1.18 : 1;
  const baseEvents = Math.round(random.between(17, 25) * tempoMultiplier * randomnessMultiplier);
  const events: MatchEvent[] = [];

  for (let index = 0; index < baseEvents; index += 1) {
    const minute = Math.min(90, Math.max(1, Math.round(((index + random.next()) / baseEvents) * 90)));
    const side = pickAttackingSide(profileA.adjustedMetrics, profileB.adjustedMetrics, random);
    const attacking = side === "A" ? profileA : profileB;
    const defending = side === "A" ? profileB : profileA;
    const eventType = pickEventType(attacking.adjustedMetrics, defending.adjustedMetrics, minute, random);
    const setPieceSituation = eventType === "setPiece" ? pickSetPieceSituation(attacking.adjustedMetrics, defending.adjustedMetrics, random) : undefined;
    const xg = calculateXg(attacking.adjustedMetrics, defending.adjustedMetrics, eventType, random, randomness, setPieceSituation);
    const outcome = resolveOutcome(xg, attacking.adjustedMetrics, defending.adjustedMetrics, random);
    const scorer = outcome === "goal" || xg > 0.08 ? pickEventPlayer(attacking, eventType, "scorer", random) : undefined;
    const assister = scorer && setPieceSituation !== "penalty" && random.chance(eventType === "setPiece" ? 0.72 : 0.58) ? pickEventPlayer(attacking, eventType, "assister", random, scorer.player.id) : undefined;
    const defensivePlayer =
      outcome === "saved"
        ? pickFlowPlayer(defending, "keeperClaim", random)
        : outcome === "blocked"
          ? pickFlowPlayer(defending, random.chance(0.55) ? "tackle" : "interception", random)
          : undefined;
    const momentumSwing = calculateMomentumSwing(eventType, outcome, xg, minute);
    const staminaPressure = calculateStaminaPressure(attacking, eventType, minute, momentumSwing);

    events.push({
      assisterId: assister?.player.id,
      defensivePlayerId: defensivePlayer?.player.id,
      defendingTeamId: defending.team.id,
      description: describeEvent(minute, attacking, defending, eventType, outcome, scorer?.player.name, assister?.player.name, defensivePlayer?.player.name, setPieceSituation),
      eventType,
      minute,
      momentumSwing,
      outcome,
      phase: "chance",
      primaryPlayerId: scorer?.player.id,
      scorerId: scorer?.player.id,
      secondaryPlayerId: assister?.player.id,
      setPieceSituation,
      staminaPressure,
      teamId: attacking.team.id,
      xg,
    });
  }

  events.push(...simulateFlowEvents(profileA, profileB, baseEvents, tempoMultiplier, random, randomness));

  return events.sort((a, b) => a.minute - b.minute || getEventSortWeight(a) - getEventSortWeight(b));
}

function simulateFlowEvents(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile, baseEvents: number, tempoMultiplier: number, random: SeededRandom, randomness: RandomnessLevel) {
  const randomnessMultiplier = randomness === "controlled" ? 0.75 : randomness === "wild" ? 1.16 : 1;
  const flowEvents = Math.round((baseEvents + random.between(4, 8)) * random.between(0.92, 1.18) * tempoMultiplier * randomnessMultiplier);
  const events: MatchEvent[] = [];

  for (let index = 0; index < flowEvents; index += 1) {
    const minute = Math.min(90, Math.max(1, Math.round(((index + random.next()) / flowEvents) * 90)));
    const side = pickAttackingSide(profileA.adjustedMetrics, profileB.adjustedMetrics, random);
    const possessionTeam = side === "A" ? profileA : profileB;
    const opponent = side === "A" ? profileB : profileA;
    const eventType = pickFlowEventType(possessionTeam.adjustedMetrics, opponent.adjustedMetrics, possessionTeam.tactics, opponent.tactics, random);
    const acting = isDefensiveFlowEventType(eventType) || eventType === "foul" ? opponent : possessionTeam;
    const defending = isDefensiveFlowEventType(eventType) || eventType === "foul" ? possessionTeam : opponent;
    const primary = pickFlowPlayer(acting, eventType, random);
    const secondary = random.chance(0.46) ? pickFlowPlayer(acting, eventType, random, primary?.player.id) : undefined;
    const setPieceSituation = eventType === "setPiece" ? pickSetPieceSituation(acting.adjustedMetrics, defending.adjustedMetrics, random) : undefined;
    const card = eventType === "foul" ? resolveCardDecision(acting, minute, random) : undefined;
    const outcome = getFlowOutcome(eventType);
    const momentumSwing = calculateMomentumSwing(eventType, outcome, 0, minute, card);
    const staminaPressure = calculateStaminaPressure(acting, eventType, minute, momentumSwing);

    events.push({
      card,
      defendingTeamId: defending.team.id,
      description: describeFlowEvent(minute, acting, defending, eventType, primary?.player.name, secondary?.player.name, setPieceSituation, card),
      eventType,
      minute,
      momentumSwing,
      outcome,
      phase: "flow",
      primaryPlayerId: primary?.player.id,
      secondaryPlayerId: secondary?.player.id,
      setPieceSituation,
      staminaPressure,
      teamId: acting.team.id,
      xg: 0,
    });
  }

  return events;
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

function pickFlowEventType(attacking: TeamMetrics, defending: TeamMetrics, tactics: SimulationTactics, defendingTactics: SimulationTactics, random: SeededRandom): MatchEventType {
  return selectByWeight(
    [
      { item: "circulation" as const, weight: 12 + attacking.midfieldControl * 0.15 + attacking.chemistry * 0.09 + (tactics.style === "possession" ? 8 : 0) },
      { item: "switchPlay" as const, weight: 7 + attacking.progression * 0.12 + Math.max(0, 86 - defending.wideSecurity) * 0.09 },
      { item: "secondBall" as const, weight: 6 + attacking.pressingPower * 0.09 + attacking.setPieceThreat * 0.06 + (tactics.style === "direct" ? 5 : 0) },
      { item: "interception" as const, weight: 5 + defending.defensiveSecurity * 0.12 + defending.midfieldControl * 0.08 + (defendingTactics.lineHeight === "high" ? 4 : 0) },
      { item: "tackle" as const, weight: 5 + defending.defensiveSecurity * 0.1 + defending.pressingPower * 0.11 + (defendingTactics.style === "high-press" ? 4 : 0) },
      { item: "keeperClaim" as const, weight: 2 + defending.goalkeeperImpact * 0.11 + (defendingTactics.style === "low-block" ? 3 : 0) },
      { item: "foul" as const, weight: 5 + defending.pressingPower * 0.12 + defending.roleConflict * 0.09 + (defendingTactics.risk === "aggressive" ? 6 : 0) },
      { item: "offside" as const, weight: 2 + attacking.transitionThreat * 0.08 + (defendingTactics.lineHeight === "high" ? 5 : 0) },
      { item: "clearance" as const, weight: 5 + defending.defensiveSecurity * 0.11 + (defendingTactics.style === "low-block" ? 6 : 0) },
      { item: "setPiece" as const, weight: 3 + attacking.setPieceThreat * 0.08 + (tactics.style === "direct" ? 4 : 0) },
    ],
    random,
  );
}

function pickSetPieceSituation(attacking: TeamMetrics, defending: TeamMetrics, random: SeededRandom): SetPieceSituation {
  return selectByWeight(
    [
      { item: "corner" as const, weight: 8 + attacking.setPieceThreat * 0.1 + Math.max(0, 88 - defending.defensiveSecurity) * 0.04 },
      { item: "freeKick" as const, weight: 5 + attacking.setPieceThreat * 0.09 },
      { item: "wideFreeKick" as const, weight: 6 + attacking.progression * 0.07 + Math.max(0, 86 - defending.wideSecurity) * 0.06 },
      { item: "penalty" as const, weight: 0.7 + Math.max(0, attacking.attackPower - defending.defensiveSecurity) * 0.035 + attacking.setPieceThreat * 0.01 },
    ],
    random,
  );
}

function resolveCardDecision(offendingProfile: AppliedTeamProfile, minute: number, random: SeededRandom): CardDecision | undefined {
  const riskModifier = offendingProfile.tactics.risk === "aggressive" ? 0.13 : offendingProfile.tactics.risk === "conservative" ? -0.08 : 0;
  const styleModifier = offendingProfile.tactics.style === "high-press" ? 0.07 : offendingProfile.tactics.style === "low-block" ? 0.03 : 0;
  const lateModifier = minute >= 70 ? 0.04 : 0;
  const disciplineLoad = offendingProfile.adjustedMetrics.roleConflict * 0.0012 + offendingProfile.adjustedMetrics.pressingPower * 0.0009;
  const yellowChance = Math.max(0.18, Math.min(0.58, 0.26 + riskModifier + styleModifier + lateModifier + disciplineLoad));
  const redChance = Math.max(0.004, Math.min(0.042, 0.006 + Math.max(0, riskModifier) * 0.11 + offendingProfile.adjustedMetrics.roleConflict * 0.00015 + (minute >= 80 ? 0.006 : 0)));

  if (!random.chance(yellowChance)) {
    return undefined;
  }

  return random.chance(redChance) ? "red" : "yellow";
}

function calculateXg(attacking: TeamMetrics, defending: TeamMetrics, eventType: MatchEventType, random: SeededRandom, randomness: RandomnessLevel, setPieceSituation?: SetPieceSituation) {
  const typeBase: Record<MatchEventType, number> = {
    centralCombination: 0.08,
    circulation: 0,
    clearance: 0,
    counter: 0.1,
    error: 0.13,
    foul: 0,
    interception: 0,
    keeperClaim: 0,
    lateMoment: 0.075,
    openPlay: 0.062,
    offside: 0,
    pressWin: 0.09,
    secondBall: 0,
    setPiece: 0.068,
    switchPlay: 0,
    tackle: 0,
    wideAttack: 0.058,
  };
  const quality = attacking.chanceQuality * 0.24 + attacking.attackPower * 0.18 + attacking.progression * 0.12 - defending.defensiveSecurity * 0.18 - defending.goalkeeperImpact * 0.08;
  const volatility = randomness === "controlled" ? 0.75 : randomness === "wild" ? 1.35 : 1;
  const randomBoost = random.between(-0.025, 0.085) * volatility;
  const setPieceBoost = getSetPieceXgBoost(setPieceSituation);
  return round2(Math.max(0.012, Math.min(0.54, typeBase[eventType] + setPieceBoost + quality / 1050 + randomBoost)));
}

function calculateMomentumSwing(eventType: MatchEventType, outcome: MatchEvent["outcome"], xg: number, minute: number, card?: CardDecision) {
  if (card === "red") {
    return -8.5;
  }

  if (card === "yellow") {
    return -2.8;
  }

  if (outcome === "goal") {
    return round1(6.5 + xg * 18 + (minute >= 75 ? 1.4 : 0));
  }

  if (eventType === "pressWin") {
    return round1(1.8 + xg * 9);
  }

  if (eventType === "counter" || eventType === "lateMoment") {
    return round1(1.4 + xg * 8 + (minute >= 75 ? 0.8 : 0));
  }

  if (eventType === "setPiece") {
    return round1(1.2 + xg * 7);
  }

  if (outcome === "saved" || outcome === "blocked") {
    return round1(0.8 + xg * 4);
  }

  if (eventType === "clearance" || eventType === "interception" || eventType === "tackle" || eventType === "keeperClaim") {
    return 1.4;
  }

  if (eventType === "secondBall" || eventType === "switchPlay") {
    return 0.9;
  }

  if (eventType === "foul") {
    return 0.3;
  }

  if (eventType === "offside") {
    return -0.5;
  }

  return 0.6;
}

function calculateStaminaPressure(profile: AppliedTeamProfile, eventType: MatchEventType, minute: number, momentumSwing: number) {
  const tempoLoad = profile.tactics.tempo === "fast" ? 1.25 : profile.tactics.tempo === "slow" ? 0.82 : 1;
  const styleLoad = profile.tactics.style === "high-press" ? 1.32 : profile.tactics.style === "counter" || profile.tactics.style === "direct" ? 1.12 : profile.tactics.style === "low-block" ? 0.92 : 1;
  const riskLoad = profile.tactics.risk === "aggressive" ? 1.16 : profile.tactics.risk === "conservative" ? 0.9 : 1;
  const minuteLoad = minute >= 75 ? 1.28 : minute >= 60 ? 1.16 : minute >= 45 ? 1.06 : 0.94;
  const eventLoad =
    eventType === "pressWin" || eventType === "counter" || eventType === "tackle"
      ? 1.2
      : eventType === "circulation" || eventType === "keeperClaim"
        ? 0.78
        : 1;

  return round1(Math.max(0.3, Math.min(3.8, (0.72 + Math.abs(momentumSwing) * 0.045) * tempoLoad * styleLoad * riskLoad * minuteLoad * eventLoad)));
}

function getSetPieceXgBoost(situation?: SetPieceSituation) {
  if (situation === "penalty") {
    return 0.25;
  }

  if (situation === "corner") {
    return 0.035;
  }

  if (situation === "freeKick") {
    return 0.025;
  }

  if (situation === "wideFreeKick") {
    return 0.015;
  }

  return 0;
}

function pickFlowPlayer(profile: AppliedTeamProfile, eventType: MatchEventType, random: SeededRandom, excludePlayerId?: string) {
  const candidates = profile.playerAttributes.filter((entry) => entry.player.id !== excludePlayerId);
  const weightedCandidates = candidates.map((entry) => {
    const attributes = entry.attributes;
    const roleWeight = getRoleFlowWeight(entry.role, eventType);
    const skillWeight =
      eventType === "circulation"
        ? attributes.control * 0.45 + attributes.chanceCreation * 0.25 + attributes.leadership * 0.15 + attributes.ballProgression * 0.15
        : eventType === "switchPlay"
          ? attributes.ballProgression * 0.38 + attributes.chanceCreation * 0.3 + attributes.control * 0.2 + attributes.versatility * 0.12
          : eventType === "interception"
            ? attributes.defending * 0.34 + attributes.control * 0.24 + attributes.pressing * 0.24 + attributes.ballProgression * 0.18
          : eventType === "tackle"
            ? attributes.defending * 0.4 + attributes.pressing * 0.28 + attributes.bigMatch * 0.16 + attributes.versatility * 0.16
          : eventType === "keeperClaim"
            ? attributes.goalkeeper * 0.55 + attributes.aerial * 0.2 + attributes.leadership * 0.15 + attributes.control * 0.1
          : eventType === "secondBall" || eventType === "clearance"
            ? attributes.defending * 0.34 + attributes.aerial * 0.28 + attributes.pressing * 0.22 + attributes.leadership * 0.16
            : eventType === "foul"
              ? attributes.pressing * 0.34 + attributes.defending * 0.26 + attributes.bigMatch * 0.18 + attributes.versatility * 0.12
              : attributes.ballProgression * 0.34 + attributes.scoring * 0.24 + attributes.chanceCreation * 0.24 + attributes.finishing * 0.18;

    return {
      item: entry,
      weight: Math.max(1, skillWeight * roleWeight * entry.fit),
    };
  });

  return selectByWeight(weightedCandidates, random);
}

function getRoleFlowWeight(role: string, eventType: MatchEventType) {
  if (eventType === "circulation") {
    if (role === "CM" || role === "DM") return 1.42;
    if (role === "AM" || role === "CB") return 1.16;
    if (role === "GK") return 0.58;
  }

  if (eventType === "switchPlay") {
    if (role === "LB" || role === "RB" || role === "CM" || role === "AM") return 1.32;
    if (role === "LW" || role === "RW") return 1.14;
    if (role === "GK") return 0.32;
  }

  if (eventType === "secondBall" || eventType === "clearance") {
    if (role === "CB" || role === "DM") return 1.38;
    if (role === "CM" || role === "LB" || role === "RB") return 1.16;
    if (role === "ST") return 0.75;
  }

  if (eventType === "interception") {
    if (role === "DM" || role === "CB") return 1.42;
    if (role === "CM" || role === "LB" || role === "RB") return 1.2;
    if (role === "ST" || role === "GK") return 0.45;
  }

  if (eventType === "tackle") {
    if (role === "CB" || role === "DM" || role === "LB" || role === "RB") return 1.36;
    if (role === "CM") return 1.15;
    if (role === "GK") return 0.28;
  }

  if (eventType === "keeperClaim") {
    if (role === "GK") return 2.4;
    if (role === "CB") return 0.45;
    return 0.18;
  }

  if (eventType === "foul") {
    if (role === "DM" || role === "CB" || role === "CM") return 1.28;
    if (role === "AM" || role === "SS") return 0.9;
  }

  if (eventType === "offside") {
    if (role === "ST" || role === "SS" || role === "LW" || role === "RW") return 1.34;
    if (role === "GK" || role === "CB") return 0.2;
  }

  if (eventType === "setPiece") {
    if (role === "CM" || role === "AM" || role === "CB") return 1.28;
    if (role === "LB" || role === "RB" || role === "ST") return 1.14;
    if (role === "GK") return 0.15;
  }

  return 1;
}

function resolveOutcome(xg: number, attacking: TeamMetrics, defending: TeamMetrics, random: SeededRandom): MatchEvent["outcome"] {
  const goalChance = Math.min(0.58, xg * (0.48 + attacking.finishing / 190) * (1.03 - defending.goalkeeperImpact / 230));

  if (random.chance(goalChance)) {
    return "goal";
  }

  const onTargetChance = Math.min(0.72, xg * 1.75 + attacking.finishing / 360);

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
    const simulationRoleWeight = getSimulationRoleEventWeight(entry.simulationRoles, eventType, purpose);
    const skillWeight =
      purpose === "scorer"
        ? attributes.scoring * 0.4 + attributes.finishing * 0.35 + attributes.bigMatch * 0.25
        : attributes.chanceCreation * 0.45 + attributes.ballProgression * 0.3 + attributes.control * 0.25;

    return {
      item: entry,
      weight: Math.max(1, skillWeight * roleWeight * simulationRoleWeight * entry.fit),
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

function getSimulationRoleEventWeight(roles: string[], eventType: MatchEventType, purpose: "assister" | "scorer") {
  let weight = 1;

  if (purpose === "scorer") {
    if (roles.includes("finisher")) weight += 0.18;
    if (roles.includes("line-breaker") && eventType === "counter") weight += 0.22;
    if (roles.includes("target") && (eventType === "setPiece" || eventType === "wideAttack")) weight += 0.2;
    if (roles.includes("set-piece") && eventType === "setPiece") weight += 0.24;
    if (roles.includes("creator") && eventType === "centralCombination") weight += 0.08;
  } else {
    if (roles.includes("creator")) weight += 0.22;
    if (roles.includes("controller") && (eventType === "centralCombination" || eventType === "openPlay")) weight += 0.16;
    if (roles.includes("wide-overload") && eventType === "wideAttack") weight += 0.18;
    if (roles.includes("ball-winner") && eventType === "pressWin") weight += 0.16;
    if (roles.includes("leader") && eventType === "lateMoment") weight += 0.12;
  }

  if (roles.includes("sweeper")) {
    weight -= 0.12;
  }

  return Math.max(0.55, weight);
}

function buildMatchStats(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile, events: MatchEvent[]) {
  const stats: Record<string, MatchTeamStats> = {
    [profileA.team.id]: createEmptyStats(profileA.adjustedMetrics),
    [profileB.team.id]: createEmptyStats(profileB.adjustedMetrics),
  };

  for (const event of events) {
    const teamStats = stats[event.teamId];
    const defendingStats = stats[event.defendingTeamId];
    teamStats.fatigueLoad = round1(teamStats.fatigueLoad + event.staminaPressure);

    if (event.momentumSwing >= 0) {
      teamStats.momentumScore = round1(teamStats.momentumScore + event.momentumSwing);
    } else {
      teamStats.momentumScore = round1(teamStats.momentumScore + event.momentumSwing);
      defendingStats.momentumScore = round1(defendingStats.momentumScore + Math.abs(event.momentumSwing) * 0.45);
    }

    if (!isChanceEvent(event)) {
      if (event.eventType === "foul") {
        teamStats.fouls += 1;

        if (event.card === "yellow") {
          teamStats.yellowCards += 1;
        }

        if (event.card === "red") {
          teamStats.redCards += 1;
        }
      }

      if (isDefensiveFlowEventType(event.eventType)) {
        teamStats.defensiveActions += 1;

        if (event.eventType === "keeperClaim") {
          teamStats.keeperSaves += 1;
        }
      }

      continue;
    }

    teamStats.xg = round2(teamStats.xg + event.xg);
    teamStats.shots += 1;

    if (event.outcome === "goal") {
      teamStats.goals += 1;
      teamStats.shotsOnTarget += 1;
    } else if (event.outcome === "saved") {
      teamStats.shotsOnTarget += 1;
      defendingStats.defensiveActions += 1;
      defendingStats.keeperSaves += 1;
    } else if (event.outcome === "blocked") {
      defendingStats.defensiveActions += 1;
    }

    if (event.eventType === "pressWin") {
      teamStats.pressingWins += 1;
    }

    if (event.eventType === "setPiece") {
      teamStats.setPieces += 1;
      teamStats.setPieceThreat = round2(teamStats.setPieceThreat + event.xg);
    }
  }

  const possessionA = calculatePossession(profileA.adjustedMetrics, profileB.adjustedMetrics);
  stats[profileA.team.id].possession = possessionA;
  stats[profileB.team.id].possession = 100 - possessionA;
  stats[profileA.team.id].lateEnergy = calculateLateEnergy(stats[profileA.team.id].fatigueLoad, profileA.adjustedMetrics);
  stats[profileB.team.id].lateEnergy = calculateLateEnergy(stats[profileB.team.id].fatigueLoad, profileB.adjustedMetrics);
  stats[profileA.team.id].momentumScore = round1(stats[profileA.team.id].momentumScore);
  stats[profileB.team.id].momentumScore = round1(stats[profileB.team.id].momentumScore);

  return stats;
}

function createEmptyStats(metrics: TeamMetrics): MatchTeamStats {
  return {
    defensiveActions: 0,
    fatigueLoad: 0,
    fouls: 0,
    goals: 0,
    keeperSaves: 0,
    lateEnergy: 100,
    momentumScore: 0,
    passFlow: Math.round(metrics.midfieldControl * 0.55 + metrics.progression * 0.25 + metrics.chemistry * 0.2),
    possession: 50,
    pressingWins: 0,
    redCards: 0,
    setPieces: 0,
    setPieceThreat: 0,
    shots: 0,
    shotsOnTarget: 0,
    yellowCards: 0,
    xg: 0,
  };
}

function calculateLateEnergy(fatigueLoad: number, metrics: TeamMetrics) {
  const recoveryBase = metrics.chemistry * 0.04 + metrics.midfieldControl * 0.025;
  return Math.max(48, Math.min(96, Math.round(100 - fatigueLoad * 0.72 + recoveryBase)));
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
    if (!isChanceEvent(event)) {
      for (const playerId of [event.primaryPlayerId, event.secondaryPlayerId]) {
        const player = playerId ? running.get(playerId) : null;

        if (player) {
          const defensiveBonus = isDefensiveFlowEventType(event.eventType) ? 0.038 : 0.018;
          player.involvement += isDefensiveFlowEventType(event.eventType) ? 0.028 : 0.015;
          player.rating += defensiveBonus;

          if (event.eventType === "foul") {
            player.rating -= event.card === "red" ? 0.55 : event.card === "yellow" ? 0.2 : 0.06;
          }
        }
      }

      continue;
    }

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

    if (event.defensivePlayerId) {
      const defender = running.get(event.defensivePlayerId);

      if (defender) {
        defender.involvement += event.xg * 0.55;
        defender.rating += event.outcome === "saved" ? 0.16 + event.xg * 0.45 : 0.1 + event.xg * 0.28;
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
          getMomentumEdgeText(winningProfile, losingProfile, stats),
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

function getMomentumEdgeText(winningProfile: AppliedTeamProfile, losingProfile: AppliedTeamProfile, stats: Record<string, MatchTeamStats>) {
  const winningStats = stats[winningProfile.team.id];
  const losingStats = stats[losingProfile.team.id];

  if (winningStats.momentumScore - losingStats.momentumScore >= 4) {
    return `${winningProfile.team.name}은 모멘텀 ${winningStats.momentumScore.toFixed(1)}-${losingStats.momentumScore.toFixed(1)}로 경기 흐름을 더 오래 잡았습니다.`;
  }

  if (winningStats.lateEnergy - losingStats.lateEnergy >= 5) {
    return `${winningProfile.team.name}은 후반 에너지 ${winningStats.lateEnergy}-${losingStats.lateEnergy}로 막판 유지력이 더 좋았습니다.`;
  }

  return `${winningProfile.team.name}은 결정적 장면 전환에서 흐름 손실을 더 잘 억제했습니다.`;
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
    const roleText = playerContext?.entry.simulationRoles.length ? `역할 ${playerContext.entry.simulationRoles.map((role) => simulationRoleLabels[role]).join("/")}` : "역할 수행";
    const tacticalText = profile ? getPlayerTacticImpactText(profile.tactics.style, role) : "경기 영향";

    return `${playerContext?.teamName ?? rating.teamId}: ${rating.playerName} ${rating.rating.toFixed(1)}점, ${rating.goals}G ${rating.assists}A. ${roleText}, ${attributeText}, ${tacticalText}이 결과에 반영됐습니다.`;
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
  const matchupNotes = [describeTacticMatchup(profileA, profileB), describeTacticMatchup(profileB, profileA), ...describeShapeMatchups(profileA, profileB)].filter(Boolean) as string[];
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

function describeShapeMatchups(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile) {
  const notes: string[] = [];
  const shapeA = getTeamShape(profileA);
  const shapeB = getTeamShape(profileB);

  for (const [profile, opponent, shape, opponentShape] of [
    [profileA, profileB, shapeA, shapeB],
    [profileB, profileA, shapeB, shapeA],
  ] as const) {
    if (profile.tactics.style === "counter" && opponent.tactics.lineHeight === "high") {
      notes.push(`${profile.team.name}은 Counter와 상대 high line 상성으로 전환 위협 보정을 받았습니다.`);
    }

    if (shape.fullbacks < 2 && opponentShape.wideThreat >= 3) {
      notes.push(`${profile.team.name}은 풀백 커버가 부족해 ${opponent.team.name}의 측면 전개에 취약한 구조입니다.`);
    }

    if (shape.centerBacks >= 3 && opponentShape.wideAttackers < 2) {
      notes.push(`${profile.team.name}의 3CB 구조는 중앙 수비와 세트피스 안정성에서 보정을 받았습니다.`);
    }

    if (shape.centralMidfielders >= 3 && profile.tactics.style === "possession") {
      notes.push(`${profile.team.name}은 중원 3명 이상과 Possession 조합으로 점유 안정성이 올라갑니다.`);
    }

    if (shape.attackers >= 5 && profile.tactics.risk === "aggressive") {
      notes.push(`${profile.team.name}은 공격 숫자와 aggressive risk가 겹쳐 공격 보상과 수비 리스크가 동시에 커졌습니다.`);
    }
  }

  return notes.slice(0, 4);
}

function buildEventPatternNotes(profileA: AppliedTeamProfile, profileB: AppliedTeamProfile, events: MatchEvent[]) {
  return [profileA, profileB].flatMap((profile) => {
    const profileEvents = events.filter((event) => event.teamId === profile.team.id);
    const chanceEvents = profileEvents.filter(isChanceEvent);
    const flowEvents = profileEvents.filter((event) => event.phase === "flow");
    const goals = profileEvents.filter((event) => event.outcome === "goal").length;
    const counters = chanceEvents.filter((event) => event.eventType === "counter").length;
    const pressWins = chanceEvents.filter((event) => event.eventType === "pressWin").length;
    const setPieces = chanceEvents.filter((event) => event.eventType === "setPiece").length;
    const penalties = chanceEvents.filter((event) => event.setPieceSituation === "penalty").length;
    const fouls = flowEvents.filter((event) => event.eventType === "foul").length;
    const yellowCards = flowEvents.filter((event) => event.card === "yellow").length;
    const redCards = flowEvents.filter((event) => event.card === "red").length;
    const momentum = round1(profileEvents.reduce((sum, event) => sum + event.momentumSwing, 0));
    const fatigue = round1(profileEvents.reduce((sum, event) => sum + event.staminaPressure, 0));
    const highXg = chanceEvents.filter((event) => event.xg >= 0.14).length;
    const circulation = flowEvents.filter((event) => event.eventType === "circulation" || event.eventType === "switchPlay").length;
    const defensiveFlow = flowEvents.filter((event) => isDefensiveFlowEventType(event.eventType)).length;
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

    if (penalties > 0) {
      notes.push(`${profile.team.name}은 페널티 상황 ${penalties}회로 경기의 큰 분기점을 만들었습니다.`);
    }

    if (goals > 0 && highXg >= goals) {
      notes.push(`${profile.team.name}의 득점은 낮은 확률 난사가 아니라 높은 xG 장면에서 나왔습니다.`);
    }

    if (circulation >= 6) {
      notes.push(`${profile.team.name}은 연결/전환 flow ${circulation}회로 공격 장면 사이의 점유 리듬을 유지했습니다.`);
    }

    if (defensiveFlow >= 5) {
      notes.push(`${profile.team.name}은 태클/인터셉트/세컨볼 ${defensiveFlow}회로 상대 흐름을 끊는 장면이 많았습니다.`);
    }

    if (fouls >= 3 || yellowCards + redCards > 0) {
      const cardText = yellowCards + redCards > 0 ? ` 카드 ${yellowCards + redCards}장` : "";
      notes.push(`${profile.team.name}은 파울 ${fouls}회${cardText}으로 경기 리듬을 끊거나 위험을 감수했습니다.`);
    }

    if (momentum >= 12) {
      notes.push(`${profile.team.name}은 누적 모멘텀 ${momentum.toFixed(1)}로 장면 간 흐름을 강하게 이어갔습니다.`);
    }

    if (fatigue >= 38) {
      notes.push(`${profile.team.name}은 활동량 부담 ${fatigue.toFixed(1)}로 후반 에너지 관리가 중요했습니다.`);
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

const simulationRoleLabels = {
  "ball-winner": "볼위너",
  controller: "컨트롤러",
  creator: "크리에이터",
  finisher: "피니셔",
  leader: "리더",
  "line-breaker": "라인브레이커",
  "set-piece": "세트피스",
  sweeper: "스위퍼",
  target: "타깃",
  "wide-overload": "와이드오버로드",
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
  defensivePlayerName?: string,
  setPieceSituation?: SetPieceSituation,
) {
  const subject = scorerName ?? attacking.team.name;
  const creator = assisterName ? `${assisterName}의 전개 이후 ` : "";
  const setPieceText = setPieceSituation ? getSetPieceSituationText(setPieceSituation) : "세트피스";
  const outcomeText: Record<MatchEvent["outcome"], string> = {
    blocked: defensivePlayerName ? `${defensivePlayerName}이 막아냈습니다.` : "수비에 막혔습니다.",
    goal: "골로 연결했습니다.",
    miss: "마무리가 빗나갔습니다.",
    saved: defensivePlayerName ? `${defensivePlayerName}의 선방에 막혔습니다.` : "골키퍼 선방에 막혔습니다.",
  };
  const typeText: Record<MatchEventType, string> = {
    centralCombination: "중앙 연계로 박스 근처를 열었고",
    circulation: "짧은 패스 흐름으로 압박을 풀었고",
    clearance: "위험 지역에서 공을 걷어냈고",
    counter: "빠른 역습으로 수비 뒷공간을 찔렀고",
    error: `${defending.team.name}의 실수를 놓치지 않았고`,
    foul: "거친 경합 이후 흐름이 끊겼고",
    interception: "패스 길을 읽고 전개를 끊었고",
    keeperClaim: "골문 앞 공중볼을 처리했고",
    lateMoment: "후반 막판 집중력으로 결정적인 장면을 만들었고",
    openPlay: "일반 공격 흐름에서 찬스를 만들었고",
    offside: "수비 라인 뒤를 노리는 움직임을 만들었고",
    pressWin: "전방 압박 성공 직후 찬스를 잡았고",
    secondBall: "세컨볼 경합에서 우위를 잡았고",
    setPiece: `${setPieceText}에서 위협적인 장면을 만들었고`,
    switchPlay: "반대편으로 전환하며 공간을 열었고",
    tackle: "몸싸움으로 전진을 저지했고",
    wideAttack: "측면 공격으로 수비를 흔들었고",
  };

  return `${minute}' ${creator}${subject}이 ${typeText[eventType]} ${outcomeText[outcome]}`;
}

function describeFlowEvent(
  minute: number,
  acting: AppliedTeamProfile,
  defending: AppliedTeamProfile,
  eventType: MatchEventType,
  primaryName?: string,
  secondaryName?: string,
  setPieceSituation?: SetPieceSituation,
  card?: CardDecision,
) {
  const subject = primaryName ?? acting.team.name;
  const support = secondaryName ? ` ${secondaryName}와 함께` : "";
  const setPieceText = setPieceSituation ? getSetPieceSituationText(setPieceSituation) : "세트피스";
  const cardText = card ? ` ${getCardDecisionText(card)}를 받았습니다.` : "";
  const typeText: Record<MatchEventType, string> = {
    centralCombination: "중앙에서 짧은 연결을 이어갔습니다.",
    circulation: "후방과 중원을 오가며 점유를 안정시켰습니다.",
    clearance: `${defending.team.name}의 압박을 피해 위험 지역에서 걷어냈습니다.`,
    counter: "전환 타이밍을 노리며 전방으로 속도를 붙였습니다.",
    error: `${defending.team.name}의 압박 속에서 공 소유가 흔들렸습니다.`,
    foul: `경합 과정에서 파울로 흐름을 끊었습니다.${cardText}`,
    interception: `${defending.team.name}의 패스 길을 읽고 끊어냈습니다.`,
    keeperClaim: "골문 앞 공중볼을 안정적으로 잡아냈습니다.",
    lateMoment: "후반 집중 싸움에서 볼 소유를 지켜냈습니다.",
    openPlay: "일반 전개 속에서 다음 패스 각도를 만들었습니다.",
    offside: "라인 뒤 침투를 시도했지만 오프사이드에 걸렸습니다.",
    pressWin: "전방 압박으로 다음 공격권을 만들었습니다.",
    secondBall: "세컨볼 경합을 따내며 중원 싸움을 이어갔습니다.",
    setPiece: `${setPieceText} 이전 위치 싸움을 가져갔습니다.`,
    switchPlay: "반대편으로 전환하며 수비 블록을 흔들었습니다.",
    tackle: "타이밍 좋은 태클로 전진을 멈췄습니다.",
    wideAttack: "측면에서 폭을 유지하며 다음 크로스 각도를 봤습니다.",
  };

  return `${minute}' ${subject}이${support} ${typeText[eventType]}`;
}

function isChanceEvent(event: MatchEvent) {
  return event.phase !== "flow" && chanceEventTypes.has(event.eventType);
}

function isDefensiveFlowEventType(eventType: MatchEventType) {
  return defensiveFlowEventTypes.has(eventType);
}

function getEventSortWeight(event: MatchEvent) {
  const base = eventTypes.indexOf(event.eventType);
  return (event.phase === "flow" ? 0 : 20) + (base === -1 ? 99 : base);
}

function getFlowOutcome(eventType: MatchEventType): MatchEvent["outcome"] {
  if (eventType === "clearance" || eventType === "interception" || eventType === "secondBall" || eventType === "tackle") {
    return "blocked";
  }

  if (eventType === "offside" || eventType === "foul") {
    return "miss";
  }

  return "saved";
}

function getSetPieceSituationText(situation: SetPieceSituation) {
  if (situation === "corner") {
    return "코너킥";
  }

  if (situation === "freeKick") {
    return "직접 프리킥";
  }

  if (situation === "penalty") {
    return "페널티킥";
  }

  return "와이드 프리킥";
}

function getCardDecisionText(card: CardDecision) {
  return card === "red" ? "레드카드" : "옐로카드";
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
