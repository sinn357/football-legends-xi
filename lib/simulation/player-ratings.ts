import type { LegendPlayer, PositionCode, ScoreKey } from "../legend-data";
import type { PlayerSimulationAttributes, PlayerSimulationRole } from "./types";

type PositionGroup = "attack" | "defense" | "goalkeeper" | "midfield" | "wide";

const attackPositions = new Set<PositionCode>(["ST", "SS", "LW", "RW", "AM"]);
const midfieldPositions = new Set<PositionCode>(["AM", "CM", "DM"]);
const defensivePositions = new Set<PositionCode>(["DM", "CB", "LB", "RB"]);
const widePositions = new Set<PositionCode>(["LW", "RW", "LB", "RB"]);

export function getPlayerSimulationAttributes(player: LegendPlayer): PlayerSimulationAttributes {
  const base = player.overallScore;
  const scores = player.scores;
  const positionGroup = getPositionGroup(player.primaryPosition);
  const positionCount = Math.max(1, new Set([player.primaryPosition, ...player.tags.map(extractPositionTag).filter(Boolean)]).size);

  return {
    aerial: clampScore(weighted(base, scores, { primeSkill: 0.3, teamCareer: 0.35, teamImportance: 0.35 }) + getAerialBonus(player.primaryPosition)),
    ballProgression: clampScore(weighted(base, scores, { primeSkill: 0.45, teamCareer: 0.2, teamImportance: 0.35 }) + getMidfieldBonus(player.primaryPosition)),
    bigMatch: clampScore(weighted(base, scores, { individualCareer: 0.35, legacy: 0.25, teamCareer: 0.4 })),
    chanceCreation: clampScore(weighted(base, scores, { individualCareer: 0.15, primeSkill: 0.55, teamImportance: 0.3 }) + getCreatorBonus(player.primaryPosition)),
    control: clampScore(weighted(base, scores, { primeSkill: 0.35, teamCareer: 0.35, teamImportance: 0.3 })),
    defending: clampScore(weighted(base, scores, { primeSkill: 0.25, teamCareer: 0.3, teamImportance: 0.45 }) + getDefensiveBonus(player.primaryPosition)),
    finishing: clampScore(weighted(base, scores, { individualCareer: 0.35, primeSkill: 0.45, teamImportance: 0.2 }) + getFinishingBonus(player.primaryPosition)),
    goalkeeper: clampScore(positionGroup === "goalkeeper" ? base + 2 : weighted(base, scores, { primeSkill: 0.35, teamCareer: 0.3, teamImportance: 0.35 }) - 24),
    leadership: clampScore(weighted(base, scores, { legacy: 0.25, teamCareer: 0.35, teamImportance: 0.4 })),
    pressing: clampScore(weighted(base, scores, { primeSkill: 0.3, teamCareer: 0.25, teamImportance: 0.45 }) + getPressingBonus(player.primaryPosition)),
    scoring: clampScore(weighted(base, scores, { individualCareer: 0.3, primeSkill: 0.5, teamImportance: 0.2 }) + getScoringBonus(player.primaryPosition)),
    versatility: clampScore(70 + positionCount * 4 + (positionGroup === "midfield" ? 3 : 0)),
  };
}

export function getRoleFit(player: LegendPlayer, role: PositionCode) {
  if (player.primaryPosition === role) {
    return 1;
  }

  if (role === "LEGEND" || player.primaryPosition === "LEGEND") {
    return 0.72;
  }

  const primaryGroup = getPositionGroup(player.primaryPosition);
  const roleGroup = getPositionGroup(role);

  if (primaryGroup === roleGroup) {
    return 0.9;
  }

  if (midfieldPositions.has(player.primaryPosition) && midfieldPositions.has(role)) {
    return 0.88;
  }

  if (attackPositions.has(player.primaryPosition) && attackPositions.has(role)) {
    return 0.84;
  }

  if (defensivePositions.has(player.primaryPosition) && defensivePositions.has(role)) {
    return 0.84;
  }

  if (widePositions.has(player.primaryPosition) && widePositions.has(role)) {
    return 0.8;
  }

  if (player.primaryPosition === "DM" && role === "CB") {
    return 0.78;
  }

  if (player.primaryPosition === "AM" && role === "CM") {
    return 0.82;
  }

  return 0.62;
}

