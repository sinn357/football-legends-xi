import type { PositionCode } from "../legend-data";
import { clampScore, getPlayerSimulationAttributes, getRoleFit } from "./player-ratings";
import type { PlayerSimulationAttributes, SimulationTeamInput, TeamBalanceReport, TeamMetrics, TeamSimulationProfile } from "./types";

const metricKeys: Array<keyof TeamMetrics> = [
  "attackPower",
  "chanceQuality",
  "chemistry",
  "defensiveSecurity",
  "finishing",
  "goalkeeperImpact",
  "midfieldControl",
  "pressingPower",
  "progression",
  "roleConflict",
  "setPieceThreat",
  "transitionThreat",
  "wideSecurity",
];

export function buildTeamSimulationProfile(team: SimulationTeamInput): TeamSimulationProfile {
  const playerAttributes = team.slots.map((slot) => ({
    attributes: getPlayerSimulationAttributes(slot.player),
    fit: getRoleFit(slot.player, slot.role),
    player: slot.player,
    role: slot.role,
    slotId: slot.id,
    slotLabel: slot.label,
  }));
  const balance = getTeamBalanceReport(team.slots);
  const metrics = applyBalanceModifiers(calculateRawMetrics(playerAttributes), balance);

  return {
    balance,
    metrics,
    playerAttributes,
    team,
  };
}

export function getEmptyTeamMetrics(): TeamMetrics {
  return {
    attackPower: 50,
    chanceQuality: 50,
    chemistry: 50,
    defensiveSecurity: 50,
    finishing: 50,
    goalkeeperImpact: 50,
    midfieldControl: 50,
    pressingPower: 50,
    progression: 50,
    roleConflict: 30,
    setPieceThreat: 50,
    transitionThreat: 50,
    wideSecurity: 50,
  };
}

export function normalizeMetric(value: number) {
  return Math.max(35, Math.min(105, value));
}

function calculateRawMetrics(
  playerAttributes: TeamSimulationProfile["playerAttributes"],
): TeamMetrics {
  if (playerAttributes.length === 0) {
    return getEmptyTeamMetrics();
  }

  const byRole = (roles: PositionCode[]) => playerAttributes.filter((entry) => roles.includes(entry.role));
  const attackers = byRole(["ST", "SS", "LW", "RW", "AM"]);
  const midfielders = byRole(["AM", "CM", "DM"]);
  const defenders = byRole(["DM", "CB", "LB", "RB"]);
  const centerBacks = byRole(["CB"]);
  const widePlayers = byRole(["LB", "RB", "LW", "RW"]);
  const goalkeepers = byRole(["GK"]);

  const avg = (entries: typeof playerAttributes, key: keyof PlayerSimulationAttributes) => average(entries.map((entry) => entry.attributes[key] * entry.fit));
  const top = (entries: typeof playerAttributes, key: keyof PlayerSimulationAttributes, count = 3) =>
    average(entries.map((entry) => entry.attributes[key] * entry.fit).sort((a, b) => b - a).slice(0, count));
  const teamAvg = (key: keyof PlayerSimulationAttributes) => avg(playerAttributes, key);

  const attackPower = top(attackers.length ? attackers : playerAttributes, "scoring", 4) * 0.4 + top(playerAttributes, "chanceCreation", 4) * 0.35 + teamAvg("bigMatch") * 0.25;
  const chanceQuality = top(playerAttributes, "chanceCreation", 4) * 0.55 + avg(midfielders.length ? midfielders : playerAttributes, "control") * 0.25 + top(attackers, "ballProgression", 3) * 0.2;
  const finishing = top(attackers.length ? attackers : playerAttributes, "finishing", 3) * 0.7 + teamAvg("bigMatch") * 0.3;
  const midfieldControl = avg(midfielders.length ? midfielders : playerAttributes, "control") * 0.55 + avg(midfielders.length ? midfielders : playerAttributes, "ballProgression") * 0.25 + teamAvg("leadership") * 0.2;
  const progression = top(playerAttributes, "ballProgression", 5) * 0.55 + avg(midfielders.length ? midfielders : playerAttributes, "chanceCreation") * 0.25 + avg(widePlayers.length ? widePlayers : playerAttributes, "ballProgression") * 0.2;
  const defensiveSecurity = avg(defenders.length ? defenders : playerAttributes, "defending") * 0.45 + avg(centerBacks.length ? centerBacks : defenders, "aerial") * 0.25 + teamAvg("leadership") * 0.3;
  const wideSecurity = avg(widePlayers.length ? widePlayers : defenders, "defending") * 0.5 + avg(widePlayers.length ? widePlayers : playerAttributes, "pressing") * 0.25 + teamAvg("control") * 0.25;
  const pressingPower = teamAvg("pressing") * 0.55 + avg(attackers.length ? attackers : playerAttributes, "pressing") * 0.25 + avg(midfielders.length ? midfielders : playerAttributes, "pressing") * 0.2;
  const transitionThreat = top(attackers.length ? attackers : playerAttributes, "scoring", 3) * 0.35 + top(playerAttributes, "ballProgression", 4) * 0.35 + top(playerAttributes, "chanceCreation", 3) * 0.3;
  const setPieceThreat = avg([...centerBacks, ...attackers], "aerial") * 0.55 + teamAvg("chanceCreation") * 0.2 + teamAvg("bigMatch") * 0.25;
  const goalkeeperImpact = goalkeepers.length ? avg(goalkeepers, "goalkeeper") : 42;
  const roleConflict = calculateRoleConflict(playerAttributes);
  const chemistry = teamAvg("leadership") * 0.35 + average(playerAttributes.map((entry) => entry.fit * 100)) * 0.45 + (100 - roleConflict) * 0.2;

  return normalizeMetrics({
    attackPower,
    chanceQuality,
    chemistry,
    defensiveSecurity,
    finishing,
    goalkeeperImpact,
    midfieldControl,
    pressingPower,
    progression,
    roleConflict,
    setPieceThreat,
    transitionThreat,
    wideSecurity,
  });
}

