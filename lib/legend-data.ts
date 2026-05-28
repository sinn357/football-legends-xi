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

export type Continent = "America" | "Europe" | "Asia" | "Africa";

export type PlayerProfileSection = {
  score: number;
  grade: string;
  title: string;
  bullets: string[];
  explanation: string;
};

export type PlayerProfile = {
  isCurated: boolean;
  summary: string;
  sections: Record<ScoreKey, PlayerProfileSection>;
};

export type LegendPlayer = {
  id: string;
  name: string;
  country: string;
  continent: Continent;
  region: string;
  primaryPosition: PositionCode;
  status: PlayerStatus;
  tags: string[];
  topTierRank: number | null;
  sourceOrder: number;
  positionOrder: number;
  scores: PlayerScores;
  profile: PlayerProfile;
};

export type CountrySummary = {
  name: string;
  continent: Continent;
  region: string;
  count: number;
  positions: Partial<Record<PositionCode, number>>;
};

export type ContinentSummary = {
  name: Continent;
  count: number;
  countries: CountrySummary[];
};

export type LegendData = {
  players: LegendPlayer[];
  countries: CountrySummary[];
  continents: ContinentSummary[];
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
  "차범근": { teamCareer: 94, individualCareer: 91, primeSkill: 95, teamImportance: 96, legacy: 97 },
  "손흥민": { teamCareer: 93, individualCareer: 92, primeSkill: 96, teamImportance: 96, legacy: 97 },
};

const topTierNames = [
  "Lionel Messi",
  "Pele",
  "Diego Maradona",
  "Cristiano Ronaldo",
  "Johan Cruyff",
  "Franz Beckenbauer",
  "Ronaldo",
  "Zinedine Zidane",
  "Michel Platini",
  "Alfredo Di Stefano",
  "Paolo Maldini",
  "Marco Van Basten",
  "Gerd Muller",
  "Eusebio",
  "Garrincha",
  "Ronaldinho",
  "Romário",
  "Xavi",
  "Andres Iniesta",
  "Lothar Matthaus",
  "Gianluigi Buffon",
  "Franco Baresi",
  "Roberto Baggio",
  "Zico",
  "Neymar",
  "Thierry Henry",
  "Ferenc Puskas",
  "George Best",
  "Bobby Charlton",
  "Bobby Moore",
  "Lev Yashin",
  "Manuel Neuer",
  "Kylian Mbappe",
  "Luka Modrić",
  "Andrea Pirlo",
  "Sergio Ramos",
  "Cafu",
  "Roberto Carlos",
  "Didi",
  "Rivaldo",
  "Ruud Gullit",
  "Frank Rijkaard",
  "Dennis Bergkamp",
  "Luis Figo",
  "Karim Benzema",
  "Kevin De Bruyne",
  "손흥민",
  "차범근",
  "박지성",
  "홍명보",
];

const topTierRankByName = new Map(topTierNames.map((name, index) => [normalizedName(name), index + 1]));