export function getPlayerSimulationRoles(player: LegendPlayer, attributes: PlayerSimulationAttributes): PlayerSimulationRole[] {
  const roles = new Set<PlayerSimulationRole>();
  const position = player.primaryPosition;

  if (["ST", "SS", "LW", "RW"].includes(position) && attributes.finishing >= 88) {
    roles.add("finisher");
  }

  if ((position === "ST" || position === "CB") && attributes.aerial >= 88) {
    roles.add("target");
  }

  if (["ST", "SS", "LW", "RW"].includes(position) && attributes.ballProgression >= 88 && attributes.scoring >= 86) {
    roles.add("line-breaker");
  }

  if (["AM", "CM", "SS", "LW", "RW"].includes(position) && attributes.chanceCreation >= 88) {
    roles.add("creator");
  }

  if (["CM", "DM", "AM"].includes(position) && attributes.control >= 88) {
    roles.add("controller");
  }

  if (["DM", "CM", "CB", "LB", "RB"].includes(position) && attributes.defending >= 86 && attributes.pressing >= 84) {
    roles.add("ball-winner");
  }

  if (["LW", "RW", "LB", "RB"].includes(position) && attributes.ballProgression >= 86) {
    roles.add("wide-overload");
  }

  if ((position === "CB" || position === "ST") && attributes.aerial >= 90) {
    roles.add("set-piece");
  }

  if (position === "GK" && attributes.goalkeeper >= 88 && attributes.control >= 82) {
    roles.add("sweeper");
  }

  if (attributes.leadership >= 90 || player.scores.legacy >= 96 || player.scores.teamImportance >= 96) {
    roles.add("leader");
  }

  if (roles.size === 0) {
    if (attackPositions.has(position)) {
      roles.add("finisher");
    } else if (midfieldPositions.has(position)) {
      roles.add("controller");
    } else if (defensivePositions.has(position)) {
      roles.add("ball-winner");
    } else if (position === "GK") {
      roles.add("sweeper");
    }
  }

  return [...roles].slice(0, 4);
}

export function clampScore(value: number, min = 40, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function getPositionGroup(position: PositionCode): PositionGroup {
  if (position === "GK") {
    return "goalkeeper";
  }

  if (position === "CB" || position === "LB" || position === "RB") {
    return "defense";
  }

  if (position === "LW" || position === "RW") {
    return "wide";
  }

  if (position === "CM" || position === "DM" || position === "AM") {
    return "midfield";
  }

  return "attack";
}

function weighted(base: number, scores: Record<ScoreKey, number>, weights: Partial<Record<ScoreKey, number>>) {
  const scoreTotal = Object.entries(weights).reduce((sum, [key, value]) => sum + scores[key as ScoreKey] * value, 0);
  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  return base * 0.18 + (scoreTotal / weightTotal) * 0.82;
}

function getAerialBonus(position: PositionCode) {
  return position === "CB" || position === "ST" || position === "GK" ? 5 : 0;
}

function getCreatorBonus(position: PositionCode) {
  return position === "AM" || position === "SS" || position === "LW" || position === "RW" || position === "CM" ? 5 : -1;
}

function getDefensiveBonus(position: PositionCode) {
  if (position === "CB" || position === "GK") {
    return 8;
  }

  if (position === "DM" || position === "LB" || position === "RB") {
    return 6;
  }

  if (position === "CM") {
    return 2;
  }

  return -5;
}

function getFinishingBonus(position: PositionCode) {
  if (position === "ST") {
    return 8;
  }

  if (position === "SS" || position === "LW" || position === "RW") {
    return 5;
  }

  if (position === "AM") {
    return 2;
  }

  return -4;
}

function getMidfieldBonus(position: PositionCode) {
  return position === "CM" || position === "DM" || position === "AM" ? 5 : 0;
}

function getPressingBonus(position: PositionCode) {
  return position === "DM" || position === "CM" || position === "LW" || position === "RW" ? 4 : 0;
}

function getScoringBonus(position: PositionCode) {
  if (position === "ST") {
    return 8;
  }

  if (position === "SS" || position === "LW" || position === "RW") {
    return 5;
  }

  if (position === "AM") {
    return 2;
  }

  if (position === "GK" || position === "CB") {
    return -10;
  }

  return -3;
}

function extractPositionTag(tag: string): PositionCode | null {
  const token = tag.toUpperCase();
  const positions: PositionCode[] = ["ST", "SS", "RW", "LW", "AM", "CM", "DM", "CB", "RB", "LB", "GK"];
  return positions.includes(token as PositionCode) ? (token as PositionCode) : null;
}
