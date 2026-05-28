import fs from "node:fs";
import path from "node:path";

export type PositionCode =
  | "ST"
  | "SS"
  | "RW"
  | "LW"
  | "AM"
  | "CM"
  | "DM"
  | "CB"
  | "RB"
  | "LB"
  | "GK"
  | "LEGEND";

export type PlayerStatus =
  | "confirmed"
  | "active-hold"
  | "active-legend"
  | "delete-candidate"
  | "watch";

export type ScoreKey =
  | "teamCareer"
  | "individualCareer"
  | "primeSkill"
  | "teamImportance"
  | "legacy";

export type PlayerScores = Record<ScoreKey, number>;

export type LegendPlayer = {
  id: string;
  name: string;
  country: string;
  region: string;
  primaryPosition: PositionCode;
  status: PlayerStatus;
  tags: string[];
  sourceOrder: number;
  positionOrder: number;
  scores: PlayerScores;
};

export type CountrySummary = {
  name: string;
  region: string;
  count: number;
  positions: Partial<Record<PositionCode, number>>;
};

export type LegendData = {
  players: LegendPlayer[];
  countries: CountrySummary[];
  sourcePath: string;
};

const POSITION_CODES: PositionCode[] = [
  "ST",
  "SS",
  "RW",
  "LW",
  "AM",
  "CM",
  "DM",
  "CB",
  "RB",
  "LB",
  "GK",
];

const STATUS_PATTERNS: Array<{
  status: PlayerStatus;
  tag: string;
  pattern: RegExp;
}> = [
  { status: "active-legend", tag: "현역 레전드 확정", pattern: /현역\s*레전드\s*확정/g },
  { status: "active-hold", tag: "현역보류", pattern: /현역보류/g },
  { status: "delete-candidate", tag: "삭제후보", pattern: /삭제후보|삭제부호/g },
  { status: "watch", tag: "비교 필요", pattern: /[가-힣A-Za-z]+\s*과\s*비교/g },
];

const positionLabels: Record<PositionCode, string> = {
  ST: "스트라이커",
  SS: "세컨드 스트라이커",
  RW: "오른쪽 윙",
  LW: "왼쪽 윙",
  AM: "공격형 미드필더",
  CM: "중앙 미드필더",
  DM: "수비형 미드필더",
  CB: "센터백",
  RB: "라이트백",
  LB: "레프트백",
  GK: "골키퍼",
  LEGEND: "레전드",
};

const prestigeCountries = new Set([
  "Argentina",
  "Brazil",
  "Germany",
  "Italy",
  "France",
  "Spain",
  "England",
  "Netherlands",
  "Portugal",
]);

const iconOverrides: Record<string, Partial<PlayerScores>> = {
  pele: { teamCareer: 99, individualCareer: 99, primeSkill: 100, teamImportance: 99, legacy: 100 },
  "lionel messi": { teamCareer: 100, individualCareer: 100, primeSkill: 100, teamImportance: 100, legacy: 100 },
  "diego maradona": { teamCareer: 96, individualCareer: 98, primeSkill: 100, teamImportance: 100, legacy: 100 },
  "cristiano ronaldo": { teamCareer: 100, individualCareer: 100, primeSkill: 99, teamImportance: 99, legacy: 100 },
  "johan cruyff": { teamCareer: 97, individualCareer: 98, primeSkill: 100, teamImportance: 99, legacy: 100 },
  "franz beckenbauer": { teamCareer: 100, individualCareer: 98, primeSkill: 99, teamImportance: 100, legacy: 100 },
  ronaldo: { teamCareer: 94, individualCareer: 96, primeSkill: 100, teamImportance: 96, legacy: 99 },
  "zinedine zidane": { teamCareer: 98, individualCareer: 98, primeSkill: 100, teamImportance: 99, legacy: 100 },
  "michel platini": { teamCareer: 96, individualCareer: 99, primeSkill: 99, teamImportance: 98, legacy: 99 },
  "paolo maldini": { teamCareer: 100, individualCareer: 96, primeSkill: 99, teamImportance: 99, legacy: 100 },
  "gianluigi buffon": { teamCareer: 98, individualCareer: 97, primeSkill: 98, teamImportance: 98, legacy: 99 },
  "xavi": { teamCareer: 100, individualCareer: 96, primeSkill: 98, teamImportance: 98, legacy: 98 },
  "andres iniesta": { teamCareer: 100, individualCareer: 96, primeSkill: 99, teamImportance: 98, legacy: 99 },
  "lothar matthaus": { teamCareer: 98, individualCareer: 98, primeSkill: 98, teamImportance: 99, legacy: 99 },
  "marco van basten": { teamCareer: 94, individualCareer: 98, primeSkill: 100, teamImportance: 97, legacy: 98 },
  "cha bum-kun": { teamCareer: 94, individualCareer: 91, primeSkill: 95, teamImportance: 96, legacy: 97 },
  "차범근": { teamCareer: 94, individualCareer: 91, primeSkill: 95, teamImportance: 96, legacy: 97 },
  "손흥민": { teamCareer: 93, individualCareer: 92, primeSkill: 96, teamImportance: 96, legacy: 97 },
};