function getTeamBalanceReport(slots: SimulationTeamInput["slots"]): TeamBalanceReport {
  const count = (roles: PositionCode[]) => slots.filter((slot) => roles.includes(slot.role)).length;
  const hasNatural = (roles: PositionCode[]) => slots.some((slot) => roles.includes(slot.player.primaryPosition));
  const gk = count(["GK"]);
  const cb = count(["CB"]);
  const dm = count(["DM"]);
  const fullbacks = count(["LB", "RB"]);
  const attackers = count(["ST", "SS", "LW", "RW", "AM"]);
  const creators = slots.filter((slot) => ["AM", "SS", "LW", "RW", "CM"].includes(slot.role)).length;
  const notes: string[] = [];
  const penalties: string[] = [];
  const strengths: string[] = [];

  if (gk >= 1) {
    strengths.push("GK 구조가 갖춰져 실점 억제 계산이 안정적입니다.");
  } else {
    penalties.push("전담 GK가 없어 goalkeeperImpact가 크게 낮아집니다.");
  }

  if (cb >= 2) {
    strengths.push("CB 2명 이상으로 중앙 수비 구조가 안정적입니다.");
  } else {
    penalties.push("CB가 부족해 중앙 수비와 제공권이 흔들립니다.");
  }

  if (dm >= 1 || hasNatural(["DM"])) {
    strengths.push("DM 성격의 선수가 있어 전환 수비가 보정됩니다.");
  } else {
    penalties.push("DM 부재로 빠른 역습에 취약합니다.");
  }

  if (fullbacks >= 2) {
    strengths.push("좌우 측면 수비 담당이 모두 존재합니다.");
  } else {
    penalties.push("풀백/측면 수비 담당이 부족해 wideSecurity가 낮아집니다.");
  }

  if (attackers >= 5) {
    penalties.push("공격 자원이 과밀해 역할 충돌이 커집니다.");
  }

  if (creators >= 4) {
    notes.push("창의적인 자원이 많아 찬스 창출은 강하지만 역할 충돌이 생길 수 있습니다.");
  }

  return { notes, penalties, strengths };
}

function applyBalanceModifiers(metrics: TeamMetrics, balance: TeamBalanceReport): TeamMetrics {
  const next = { ...metrics };

  for (const penalty of balance.penalties) {
    if (penalty.includes("GK")) {
      next.goalkeeperImpact -= 18;
      next.defensiveSecurity -= 8;
    }

    if (penalty.includes("CB")) {
      next.defensiveSecurity -= 10;
      next.setPieceThreat -= 5;
    }

    if (penalty.includes("DM")) {
      next.defensiveSecurity -= 6;
      next.transitionThreat -= 2;
      next.roleConflict += 5;
    }

    if (penalty.includes("측면")) {
      next.wideSecurity -= 9;
    }

    if (penalty.includes("공격")) {
      next.roleConflict += 9;
      next.chemistry -= 5;
    }
  }

  for (const strength of balance.strengths) {
    if (strength.includes("GK")) {
      next.goalkeeperImpact += 2;
    }

    if (strength.includes("CB")) {
      next.defensiveSecurity += 3;
    }

    if (strength.includes("DM")) {
      next.defensiveSecurity += 3;
      next.midfieldControl += 2;
    }

    if (strength.includes("측면")) {
      next.wideSecurity += 3;
    }
  }

  return normalizeMetrics(next);
}

function calculateRoleConflict(playerAttributes: TeamSimulationProfile["playerAttributes"]) {
  const lowFit = playerAttributes.filter((entry) => entry.fit < 0.8).length;
  const attackers = playerAttributes.filter((entry) => ["ST", "SS", "LW", "RW", "AM"].includes(entry.role)).length;
  const defensiveCore = playerAttributes.filter((entry) => ["GK", "CB", "DM"].includes(entry.role)).length;
  return Math.max(5, Math.min(80, 12 + lowFit * 8 + Math.max(0, attackers - 4) * 6 + Math.max(0, 4 - defensiveCore) * 5));
}

function normalizeMetrics(metrics: TeamMetrics): TeamMetrics {
  return metricKeys.reduce((next, key) => {
    next[key] = key === "roleConflict" ? clampScore(metrics[key], 0, 100) : normalizeMetric(metrics[key]);
    return next;
  }, {} as TeamMetrics);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 50;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