export function loadLegendData(): LegendData {
  const sourcePath = resolveSourcePath();
  const markdown = fs.readFileSync(sourcePath, "utf8");
  const players = parseLegendMarkdown(markdown);
  const countries = summarizeCountries(players);
  const continents = summarizeContinents(countries);

  return { players, countries, continents, sourcePath };
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

    const scores = makeSeedScores({
      name: parsedName.name,
      country: currentCountry,
      position: currentPosition,
      status: parsedName.status,
      positionOrder,
    });

    const player: LegendPlayer = {
      id: makePlayerId(currentCountry, parsedName.name, players.length),
      name: parsedName.name,
      country: currentCountry,
      continent: getContinent(currentCountry),
      region: currentRegion,
      primaryPosition: currentPosition,
      status: parsedName.status,
      tags: [positionLabels[currentPosition], ...parsedName.tags],
      topTierRank: topTierRankByName.get(normalizedName(parsedName.name)) ?? null,
      sourceOrder: players.length + 1,
      positionOrder,
      scores,
      profile: makePlayerProfile(parsedName.name, currentCountry, currentPosition, parsedName.status, scores),
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
    KOREA: "South Korea",
    "우루과이": "Uruguay",
    "칠레": "Chile",
    "페루": "Peru",
    "콜롬비아": "Colombia",
    "멕시코": "Mexico",
    "파라과이": "Paraguay",
    "트리니다드 토바고": "Trinidad and Tobago",
    "미국": "United States",
    "오스트레일리아": "Australia",
    "코스타리카": "Costa Rica",
    "스위스": "Switzerland",
    "불가리아": "Bulgaria",
    "크로아티아": "Croatia",
    "루마니아": "Romania",
    "우크라이나": "Ukraine",
    "러시아": "Russia",
    "보스니아": "Bosnia and Herzegovina",
    "폴란드": "Poland",
    "세르비아": "Serbia",
    "몬테네그로": "Montenegro",
    "헝가리": "Hungary",
    "오스트리아": "Austria",
    "체코": "Czech Republic",
    "슬로베니아": "Slovenia",
    "슬로바키아": "Slovakia",
    "아르메니아": "Armenia",
    "북아일랜드": "Northern Ireland",
    "스코틀랜드": "Scotland",
    "웨일스": "Wales",
    "아일랜드": "Ireland",
    "아이슬란드": "Iceland",
    "노르웨이": "Norway",
    "덴마크": "Denmark",
    "스웨덴": "Sweden",
    "핀란드": "Finland",
    "일본": "Japan",
    "이란": "Iran",
    "가나": "Ghana",
    "나이지리아": "Nigeria",
    "카메룬": "Cameroon",
    "코트디부아르": "Cote d'Ivoire",
    "라이베리아": "Liberia",
    "남아공": "South Africa",
    "세네갈": "Senegal",
    "모로코": "Morocco",
    "가봉": "Gabon",
    "이집트": "Egypt",
    "알제리": "Algeria",
  };

  return map[clean] ?? clean;
}

