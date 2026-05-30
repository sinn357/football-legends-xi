import { normalizeMetric } from "./team-metrics";
import type { SimulationTactics, TeamMetrics } from "./types";

export const defaultTactics: SimulationTactics = {
  lineHeight: "mid",
  risk: "normal",
  style: "balanced",
  tempo: "normal",
};

export function applyTactics(metrics: TeamMetrics, tactics: SimulationTactics): TeamMetrics {
  const next = { ...metrics };

  switch (tactics.style) {
    case "possession":
      next.midfieldControl += 7;
      next.chanceQuality += 4;
      next.progression += 2;
      next.transitionThreat -= 5;
      break;
    case "direct":
      next.progression += 7;
      next.setPieceThreat += 4;
      next.transitionThreat += 3;
      next.midfieldControl -= 6;
      break;
    case "counter":
      next.transitionThreat += 9;
      next.defensiveSecurity += 3;
      next.midfieldControl -= 5;
      next.pressingPower -= 2;
      break;
    case "high-press":
      next.pressingPower += 9;
      next.attackPower += 3;
      next.defensiveSecurity -= 4;
      next.wideSecurity -= 2;
      break;
    case "low-block":
      next.defensiveSecurity += 8;
      next.wideSecurity += 5;
      next.attackPower -= 5;
      next.midfieldControl -= 4;
      break;
    case "balanced":
      next.chemistry += 2;
      break;
  }

  switch (tactics.tempo) {
    case "slow":
      next.midfieldControl += 4;
      next.chanceQuality += 2;
      next.attackPower -= 2;
      break;
    case "fast":
      next.attackPower += 3;
      next.transitionThreat += 4;
      next.roleConflict += 3;
      next.midfieldControl -= 2;
      break;
    case "normal":
      break;
  }

  switch (tactics.lineHeight) {
    case "low":
      next.defensiveSecurity += 4;
      next.pressingPower -= 5;
      break;
    case "high":
      next.pressingPower += 5;
      next.transitionThreat += 2;
      next.defensiveSecurity -= 3;
      next.wideSecurity -= 2;
      break;
    case "mid":
      break;
  }

  switch (tactics.risk) {
    case "conservative":
      next.defensiveSecurity += 4;
      next.wideSecurity += 2;
      next.attackPower -= 4;
      next.transitionThreat -= 2;
      break;
    case "aggressive":
      next.attackPower += 5;
      next.chanceQuality += 2;
      next.defensiveSecurity -= 5;
      next.roleConflict += 4;
      break;
    case "normal":
      break;
  }

  return Object.fromEntries(
    Object.entries(next).map(([key, value]) => [key, key === "roleConflict" ? Math.max(0, Math.min(100, Math.round(value))) : normalizeMetric(value)]),
  ) as TeamMetrics;
}

export function getTacticTempoMultiplier(tactics: SimulationTactics) {
  if (tactics.tempo === "fast") {
    return 1.12;
  }

  if (tactics.tempo === "slow") {
    return 0.9;
  }

  return 1;
}
