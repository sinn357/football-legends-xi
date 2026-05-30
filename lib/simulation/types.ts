import type { LegendPlayer, PositionCode } from "../legend-data";

export type TacticStyle = "balanced" | "possession" | "direct" | "counter" | "high-press" | "low-block";
export type TacticTempo = "slow" | "normal" | "fast";
export type TacticLineHeight = "low" | "mid" | "high";
export type TacticRisk = "conservative" | "normal" | "aggressive";
export type RandomnessLevel = "controlled" | "normal" | "wild";

export type SimulationTactics = {
  lineHeight: TacticLineHeight;
  risk: TacticRisk;
  style: TacticStyle;
  tempo: TacticTempo;
};

export type SimulationSlot = {
  id: string;
  label: string;
  player: LegendPlayer;
  role: PositionCode;
};

export type SimulationTeamInput = {
  id: string;
  name: string;
  slots: SimulationSlot[];
};

export type PlayerSimulationAttributes = {
  aerial: number;
  ballProgression: number;
  bigMatch: number;
  chanceCreation: number;
  control: number;
  defending: number;
  finishing: number;
  goalkeeper: number;
  leadership: number;
  pressing: number;
  scoring: number;
  versatility: number;
};

export type TeamMetrics = {
  attackPower: number;
  chanceQuality: number;
  chemistry: number;
  defensiveSecurity: number;
  finishing: number;
  goalkeeperImpact: number;
  midfieldControl: number;
  pressingPower: number;
  progression: number;
  roleConflict: number;
  setPieceThreat: number;
  transitionThreat: number;
  wideSecurity: number;
};

export type TeamBalanceReport = {
  notes: string[];
  penalties: string[];
  strengths: string[];
};

export type TeamSimulationProfile = {
  balance: TeamBalanceReport;
  metrics: TeamMetrics;
  playerAttributes: Array<{
    attributes: PlayerSimulationAttributes;
    fit: number;
    player: LegendPlayer;
    role: PositionCode;
    slotId: string;
    slotLabel: string;
  }>;
  team: SimulationTeamInput;
};

export type AppliedTeamProfile = TeamSimulationProfile & {
  adjustedMetrics: TeamMetrics;
  tactics: SimulationTactics;
};

export type MatchEventType =
  | "centralCombination"
  | "counter"
  | "error"
  | "lateMoment"
  | "openPlay"
  | "pressWin"
  | "setPiece"
  | "wideAttack";

export type MatchEvent = {
  assisterId?: string;
  defendingTeamId: string;
  description: string;
  eventType: MatchEventType;
  minute: number;
  outcome: "goal" | "miss" | "saved" | "blocked";
  scorerId?: string;
  teamId: string;
  xg: number;
};

export type MatchTeamStats = {
  goals: number;
  passFlow: number;
  possession: number;
  pressingWins: number;
  setPieceThreat: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
};

export type PlayerMatchRating = {
  goals: number;
  assists: number;
  playerId: string;
  playerName: string;
  rating: number;
  teamId: string;
};

export type TacticalReport = {
  notes: string[];
  weakPoints: string[];
  whyTheyWon: string[];
};

export type SimulatedMatchResult = {
  events: MatchEvent[];
  matchSeed: string;
  playerRatings: PlayerMatchRating[];
  report: TacticalReport;
  stats: Record<string, MatchTeamStats>;
  teams: Record<string, AppliedTeamProfile>;
  winnerTeamId: string | null;
};

export type SimulateMatchOptions = {
  homeTeamId?: string;
  randomness?: RandomnessLevel;
  seed?: string;
};