function getContinent(country: string): Continent {
  const america = new Set([
    "Argentina",
    "Brazil",
    "Uruguay",
    "Chile",
    "Peru",
    "Colombia",
    "Mexico",
    "Paraguay",
    "Trinidad and Tobago",
    "United States",
    "Costa Rica",
  ]);

  const asia = new Set(["South Korea", "Japan", "Iran", "Australia"]);
  const africa = new Set([
    "Ghana",
    "Nigeria",
    "Cameroon",
    "Cote d'Ivoire",
    "Liberia",
    "South Africa",
    "Senegal",
    "Morocco",
    "Gabon",
    "Egypt",
    "Algeria",
  ]);

  if (asia.has(country)) {
    return "Asia";
  }

  if (africa.has(country)) {
    return "Africa";
  }

  if (america.has(country)) {
    return "America";
  }

  return "Europe";
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

function makePlayerProfile(
  name: string,
  country: string,
  position: PositionCode,
  status: PlayerStatus,
  scores: PlayerScores,
): PlayerProfile {
  const topTierRank = topTierRankByName.get(normalizedName(name)) ?? null;
  const isCurated = topTierRank !== null;
  const statusNote =
    status === "active-hold"
      ? "현역 커리어가 진행 중이라 최종 평가는 보류된 상태입니다."
      : status === "delete-candidate"
        ? "원본 리스트에서 삭제 후보로 표시되어 재검토가 필요한 선수입니다."
        : "레전드 풀에 포함된 선수입니다.";

  const summary = isCurated
    ? `${name}는 ${country} 레전드 풀의 핵심 티어로 우선 큐레이션된 선수입니다. 현재 상세 평가는 앱 내부 기준인 팀 커리어, 개인 수상, 프라임 실력, 팀 내 비중, 장기 존재감으로 분리해 보여줍니다.`
    : `${name}는 ${country}의 ${positionLabels[position]} 후보입니다. 상세 리서치 메모는 아직 확장 전이지만, 빌더와 랭킹에서는 동일하게 사용할 수 있습니다. ${statusNote}`;

  return {
    isCurated,
    summary,
    sections: {
      teamCareer: makeProfileSection({
        score: scores.teamCareer,
        title: "팀 커리어",
        bullets: [
          isCurated ? "클럽/국가대표 커리어의 팀 성과를 우선 검토할 핵심 선수입니다." : "주요 우승 및 대표팀 성과를 추가 기록할 예정입니다.",
          "리그, 국제 대회, 국가대표 토너먼트 성과를 별도 축으로 분리합니다.",
        ],
        explanation: "팀 커리어 점수는 소속 팀의 우승, 장기 지배력, 국가대표 성취를 함께 반영하는 축입니다.",
      }),
      individualCareer: makeProfileSection({
        score: scores.individualCareer,
        title: "개인 수상",
        bullets: [
          isCurated ? "개인상과 시즌 베스트급 평가를 우선 큐레이션 대상으로 둡니다." : "개인상, 득점왕, 베스트11 등 세부 수상 기록을 보강할 예정입니다.",
          "공격수와 창조형 선수는 개인 수상 영향이 상대적으로 크게 반영됩니다.",
        ],
        explanation: "개인 수상 점수는 발롱도르급 평가, 리그/대회 개인상, 시대별 개인 인지도를 보는 축입니다.",
      }),
      primeSkill: makeProfileSection({
        score: scores.primeSkill,
        title: "프라임 실력",
        bullets: [
          isCurated ? "전성기 단기 고점이 논쟁의 중심이 되는 선수로 우선 표시합니다." : "전성기 시즌과 강점 메모를 추가할 예정입니다.",
          "순수 기량, 경기 지배력, 포지션 내 희소성을 같이 봅니다.",
        ],
        explanation: "프라임 실력은 누적 커리어와 분리해, 전성기 퍼포먼스의 고점만 따로 보는 축입니다.",
      }),
      teamImportance: makeProfileSection({
        score: scores.teamImportance,
        title: "팀 내 비중",
        bullets: [
          isCurated ? "소속 팀 또는 대표팀에서의 에이스성/중심성을 우선 평가합니다." : "팀 내 역할과 핵심도 메모를 추가할 예정입니다.",
          "우승팀의 일부였는지, 우승팀을 끌고 간 축이었는지를 구분합니다.",
        ],
        explanation: "팀 내 비중은 커리어 성과 안에서 해당 선수가 차지한 책임과 영향력을 보는 축입니다.",
      }),
      legacy: makeProfileSection({
        score: scores.legacy,
        title: "100년 뒤 존재감",
        bullets: [
          isCurated ? "역사적 기억에 남을 가능성이 큰 선수로 우선 큐레이션했습니다." : "장기적 존재감은 상세 리서치 후 조정할 예정입니다.",
          "기록, 서사, 전술사적 의미, 국가 대표성을 함께 봅니다.",
        ],
        explanation: "장기 존재감은 지금의 실력 평가를 넘어 축구사에서 계속 호출될 가능성을 보는 축입니다.",
      }),
    },
  };
}

function makeProfileSection({
  score,
  title,
  bullets,
  explanation,
}: {
  score: number;
  title: string;
  bullets: string[];
  explanation: string;
}): PlayerProfileSection {
  return {
    score,
    grade: score >= 97 ? "S+" : score >= 92 ? "S" : score >= 86 ? "A" : score >= 78 ? "B" : "C",
    title,
    bullets,
    explanation,
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
        continent: player.continent,
        region: player.region,
        count: 0,
        positions: {},
      } satisfies CountrySummary);

    existing.count += 1;
    existing.positions[player.primaryPosition] = (existing.positions[player.primaryPosition] ?? 0) + 1;
    summaries.set(player.country, existing);
  }

  return Array.from(summaries.values()).sort((a, b) => {
    const continentCompare = continentOrder(a.continent) - continentOrder(b.continent);
    if (continentCompare !== 0) {
      return continentCompare;
    }

    return b.count - a.count || a.name.localeCompare(b.name);
  });
}

function summarizeContinents(countries: CountrySummary[]) {
  const continentNames: Continent[] = ["America", "Europe", "Asia", "Africa"];

  return continentNames.map((name) => {
    const continentCountries = countries.filter((country) => country.continent === name);
    return {
      name,
      count: continentCountries.reduce((sum, country) => sum + country.count, 0),
      countries: continentCountries,
    };
  });
}

function continentOrder(continent: Continent) {
  const order: Record<Continent, number> = {
    America: 0,
    Europe: 1,
    Asia: 2,
    Africa: 3,
  };

  return order[continent];
}