export function loadLegendData(): LegendData {
  const sourcePath = resolveSourcePath();
  const markdown = fs.readFileSync(sourcePath, "utf8");
  const players = parseLegendMarkdown(markdown);
  const countries = summarizeCountries(players);

  return { players, countries, sourcePath };
}

function resolveSourcePath() {
  const bundled = path.join(process.cwd(), "data", "football-legends.md");
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  const workspaceRoot = path.resolve(process.cwd(), "../..");
  const direct = path.join(workspaceRoot, "축구 레전드", "축구 레전드.md");

  if (fs.existsSync(direct)) {
    return direct;
  }

  const footballDir = fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.includes("축구"));

  if (!footballDir) {
    throw new Error("축구 레전드 원본 폴더를 찾지 못했습니다.");
  }

  const folderPath = path.join(workspaceRoot, footballDir.name);
  const markdownFile = fs
    .readdirSync(folderPath)
    .find((fileName) => fileName.endsWith(".md") && fileName.includes("축구"));

  if (!markdownFile) {
    throw new Error("축구 레전드 원본 마크다운을 찾지 못했습니다.");
  }

  return path.join(folderPath, markdownFile);
}

function parseLegendMarkdown(markdown: string) {
  const players: LegendPlayer[] = [];
  const positionCounts = new Map<string, number>();
  let currentRegion = "Core Nations";
  let currentCountry = "";
  let currentPosition: PositionCode = "LEGEND";

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("## ")) {
      const heading = cleanHeading(line.replace(/^##\s+/, ""));
      currentRegion = resolveRegion(heading);
      currentCountry = isRegionHeading(heading) ? "" : normalizeCountryName(heading);
      currentPosition = "LEGEND";
      continue;
    }

    if (line.startsWith("### ")) {
      const heading = cleanHeading(line.replace(/^###\s+/, ""));
      const position = extractPosition(heading);

      if (position) {
        currentPosition = position;
      } else {
        currentCountry = normalizeCountryName(stripTrailingCount(heading));
        currentPosition = "LEGEND";
      }

      continue;
    }

    if (line.startsWith("****") && !line.includes("총합")) {
      const heading = cleanHeading(line.replace(/\*/g, ""));
      if (heading) {
        currentCountry = normalizeCountryName(stripTrailingCount(heading));
        currentPosition = "LEGEND";
      }
      continue;
    }

    if (!line.startsWith("* ")) {
      continue;
    }

    const content = line.replace(/^\*\s+/, "").trim();
    const nestedPosition = extractPosition(content);

    if (nestedPosition && content.replace(nestedPosition, "").trim() === "") {
      currentPosition = nestedPosition;
      continue;
    }

    if (!currentCountry || content.includes("총합")) {
      continue;
    }

    const parsedName = parseNameAndStatus(content);
    if (!parsedName.name) {
      continue;
    }

    const positionKey = `${currentCountry}:${currentPosition}`;
    const positionOrder = (positionCounts.get(positionKey) ?? 0) + 1;
    positionCounts.set(positionKey, positionOrder);

    const player: LegendPlayer = {
      id: makePlayerId(currentCountry, parsedName.name, players.length),
      name: parsedName.name,
      country: currentCountry,
      region: currentRegion,
      primaryPosition: currentPosition,
      status: parsedName.status,
      tags: [positionLabels[currentPosition], ...parsedName.tags],
      sourceOrder: players.length + 1,
      positionOrder,
      scores: makeSeedScores({
        name: parsedName.name,
        country: currentCountry,
        position: currentPosition,
        status: parsedName.status,
        positionOrder,
      }),
    };

    players.push(player);
  }

  return players;
}

function resolveRegion(heading: string) {
  if (heading.startsWith("OTHERS:")) {
    return heading.replace("OTHERS:", "Others:");
  }

  if (heading.startsWith("EUROPE")) {
    return heading;
  }

  return "Core Nations";
}

function isRegionHeading(heading: string) {
  return heading.startsWith("OTHERS:") || heading.startsWith("EUROPE");
}

function cleanHeading(value: string) {
  return value.replace(/#+/g, "").replace(/\s+/g, " ").trim();
}

function stripTrailingCount(value: string) {
  return value.replace(/\s+\d+$/, "").trim();
}

function extractPosition(value: string): PositionCode | null {
  const token = value.trim().split(/\s+/)[0]?.toUpperCase();
  return POSITION_CODES.includes(token as PositionCode) ? (token as PositionCode) : null;
}

function normalizeCountryName(value: string) {
  const clean = value.trim();
  const map: Record<string, string> = {
    ARGENTINA: "Argentina",
    BRAZIL: "Brazil",
    GERMANY: "Germany",
    ITALY: "Italy",
    FRANCE: "France",
    SPAIN: "Spain",
    ENGLAND: "England",
    NETHERLANDS: "Netherlands",
    PORTUGAL: "Portugal",
    Belgium: "Belgium",
    KOREA: "Korea",
  };

  return map[clean] ?? clean;
}

function parseNameAndStatus(content: string): {
  name: string;
  status: PlayerStatus;
  tags: string[];
} {
  let name = content;
  let status: PlayerStatus = "confirmed";
  const tags: string[] = [];

  for (const statusPattern of STATUS_PATTERNS) {
    if (statusPattern.pattern.test(name)) {
      status = statusPattern.status;
      tags.push(statusPattern.tag);
      name = name.replace(statusPattern.pattern, "");
    }
    statusPattern.pattern.lastIndex = 0;
  }

  return {
    name: name.replace(/\s+/g, " ").trim(),
    status,
    tags,
  };
}

function makePlayerId(country: string, name: string, index: number) {
  return `${slugify(country)}-${slugify(name)}-${index + 1}`;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizedName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim();
}

function makeSeedScores({
  name,
  country,
  position,
  status,
  positionOrder,
}: {
  name: string;
  country: string;
  position: PositionCode;
  status: PlayerStatus;
  positionOrder: number;
}): PlayerScores {
  const orderBase = Math.max(58, 96 - (positionOrder - 1) * 4);
  const countryBonus = prestigeCountries.has(country) ? 2 : 0;
  const statusPenalty =
    status === "delete-candidate" ? -12 : status === "active-hold" ? -5 : status === "watch" ? -4 : 0;
  const activeBonus = status === "active-legend" ? 2 : 0;
  const attacker = ["ST", "SS", "RW", "LW", "AM"].includes(position) ? 2 : 0;
  const spine = ["GK", "CB", "DM", "CM"].includes(position) ? 2 : 0;
  const fullback = ["RB", "LB"].includes(position) ? -1 : 0;

  const scores: PlayerScores = {
    teamCareer: clampScore(orderBase + countryBonus + spine + statusPenalty + activeBonus),
    individualCareer: clampScore(orderBase + countryBonus + attacker + fullback + statusPenalty + activeBonus),
    primeSkill: clampScore(orderBase + countryBonus + attacker + statusPenalty + activeBonus),
    teamImportance: clampScore(orderBase + countryBonus + spine + statusPenalty + activeBonus),
    legacy: clampScore(orderBase + countryBonus + attacker + spine + statusPenalty + activeBonus),
  };

  const override = iconOverrides[normalizedName(name)];
  if (!override) {
    return scores;
  }

  return {
    teamCareer: override.teamCareer ?? scores.teamCareer,
    individualCareer: override.individualCareer ?? scores.individualCareer,
    primeSkill: override.primeSkill ?? scores.primeSkill,
    teamImportance: override.teamImportance ?? scores.teamImportance,
    legacy: override.legacy ?? scores.legacy,
  };
}

function clampScore(value: number) {
  return Math.min(100, Math.max(1, Math.round(value)));
}

function summarizeCountries(players: LegendPlayer[]) {
  const summaries = new Map<string, CountrySummary>();

  for (const player of players) {
    const existing =
      summaries.get(player.country) ??
      ({
        name: player.country,
        region: player.region,
        count: 0,
        positions: {},
      } satisfies CountrySummary);

    existing.count += 1;
    existing.positions[player.primaryPosition] = (existing.positions[player.primaryPosition] ?? 0) + 1;
    summaries.set(player.country, existing);
  }

  return Array.from(summaries.values()).sort((a, b) => {
    const regionCompare = a.region.localeCompare(b.region);
    if (regionCompare !== 0) {
      return regionCompare;
    }

    return b.count - a.count || a.name.localeCompare(b.name);
  });
}
