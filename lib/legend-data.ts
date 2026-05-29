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
export type ScoreMode = "anchor" | "computed" | "adjusted";

export type Continent = "America" | "Europe" | "Asia" | "Africa";

export type PlayerProfileSection = {
  score: number;
  grade: string;
  title: string;
  verdict?: string;
  facts?: Array<{
    label: string;
    items: string[];
  }>;
  bullets: string[];
  explanation: string;
  caveat?: string;
};

export type PlayerProfileSource = {
  label: string;
  url: string;
};

export type PlayerProfile = {
  isCurated: boolean;
  summary: string;
  sections: Record<ScoreKey, PlayerProfileSection>;
  sources: PlayerProfileSource[];
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
  overallScore: number;
  scoreMode: ScoreMode;
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

type ScoreOverride = Partial<PlayerScores> & {
  overallScore?: number;
  scoreMode?: ScoreMode;
  scores?: Partial<PlayerScores>;
};

const scoreOverrides: Record<string, ScoreOverride> = {
  pele: {
    overallScore: 98,
    scoreMode: "anchor",
    scores: { teamCareer: 98, individualCareer: 98, primeSkill: 99, teamImportance: 99, legacy: 100 },
  },
  "lionel messi": {
    overallScore: 99,
    scoreMode: "anchor",
    scores: { teamCareer: 99, individualCareer: 100, primeSkill: 100, teamImportance: 100, legacy: 100 },
  },
  "diego maradona": {
    overallScore: 98,
    scoreMode: "anchor",
    scores: { teamCareer: 91, individualCareer: 96, primeSkill: 100, teamImportance: 100, legacy: 100 },
  },
  "cristiano ronaldo": {
    overallScore: 97,
    scoreMode: "anchor",
    scores: { teamCareer: 100, individualCareer: 99, primeSkill: 98, teamImportance: 98, legacy: 100 },
  },
  "johan cruyff": {
    overallScore: 97,
    scoreMode: "anchor",
    scores: { teamCareer: 95, individualCareer: 97, primeSkill: 98, teamImportance: 99, legacy: 100 },
  },
  "franz beckenbauer": {
    overallScore: 96,
    scoreMode: "anchor",
    scores: { teamCareer: 99, individualCareer: 97, primeSkill: 97, teamImportance: 98, legacy: 99 },
  },
  "ferenc puskas": {
    overallScore: 96,
    scoreMode: "anchor",
    scores: { teamCareer: 95, individualCareer: 96, primeSkill: 98, teamImportance: 98, legacy: 98 },
  },
  ronaldo: {
    overallScore: 96,
    scoreMode: "anchor",
    scores: { teamCareer: 91, individualCareer: 95, primeSkill: 100, teamImportance: 96, legacy: 99 },
  },
  "zinedine zidane": {
    overallScore: 96,
    scoreMode: "anchor",
    scores: { teamCareer: 97, individualCareer: 96, primeSkill: 98, teamImportance: 99, legacy: 99 },
  },
  "michel platini": { teamCareer: 96, individualCareer: 99, primeSkill: 99, teamImportance: 98, legacy: 99 },
  "paolo maldini": { teamCareer: 100, individualCareer: 96, primeSkill: 99, teamImportance: 99, legacy: 100 },
  "gianluigi buffon": { teamCareer: 98, individualCareer: 97, primeSkill: 98, teamImportance: 98, legacy: 99 },
  "xavi": { teamCareer: 100, individualCareer: 96, primeSkill: 98, teamImportance: 98, legacy: 98 },
  "andres iniesta": { teamCareer: 100, individualCareer: 96, primeSkill: 99, teamImportance: 98, legacy: 99 },
  "lothar matthaus": { teamCareer: 98, individualCareer: 98, primeSkill: 98, teamImportance: 99, legacy: 99 },
  "marco van basten": { teamCareer: 94, individualCareer: 98, primeSkill: 100, teamImportance: 97, legacy: 98 },
  "alfredo di stefano": {
    overallScore: 96,
    scoreMode: "anchor",
    scores: { teamCareer: 97, individualCareer: 97, primeSkill: 98, teamImportance: 98, legacy: 99 },
  },
  garrincha: {
    overallScore: 95,
    scoreMode: "adjusted",
    scores: { teamCareer: 96, individualCareer: 94, primeSkill: 98, teamImportance: 96, legacy: 98 },
  },
  zico: {
    overallScore: 95,
    scoreMode: "adjusted",
    scores: { teamCareer: 90, individualCareer: 95, primeSkill: 98, teamImportance: 98, legacy: 97 },
  },
  ronaldinho: {
    overallScore: 95,
    scoreMode: "adjusted",
    scores: { teamCareer: 95, individualCareer: 97, primeSkill: 98, teamImportance: 94, legacy: 98 },
  },
  romario: {
    overallScore: 95,
    scoreMode: "adjusted",
    scores: { teamCareer: 94, individualCareer: 96, primeSkill: 97, teamImportance: 95, legacy: 96 },
  },
  neymar: {
    overallScore: 94,
    scoreMode: "adjusted",
    scores: { teamCareer: 94, individualCareer: 94, primeSkill: 97, teamImportance: 96, legacy: 95 },
  },
  "차범근": {
    overallScore: 90,
    scoreMode: "adjusted",
    scores: { teamCareer: 89, individualCareer: 88, primeSkill: 91, teamImportance: 92, legacy: 94 },
  },
  "손흥민": {
    overallScore: 92,
    scoreMode: "adjusted",
    scores: { teamCareer: 88, individualCareer: 92, primeSkill: 94, teamImportance: 94, legacy: 94 },
  },
  "박지성": {
    overallScore: 88,
    scoreMode: "adjusted",
    scores: { teamCareer: 94, individualCareer: 82, primeSkill: 88, teamImportance: 90, legacy: 91 },
  },
  "홍명보": {
    overallScore: 88,
    scoreMode: "adjusted",
    scores: { teamCareer: 86, individualCareer: 88, primeSkill: 88, teamImportance: 94, legacy: 93 },
  },
  "황선홍": {
    overallScore: 85,
    scoreMode: "adjusted",
    scores: { teamCareer: 84, individualCareer: 84, primeSkill: 87, teamImportance: 90, legacy: 88 },
  },
  "이동국": {
    overallScore: 85,
    scoreMode: "adjusted",
    scores: { teamCareer: 88, individualCareer: 88, primeSkill: 86, teamImportance: 88, legacy: 86 },
  },
  "안정환": {
    overallScore: 84,
    scoreMode: "adjusted",
    scores: { teamCareer: 81, individualCareer: 82, primeSkill: 86, teamImportance: 90, legacy: 90 },
  },
  "김주성": {
    overallScore: 87,
    scoreMode: "adjusted",
    scores: { teamCareer: 85, individualCareer: 91, primeSkill: 88, teamImportance: 89, legacy: 91 },
  },
  "유상철": {
    overallScore: 86,
    scoreMode: "adjusted",
    scores: { teamCareer: 84, individualCareer: 84, primeSkill: 87, teamImportance: 92, legacy: 89 },
  },
  "기성용": {
    overallScore: 85,
    scoreMode: "adjusted",
    scores: { teamCareer: 86, individualCareer: 84, primeSkill: 86, teamImportance: 88, legacy: 87 },
  },
  "이영표": {
    overallScore: 86,
    scoreMode: "adjusted",
    scores: { teamCareer: 88, individualCareer: 83, primeSkill: 86, teamImportance: 89, legacy: 89 },
  },
  "김민재": {
    overallScore: 89,
    scoreMode: "adjusted",
    scores: { teamCareer: 90, individualCareer: 89, primeSkill: 91, teamImportance: 89, legacy: 89 },
  },
  "이운재": {
    overallScore: 87,
    scoreMode: "adjusted",
    scores: { teamCareer: 90, individualCareer: 87, primeSkill: 87, teamImportance: 91, legacy: 90 },
  },
  "김병지": {
    overallScore: 84,
    scoreMode: "adjusted",
    scores: { teamCareer: 82, individualCareer: 86, primeSkill: 86, teamImportance: 86, legacy: 88 },
  },
  "오카자키 신지": {
    overallScore: 86,
    scoreMode: "adjusted",
    scores: { teamCareer: 89, individualCareer: 84, primeSkill: 86, teamImportance: 87, legacy: 87 },
  },
  "미우라 카즈요시": {
    overallScore: 87,
    scoreMode: "adjusted",
    scores: { teamCareer: 86, individualCareer: 88, primeSkill: 88, teamImportance: 91, legacy: 92 },
  },
  "카마모토 쿠니시게": {
    overallScore: 87,
    scoreMode: "adjusted",
    scores: { teamCareer: 84, individualCareer: 91, primeSkill: 89, teamImportance: 91, legacy: 93 },
  },
  "미토마 카오루": {
    overallScore: 84,
    scoreMode: "adjusted",
    scores: { teamCareer: 82, individualCareer: 83, primeSkill: 88, teamImportance: 85, legacy: 85 },
  },
  "쿠보 타케후사": {
    overallScore: 84,
    scoreMode: "adjusted",
    scores: { teamCareer: 82, individualCareer: 84, primeSkill: 88, teamImportance: 85, legacy: 86 },
  },
  "오노 신지": {
    overallScore: 85,
    scoreMode: "adjusted",
    scores: { teamCareer: 87, individualCareer: 86, primeSkill: 88, teamImportance: 86, legacy: 88 },
  },
  "엔도 야스히토": {
    overallScore: 88,
    scoreMode: "adjusted",
    scores: { teamCareer: 90, individualCareer: 90, primeSkill: 88, teamImportance: 91, legacy: 92 },
  },
  "하세베 마코토": {
    overallScore: 87,
    scoreMode: "adjusted",
    scores: { teamCareer: 91, individualCareer: 84, primeSkill: 86, teamImportance: 91, legacy: 90 },
  },
  "엔도 와타루": {
    overallScore: 84,
    scoreMode: "adjusted",
    scores: { teamCareer: 86, individualCareer: 83, primeSkill: 86, teamImportance: 87, legacy: 85 },
  },
  "나가토모 유토": {
    overallScore: 86,
    scoreMode: "adjusted",
    scores: { teamCareer: 87, individualCareer: 86, primeSkill: 87, teamImportance: 89, legacy: 89 },
  },
  "우치다 아쓰토": {
    overallScore: 84,
    scoreMode: "adjusted",
    scores: { teamCareer: 86, individualCareer: 82, primeSkill: 86, teamImportance: 86, legacy: 85 },
  },
  "나카자와 유지": {
    overallScore: 85,
    scoreMode: "adjusted",
    scores: { teamCareer: 87, individualCareer: 86, primeSkill: 86, teamImportance: 89, legacy: 88 },
  },
  "이하라 마사미": {
    overallScore: 87,
    scoreMode: "adjusted",
    scores: { teamCareer: 87, individualCareer: 90, primeSkill: 88, teamImportance: 92, legacy: 91 },
  },
  "요시다 마야": {
    overallScore: 85,
    scoreMode: "adjusted",
    scores: { teamCareer: 85, individualCareer: 83, primeSkill: 86, teamImportance: 90, legacy: 88 },
  },
  "토미야스 타케히로": {
    overallScore: 84,
    scoreMode: "adjusted",
    scores: { teamCareer: 84, individualCareer: 82, primeSkill: 88, teamImportance: 86, legacy: 85 },
  },
  "가와구치 요시카쓰": {
    overallScore: 86,
    scoreMode: "adjusted",
    scores: { teamCareer: 86, individualCareer: 86, primeSkill: 87, teamImportance: 90, legacy: 90 },
  },
  "가와시마 에이지": {
    overallScore: 84,
    scoreMode: "adjusted",
    scores: { teamCareer: 84, individualCareer: 83, primeSkill: 85, teamImportance: 88, legacy: 87 },
  },
  "나카타 히데토시": {
    overallScore: 87,
    scoreMode: "adjusted",
    scores: { teamCareer: 85, individualCareer: 89, primeSkill: 90, teamImportance: 90, legacy: 92 },
  },
  "혼다 케이스케": {
    overallScore: 86,
    scoreMode: "adjusted",
    scores: { teamCareer: 84, individualCareer: 87, primeSkill: 88, teamImportance: 91, legacy: 90 },
  },
  "나카무라 슌스케": {
    overallScore: 86,
    scoreMode: "adjusted",
    scores: { teamCareer: 86, individualCareer: 88, primeSkill: 89, teamImportance: 88, legacy: 89 },
  },
  "카가와 신지": {
    overallScore: 85,
    scoreMode: "adjusted",
    scores: { teamCareer: 90, individualCareer: 85, primeSkill: 88, teamImportance: 85, legacy: 86 },
  },
  "ali daei": {
    overallScore: 88,
    scoreMode: "adjusted",
    scores: { teamCareer: 82, individualCareer: 91, primeSkill: 90, teamImportance: 94, legacy: 95 },
  },
  "tim cahill": {
    overallScore: 85,
    scoreMode: "adjusted",
    scores: { teamCareer: 84, individualCareer: 84, primeSkill: 86, teamImportance: 91, legacy: 89 },
  },
  "abedi pele": {
    overallScore: 92,
    scoreMode: "adjusted",
    scores: { teamCareer: 91, individualCareer: 92, primeSkill: 93, teamImportance: 92, legacy: 93 },
  },
  "michael essien": { teamCareer: 92, individualCareer: 86, primeSkill: 92, teamImportance: 93, legacy: 90 },
  "samuel kuffour": { teamCareer: 91, individualCareer: 82, primeSkill: 88, teamImportance: 90, legacy: 87 },
  "jay jay okocha": { teamCareer: 82, individualCareer: 86, primeSkill: 95, teamImportance: 89, legacy: 91 },
  "nwankwo kanu": { teamCareer: 91, individualCareer: 89, primeSkill: 91, teamImportance: 88, legacy: 90 },
  "samuel eto o": {
    overallScore: 95,
    scoreMode: "adjusted",
    scores: { teamCareer: 97, individualCareer: 95, primeSkill: 95, teamImportance: 95, legacy: 95 },
  },
  "roger milla": {
    overallScore: 92,
    scoreMode: "adjusted",
    scores: { teamCareer: 88, individualCareer: 91, primeSkill: 91, teamImportance: 95, legacy: 96 },
  },
  "thomas n kono": { teamCareer: 86, individualCareer: 90, primeSkill: 92, teamImportance: 93, legacy: 91 },
  "didier drogba": {
    overallScore: 93,
    scoreMode: "adjusted",
    scores: { teamCareer: 94, individualCareer: 91, primeSkill: 94, teamImportance: 96, legacy: 94 },
  },
  "yaya toure": {
    overallScore: 93,
    scoreMode: "adjusted",
    scores: { teamCareer: 95, individualCareer: 93, primeSkill: 94, teamImportance: 93, legacy: 92 },
  },
  "kolo toure": { teamCareer: 93, individualCareer: 82, primeSkill: 87, teamImportance: 89, legacy: 87 },
  "george weah": {
    overallScore: 95,
    scoreMode: "adjusted",
    scores: { teamCareer: 89, individualCareer: 97, primeSkill: 96, teamImportance: 95, legacy: 98 },
  },
  "lucas radebe": { teamCareer: 78, individualCareer: 76, primeSkill: 86, teamImportance: 95, legacy: 87 },
  "sadio mane": {
    overallScore: 93,
    scoreMode: "adjusted",
    scores: { teamCareer: 94, individualCareer: 93, primeSkill: 93, teamImportance: 94, legacy: 93 },
  },
  "kalidou koulibaly": { teamCareer: 88, individualCareer: 87, primeSkill: 92, teamImportance: 93, legacy: 91 },
  "achraf hakimi": { teamCareer: 95, individualCareer: 88, primeSkill: 93, teamImportance: 91, legacy: 91 },
  "hakim ziyach": { teamCareer: 90, individualCareer: 84, primeSkill: 90, teamImportance: 88, legacy: 86 },
  "pierre emerick aubameyang": { teamCareer: 86, individualCareer: 91, primeSkill: 94, teamImportance: 93, legacy: 91 },
  "mohamed salah": {
    overallScore: 95,
    scoreMode: "adjusted",
    scores: { teamCareer: 95, individualCareer: 96, primeSkill: 96, teamImportance: 96, legacy: 95 },
  },
  "riyad mahrez": { teamCareer: 100, individualCareer: 94, primeSkill: 96, teamImportance: 94, legacy: 94 },
  "rabah madjer": { teamCareer: 92, individualCareer: 90, primeSkill: 93, teamImportance: 95, legacy: 94 },
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

type CuratedProfileEntry = {
  summary: string;
  sections: Record<
    ScoreKey,
    {
      bullets: string[];
      caveat?: string;
      explanation: string;
      facts?: Array<{ label: string; items: string[] }>;
      verdict?: string;
    }
  >;
  sources: PlayerProfileSource[];
};

const commonAfricaSources: PlayerProfileSource[] = [
  { label: "RSSSF African Player of the Year", url: "https://www.rsssf.org/miscellaneous/afr-poy.html" },
];

type FocusedProfileInput = {
  summary: string;
  team: {
    clubs: string[];
    clubHonours: string[];
    nationalHonours: string[];
    verdict: string;
  };
  individual: {
    awards: string[];
    records: string[];
    verdict: string;
  };
  prime: {
    period: string;
    evidence: string[];
    skills: string[];
    verdict: string;
  };
  importance: {
    roles: string[];
    moments: string[];
    verdict: string;
  };
  legacy: {
    reasons: string[];
    context: string[];
    verdict: string;
  };
  sources: PlayerProfileSource[];
};

function makeFocusedProfile(input: FocusedProfileInput): CuratedProfileEntry {
  return {
    summary: input.summary,
    sections: {
      teamCareer: {
        explanation: "소속팀 전체와 팀 우승, 대표팀 성과를 분리해 정리한 프로필입니다.",
        verdict: input.team.verdict,
        facts: [
          { label: "소속팀", items: input.team.clubs },
          { label: "클럽 우승", items: input.team.clubHonours },
          { label: "대표팀 성과", items: input.team.nationalHonours },
        ],
        bullets: ["클럽 우승 총량과 대표팀 역사적 성과를 분리해서 봅니다.", "우승팀에서의 역할은 팀 내 비중 섹션에서 다시 판단합니다."],
      },
      individualCareer: {
        explanation: "개인상, 득점/선정 기록, 세계/대륙 단위 평가를 분리해 정리한 프로필입니다.",
        verdict: input.individual.verdict,
        facts: [
          { label: "주요 개인 수상/선정", items: input.individual.awards },
          { label: "득점/기록/순위", items: input.individual.records },
        ],
        bullets: ["수상, 후보, 베스트 XI, 기록은 서로 다른 무게로 반영합니다.", "포지션과 시대에 따른 개인상 불균형을 감안합니다."],
      },
      primeSkill: {
        explanation: "전성기 기간과 그 시기의 경기력 근거, 반복된 기술 프로필을 분리해 정리한 프로필입니다.",
        verdict: input.prime.verdict,
        facts: [
          { label: "프라임 기간", items: [input.prime.period] },
          { label: "프라임 근거", items: input.prime.evidence },
          { label: "스킬 프로필", items: input.prime.skills },
        ],
        bullets: ["프라임 실력은 누적 커리어와 별도로 봅니다.", "큰 경기에서 반복된 영향력을 중요하게 반영합니다."],
      },
      teamImportance: {
        explanation: "클럽과 대표팀에서 전술적 중심이었는지, 역사적 장면을 직접 만든 선수였는지 정리한 프로필입니다.",
        verdict: input.importance.verdict,
        facts: [
          { label: "팀별 역할", items: input.importance.roles },
          { label: "결정적 장면", items: input.importance.moments },
        ],
        bullets: ["빅클럽 소속과 대체 불가능성은 구분합니다.", "국가대표 전력 차이가 큰 선수는 대표팀 비중을 별도로 높게 봅니다."],
      },
      legacy: {
        explanation: "100년 뒤에도 반복 소환될 기록, 상징성, 비교 기준을 정리한 프로필입니다.",
        verdict: input.legacy.verdict,
        facts: [
          { label: "장기 보존 근거", items: input.legacy.reasons },
          { label: "비교 맥락", items: input.legacy.context },
        ],
        bullets: ["레거시는 인기보다 반복 소환 가능한 역사적 근거를 우선합니다.", "국가, 대륙, 포지션 기준점을 함께 봅니다."],
      },
    },
    sources: input.sources,
  };
}

const focusedNonEuropeProfileOverrides: Record<string, CuratedProfileEntry> = {
  "손흥민": makeFocusedProfile({
    summary:
      "Son Heung-min은 Premier League Golden Boot, FIFA Puskas Award, Tottenham 주장 커리어를 가진 한국 축구의 현대 기준점입니다.",
    team: {
      clubs: ["Hamburger SV", "Bayer Leverkusen", "Tottenham Hotspur", "South Korea U23", "South Korea national team"],
      clubHonours: ["Tottenham Hotspur: UEFA Europa League 2024-25; runner-up UEFA Champions League 2018-19"],
      nationalHonours: ["South Korea U23: Asian Games gold medal 2018", "South Korea: AFC Asian Cup runner-up 2015", "South Korea: FIFA World Cup appearances 2014, 2018, 2022"],
      verdict: "팀 커리어 우승 총량은 제한적이지만, 유럽 최상위 리그에서의 장기 핵심성과 대표팀 상징성이 매우 큽니다.",
    },
    individual: {
      awards: ["Premier League Golden Boot: 2021-22 shared", "FIFA Puskas Award: 2020", "AFC Asian International Player of the Year: 2015, 2017, 2019, 2023"],
      records: ["First Asian player to win the Premier League Golden Boot", "First Asian player in the Premier League 100-goal club", "Tottenham all-time leading non-British goalscorer"],
      verdict: "아시아 선수 개인 커리어 기준으로는 최상위권입니다.",
    },
    prime: {
      period: "2018-19 to 2021-22 Tottenham, plus Korea captaincy peak",
      evidence: ["2018-19 Champions League final run", "2021-22 Premier League 23 non-penalty goals, Golden Boot shared", "2020 Puskas-winning Burnley solo goal"],
      skills: ["Two-footed finishing", "elite transition speed", "off-ball runs behind the line", "wide forward pressing", "captain-level responsibility for Korea"],
      verdict: "아시아 공격수 프라임으로는 역대 최고 논쟁권입니다.",
    },
    importance: {
      roles: ["Tottenham: Kane-Son era final-third production axis", "South Korea: long-term captain and attacking focal point"],
      moments: ["2018 Asian Games title as senior star", "2019 Champions League knockout contributions", "2022 World Cup assist vs Portugal to reach last 16"],
      verdict: "클럽과 대표팀 양쪽에서 공격 생산과 상징성을 동시에 짊어진 선수입니다.",
    },
    legacy: {
      reasons: ["Premier League Golden Boot as an Asian first", "Puskas Award", "Premier League 100 Club", "South Korea captaincy across multiple World Cups"],
      context: ["Asia all-time best player debate with Cha Bum-kun", "Modern Premier League Asian benchmark"],
      verdict: "100년 뒤에도 아시아 축구의 글로벌 성공 사례로 반복 소환될 이름입니다.",
    },
    sources: [
      { label: "FIFA - Son Heung-min records", url: "https://www.fifa.com/en/articles/fifa.com/en/articles/son-heungmin-stats-quotes-records" },
      { label: "Premier League - Son legacy", url: "https://www.premierleague.com/en/news/4365044/son-heung-min-legacy-at-tottenham-hotspur-records-awards-goals-assists-trophy" },
      { label: "Wikipedia - Son Heung-min", url: "https://en.wikipedia.org/wiki/Son_Heung-min" },
    ],
  }),
  "차범근": makeFocusedProfile({
    summary:
      "Cha Bum-kun은 Bundesliga와 UEFA Cup에서 성공한 한국 축구의 원형적 유럽파 스타입니다. 1970-80년대 아시아 공격수 기준을 유럽에서 직접 올린 선수입니다.",
    team: {
      clubs: ["Korea Trust Bank", "Air Force", "Darmstadt 98", "Eintracht Frankfurt", "Bayer Leverkusen", "South Korea national team"],
      clubHonours: ["Eintracht Frankfurt: UEFA Cup 1979-80, DFB-Pokal 1980-81", "Bayer Leverkusen: UEFA Cup 1987-88"],
      nationalHonours: ["South Korea: AFC Asian Cup runner-up 1972", "South Korea: FIFA World Cup 1986 participant"],
      verdict: "UEFA Cup 2회 우승은 아시아 선수 팀 커리어 역사에서 매우 강한 근거입니다.",
    },
    individual: {
      awards: ["Bundesliga Team of the Season by kicker: 1979-80", "South Korean Footballer of the Year: 1973", "IFFHS Asian Player of the 20th Century high ranking"],
      records: ["Former highest-scoring foreign player in Bundesliga history", "South Korea all-time top scorer for decades"],
      verdict: "공식 개인상 총량보다 독일 무대 장기 득점 기록과 시대 보정이 중요합니다.",
    },
    prime: {
      period: "1979-80 Eintracht Frankfurt to 1987-88 Bayer Leverkusen",
      evidence: ["UEFA Cup 1979-80 with Frankfurt", "DFB-Pokal 1980-81 scoring run", "UEFA Cup 1987-88 with Leverkusen"],
      skills: ["Explosive acceleration", "direct ball carrying", "two-footed shooting", "wide striker movement", "counter-attacking finishing"],
      verdict: "동시대 유럽 리그에서 검증된 아시아 최고급 프라임입니다.",
    },
    importance: {
      roles: ["Eintracht Frankfurt: direct attacking outlet", "Bayer Leverkusen: veteran attacking leader", "South Korea: national-team scoring icon"],
      moments: ["1979-80 UEFA Cup run", "1987-88 UEFA Cup success with Leverkusen"],
      verdict: "한국 축구가 유럽 정상권에서도 통할 수 있다는 선례를 만든 선수입니다.",
    },
    legacy: {
      reasons: ["Two UEFA Cups", "Bundesliga Asian pioneer status", "South Korea scoring icon before the modern global era"],
      context: ["Asia all-time best player debate with Son Heung-min", "Bundesliga Asian pioneer benchmark"],
      verdict: "장기 레거시는 팀 우승과 선구자성 때문에 매우 강합니다.",
    },
    sources: [
      { label: "Wikipedia - Cha Bum-kun", url: "https://en.wikipedia.org/wiki/Cha_Bum-kun" },
      { label: "kicker - Bum-kun Cha", url: "https://www.kicker.de/bum-kun-cha/laufbahn" },
    ],
  }),
  "박지성": makeFocusedProfile({
    summary:
      "Park Ji-sung은 PSV와 Manchester United에서 유럽 정상권 팀의 전술적 핵심 역할을 수행한 한국 미드필더입니다.",
    team: {
      clubs: ["Myongji University", "Kyoto Purple Sanga", "PSV Eindhoven", "Manchester United", "Queens Park Rangers", "PSV Eindhoven loan", "South Korea national team"],
      clubHonours: ["PSV Eindhoven: Eredivisie 2002-03, 2004-05; KNVB Cup 2004-05", "Manchester United: Premier League 2006-07, 2007-08, 2008-09, 2010-11; UEFA Champions League 2007-08; FIFA Club World Cup 2008; League Cup 2005-06, 2008-09, 2009-10"],
      nationalHonours: ["South Korea: FIFA World Cup fourth place 2002", "South Korea: AFC Asian Cup third place 2000, 2011"],
      verdict: "팀 커리어 우승 총량은 아시아 선수 중 최상위권입니다.",
    },
    individual: {
      awards: ["AFC Asian Cup Team of the Tournament: 2011", "Manchester United Players' Player of the Month and multiple club recognitions"],
      records: ["First Asian player to win the UEFA Champions League", "First Asian player to play in a UEFA Champions League final squad context", "100 caps for South Korea"],
      verdict: "개인상보다 팀 성공과 전술적 신뢰가 핵심인 선수입니다.",
    },
    prime: {
      period: "2004-05 PSV to 2010-11 Manchester United",
      evidence: ["2004-05 PSV Champions League semi-final run", "Manchester United Champions League knockout assignments", "Premier League title seasons as trusted rotation/core midfielder"],
      skills: ["Elite stamina", "pressing", "man-marking", "third-man runs", "big-game tactical discipline"],
      verdict: "화려한 프라임보다 전술 수행력과 큰 경기 신뢰가 높은 유형입니다.",
    },
    importance: {
      roles: ["Manchester United: big-match tactical midfielder under Ferguson", "South Korea: 2000s national-team leader"],
      moments: ["2002 World Cup Portugal goal", "Champions League knockout man-marking roles", "PSV 2005 Milan semi-final performance"],
      verdict: "우승팀의 스타보다 감독이 신뢰한 전술적 해결책에 가까운 선수입니다.",
    },
    legacy: {
      reasons: ["UEFA Champions League winner", "Four Premier League titles", "Asian pioneer at Manchester United", "2002 Korea World Cup icon"],
      context: ["Asia's most successful team-career midfielder", "Korean European pathway model before the Son era"],
      verdict: "아시아 선수의 유럽 빅클럽 팀 커리어를 설명할 때 빠질 수 없습니다.",
    },
    sources: [
      { label: "BBC - Park Ji-sung retires", url: "https://www.bbc.co.uk/sport/football/27404603" },
      { label: "Premier League - Park Ji-sung", url: "https://www.premierleague.com/players/2940/" },
      { label: "Wikipedia - Park Ji-sung", url: "https://en.wikipedia.org/wiki/Park_Ji-sung" },
    ],
  }),
  "홍명보": makeFocusedProfile({
    summary:
      "Hong Myung-bo는 2002년 월드컵 4강과 Bronze Ball로 대표되는 한국 축구의 수비 리더입니다.",
    team: {
      clubs: ["Pohang Steelers", "Bellmare Hiratsuka", "Kashiwa Reysol", "LA Galaxy", "South Korea national team"],
      clubHonours: ["Pohang Steelers: Korean League/K League titles and Asian Club Championship-era success", "Kashiwa Reysol: J.League Cup 1999"],
      nationalHonours: ["South Korea: FIFA World Cup fourth place 2002", "South Korea: AFC Asian Cup third place 2000"],
      verdict: "클럽보다 대표팀 팀 커리어와 월드컵 성과가 압도적으로 큰 선수입니다.",
    },
    individual: {
      awards: ["FIFA World Cup Bronze Ball: 2002", "FIFA World Cup All-Star Team: 2002", "AFC Asian Cup All-Star Team: 2000"],
      records: ["First Asian player to receive a World Cup top-three individual award", "Four FIFA World Cup appearances as player"],
      verdict: "수비수로 월드컵 Bronze Ball을 받은 희소성이 매우 큽니다.",
    },
    prime: {
      period: "1994-2002 South Korea and club career peak",
      evidence: ["2002 World Cup defensive leadership", "Quarter-final penalty vs Spain", "FIFA World Cup Bronze Ball"],
      skills: ["Sweeper reading", "cover defense", "long passing", "penalty composure", "back-line leadership"],
      verdict: "아시아 수비수 프라임 기준점 중 하나입니다.",
    },
    importance: {
      roles: ["South Korea: captain and defensive organizer", "Pohang/Kashiwa: veteran libero and build-up leader"],
      moments: ["2002 World Cup Spain shootout winning penalty", "2002 World Cup semi-final run"],
      verdict: "대표팀 내 비중은 아시아 축구사 전체에서도 최상위입니다.",
    },
    legacy: {
      reasons: ["2002 World Cup Bronze Ball", "Korea 2002 captain", "first Asian top-three World Cup individual award"],
      context: ["Asia all-time defender benchmark", "Korean football leadership archetype"],
      verdict: "수비수 레거리 기준으로 한국과 아시아 모두에서 장기 보존됩니다.",
    },
    sources: [
      { label: "FIFA - Hong Myung-bo Bronze Ball", url: "https://www.plus.fifa.com/en/content/hong-myung-bo-bronze-ball-award-2002-fifa-world-cup-korea-japan/f60e1899-3383-4880-b367-47d94daf4832" },
      { label: "AFC - Hong Myung-bo profile", url: "https://www.the-afc.com/en/more/news/asian_cup_now_a_priority_says_korean_legend_hong.html" },
      { label: "Wikipedia - Hong Myung-bo", url: "https://en.wikipedia.org/wiki/Hong_Myung-bo" },
    ],
  }),
  "황선홍": makeFocusedProfile({
    summary:
      "Hwang Sun-hong은 2002년 월드컵 첫 승의 선제골, J1 League 득점왕, 한국 대표팀 장기 득점원으로 기억되는 스트라이커입니다.",
    team: {
      clubs: ["Waseda University", "Bayer Leverkusen amateur context", "Wuppertaler SV", "POSCO Atoms/Pohang Steelers", "Cerezo Osaka", "Suwon Samsung Bluewings", "Kashiwa Reysol", "Chunnam Dragons", "South Korea national team"],
      clubHonours: ["Pohang Steelers: Asian Club Championship 1996-97", "Pohang Steelers: Korean FA Cup 1996", "Suwon Samsung Bluewings: K League 2000s domestic title context"],
      nationalHonours: ["South Korea: FIFA World Cup fourth place 2002", "South Korea: AFC Asian Cup runner-up 1988", "South Korea: Asian Games bronze medal 1990"],
      verdict: "클럽 우승보다 2002 대표팀과 J리그 득점왕 커리어가 평가의 핵심입니다.",
    },
    individual: {
      awards: ["J1 League Top Scorer: 1999", "K League Best XI selections", "South Korea national-team scoring honours"],
      records: ["First South Korean footballer to become top scorer in a foreign top league", "Scored South Korea's first goal in their first-ever World Cup win"],
      verdict: "개인상 총량보다 J1 득점왕과 2002 폴란드전 골의 역사성이 큽니다.",
    },
    prime: {
      period: "1994-2002 Pohang/Cerezo/South Korea",
      evidence: ["1999 J1 League 24 goals", "2002 World Cup Poland goal", "South Korea long-term striker role"],
      skills: ["Penalty-box finishing", "heading", "near-post movement", "link play", "big-match composure"],
      verdict: "한국 전통 9번 프라임 기준점 중 하나입니다.",
    },
    importance: {
      roles: ["South Korea: senior striker and 2002 starting forward", "Cerezo Osaka: primary scorer in 1999", "Pohang: domestic and Asian-stage attacking reference"],
      moments: ["2002 World Cup opener vs Poland", "1999 J1 League scoring title"],
      verdict: "대표팀 역사적 첫 승 장면 때문에 팀 내 비중이 단순 득점원 이상입니다.",
    },
    legacy: {
      reasons: ["2002 Poland opening goal", "J1 League top scorer 1999", "South Korea striker lineage before modern Europe-based forwards"],
      context: ["Korea all-time striker debate with Lee Dong-gook and Cha Bum-kun", "2002 World Cup generation"],
      verdict: "월드컵 첫 승 장면으로 장기 기억이 매우 강합니다.",
    },
    sources: [
      { label: "Wikipedia - Hwang Sun-hong", url: "https://en.wikipedia.org/wiki/Hwang_Sun-hong" },
      { label: "Chosun - 1999 J League top scorer", url: "https://www.chosun.com/site/data/html_dir/1999/11/28/1999112870357.html" },
    ],
  }),
  "이동국": makeFocusedProfile({
    summary:
      "Lee Dong-gook은 K League 역대 최다 득점권 기록, MVP 4회, Jeonbuk 왕조, AFC Champions League 커리어로 평가하는 한국 리그형 스트라이커입니다.",
    team: {
      clubs: ["Pohang Steelers", "Werder Bremen loan", "Gwangju Sangmu", "Middlesbrough", "Seongnam Ilhwa Chunma", "Jeonbuk Hyundai Motors", "South Korea U20", "South Korea national team"],
      clubHonours: ["Jeonbuk Hyundai Motors: K League titles across 2009, 2011, 2014, 2015, 2017, 2018, 2019", "Jeonbuk Hyundai Motors: AFC Champions League 2016; runner-up 2011", "Pohang Steelers: domestic cup/league-cup honours in late 1990s"],
      nationalHonours: ["South Korea U20: AFC Youth Championship 1998", "South Korea: AFC Asian Cup third place 2000", "South Korea: FIFA World Cup squads 1998, 2010"],
      verdict: "국내 리그와 AFC 클럽 커리어 기준으로는 한국 공격수 최상위권입니다.",
    },
    individual: {
      awards: ["K League MVP: 2009, 2011, 2014, 2015", "AFC Champions League MVP and Top Scorer: 2011", "K League Top Scorer: 2009"],
      records: ["K League all-time top scorer", "Long-term Jeonbuk scoring icon", "AFC Champions League all-time scoring leader tier"],
      verdict: "K League 개인 수상과 득점 기록은 한국 선수 중 독보적입니다.",
    },
    prime: {
      period: "2009-16 Jeonbuk Hyundai Motors",
      evidence: ["2009 K League MVP/top scorer", "2011 ACL MVP/top scorer", "2016 ACL title as veteran leader"],
      skills: ["Box finishing", "heading", "post play", "penalty-area positioning", "long-career scoring consistency"],
      verdict: "국내/AFC 클럽 무대 프라임은 한국 스트라이커 최고권입니다.",
    },
    importance: {
      roles: ["Jeonbuk: dynasty-era scoring reference", "South Korea: talented but uneven national-team striker"],
      moments: ["Jeonbuk first K League title era", "2011 ACL scoring run", "2016 ACL title"],
      verdict: "클럽 팀 내 비중은 매우 높지만 대표팀 서사는 상대적으로 약합니다.",
    },
    legacy: {
      reasons: ["K League all-time top scorer", "K League MVP 4회", "Jeonbuk dynasty icon", "ACL MVP/top scorer"],
      context: ["Korea domestic league greatest striker debate", "club legend profile more than national-team legend"],
      verdict: "한국 리그사를 설명할 때 반드시 남는 이름입니다.",
    },
    sources: [
      { label: "Wikipedia - Lee Dong-gook", url: "https://en.wikipedia.org/wiki/Lee_Dong-gook" },
      { label: "AFC - Lee breaks K-League record", url: "https://www.the-afc.com/en/club/afc_champions_league/news/lee_breaks_k-league_record.html" },
      { label: "Yonhap - Lee fourth MVP", url: "https://en.yna.co.kr/view/AEN20151201007300315" },
    ],
  }),
  "안정환": makeFocusedProfile({
    summary:
      "Ahn Jung-hwan은 2002년 이탈리아전 골든골로 한국 축구사의 가장 유명한 장면 중 하나를 만든 세컨드 스트라이커입니다.",
    team: {
      clubs: ["Busan Daewoo Royals", "Perugia loan", "Shimizu S-Pulse", "Yokohama F. Marinos", "Metz", "MSV Duisburg", "Suwon Samsung Bluewings", "Busan I'Park", "Dalian Shide", "South Korea national team"],
      clubHonours: ["Yokohama F. Marinos: J1 League 2003, 2004", "Busan Daewoo Royals: Korean domestic cup/league-cup honours context"],
      nationalHonours: ["South Korea: FIFA World Cup fourth place 2002", "South Korea: AFC Asian Cup third place 2000"],
      verdict: "클럽 우승 총량보다 2002 월드컵 토너먼트 임팩트가 압도적으로 큽니다.",
    },
    individual: {
      awards: ["K League MVP: 1999", "K League Best XI: 1999", "AFC Asian Cup Team/Tournament-level recognition in 2000 context"],
      records: ["Scored the golden goal that eliminated Italy in the 2002 World Cup round of 16", "One of South Korea's leading World Cup scorers"],
      verdict: "개인상보다 월드컵 골든골 하나의 역사적 무게가 큽니다.",
    },
    prime: {
      period: "1999 Busan to 2002 World Cup",
      evidence: ["1999 K League MVP", "2002 World Cup goals vs USA and Italy", "Perugia Serie A spell before/after World Cup drama"],
      skills: ["Second-striker movement", "aerial timing", "technical first touch", "clutch finishing", "combination play"],
      verdict: "짧은 프라임과 클러치 임팩트형 레전드입니다.",
    },
    importance: {
      roles: ["South Korea: 2002 knockout difference-maker", "Busan: late-1990s attacking star", "Yokohama F. Marinos: title-winning attacking option"],
      moments: ["2002 USA equalizer", "2002 Italy golden goal", "Korea's first World Cup quarter-final entry"],
      verdict: "대표팀의 역사적 장면을 직접 만든 비중이 매우 큽니다.",
    },
    legacy: {
      reasons: ["2002 Italy golden goal", "K League MVP 1999", "Serie A/World Cup drama story", "Korea 2002 icon"],
      context: ["Korea's most famous single World Cup goal", "legacy higher than trophy total"],
      verdict: "하나의 장면으로도 100년 뒤 기억될 가능성이 높은 선수입니다.",
    },
    sources: [
      { label: "FIFA - Ahn golden goal", url: "https://www.fifa.com/ko/tournaments/mens/worldcup/articles/korea-republic-italy-upset-ko" },
      { label: "Wikipedia - Ahn Jung-hwan", url: "https://en.wikipedia.org/wiki/Ahn_Jung-hwan" },
      { label: "Guardian - Ahn and Perugia story", url: "https://www.theguardian.com/football/2002/jun/22/worldcupfootball2002.sport13" },
    ],
  }),
  "김주성": makeFocusedProfile({
    summary:
      "Kim Joo-sung은 Asian Footballer of the Year 3연속 수상으로 1980-90년대 아시아를 대표한 한국 공격형 미드필더/윙어입니다.",
    team: {
      clubs: ["Daewoo Royals", "VfL Bochum", "Busan Daewoo Royals", "South Korea national team"],
      clubHonours: ["Daewoo Royals/Busan Daewoo: K League titles in late-1980s/early-1990s era", "Daewoo Royals: Asian Club Championship 1985-86 context"],
      nationalHonours: ["South Korea: AFC Asian Cup runner-up 1988", "South Korea: FIFA World Cup appearances 1986, 1990, 1994"],
      verdict: "대표팀 장기 주축성과 아시아 올해의 선수 3연속 위상이 핵심입니다.",
    },
    individual: {
      awards: ["Asian Footballer of the Year/IFFHS Asian Men's Player of the Year: 1989, 1990, 1991", "K League Best XI selections"],
      records: ["Three consecutive Asian Player of the Year awards", "Korean star of the 1986-94 World Cup generation"],
      verdict: "개인 수상 총량만 보면 한국 선수 역사 최상위권입니다.",
    },
    prime: {
      period: "1988-91 Daewoo Royals and South Korea",
      evidence: ["AFC Asian Cup runner-up 1988", "Asian Footballer of the Year 1989-91", "World Cup appearances across three editions"],
      skills: ["Direct wing play", "attacking midfield versatility", "pace", "crossing", "transition carrying"],
      verdict: "동시대 아시아 지배력은 매우 뚜렷합니다.",
    },
    importance: {
      roles: ["South Korea: late-1980s/early-1990s attacking face", "Daewoo Royals: domestic title-era star"],
      moments: ["1988 Asian Cup run", "three World Cup cycles"],
      verdict: "대표팀 세대의 얼굴 역할을 한 선수입니다.",
    },
    legacy: {
      reasons: ["Asian Footballer of the Year three straight years", "three World Cups", "Korean pre-2002 star identity"],
      context: ["Korea's best pre-Europe boom attacking midfielder", "Asian individual-award benchmark"],
      verdict: "아시아 개인상 역사 때문에 장기 보존성이 큽니다.",
    },
    sources: [
      { label: "Wikipedia - Kim Joo-sung", url: "https://en.wikipedia.org/wiki/Kim_Joo-sung" },
      { label: "RSSSF - Asian Player of the Year", url: "https://www.rsssf.org/miscellaneous/as-poy.html" },
    ],
  }),
  "유상철": makeFocusedProfile({
    summary:
      "Yoo Sang-chul은 2002 월드컵 폴란드전 골과 멀티 포지션 능력으로 기억되는 한국 축구의 전술형 미드필더입니다.",
    team: {
      clubs: ["Ulsan Hyundai Horang-i", "Yokohama F. Marinos", "Kashiwa Reysol", "Ulsan Hyundai Horang-i second spell", "South Korea U23", "South Korea national team"],
      clubHonours: ["Ulsan Hyundai: Korean League Cup 1995, 1998", "Yokohama F. Marinos: J.League title-era squad context"],
      nationalHonours: ["South Korea: FIFA World Cup fourth place 2002", "South Korea: AFC Asian Cup third place 2000", "South Korea U23: Asian Games bronze medal 2002"],
      verdict: "클럽 우승보다 2002 월드컵과 대표팀 전술적 활용도가 핵심입니다.",
    },
    individual: {
      awards: ["K League Best XI selections", "Korean football domestic individual recognitions"],
      records: ["Scored in South Korea's first World Cup win vs Poland in 2002", "Played multiple outfield positions for club and country"],
      verdict: "화려한 개인상보다 포지션 다기능성과 월드컵 장면의 가치가 큽니다.",
    },
    prime: {
      period: "1998-2002 Ulsan/Yokohama/South Korea",
      evidence: ["2002 World Cup Poland goal", "K League/J.League peak years", "South Korea semi-final run"],
      skills: ["Box-to-box coverage", "aerial ability", "shooting from midfield", "defensive versatility", "tactical intelligence"],
      verdict: "한국 선수 중 전술적 다기능성 프라임이 가장 높은 축입니다.",
    },
    importance: {
      roles: ["South Korea: Hiddink system's multi-role connector", "Ulsan/Yokohama: midfield/defensive spine"],
      moments: ["2002 Poland goal", "2002 World Cup semi-final run"],
      verdict: "대표팀 구조 안에서 빈 곳을 메우는 대체 불가능성이 컸습니다.",
    },
    legacy: {
      reasons: ["2002 Poland goal", "Korea 2002 semi-final generation", "multi-position Korean football archetype"],
      context: ["Korea's most complete utility midfielder debate", "legacy tied to 2002 World Cup identity"],
      verdict: "대표팀 전술형 레전드로 장기 기억됩니다.",
    },
    sources: [
      { label: "Wikipedia - Yoo Sang-chul", url: "https://en.wikipedia.org/wiki/Yoo_Sang-chul" },
      { label: "Korea JoongAng Daily - Yoo Sang-chul obituary", url: "https://koreajoongangdaily.joins.com/2021/06/08/sports/football/Yoo-Sangchul-National-football-team-2002-World-Cup/20210608181800345.html" },
    ],
  }),
  "기성용": makeFocusedProfile({
    summary:
      "Ki Sung-yueng은 Celtic, Swansea City, 한국 대표팀에서 롱패스와 중원 조율을 맡은 현대 한국 중앙 미드필더입니다.",
    team: {
      clubs: ["FC Seoul", "Celtic", "Swansea City", "Sunderland loan", "Newcastle United", "Mallorca", "FC Seoul second spell", "Pohang Steelers", "South Korea U23", "South Korea national team"],
      clubHonours: ["Celtic: Scottish Premiership 2011-12; Scottish Cup 2010-11", "Swansea City: Football League Cup 2012-13"],
      nationalHonours: ["South Korea Olympic: bronze medal 2012", "South Korea: AFC Asian Cup runner-up 2015", "South Korea: FIFA World Cup appearances 2010, 2014, 2018"],
      verdict: "유럽 중상위권 클럽 팀 커리어와 대표팀 장기 주장성이 균형 있게 있습니다.",
    },
    individual: {
      awards: ["Swansea City Player of the Year: 2014-15", "AFC Asian Cup Team of the Tournament: 2015", "KFA Player of the Year-level recognition in Korean context"],
      records: ["100+ South Korea caps", "One of Korea's longest-serving European midfielders"],
      verdict: "개인상보다 EPL 중앙 미드필더로 버틴 지속성이 강점입니다.",
    },
    prime: {
      period: "2011-15 Celtic/Swansea/South Korea",
      evidence: ["Swansea League Cup 2012-13", "2014-15 Swansea Player of the Year", "2015 Asian Cup final run as captain-level midfielder"],
      skills: ["Long passing", "set-piece delivery", "tempo control", "press resistance", "deep midfield distribution"],
      verdict: "한국 중앙 미드필더 중 유럽 리그 검증 프라임이 높은 편입니다.",
    },
    importance: {
      roles: ["South Korea: captain and deep-lying playmaker", "Swansea: ball-progressing midfielder", "Celtic: title-winning midfield option"],
      moments: ["2012 Olympic bronze medal", "2015 Asian Cup final", "Swansea 2014-15 peak season"],
      verdict: "대표팀 빌드업 구조에서 장기간 중심 역할을 했습니다.",
    },
    legacy: {
      reasons: ["Olympic bronze", "Asian Cup runner-up as midfield leader", "Swansea Player of the Year", "long European career"],
      context: ["Korea's post-2002 midfield benchmark", "bridge between Park Ji-sung and Son/Kim Min-jae era"],
      verdict: "한국 현대 미드필더 계보에서 장기 보존될 이름입니다.",
    },
    sources: [
      { label: "Wikipedia - Ki Sung-yueng", url: "https://en.wikipedia.org/wiki/Ki_Sung-yueng" },
      { label: "Swansea City - Ki Asian Cup final", url: "https://www.swanseacity.com/news/ki-all-set-asian-cup-final" },
      { label: "BBC - Ki at Swansea", url: "https://www.bbc.co.uk/sport/football/31249015" },
    ],
  }),
  "이영표": makeFocusedProfile({
    summary:
      "Lee Young-pyo는 PSV, Tottenham, Dortmund를 거치며 2002년 이후 한국 풀백의 유럽 기준을 만든 왼쪽 수비수입니다.",
    team: {
      clubs: ["Anyang LG Cheetahs", "PSV Eindhoven", "Tottenham Hotspur", "Borussia Dortmund", "Al Hilal", "Vancouver Whitecaps", "South Korea national team"],
      clubHonours: ["Anyang LG Cheetahs: K League 2000", "PSV Eindhoven: Eredivisie 2002-03, 2004-05; KNVB Cup 2004-05", "Al Hilal: Saudi Professional League 2009-10, Crown Prince Cup 2009-10"],
      nationalHonours: ["South Korea: FIFA World Cup fourth place 2002", "South Korea: AFC Asian Cup third place 2000, 2011"],
      verdict: "유럽과 아시아 클럽 우승, 월드컵 4강을 모두 가진 풀백 커리어입니다.",
    },
    individual: {
      awards: ["K League Best XI selections", "AFC Asian Cup Team of the Tournament-level fullback recognition", "Vancouver Whitecaps Player of the Year-type club recognition"],
      records: ["South Korea 100+ caps", "Played in three FIFA World Cups: 2002, 2006, 2010"],
      verdict: "개인상보다 유럽 클럽 지속성과 대표팀 장기성이 중요합니다.",
    },
    prime: {
      period: "2002-06 South Korea/PSV/Tottenham",
      evidence: ["2002 World Cup semi-final run", "2004-05 PSV Champions League semi-final run", "Tottenham Premier League spell"],
      skills: ["Two-footed fullback play", "overlapping", "close control under pressure", "1v1 defending", "crossing angles"],
      verdict: "아시아 풀백 프라임으로 매우 높은 검증을 받은 선수입니다.",
    },
    importance: {
      roles: ["South Korea: left-side outlet in 2002 and later cycles", "PSV: Champions League semi-final team fullback", "Tottenham: Premier League fullback option"],
      moments: ["2002 World Cup run", "PSV 2005 Champions League semi-final", "long national-team service"],
      verdict: "대표팀과 유럽 클럽 양쪽에서 안정적인 전술 자산이었습니다.",
    },
    legacy: {
      reasons: ["2002 World Cup semi-finalist", "PSV Champions League semi-finalist", "Tottenham Premier League spell", "100+ caps"],
      context: ["Korea all-time fullback benchmark", "European pathway after Hiddink/PSV connection"],
      verdict: "한국 풀백 역사에서는 가장 먼저 호출될 이름 중 하나입니다.",
    },
    sources: [
      { label: "Wikipedia - Lee Young-pyo", url: "https://en.wikipedia.org/wiki/Lee_Young-pyo" },
      { label: "FIFA - Lee Young-pyo interview", url: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/lee-youngpyo-interview-korea-republic" },
      { label: "Tottenham - Young-Pyo's Dutch adventure", url: "https://www.tottenhamhotspur.com/news-archive-1/young-pyos-dutch-adventure/" },
    ],
  }),
  "김민재": makeFocusedProfile({
    summary:
      "Kim Min-jae는 Napoli의 33년 만의 Serie A 우승과 Serie A Best Defender 수상으로 한국 수비수 평가 기준을 새로 올린 센터백입니다.",
    team: {
      clubs: ["Gyeongju KHNP", "Jeonbuk Hyundai Motors", "Beijing Guoan", "Fenerbahce", "Napoli", "Bayern Munich", "South Korea U23", "South Korea national team"],
      clubHonours: ["Jeonbuk Hyundai Motors: K League 1 2017, 2018", "Napoli: Serie A 2022-23", "Bayern Munich: Bundesliga 2024-25"],
      nationalHonours: ["South Korea U23: Asian Games gold medal 2018", "South Korea: FIFA World Cup 2022 last-16 squad"],
      verdict: "Napoli 우승 핵심 센터백이라는 점 때문에 한국 수비수 팀 커리어 최고권입니다.",
    },
    individual: {
      awards: ["Serie A Best Defender: 2022-23", "Serie A Team of the Season: 2022-23", "KFA Player of the Year: 2023", "AFC Asian International Player of the Year-level recognition"],
      records: ["First Asian player to win Serie A Best Defender", "Key defender in Napoli's first Serie A title in 33 years"],
      verdict: "아시아 센터백 개인상 기준으로는 역대 최고급입니다.",
    },
    prime: {
      period: "2021-24 Fenerbahce/Napoli/Bayern",
      evidence: ["2022-23 Napoli Serie A title", "2022-23 Serie A Best Defender", "Bayern transfer after one Napoli season"],
      skills: ["Recovery speed", "front-foot defending", "aerial duels", "progressive carrying", "high-line cover"],
      verdict: "센터백 프라임은 한국 선수 역대 최고 논쟁권입니다.",
    },
    importance: {
      roles: ["Napoli: title-winning defensive anchor", "South Korea: first-choice centre-back and build-up base", "Bayern: elite-club centre-back rotation/core"],
      moments: ["Napoli 2022-23 Scudetto", "2022 World Cup defensive core", "rapid progression from K League to elite Europe"],
      verdict: "단기 프라임 기준으로는 대표팀보다 클럽 비중이 특히 강합니다.",
    },
    legacy: {
      reasons: ["Serie A Best Defender", "Napoli Scudetto", "Bayern Munich move", "Asian Games gold"],
      context: ["Korea all-time defender debate with Hong Myung-bo", "Asia's elite centre-back benchmark"],
      verdict: "커리어가 진행 중이지만 이미 한국 수비수 레거시 최상위권입니다.",
    },
    sources: [
      { label: "Bayern - Minjae Kim profile", url: "https://fcbayern.com/en/teams/first-team/minjae-kim" },
      { label: "Yonhap - Serie A best defender", url: "https://en.yna.co.kr/view/AEN20230603000200315" },
      { label: "Wikipedia - Kim Min-jae", url: "https://en.wikipedia.org/wiki/Kim_Min-jae_(footballer)" },
    ],
  }),
  "이운재": makeFocusedProfile({
    summary:
      "Lee Woon-jae는 2002 월드컵 스페인전 승부차기와 Suwon Samsung의 아시아 클럽 성공으로 기억되는 한국 골키퍼 레전드입니다.",
    team: {
      clubs: ["Kyung Hee University", "Suwon Samsung Bluewings", "Chunnam Dragons", "South Korea national team"],
      clubHonours: ["Suwon Samsung Bluewings: K League 1998, 1999, 2004, 2008", "Suwon Samsung Bluewings: Asian Club Championship 2000-01, 2001-02; Asian Super Cup 2001, 2002"],
      nationalHonours: ["South Korea: FIFA World Cup fourth place 2002", "South Korea: AFC Asian Cup third place 2000, 2007", "South Korea: FIFA World Cup appearances 1994, 2002, 2006, 2010 squad context"],
      verdict: "클럽 우승과 대표팀 월드컵 장면을 모두 가진 한국 골키퍼 최고권 커리어입니다.",
    },
    individual: {
      awards: ["K League MVP: 2008", "K League Best XI selections", "AFC Asian Cup penalty shootout and goalkeeper recognitions"],
      records: ["South Korea's 2002 World Cup starting goalkeeper", "Penalty save vs Spain in 2002 World Cup quarter-final shootout", "One of Korea's most-capped goalkeepers"],
      verdict: "골키퍼로 K League MVP를 받은 희소성과 2002 장면이 큽니다.",
    },
    prime: {
      period: "2001-08 Suwon/South Korea",
      evidence: ["Asian Club Championship/Super Cup run with Suwon", "2002 World Cup semi-final run", "2008 K League MVP and title"],
      skills: ["Penalty saving", "shot stopping", "large-frame positioning", "big-match composure", "defensive organization"],
      verdict: "한국 골키퍼 프라임 기준으로 최상위입니다.",
    },
    importance: {
      roles: ["South Korea: 2002 World Cup starting goalkeeper", "Suwon Samsung: title-winning defensive base"],
      moments: ["2002 Spain quarter-final penalty shootout", "Suwon Asian Super Cup back-to-back success", "2008 K League MVP season"],
      verdict: "대표팀 역사적 성과와 클럽 왕조 모두에서 직접적 비중이 있습니다.",
    },
    legacy: {
      reasons: ["2002 Spain penalty save", "K League MVP as goalkeeper", "Suwon Asian Club Championship titles", "four World Cup cycles"],
      context: ["Korea all-time goalkeeper debate with Kim Byung-ji", "big-match goalkeeper archetype"],
      verdict: "2002 월드컵의 결정적 장면 때문에 장기 기억이 매우 강합니다.",
    },
    sources: [
      { label: "Wikipedia - Lee Woon-jae", url: "https://en.wikipedia.org/wiki/Lee_Woon-jae" },
      { label: "Reuters/Moneycontrol - Lee retirement", url: "https://www.moneycontrol.com/news/business/wire-news/-1665569.html" },
      { label: "Donga - Asian Super Cup", url: "https://www.donga.com/en/article/all/20020721/223820/1" },
    ],
  }),
  "김병지": makeFocusedProfile({
    summary:
      "Kim Byung-ji는 K League 최다 출장/클린시트 기록과 골키퍼 득점 서사로 남는 한국 프로축구의 장수형 골키퍼 레전드입니다.",
    team: {
      clubs: ["Sangmu", "Ulsan Hyundai", "Pohang Steelers", "FC Seoul", "Gyeongnam FC", "Jeonnam Dragons", "South Korea national team"],
      clubHonours: ["Ulsan Hyundai: K League 1996", "Ulsan/Pohang/FC Seoul: Korean domestic cup and league-cup honours across long career"],
      nationalHonours: ["South Korea: FIFA World Cup squad 1998, 2002", "South Korea: AFC Asian Cup 1996/2000 era squads"],
      verdict: "대표팀 주전 월드컵 서사는 이운재보다 약하지만 K League 누적은 독보적입니다.",
    },
    individual: {
      awards: ["K League Hall of Fame induction context", "K League Best XI selections", "Korean goalkeeper of the year-level domestic recognitions"],
      records: ["K League record appearances", "K League record clean sheets", "First goalkeeper to score in K League", "Oldest player in K League history at retirement context"],
      verdict: "국내 리그 기록형 개인 커리어는 한국 골키퍼 중 최상위입니다.",
    },
    prime: {
      period: "1996-2002 Ulsan/Pohang/South Korea squad era",
      evidence: ["Ulsan K League 1996", "long-term K League clean-sheet record", "1998 World Cup starting goalkeeper context"],
      skills: ["Reflex saves", "aggressive sweeping", "distribution risk-taking", "leadership", "longevity and conditioning"],
      verdict: "순수 K League 장기 프라임과 지속성은 매우 강합니다.",
    },
    importance: {
      roles: ["K League: generational goalkeeper icon", "South Korea: 1990s national-team goalkeeper", "multiple clubs: defensive leader over two decades"],
      moments: ["K League goalkeeper goal", "record appearance/clean-sheet accumulation", "1998 World Cup role"],
      verdict: "대표팀보다 프로리그 역사에서의 비중이 훨씬 큽니다.",
    },
    legacy: {
      reasons: ["K League record appearances", "K League clean-sheet record", "first K League goalkeeper goal", "career until age 46"],
      context: ["Korea all-time goalkeeper debate with Lee Woon-jae", "longevity and domestic-league icon"],
      verdict: "한국 프로축구 기록사에서는 반드시 남는 골키퍼입니다.",
    },
    sources: [
      { label: "AFC - Kim Byung-ji retires", url: "https://www.the-afc.com/en/more/news/legendary_korea_republic_goalkeeper_kim_byung-ji__retires.html" },
      { label: "Yonhap - Kim Byung-ji retirement", url: "https://en.yna.co.kr/view/AEN20160719010000315" },
      { label: "Wikipedia - Kim Byung-ji", url: "https://en.wikipedia.org/wiki/Kim_Byung-ji" },
    ],
  }),
  "오카자키 신지": makeFocusedProfile({
    summary:
      "Shinji Okazaki는 Leicester City의 2015-16 Premier League 우승과 Japan 대표팀 득점 누적으로 평가하는 일본 스트라이커입니다.",
    team: {
      clubs: ["Shimizu S-Pulse", "VfB Stuttgart", "Mainz 05", "Leicester City", "Malaga", "Huesca", "Cartagena", "Sint-Truiden", "Japan national team"],
      clubHonours: ["Leicester City: Premier League 2015-16", "Huesca: Segunda Division promotion 2019-20"],
      nationalHonours: ["Japan: AFC Asian Cup 2011", "Japan: FIFA World Cup appearances 2010, 2014, 2018"],
      verdict: "Premier League 우승팀의 전방 압박 자원이라는 팀 커리어가 강합니다.",
    },
    individual: {
      awards: ["AFC Asian International Player of the Year: 2016", "IFFHS AFC Men's Team of the Decade: 2011-2020 context"],
      records: ["Japan national-team 50-goal tier", "Second Japanese player to win the Premier League"],
      verdict: "개인상보다 대표팀 득점 누적과 Leicester 우승 서사가 중요합니다.",
    },
    prime: {
      period: "2013-16 Mainz/Leicester/Japan",
      evidence: ["Mainz Bundesliga scoring peak", "2015-16 Leicester Premier League title", "2011 Asian Cup and World Cup-cycle Japan role"],
      skills: ["Pressing", "near-post runs", "acrobatic finishing", "second-ball reactions", "work rate"],
      verdict: "순수 득점왕형보다 전방 수비와 활동량이 결합된 프라임입니다.",
    },
    importance: {
      roles: ["Leicester City: Vardy/Mahrez behind-the-ball pressing support", "Japan: long-term scoring forward"],
      moments: ["Leicester 2015-16 title run", "Japan Asian Cup-winning squad", "World Cup appearances across three editions"],
      verdict: "클럽에서는 시스템형 핵심, 대표팀에서는 장기 득점 자원입니다.",
    },
    legacy: {
      reasons: ["Premier League 2015-16", "AFC Asian International Player of the Year 2016", "Japan 50-goal tier"],
      context: ["Japanese European striker benchmark", "Leicester miracle story"],
      verdict: "Leicester 우승 때문에 일본 축구사에서 오래 남습니다.",
    },
    sources: [
      { label: "AFC - Okazaki Asian International Player", url: "https://www.the-afc.com/en/about_afc/afc_annual_awards/news/afc_asian_international_player_of_the_year_2016_shinji_okazaki.html" },
      { label: "Wikipedia - Shinji Okazaki", url: "https://en.wikipedia.org/wiki/Shinji_Okazaki" },
    ],
  }),
  "미우라 카즈요시": makeFocusedProfile({
    summary:
      "Kazuyoshi Miura는 J.League 초기의 얼굴이자 일본 프로축구 대중화를 상징하는 'King Kazu'입니다.",
    team: {
      clubs: ["Santos", "Palmeiras", "Matsubara", "CRB", "XV de Jau", "Coritiba", "Yomiuri/Verdy Kawasaki", "Genoa loan", "Dinamo Zagreb", "Kyoto Purple Sanga", "Vissel Kobe", "Yokohama FC", "Sydney FC loan", "Suzuka Point Getters loan", "Atletico Suzuka", "Oliveirense loan", "Japan national team"],
      clubHonours: ["Verdy Kawasaki: Japan Soccer League/J.League titles in early 1990s", "Yokohama FC: J2 League 2006"],
      nationalHonours: ["Japan: AFC Asian Cup 1992", "Japan: FIFA World Cup qualification-era icon before 1998 omission"],
      verdict: "팀 커리어보다 J.League 탄생기의 상징성과 장수성이 핵심입니다.",
    },
    individual: {
      awards: ["Asian Footballer of the Year: 1993", "J.League MVP: 1993", "J.League Best XI multiple selections"],
      records: ["World's oldest professional footballer/goalscorer records", "Japan national-team 50-goal tier"],
      verdict: "J.League 초대 MVP와 아시아 올해의 선수 수상이 핵심입니다.",
    },
    prime: {
      period: "1992-96 Verdy Kawasaki and Japan",
      evidence: ["1992 Asian Cup title", "1993 J.League MVP", "1993 Asian Footballer of the Year"],
      skills: ["Dribbling flair", "box finishing", "star charisma", "wide/central forward movement", "commercial-cultural pull"],
      verdict: "J.League 초기 스타 프라임으로 일본 축구 대중화를 끌었습니다.",
    },
    importance: {
      roles: ["Verdy/J.League: league-launch face", "Japan: professional-era attacking icon"],
      moments: ["1992 Asian Cup", "1993 inaugural J.League season", "decades-long professional career"],
      verdict: "축구 실력뿐 아니라 일본 프로축구의 이미지 형성 비중이 매우 큽니다.",
    },
    legacy: {
      reasons: ["King Kazu identity", "J.League MVP 1993", "Asian Footballer of the Year 1993", "oldest professional records"],
      context: ["Japan professional football pioneer", "cultural icon beyond pure statistics"],
      verdict: "일본 프로축구사를 설명할 때 반드시 등장합니다.",
    },
    sources: [
      { label: "J.League - King Kazu", url: "https://www.jleague.co/en/news/54-year-old-king-kazu-continues-legendary-career-with-suzuka-point-getters/" },
      { label: "RSSSF - Asian Player of the Year", url: "https://www.rsssf.org/miscellaneous/as-poy.html" },
      { label: "Wikipedia - Kazuyoshi Miura", url: "https://en.wikipedia.org/wiki/Kazuyoshi_Miura" },
    ],
  }),
  "카마모토 쿠니시게": makeFocusedProfile({
    summary:
      "Kunishige Kamamoto는 1968 Olympic bronze와 대회 득점왕, 일본 대표팀 최다 득점 기록으로 남는 일본 축구의 원형적 스트라이커입니다.",
    team: {
      clubs: ["Yanmar Diesel", "Japan national team"],
      clubHonours: ["Yanmar Diesel: Japan Soccer League titles 1971, 1974, 1975, 1980", "Yanmar Diesel: Emperor's Cup titles in 1968, 1970, 1974"],
      nationalHonours: ["Japan: Olympic bronze medal 1968", "Japan: Asian Games bronze medal 1966"],
      verdict: "클럽/대표팀 모두 일본 축구 초기 최고급 팀 성과를 갖고 있습니다.",
    },
    individual: {
      awards: ["Japan Soccer League top scorer: seven times", "Japan Soccer League Best XI: 14 times", "Japan Soccer League Player of the Year: seven times"],
      records: ["Japan men's all-time top scorer", "1968 Olympic top scorer with seven goals"],
      verdict: "개인상과 대표팀 득점 기록은 일본 역대 최고급입니다.",
    },
    prime: {
      period: "1968 Olympics to mid-1970s Yanmar/Japan",
      evidence: ["1968 Olympic bronze and top scorer", "JSL repeated top-scorer seasons", "Japan all-time scoring record"],
      skills: ["Box finishing", "shooting power", "aerial threat", "penalty-area timing", "two-footed striker instincts"],
      verdict: "일본 스트라이커 원형이자 기록형 최고점입니다.",
    },
    importance: {
      roles: ["Japan: 1968 Olympic attacking centerpiece", "Yanmar Diesel: domestic dynasty scorer"],
      moments: ["1968 Mexico Olympics bronze medal", "JSL repeated scoring titles"],
      verdict: "국가대표와 클럽 모두에서 득점 구조의 중심이었습니다.",
    },
    legacy: {
      reasons: ["Japan all-time top scorer", "1968 Olympic bronze/top scorer", "JFA Hall of Fame", "JSL scoring dominance"],
      context: ["Japan pre-professional era greatest striker", "benchmark before Miura/Nakata era"],
      verdict: "일본 축구 초기 역사를 설명할 때 빠질 수 없습니다.",
    },
    sources: [
      { label: "JFA Hall of Fame - Kunishige Kamamoto", url: "https://jfajp-img.jh.bit-drive.ne.jp/eng/about_jfa/hall_of_fame/member/KAMAMOTO_Kunishige.html" },
      { label: "Wikipedia - Kunishige Kamamoto", url: "https://en.wikipedia.org/wiki/Kunishige_Kamamoto" },
    ],
  }),
  "미토마 카오루": makeFocusedProfile({
    summary:
      "Kaoru Mitoma는 Brighton에서 Premier League 드리블러로 떠오른 현역 일본 윙어입니다. 커리어가 진행 중이라 점수는 보수적으로 잡습니다.",
    team: {
      clubs: ["University of Tsukuba", "Kawasaki Frontale", "Union SG loan", "Brighton & Hove Albion", "Japan national team"],
      clubHonours: ["Kawasaki Frontale: J1 League 2020, 2021; Emperor's Cup 2020; Japanese Super Cup 2021"],
      nationalHonours: ["Japan: FIFA World Cup 2022 last-16 squad", "Japan: AFC Asian Cup 2023 squad context"],
      verdict: "팀 커리어는 아직 성장 중이지만 J1 우승과 Premier League 주전성이 있습니다.",
    },
    individual: {
      awards: ["Japan Pro-Footballers Association Awards MVP: 2022, 2023", "Brighton Goal of the Season awards", "Premier League Goal of the Month recognition"],
      records: ["One of Japan's most visible Premier League wingers", "World Cup 2022 Spain byline assist image"],
      verdict: "현역이라 개인상 총량은 제한적이지만 드리블 프라임 인지도는 큽니다.",
    },
    prime: {
      period: "2022-24 Brighton and Japan",
      evidence: ["Premier League breakout under Brighton", "2022 World Cup assist vs Spain", "JPFA MVP awards"],
      skills: ["One-v-one dribbling", "left-wing isolation", "acceleration", "cutback creation", "transition carrying"],
      verdict: "드리블 고점은 일본 윙어 역사에서 매우 높은 편입니다.",
    },
    importance: {
      roles: ["Brighton: left-wing progression outlet", "Japan: late-game and starting wide threat"],
      moments: ["2022 World Cup Spain assist", "Brighton Premier League breakthrough seasons"],
      verdict: "대표팀과 클럽에서 상대 수비를 직접 흔드는 역할입니다.",
    },
    legacy: {
      reasons: ["Premier League Japanese winger benchmark", "2022 World Cup Spain assist", "elite dribbling reputation"],
      context: ["active-hold, legacy still forming", "Japan modern winger lineage"],
      verdict: "현역 커리어가 더 쌓이면 점수 상승 여지가 큽니다.",
    },
    sources: [
      { label: "Wikipedia - Kaoru Mitoma", url: "https://en.wikipedia.org/wiki/Kaoru_Mitoma" },
      { label: "Brighton - Kaoru Mitoma", url: "https://www.brightonandhovealbion.com/" },
    ],
  }),
  "쿠보 타케후사": makeFocusedProfile({
    summary:
      "Takefusa Kubo는 Real Sociedad에서 La Liga 상위권 윙어로 성장한 현역 일본 공격수입니다. 아직 완성 전이라 점수는 보수적으로 둡니다.",
    team: {
      clubs: ["FC Tokyo", "Yokohama F. Marinos loan", "Real Madrid", "Mallorca loan", "Villarreal loan", "Getafe loan", "Mallorca second loan", "Real Sociedad", "Japan national team"],
      clubHonours: ["Real Sociedad: Champions League qualification-era core contributor", "Yokohama F. Marinos/FC Tokyo: J.League developmental context"],
      nationalHonours: ["Japan: FIFA World Cup 2022 squad", "Japan: AFC Asian Cup 2023 squad context"],
      verdict: "아직 팀 우승은 부족하지만 La Liga 주전/핵심 경력이 중요합니다.",
    },
    individual: {
      awards: ["La Liga Player of the Month: September 2023", "Japan Pro-Footballers Association Awards Best XI: 2022, 2023"],
      records: ["One of Japan's youngest elite European prospects", "Real Sociedad final-third creator"],
      verdict: "현역 발전형이라 개인상은 시작 단계입니다.",
    },
    prime: {
      period: "2022-24 Real Sociedad",
      evidence: ["La Liga Player of the Month September 2023", "Real Sociedad Champions League qualification period", "Japan World Cup-cycle role"],
      skills: ["Right-wing dribbling", "left-foot shooting", "chance creation", "pressing", "tight-space turns"],
      verdict: "기술 고점은 일본 현역 최고권이지만 지속성은 더 필요합니다.",
    },
    importance: {
      roles: ["Real Sociedad: right-side creative outlet", "Japan: attacking rotation/core option"],
      moments: ["Real Sociedad 2023-24 Champions League stage", "La Liga monthly award"],
      verdict: "클럽 비중이 대표팀 비중보다 먼저 커진 유형입니다.",
    },
    legacy: {
      reasons: ["La Liga standout Japanese winger", "Barcelona/Real Madrid youth-path narrative", "active-hold future upside"],
      context: ["Japan next-generation star after Nakata/Honda/Kagawa", "legacy still forming"],
      verdict: "장기 평가는 앞으로의 우승/대표팀 성과에 달려 있습니다.",
    },
    sources: [
      { label: "La Liga - Kubo Player of the Month", url: "https://www.laliga.com/en-ES/news/takefusa-kubo-named-laliga-ea-sports-player-of-the-month-for-september" },
      { label: "Wikipedia - Takefusa Kubo", url: "https://en.wikipedia.org/wiki/Takefusa_Kubo" },
    ],
  }),
  "오노 신지": makeFocusedProfile({
    summary:
      "Shinji Ono는 Feyenoord의 2001-02 UEFA Cup 우승과 2002 Asian Footballer of the Year 수상으로 평가하는 일본의 천재형 미드필더입니다.",
    team: {
      clubs: ["Urawa Red Diamonds", "Feyenoord", "Urawa Red Diamonds second spell", "Bochum", "Shimizu S-Pulse", "Western Sydney Wanderers", "Consadole Sapporo/Hokkaido Consadole Sapporo", "FC Ryukyu", "Japan national team"],
      clubHonours: ["Feyenoord: UEFA Cup 2001-02", "Urawa Red Diamonds: J1 League 2006; Emperor's Cup 2005, 2006; AFC Champions League 2007 squad context"],
      nationalHonours: ["Japan: AFC Asian Cup 2000", "Japan: FIFA World Cup appearances 1998, 2002, 2006"],
      verdict: "UEFA Cup 우승팀 주전급 공헌이라는 유럽 팀 커리어가 일본 선수 역사에서 강하게 남습니다.",
    },
    individual: {
      awards: ["Asian Footballer of the Year: 2002", "J.League Rookie of the Year: 1998", "J.League Best XI selections"],
      records: ["First Japanese player to win a UEFA club competition", "Japan golden-generation technical midfielder"],
      verdict: "부상 변수에도 Asian Footballer of the Year와 UEFA Cup 우승 조합은 매우 높게 평가됩니다.",
    },
    prime: {
      period: "1998-2002 Urawa/Feyenoord/Japan",
      evidence: ["1998 J.League breakout", "Feyenoord 2001-02 UEFA Cup", "Asian Footballer of the Year 2002"],
      skills: ["Two-footed passing", "press resistance", "tempo control", "long-range distribution", "midfield creativity"],
      verdict: "짧지만 기술 고점은 일본 미드필더 계보에서 최상위권입니다.",
    },
    importance: {
      roles: ["Feyenoord: creative central/wide midfielder in UEFA Cup-winning side", "Japan: golden-generation technical connector", "Urawa: early professional-era star"],
      moments: ["2002 UEFA Cup final run", "Japan 2002 World Cup generation", "2002 Asian Footballer of the Year"],
      verdict: "대표팀 장기 지배력보다 유럽 클럽 고점과 기술 상징성이 큽니다.",
    },
    legacy: {
      reasons: ["UEFA Cup 2001-02", "Asian Footballer of the Year 2002", "first Japanese UEFA club-competition winner"],
      context: ["Japan technical genius archetype", "what-if legacy because injuries limited total volume"],
      verdict: "부상으로 누적은 제한됐지만 프라임 재능과 유럽 우승 서사는 오래 남습니다.",
    },
    sources: [
      { label: "UEFA - Ono is Asia's finest", url: "https://www.uefa.com/news-media/news/0191-0e6a62cb62dc-0478069f9bb0-1000--ono-is-asia-s-finest/" },
      { label: "UEFA - Eastern promise", url: "https://www.uefa.com/uefasupercup/news/0250-0c50f1df0273-535ff267d1ec-1000--eastern-promise/" },
      { label: "Wikipedia - Shinji Ono", url: "https://en.wikipedia.org/wiki/Shinji_Ono" },
    ],
  }),
  "엔도 야스히토": makeFocusedProfile({
    summary:
      "Yasuhito Endo는 Gamba Osaka의 2008 AFC Champions League 우승과 J.League 30주년 MVP로 설명되는 일본 리그 역사상 최고급 플레이메이커입니다.",
    team: {
      clubs: ["Yokohama Flugels", "Kyoto Purple Sanga", "Gamba Osaka", "Jubilo Iwata", "Japan national team"],
      clubHonours: ["Gamba Osaka: AFC Champions League 2008", "Gamba Osaka: J1 League 2005, 2014", "Gamba Osaka: Emperor's Cup 2008, 2009, 2014, 2015; J.League Cup 2007, 2014"],
      nationalHonours: ["Japan: AFC Asian Cup 2004, 2011", "Japan: FIFA World Cup appearances 2006, 2010, 2014"],
      verdict: "국내 클럽 트로피, ACL, 대표팀 아시안컵이 모두 있는 균형형 팀 커리어입니다.",
    },
    individual: {
      awards: ["Asian Footballer of the Year: 2009", "AFC Champions League Best Player: 2008", "J.League MVP: 2014", "J.League 30-year MVP", "J.League Best XI record-level 12 selections"],
      records: ["J.League record appearance tier", "Gamba Osaka all-time symbol"],
      verdict: "J.League 역사 평가에서는 일본 선수 전체에서도 최상위권입니다.",
    },
    prime: {
      period: "2005-14 Gamba Osaka/Japan",
      evidence: ["2008 ACL Best Player and title", "2009 Asian Footballer of the Year", "2014 domestic treble/J.League MVP"],
      skills: ["Tempo control", "set-piece delivery", "long passing", "press-resistant circulation", "late-career game management"],
      verdict: "순간 폭발형보다 10년 이상 리그를 지배한 컨트롤러 프라임입니다.",
    },
    importance: {
      roles: ["Gamba Osaka: central playmaker and franchise icon", "Japan: midfield set-piece/tempo option across three World Cups"],
      moments: ["2008 AFC Champions League", "2014 Gamba domestic treble", "Japan 2010 World Cup midfield rotation"],
      verdict: "클럽 내 비중은 일본 선수 중 최고권이고 대표팀도 장기적으로 기여했습니다.",
    },
    legacy: {
      reasons: ["J.League 30-year MVP", "Asian Footballer of the Year 2009", "ACL Best Player 2008", "record-level Best XI selections"],
      context: ["J.League all-time midfield benchmark", "domestic greatness vs European-career debate"],
      verdict: "유럽 커리어가 없어도 J.League 역사성 때문에 일본 레전드 상위권에 남습니다.",
    },
    sources: [
      { label: "J.League - J30 Yasuhito Endo MVP", url: "https://www.jleague.co/news/j30-yasuhito-endo-named-mvp-of-jleagues-first-30-years/" },
      { label: "Wikipedia - Yasuhito Endo", url: "https://en.wikipedia.org/wiki/Yasuhito_End%C5%8D" },
    ],
  }),
  "하세베 마코토": makeFocusedProfile({
    summary:
      "Makoto Hasebe는 Bundesliga, DFB-Pokal, UEFA Europa League, AFC Champions League, AFC Asian Cup을 모두 가진 일본의 장기 리더형 미드필더/수비수입니다.",
    team: {
      clubs: ["Urawa Red Diamonds", "Wolfsburg", "Nurnberg", "Eintracht Frankfurt", "Japan national team"],
      clubHonours: ["Urawa Red Diamonds: J1 League 2006; Emperor's Cup 2005, 2006; J.League Cup 2003; AFC Champions League 2007", "Wolfsburg: Bundesliga 2008-09", "Eintracht Frankfurt: DFB-Pokal 2017-18; UEFA Europa League 2021-22"],
      nationalHonours: ["Japan: AFC Asian Cup 2011", "Japan: FIFA World Cup appearances 2010, 2014, 2018"],
      verdict: "일본 선수 중 유럽 주요 타이틀과 아시아/국내 타이틀을 폭넓게 가진 드문 커리어입니다.",
    },
    individual: {
      awards: ["AFC Asian International Player of the Year: 2018", "Bundesliga Asian appearance-record recognition", "Eintracht Frankfurt long-service captain/leader recognition"],
      records: ["Bundesliga all-time Asian appearance leader at retirement context", "Japan captain across three World Cup cycles"],
      verdict: "화려한 공격 개인상보다 리더십, 지속성, 포지션 전환 성공이 핵심입니다.",
    },
    prime: {
      period: "2008-19 Wolfsburg/Frankfurt/Japan",
      evidence: ["2008-09 Wolfsburg Bundesliga title", "Japan captaincy in 2010/2014/2018 World Cups", "2017-18 DFB-Pokal and 2018 individual recognition"],
      skills: ["Defensive reading", "midfield-to-libero versatility", "leadership", "positioning", "low-error build-up"],
      verdict: "공격 스탯형 프라임은 아니지만 팀 안정성을 올리는 지능형 프라임입니다.",
    },
    importance: {
      roles: ["Japan: long-term captain and dressing-room standard", "Eintracht Frankfurt: veteran defensive organizer", "Wolfsburg: Bundesliga title-squad contributor"],
      moments: ["2011 Asian Cup captain era", "Frankfurt DFB-Pokal and Europa League period", "three World Cup cycles as captain/core"],
      verdict: "대표팀 내 비중과 클럽 장기 신뢰도가 모두 강합니다.",
    },
    legacy: {
      reasons: ["Bundesliga title", "Europa League title", "AFC Asian Cup 2011", "Japan captaincy", "Bundesliga longevity record"],
      context: ["Japan leadership archetype", "Asian Bundesliga longevity benchmark"],
      verdict: "100년 뒤에는 화려함보다 커리어 폭과 리더십의 기준점으로 남을 가능성이 큽니다.",
    },
    sources: [
      { label: "Eintracht - Makoto Hasebe profile", url: "https://en.eintracht.de/2021-2022/kader/makoto-hasebe/" },
      { label: "Bundesliga - Hasebe record-setter", url: "https://www.bundesliga.com/en/bundesliga/news/makoto-hasebe-eintracht-frankfurt-s-record-setting-asian-still-going-strong-11454" },
      { label: "Wikipedia - Makoto Hasebe", url: "https://en.wikipedia.org/wiki/Makoto_Hasebe" },
    ],
  }),
  "엔도 와타루": makeFocusedProfile({
    summary:
      "Wataru Endo는 Urawa의 ACL 우승, Stuttgart captaincy, Liverpool 트로피까지 이어진 현역 일본 수비형 미드필더입니다.",
    team: {
      clubs: ["Shonan Bellmare", "Urawa Red Diamonds", "Sint-Truiden", "Stuttgart", "Liverpool", "Japan national team"],
      clubHonours: ["Shonan Bellmare: J2 League 2014", "Urawa Red Diamonds: J.League Cup 2016; AFC Champions League 2017", "Liverpool: EFL Cup 2023-24; Premier League 2024-25"],
      nationalHonours: ["Japan: AFC Asian Cup runner-up 2019", "Japan: FIFA World Cup squad 2018 and starter/core in 2022", "Japan: national-team captaincy era"],
      verdict: "현역이지만 ACL과 Liverpool 트로피가 있어 팀 커리어 기반은 이미 강합니다.",
    },
    individual: {
      awards: ["IFFHS AFC Men's Team of the Year: 2024", "Stuttgart captain and player-of-season-level club recognition", "Bundesliga duel-winning reputation during Stuttgart prime"],
      records: ["Japan national-team captain in the 2020s", "Late-career move to Liverpool as Japan captain"],
      verdict: "전통적 개인상 총량은 적지만 수비형 미드필더 특성상 팀 신뢰도와 리그 적응력이 중요합니다.",
    },
    prime: {
      period: "2020-24 Stuttgart/Liverpool/Japan",
      evidence: ["Stuttgart Bundesliga survival/relegation-fight leadership", "Liverpool 2023-24 EFL Cup run", "Japan captaincy and 2022 World Cup role"],
      skills: ["Ball winning", "duel strength", "defensive positioning", "simple forward passing", "press coverage"],
      verdict: "엘리트 볼위닝과 리더십이 강한 수비형 미드필더 프라임입니다.",
    },
    importance: {
      roles: ["Stuttgart: captain and midfield shield", "Liverpool: squad-stabilizing defensive midfielder", "Japan: captain and balance setter"],
      moments: ["Urawa ACL 2017", "Liverpool EFL Cup 2024", "Japan 2022 World Cup Germany/Spain group-stage run"],
      verdict: "대표팀과 Stuttgart에서는 핵심, Liverpool에서는 로테이션 이상의 특정 역할 자원입니다.",
    },
    legacy: {
      reasons: ["AFC Champions League 2017", "Liverpool EFL Cup/Premier League titles", "Japan captaincy", "Bundesliga/Premier League late-career proof"],
      context: ["active-hold, legacy still forming", "Japan defensive-midfield benchmark after Hasebe/Endo Yasuhito line"],
      verdict: "현역이라 최종 평가는 미완이지만 이미 일본 중원 레전드 후보군입니다.",
    },
    sources: [
      { label: "Wataru Endo official profile", url: "https://www.wataruendo.com/en/" },
      { label: "LFChistory - Wataru Endo", url: "https://www.lfchistory.net/players/1413" },
      { label: "Wikipedia - Wataru Endo", url: "https://en.wikipedia.org/wiki/Wataru_Endo" },
    ],
  }),
  "나가토모 유토": makeFocusedProfile({
    summary:
      "Yuto Nagatomo는 Inter와 Galatasaray에서 장기 유럽 커리어를 만들고 Japan 대표팀 월드컵 4회 세대를 버틴 풀백입니다.",
    team: {
      clubs: ["FC Tokyo", "Cesena", "Inter Milan", "Galatasaray", "Marseille", "FC Tokyo second spell", "Japan national team"],
      clubHonours: ["FC Tokyo: J.League Cup 2009", "Inter Milan: Coppa Italia 2010-11", "Galatasaray: Super Lig 2017-18, 2018-19; Turkish Cup 2018-19; Turkish Super Cup 2019"],
      nationalHonours: ["Japan: AFC Asian Cup 2011", "Japan: FIFA World Cup appearances 2010, 2014, 2018, 2022"],
      verdict: "빅리그 장기 출전, 터키 리그 우승, 대표팀 월드컵 4회가 결합된 강한 팀 커리어입니다.",
    },
    individual: {
      awards: ["AFC Asian International Player of the Year: 2013", "AFC Asian Cup Team of the Tournament: 2019", "J.League Best XI-level domestic recognition"],
      records: ["Japan 140-cap tier", "One of Japan's longest-serving European fullbacks"],
      verdict: "수비수 개인상 총량은 제한적이지만 커리어 지속성과 대표팀 누적이 큽니다.",
    },
    prime: {
      period: "2010-18 Inter/Galatasaray/Japan",
      evidence: ["Inter long stay after 2011 Asian Cup", "2013 AFC Asian International Player of the Year", "Galatasaray back-to-back league titles"],
      skills: ["Recovery pace", "two-sided fullback usage", "overlapping runs", "stamina", "man-marking mobility"],
      verdict: "일본 풀백의 유럽 지속성 기준점에 가까운 프라임입니다.",
    },
    importance: {
      roles: ["Japan: long-term left-back and senior leader", "Inter/Galatasaray: high-work-rate flank defender", "FC Tokyo: career bookend and domestic symbol"],
      moments: ["2011 Asian Cup", "World Cup appearances across four editions", "Galatasaray title seasons"],
      verdict: "대표팀 내 누적 비중이 특히 크고 클럽에서도 장기 생존력을 증명했습니다.",
    },
    legacy: {
      reasons: ["AFC Asian Cup 2011", "four World Cups", "Inter/Galatasaray European career", "Japan cap total"],
      context: ["Japan all-time fullback debate", "Asian fullback export benchmark"],
      verdict: "100년 뒤에도 일본 대표팀 장수형 풀백의 대표 사례로 남을 가능성이 큽니다.",
    },
    sources: [
      { label: "Inter - Yuto Nagatomo profile archive", url: "https://www.inter.it/it/archivio_giocatore/G0874" },
      { label: "Wikipedia - Yuto Nagatomo", url: "https://en.wikipedia.org/wiki/Y%C5%ABto_Nagatomo" },
    ],
  }),
  "우치다 아쓰토": makeFocusedProfile({
    summary:
      "Atsuto Uchida는 Kashima의 J1 3연패와 Schalke의 Champions League/DFB-Pokal 시기를 연결한 일본 오른쪽 풀백입니다.",
    team: {
      clubs: ["Kashima Antlers", "Schalke 04", "Union Berlin", "Kashima Antlers second spell", "Japan national team"],
      clubHonours: ["Kashima Antlers: J1 League 2007, 2008, 2009; Emperor's Cup 2007; Japanese Super Cup 2009", "Schalke 04: DFB-Pokal 2010-11; DFL-Supercup 2011", "Kashima Antlers: AFC Champions League 2018 squad context"],
      nationalHonours: ["Japan: AFC Asian Cup 2011", "Japan: FIFA World Cup appearances 2010, 2014"],
      verdict: "J1 왕조와 Schalke 컵 우승을 동시에 가진 풀백 커리어입니다.",
    },
    individual: {
      awards: ["J.League Best XI selections", "Bundesliga team-of-season-level recognition in Schalke peak years"],
      records: ["One of Japan's earliest Champions League knockout-stage regular fullbacks", "Young fullback starter in Japan World Cup cycle"],
      verdict: "부상으로 누적은 줄었지만 유럽 고점과 국내 왕조 기여가 좋습니다.",
    },
    prime: {
      period: "2007-14 Kashima/Schalke/Japan",
      evidence: ["Kashima J1 three-peat", "Schalke DFB-Pokal 2010-11", "Schalke Champions League regular role"],
      skills: ["Right-side acceleration", "overlapping", "recovery defending", "crossing", "tactical discipline"],
      verdict: "일본 오른쪽 풀백 고점 기준으로 상위권입니다.",
    },
    importance: {
      roles: ["Kashima: young starter in domestic dynasty", "Schalke: Champions League-era right-back", "Japan: 2010s right-back option"],
      moments: ["Kashima 2007-09 J1 run", "Schalke 2010-11 cup/Europe run", "2014 World Cup role"],
      verdict: "클럽 커리어 고점은 강하지만 부상 이후 장기 대표팀 비중은 제한됐습니다.",
    },
    legacy: {
      reasons: ["Kashima J1 three-peat", "Schalke DFB-Pokal", "Champions League regularity", "2011 Asian Cup"],
      context: ["Japan European fullback lineage with Nagatomo", "injury-shortened but respected peak"],
      verdict: "누적보다 고점형 풀백으로 기억될 가능성이 큽니다.",
    },
    sources: [
      { label: "Wikipedia - Atsuto Uchida", url: "https://en.wikipedia.org/wiki/Atsuto_Uchida" },
      { label: "UEFA 2010-11 media guide excerpt", url: "https://www.uefa.com/MultimediaFiles/Download/EuroExperience/uefaorg/Publications/01/53/55/89/1535589_DOWNLOAD.pdf" },
    ],
  }),
  "나카자와 유지": makeFocusedProfile({
    summary:
      "Yuji Nakazawa는 Yokohama F. Marinos의 2003-04 J.League 연속 우승과 Japan의 2000/2004 Asian Cup 우승을 지킨 센터백입니다.",
    team: {
      clubs: ["Verdy Kawasaki/Tokyo Verdy", "Yokohama F. Marinos", "Japan national team"],
      clubHonours: ["Yokohama F. Marinos: J1 League 2003, 2004", "Yokohama F. Marinos: Emperor's Cup 2013"],
      nationalHonours: ["Japan: AFC Asian Cup 2000, 2004", "Japan: FIFA World Cup appearances 2006, 2010"],
      verdict: "클럽 리그 우승과 대표팀 아시안컵 우승이 모두 있는 일본 센터백 상위 커리어입니다.",
    },
    individual: {
      awards: ["J.League MVP: 2004", "Japanese Footballer of the Year: 2004", "J.League Best XI: five selections"],
      records: ["Yokohama F. Marinos long-term defensive icon", "Japan 100-cap tier centre-back"],
      verdict: "센터백으로 J.League MVP를 받은 점이 개인 평가에서 매우 큽니다.",
    },
    prime: {
      period: "2003-10 Yokohama/Japan",
      evidence: ["Yokohama 2003-04 league titles", "2004 J.League MVP", "2004 Asian Cup title"],
      skills: ["Aerial duels", "penalty-box defending", "durability", "one-v-one defending", "set-piece threat"],
      verdict: "국내 리그와 대표팀을 동시에 지탱한 센터백 프라임입니다.",
    },
    importance: {
      roles: ["Yokohama F. Marinos: defensive leader", "Japan: 2000s centre-back core"],
      moments: ["2004 J.League title/MVP", "2004 Asian Cup retention", "2010 World Cup defensive campaign"],
      verdict: "대표팀과 클럽 모두에서 수비 라인의 기준점 역할을 했습니다.",
    },
    legacy: {
      reasons: ["J.League MVP 2004", "two Asian Cup titles", "Yokohama league titles", "long-term domestic icon"],
      context: ["Japan all-time centre-back debate with Ihara/Yoshida/Tomiyasu", "domestic-defender benchmark"],
      verdict: "일본 센터백 역사에서 반드시 비교 대상이 되는 선수입니다.",
    },
    sources: [
      { label: "J.League - Nakazawa contract renewal", url: "https://www.jleague.co/news/f-marinos-renew-with-veteran-nakazawa/" },
      { label: "Japan Times - Nakazawa Footballer of the Year", url: "https://www.japantimes.co.jp/sports/2005/03/02/soccer/j-league/defender-nakazawa-honored-by-soccer-writers/" },
      { label: "Wikipedia - Yuji Nakazawa", url: "https://en.wikipedia.org/wiki/Yuji_Nakazawa" },
    ],
  }),
  "이하라 마사미": makeFocusedProfile({
    summary:
      "Masami Ihara는 'Wall of Asia'로 불린 일본 1990년대 대표팀 주장 센터백이자 1995 Asian Footballer of the Year 수상자입니다.",
    team: {
      clubs: ["Nissan Motors/Yokohama Marinos", "Jubilo Iwata", "Urawa Red Diamonds", "Japan national team"],
      clubHonours: ["Nissan/Yokohama Marinos: Emperor's Cup 1991, 1992; Asian Cup Winners' Cup 1991-92, 1992-93; J.League 1995", "Yokohama Marinos: domestic cups/titles across early J.League transition"],
      nationalHonours: ["Japan: AFC Asian Cup 1992", "Japan: FIFA World Cup 1998 captain", "Japan: Dynasty Cup 1992"],
      verdict: "일본 대표팀 첫 아시안컵 우승과 J.League 초기 클럽 성공을 모두 가진 수비수입니다.",
    },
    individual: {
      awards: ["Asian Footballer of the Year: 1995", "J.League Best XI: 1993, 1994, 1995, 1996, 1997", "JFA Hall of Fame"],
      records: ["Japan 120-cap tier", "Captain of Japan's first World Cup team in 1998"],
      verdict: "센터백으로 Asian Footballer of the Year를 받은 역사성이 매우 큽니다.",
    },
    prime: {
      period: "1992-98 Yokohama/Japan",
      evidence: ["1992 Asian Cup", "1995 Asian Footballer of the Year", "1998 World Cup captaincy"],
      skills: ["Sweeping", "cover defending", "calm decision-making", "leadership", "aerial positioning"],
      verdict: "프로화 초창기 일본 수비 기준을 만든 프라임입니다.",
    },
    importance: {
      roles: ["Japan: national-team captain and defensive organizer", "Yokohama Marinos: early J.League defensive pillar"],
      moments: ["1992 Asian Cup title", "1998 World Cup captaincy", "five straight J.League Best XI selections"],
      verdict: "대표팀 상징성과 수비 조직 비중이 매우 강합니다.",
    },
    legacy: {
      reasons: ["Asian Footballer of the Year 1995", "Japan first World Cup captain", "JFA Hall of Fame", "Wall of Asia identity"],
      context: ["Japan's pre-Nakazawa/Yoshida centre-back benchmark", "professional-era defensive pioneer"],
      verdict: "일본 대표팀 역사 서사에서는 수비수 중 최상위권으로 남습니다.",
    },
    sources: [
      { label: "JFA Hall of Fame - Masami Ihara", url: "https://www.jfa.jp/eng/about_jfa/hall_of_fame/member/IHARA_Masami.html" },
      { label: "RSSSF - Asian Player of the Year", url: "https://www.rsssf.org/miscellaneous/as-poy.html" },
      { label: "Wikipedia - Masami Ihara", url: "https://en.wikipedia.org/wiki/Masami_Ihara" },
    ],
  }),
  "요시다 마야": makeFocusedProfile({
    summary:
      "Maya Yoshida는 Premier League 장기 생존과 Japan captaincy, 2011 Asian Cup 우승을 가진 현대 일본 센터백입니다.",
    team: {
      clubs: ["Nagoya Grampus", "VVV-Venlo", "Southampton", "Sampdoria", "Schalke 04", "LA Galaxy", "Japan national team"],
      clubHonours: ["Nagoya Grampus: J1 League 2010", "Southampton: EFL Cup runner-up 2016-17"],
      nationalHonours: ["Japan: AFC Asian Cup 2011", "Japan: AFC Asian Cup runner-up 2019", "Japan: FIFA World Cup appearances 2014, 2018, 2022"],
      verdict: "우승 트로피 총량은 제한적이지만 Premier League 장기 주전성과 대표팀 주장 이력이 큽니다.",
    },
    individual: {
      awards: ["Japan captaincy recognition", "Southampton long-service defensive leader recognition", "AFC Asian Cup Team of the Tournament-level tournament recognition"],
      records: ["Japan 120-cap tier", "Captain of Japan at the 2022 World Cup"],
      verdict: "공식 개인상보다 장기 주전성, 주장직, 빅리그 생존력이 평가 포인트입니다.",
    },
    prime: {
      period: "2012-19 Southampton/Japan",
      evidence: ["Southampton Premier League regular seasons", "2018 World Cup last-16 run", "2019 Asian Cup final run as senior leader"],
      skills: ["Aerial defending", "line leadership", "right-foot build-up", "set-piece threat", "big-league adaptability"],
      verdict: "일본 센터백의 Premier League 지속성 기준을 만든 프라임입니다.",
    },
    importance: {
      roles: ["Japan: captain and back-line leader", "Southampton: long-serving centre-back", "Olympic/Japan senior squads: senior organizer"],
      moments: ["2011 Asian Cup", "2018 World Cup Belgium last-16", "2022 World Cup group win over Germany/Spain"],
      verdict: "대표팀 비중이 특히 크고 클럽에서는 장기 신뢰도가 핵심입니다.",
    },
    legacy: {
      reasons: ["Japan captaincy", "three World Cups", "Premier League long spell", "AFC Asian Cup 2011"],
      context: ["modern Japanese centre-back benchmark before Tomiyasu/Kim Min-jae Asian comparison era", "leadership and durability profile"],
      verdict: "일본 현대 수비수 계보에서 장기 누적형 레전드로 남습니다.",
    },
    sources: [
      { label: "Japan Times - Yoshida Schalke move", url: "https://www.japantimes.co.jp/sports/2022/07/06/soccer/yoshida-schalke-transfer/" },
      { label: "Wikipedia - Maya Yoshida", url: "https://en.wikipedia.org/wiki/Maya_Yoshida" },
    ],
  }),
  "토미야스 타케히로": makeFocusedProfile({
    summary:
      "Takehiro Tomiyasu는 Bologna와 Arsenal에서 멀티 수비수로 검증된 현역 일본 수비수입니다. 부상과 커리어 진행 중이라는 점 때문에 점수는 보수적으로 둡니다.",
    team: {
      clubs: ["Avispa Fukuoka", "Sint-Truiden", "Bologna", "Arsenal", "Ajax", "Japan national team"],
      clubHonours: ["Arsenal: FA Community Shield 2023", "Arsenal: Premier League title-contending squad era context"],
      nationalHonours: ["Japan: AFC Asian Cup runner-up 2019", "Japan: FIFA World Cup 2022 last-16 squad", "Japan: AFC Asian Cup 2023 squad context"],
      verdict: "아직 우승 누적은 적지만 Serie A/Premier League에서의 수비 고점이 중요합니다.",
    },
    individual: {
      awards: ["Bologna/Arsenal defensive-performance recognition", "Japan Pro-Footballers Association Awards Best XI-level recognition"],
      records: ["One of Japan's most complete modern defenders", "Premier League/Serie A proven Japanese centre-back/fullback"],
      verdict: "개인상은 적지만 수비 포지션 멀티성과 리그 난이도가 평가를 끌어올립니다.",
    },
    prime: {
      period: "2019-24 Bologna/Arsenal/Japan",
      evidence: ["Bologna Serie A breakout", "Arsenal Premier League title-race squads", "Japan 2022 World Cup defensive role"],
      skills: ["One-v-one defending", "two-footed build-up", "centre-back/fullback versatility", "aerial duels", "recovery defending"],
      verdict: "부상 전 고점은 일본 수비수 중 최고급이지만 지속성 검증이 더 필요합니다.",
    },
    importance: {
      roles: ["Arsenal: tactical defensive rotation across the back line", "Japan: elite defender when fit", "Bologna: development-to-breakout platform"],
      moments: ["Arsenal 2022-24 title-race seasons", "Japan 2022 World Cup", "Serie A to Premier League progression"],
      verdict: "클럽 전술 가치가 크지만 부상 때문에 연속 비중은 제한됐습니다.",
    },
    legacy: {
      reasons: ["Arsenal/Premier League profile", "Serie A breakout", "AFC Asian Cup 2019 runner-up", "modern multi-defender archetype"],
      context: ["active-hold, legacy still forming", "Japan defender ceiling debate with Yoshida/Nakazawa/Ihara"],
      verdict: "건강과 우승 누적에 따라 일본 수비수 순위가 더 올라갈 수 있습니다.",
    },
    sources: [
      { label: "Ajax - Takehiro Tomiyasu", url: "https://english.ajax.nl/articles/ajax-signs-takehiro-tomiyasu" },
      { label: "Arsenal - Takehiro Tomiyasu", url: "https://www.arsenal.com/men/players/takehiro-tomiyasu" },
      { label: "Wikipedia - Takehiro Tomiyasu", url: "https://en.wikipedia.org/wiki/Takehiro_Tomiyasu" },
    ],
  }),
  "가와구치 요시카쓰": makeFocusedProfile({
    summary:
      "Yoshikatsu Kawaguchi는 2000/2004 Asian Cup 우승과 2004 Jordan전 승부차기 서사로 남는 일본 대표팀 골키퍼입니다.",
    team: {
      clubs: ["Yokohama Marinos/Yokohama F. Marinos", "Portsmouth", "Nordsjaelland", "Jubilo Iwata", "FC Gifu", "SC Sagamihara", "Japan national team"],
      clubHonours: ["Yokohama Marinos: J1 League 1995", "Yokohama F. Marinos: J.League Cup 2001"],
      nationalHonours: ["Japan: AFC Asian Cup 2000, 2004", "Japan: FIFA Confederations Cup runner-up 2001", "Japan: FIFA World Cup squads 1998, 2002, 2006, 2010"],
      verdict: "클럽보다 대표팀 토너먼트 성과와 장기 주전성이 훨씬 강한 골키퍼입니다.",
    },
    individual: {
      awards: ["2000 AFC Asian Cup final Man of the Match", "J.League Best XI/goalkeeper recognition", "Japan 100-cap tier goalkeeper"],
      records: ["Japan World Cup squad across four editions", "Iconic 2004 Asian Cup penalty-shootout performance vs Jordan"],
      verdict: "골키퍼 특성상 특정 토너먼트 장면과 대표팀 누적이 평가를 좌우합니다.",
    },
    prime: {
      period: "1997-2006 Japan/Yokohama/Jubilo",
      evidence: ["1998 World Cup starting era", "2000 Asian Cup final Man of the Match", "2004 Asian Cup penalty-shootout heroics"],
      skills: ["Shot stopping", "penalty saving", "reaction saves", "big-match aggression", "goal-line presence"],
      verdict: "토너먼트 승부차기와 단기 반응속도 고점이 강한 골키퍼 프라임입니다.",
    },
    importance: {
      roles: ["Japan: first-choice/major-tournament goalkeeper", "Yokohama: early J.League title-era goalkeeper"],
      moments: ["2000 Asian Cup final", "2004 Asian Cup quarter-final penalties vs Jordan", "2001 Confederations Cup runner-up"],
      verdict: "대표팀 대회에서의 장면 비중이 일본 골키퍼 중 최고권입니다.",
    },
    legacy: {
      reasons: ["two Asian Cup titles", "2004 penalty legend", "four World Cup squads", "Japan 100-cap tier"],
      context: ["Japan all-time goalkeeper debate with Kawashima", "big-tournament memory profile"],
      verdict: "승부차기와 아시안컵 서사 때문에 오래 회자될 골키퍼입니다.",
    },
    sources: [
      { label: "UEFA - Japan retain Asian crown", url: "https://www.uefa.com/news-media/news/0254-0d7b26412328-f7505a4fad4f-1000--japan-retain-asian-crown/" },
      { label: "Wikipedia - 2000 AFC Asian Cup final", url: "https://en.wikipedia.org/wiki/2000_AFC_Asian_Cup_final" },
      { label: "Wikipedia - Yoshikatsu Kawaguchi", url: "https://en.wikipedia.org/wiki/Yoshikatsu_Kawaguchi" },
    ],
  }),
  "가와시마 에이지": makeFocusedProfile({
    summary:
      "Eiji Kawashima는 2011 Asian Cup 우승 골키퍼이자 유럽 여러 리그와 Japan 월드컵 4회 사이클을 버틴 장수형 골키퍼입니다.",
    team: {
      clubs: ["Omiya Ardija", "Nagoya Grampus Eight", "Kawasaki Frontale", "Lierse", "Standard Liege", "Dundee United", "Metz", "Strasbourg", "Jubilo Iwata", "Japan national team"],
      clubHonours: ["Kawasaki Frontale: J.League Cup runner-up and title-challenge era context", "European career: Belgium, Scotland and France top-flight/second-tier spells"],
      nationalHonours: ["Japan: AFC Asian Cup 2011", "Japan: FIFA World Cup squads 2010, 2014, 2018, 2022"],
      verdict: "클럽 우승 총량은 약하지만 대표팀 주전성과 유럽 장기 커리어가 핵심입니다.",
    },
    individual: {
      awards: ["Japan national-team long-service goalkeeper recognition", "Belgium/France first-choice spells and club-level goalkeeper recognition"],
      records: ["Japan 95-cap tier goalkeeper", "World Cup squad across four editions"],
      verdict: "공식 개인상보다 대표팀 주전 누적과 유럽 생존력이 평가 포인트입니다.",
    },
    prime: {
      period: "2010-18 Japan/Lierse/Standard/Metz",
      evidence: ["2011 Asian Cup title as starting goalkeeper", "2010/2014/2018 World Cup starting eras", "long European goalkeeper career"],
      skills: ["Reflex saves", "penalty-area command", "shot stopping", "communication", "experience management"],
      verdict: "최고점보다 장기 안정성과 대표팀 신뢰도가 강한 프라임입니다.",
    },
    importance: {
      roles: ["Japan: long-term tournament goalkeeper", "European clubs: experienced first-choice/rotation goalkeeper", "Jubilo/Nagoya/Kawasaki: domestic career base"],
      moments: ["2011 Asian Cup", "2018 World Cup Belgium last-16", "four World Cup squads"],
      verdict: "대표팀 내 누적 비중은 매우 크지만 클럽 타이틀 비중은 제한적입니다.",
    },
    legacy: {
      reasons: ["AFC Asian Cup 2011", "four World Cup squads", "long European goalkeeper career", "Japan 95-cap tier"],
      context: ["Japan all-time goalkeeper debate with Kawaguchi", "longevity and Europe-path goalkeeper profile"],
      verdict: "대표팀 장수성과 월드컵 반복 출전으로 일본 골키퍼 계보에 남습니다.",
    },
    sources: [
      { label: "MLS - Eiji Kawashima profile", url: "https://www.mlssoccer.com/players/eiji-kawashima/" },
      { label: "Wikipedia - Eiji Kawashima", url: "https://en.wikipedia.org/wiki/Eiji_Kawashima" },
    ],
  }),
  "나카타 히데토시": makeFocusedProfile({
    summary:
      "Hidetoshi Nakata는 Serie A에서 Scudetto를 경험하고 AFC Player of the Year를 2회 수상한 일본 축구의 글로벌 선구자입니다.",
    team: {
      clubs: ["Bellmare Hiratsuka", "Perugia", "Roma", "Parma", "Bologna loan", "Fiorentina", "Bolton Wanderers loan", "Japan U23", "Japan national team"],
      clubHonours: ["Roma: Serie A 2000-01", "Parma: Coppa Italia 2001-02"],
      nationalHonours: ["Japan: AFC Asian Cup 2000", "Japan: FIFA World Cup appearances 1998, 2002, 2006"],
      verdict: "일본 선수의 유럽 빅리그 개척사에서 팀 커리어와 상징성이 모두 큽니다.",
    },
    individual: {
      awards: ["AFC Player of the Year: 1997, 1998", "Japanese Footballer of the Year: 1997", "FIFA 100"],
      records: ["One of the first Japanese players to make a major Serie A impact", "Three FIFA World Cups for Japan"],
      verdict: "아시아 올해의 선수 2회와 Serie A 개척성이 개인 평가의 핵심입니다.",
    },
    prime: {
      period: "1998-99 Perugia to 2001-02 Roma/Parma",
      evidence: ["Serie A impact immediately after 1998 World Cup", "Roma Scudetto season contribution", "Parma Coppa Italia 2001-02"],
      skills: ["Ball carrying from midfield", "long shooting", "press resistance", "creative passing", "tactical versatility"],
      verdict: "일본 선수의 유럽 중앙 미드필더 프라임 기준점입니다.",
    },
    importance: {
      roles: ["Japan: late-1990s/early-2000s global face", "Roma/Parma: high-value creative midfielder"],
      moments: ["Japan's first World Cup generation", "Roma title season squad role", "Parma Coppa Italia final contribution"],
      verdict: "대표팀과 일본 축구 세계화에서 상징 비중이 매우 큽니다.",
    },
    legacy: {
      reasons: ["AFC Player of the Year twice", "Serie A Scudetto with Roma", "FIFA 100", "Japan global football pioneer"],
      context: ["Japanese all-time best debate", "Asian Serie A benchmark"],
      verdict: "일본 축구의 세계화 서사에서 반드시 남을 이름입니다.",
    },
    sources: [
      { label: "Wikipedia - Hidetoshi Nakata", url: "https://en.wikipedia.org/wiki/Hidetoshi_Nakata" },
      { label: "AFC Player of the Year list", url: "https://en.wikipedia.org/wiki/Asian_Footballer_of_the_Year" },
    ],
  }),
  "혼다 케이스케": makeFocusedProfile({
    summary:
      "Keisuke Honda는 Japan 대표팀의 월드컵/아시안컵 해결사이자 CSKA Moscow와 AC Milan을 거친 왼발 공격형 미드필더입니다.",
    team: {
      clubs: ["Nagoya Grampus", "VVV-Venlo", "CSKA Moscow", "AC Milan", "Pachuca", "Melbourne Victory", "Vitesse", "Botafogo", "Neftci", "Suduva", "Japan national team"],
      clubHonours: ["CSKA Moscow: Russian Premier League 2012-13; Russian Cup 2010-11, 2012-13; Russian Super Cup 2013"],
      nationalHonours: ["Japan: AFC Asian Cup 2011", "Japan: FIFA World Cup appearances 2010, 2014, 2018"],
      verdict: "클럽 우승보다 대표팀 토너먼트 비중과 월드컵 득점 기록이 큰 선수입니다.",
    },
    individual: {
      awards: ["AFC Asian Cup Most Valuable Player: 2011", "AFC Asian International Player of the Year shortlist/recognition era", "VVV-Venlo Player of the Year: 2008-09"],
      records: ["Japan joint/leading World Cup scoring icon across multiple tournaments", "Goals and assists in three different World Cups"],
      verdict: "아시안컵 MVP와 월드컵 반복 생산성이 핵심입니다.",
    },
    prime: {
      period: "2010 World Cup to 2014 CSKA/AC Milan period",
      evidence: ["2010 World Cup free-kick and knockout run", "2011 Asian Cup MVP", "CSKA Champions League-level experience"],
      skills: ["Left-foot free kicks", "central playmaking", "long passing", "set-piece delivery", "big-game shooting"],
      verdict: "대표팀 토너먼트 기준으로 일본 최고급 프라임입니다.",
    },
    importance: {
      roles: ["Japan: attacking hub and set-piece leader", "CSKA Moscow: creative midfielder in title-winning squad"],
      moments: ["2010 World Cup Denmark free-kick", "2011 Asian Cup MVP run", "2018 World Cup late impact vs Senegal"],
      verdict: "일본 대표팀에서는 골과 리더십 모두에서 핵심이었습니다.",
    },
    legacy: {
      reasons: ["2011 Asian Cup MVP", "World Cup goals across three tournaments", "AC Milan number 10 symbolism"],
      context: ["Japan modern attacking midfielder benchmark with Nakata/Kagawa/Nakamura"],
      verdict: "국가대표 토너먼트 서사 때문에 장기 기억이 강합니다.",
    },
    sources: [
      { label: "AFC - Keisuke Honda profile", url: "https://www.the-afc.com/en/national/fifa_world_cup/news/one_to_watch_keisuke_honda_jpn.html" },
      { label: "CSKA - Honda Asian Cup MVP", url: "https://en.pfc-cska.com/news/team-news/Congratulations-to-Honda-2/" },
      { label: "Wikipedia - Keisuke Honda", url: "https://en.wikipedia.org/wiki/Keisuke_Honda" },
    ],
  }),
  "나카무라 슌스케": makeFocusedProfile({
    summary:
      "Shunsuke Nakamura는 Celtic의 우승기와 Japan 대표팀의 아시안컵 세대를 대표하는 왼발 플레이메이커입니다.",
    team: {
      clubs: ["Yokohama Marinos", "Reggina", "Celtic", "Espanyol", "Yokohama F. Marinos", "Jubilo Iwata", "Yokohama FC", "Japan national team"],
      clubHonours: ["Celtic: Scottish Premier League 2005-06, 2006-07, 2007-08; Scottish Cup 2006-07; Scottish League Cup 2005-06, 2008-09", "Yokohama F. Marinos: J1 League 1995, 2000 stages/context and later domestic honours context"],
      nationalHonours: ["Japan: AFC Asian Cup 2000, 2004", "Japan: FIFA World Cup appearances 2006, 2010"],
      verdict: "Celtic 팀 커리어와 Japan 아시안컵 성과가 모두 탄탄합니다.",
    },
    individual: {
      awards: ["AFC Asian Cup Most Valuable Player: 2004", "SPFA Players' Player of the Year: 2006-07", "Scottish Football Writers' Player of the Year: 2006-07", "J.League MVP: 2000, 2013"],
      records: ["Famous Champions League free-kicks against Manchester United", "Japan set-piece icon"],
      verdict: "리그 MVP와 아시안컵 MVP를 모두 가진 창조형 미드필더입니다.",
    },
    prime: {
      period: "2004 Asian Cup to 2006-07 Celtic",
      evidence: ["2004 Asian Cup MVP", "2006-07 Celtic league title and player awards", "Champions League free-kick vs Manchester United"],
      skills: ["Free kicks", "left-foot passing", "crossing", "tempo control", "set-piece chance creation"],
      verdict: "왼발 킥과 세트피스 프라임은 아시아 역대 최고권입니다.",
    },
    importance: {
      roles: ["Celtic: creative and set-piece centre", "Japan: left-foot playmaking and dead-ball specialist"],
      moments: ["Title-clinching free-kick for Celtic", "Manchester United Champions League goals", "2004 Asian Cup MVP run"],
      verdict: "Celtic와 Japan 모두에서 창의성의 중심이었습니다.",
    },
    legacy: {
      reasons: ["Asian Cup MVP", "Scottish player awards", "Champions League free-kick legacy", "J.League long-term greatness"],
      context: ["Japan technical midfielder lineage", "Asia's set-piece specialist benchmark"],
      verdict: "기술형 플레이메이커 계보에서 장기 보존될 이름입니다.",
    },
    sources: [
      { label: "Wikipedia - Shunsuke Nakamura", url: "https://en.wikipedia.org/wiki/Shunsuke_Nakamura" },
      { label: "Celtic Wiki - Nakamura SPFA award", url: "https://www.thecelticwiki.com/nakamura-prize-asset-spfa-player-of-the-year-apr-2007/" },
    ],
  }),
  "카가와 신지": makeFocusedProfile({
    summary:
      "Shinji Kagawa는 Klopp Dortmund의 2연속 Bundesliga 우승과 Manchester United Premier League 우승을 모두 경험한 일본 공격형 미드필더입니다.",
    team: {
      clubs: ["Cerezo Osaka", "Borussia Dortmund", "Manchester United", "Borussia Dortmund second spell", "Besiktas loan", "Real Zaragoza", "PAOK", "Sint-Truiden", "Cerezo Osaka second spell", "Japan national team"],
      clubHonours: ["Borussia Dortmund: Bundesliga 2010-11, 2011-12; DFB-Pokal 2011-12", "Manchester United: Premier League 2012-13; FA Community Shield 2013"],
      nationalHonours: ["Japan: AFC Asian Cup 2011", "Japan: FIFA World Cup appearances 2014, 2018"],
      verdict: "팀 커리어는 아시아 공격형 미드필더 중 매우 강합니다.",
    },
    individual: {
      awards: ["AFC Asian International Player of the Year: 2012", "Bundesliga Team/season recognitions in Dortmund peak era", "First Asian player to score a Premier League hat-trick"],
      records: ["First Japanese player to play for Manchester United and win Premier League", "Key Asian star of Klopp Dortmund"],
      verdict: "개인상보다 Dortmund 프라임과 Premier League 선구성이 중요합니다.",
    },
    prime: {
      period: "2010-11 to 2011-12 Borussia Dortmund",
      evidence: ["Two Bundesliga titles with Dortmund", "2011-12 domestic double", "High creative output in Klopp pressing system"],
      skills: ["Half-space receiving", "quick combinations", "late box runs", "pressing", "one-touch play"],
      verdict: "Dortmund 시절 프라임은 아시아 공격형 미드필더 최고권입니다.",
    },
    importance: {
      roles: ["Borussia Dortmund: central attacking midfielder in Klopp system", "Japan: attacking midfield option in 2010s generation"],
      moments: ["Dortmund title-winning seasons", "Manchester United hat-trick vs Norwich", "AFC Asian International Player recognition"],
      verdict: "클럽 프라임의 전술적 비중이 대표팀 비중보다 더 강합니다.",
    },
    legacy: {
      reasons: ["Two Bundesliga titles", "Premier League title", "AFC International Player of the Year", "Japanese Manchester United pioneer"],
      context: ["Japan European attacking-midfielder benchmark with Nakata/Honda/Nakamura"],
      verdict: "Dortmund 프라임 때문에 일본 유럽파 역사에서 계속 남습니다.",
    },
    sources: [
      { label: "Bundesliga - Shinji Kagawa", url: "https://www.bundesliga.com/en/bundesliga/news/shinji-kagawa-10-things-about-borussia-dortmund-s-japanese-samurai-2738-1197" },
      { label: "Premier League - Kagawa", url: "https://www.premierleague.com/en/news/760375" },
      { label: "AFC - Asian Icons Shinji Kagawa", url: "https://www.the-afc.com/en/more/news/asian_icons_shinji_kagawa.html" },
    ],
  }),
  "ali daei": makeFocusedProfile({
    summary:
      "Ali Daei는 108골 이상의 A매치 득점 기록과 AFC Asian Cup 득점 기록으로 남는 이란의 역사적 스트라이커입니다.",
    team: {
      clubs: ["Esteghlal Ardabil", "Taxirani", "Bank Tejarat", "Persepolis", "Al Sadd", "Arminia Bielefeld", "Bayern Munich", "Hertha BSC", "Al Shabab", "Saba Battery", "Saipa", "Iran national team"],
      clubHonours: ["Bayern Munich: Bundesliga 1998-99", "Persepolis/Saba/Saipa: Iranian domestic titles and cups across career"],
      nationalHonours: ["Iran: Asian Games gold medal 1998", "Iran: FIFA World Cup appearances 1998, 2006"],
      verdict: "클럽 커리어보다 대표팀 득점과 아시아 대회 기록이 핵심입니다.",
    },
    individual: {
      awards: ["AFC Asian Footballer of the Year: 1999", "AFC Asian Cup top scorer: 1996", "IFFHS world's top international goal scorer recognition"],
      records: ["Iran all-time top scorer", "Former world record men's international goalscorer", "AFC Asian Cup all-time top scorer"],
      verdict: "기록형 개인 커리어는 아시아 공격수 중 최상위입니다.",
    },
    prime: {
      period: "1996 Asian Cup to early-2000s Iran/Bundesliga period",
      evidence: ["1996 Asian Cup 8 goals", "1998 Asian Games gold", "international scoring record ascent"],
      skills: ["Box finishing", "aerial power", "penalty-area positioning", "physical target play", "international scoring consistency"],
      verdict: "대표팀 득점 프라임은 아시아 역사적 기준점입니다.",
    },
    importance: {
      roles: ["Iran: absolute scoring reference", "Club career: first Iranian profile in Bundesliga elite context"],
      moments: ["Four goals vs South Korea at Asian Cup 1996", "breaking Puskas international scoring record", "Iran 1998 World Cup era"],
      verdict: "대표팀 내 비중은 아시아 축구사 전체에서도 최상위권입니다.",
    },
    legacy: {
      reasons: ["Former world men's international goals record", "AFC Asian Cup all-time top scorer", "AFC Player of the Year 1999"],
      context: ["Asia's record striker benchmark", "Iran all-time great debate"],
      verdict: "득점 기록 때문에 100년 뒤에도 반복 소환될 가능성이 큽니다.",
    },
    sources: [
      { label: "Wikipedia - Ali Daei", url: "https://en.wikipedia.org/wiki/Ali_Daei" },
      { label: "Tehran Times - IFFHS Asia Team", url: "https://www.tehrantimes.com/news/460705/Parvin-Daei-at-IFFHS-Asia-Team-of-the-XXth-Century" },
      { label: "AFC Asian Cup records", url: "https://en.wikipedia.org/wiki/AFC_Asian_Cup_records_and_statistics" },
    ],
  }),
  "tim cahill": makeFocusedProfile({
    summary:
      "Tim Cahill은 Everton과 Australia 대표팀의 역사적 득점 장면으로 남는 공격형 미드필더/세컨드 스트라이커입니다.",
    team: {
      clubs: ["Millwall", "Everton", "New York Red Bulls", "Shanghai Shenhua", "Hangzhou Greentown", "Melbourne City", "Millwall second spell", "Jamshedpur", "Australia national team"],
      clubHonours: ["Millwall: Football League Trophy 1998-99; FA Cup runner-up 2003-04", "New York Red Bulls: MLS Supporters' Shield 2013"],
      nationalHonours: ["Australia: AFC Asian Cup 2015", "Australia: FIFA World Cup appearances 2006, 2010, 2014, 2018"],
      verdict: "클럽 우승보다 Australia 대표팀 기록과 Everton 상징성이 큽니다.",
    },
    individual: {
      awards: ["AFC Asian Cup Team of the Tournament: 2015", "Oceania Footballer of the Year: 2004", "Australian football hall-of-fame level recognition"],
      records: ["Australia all-time top scorer", "First Australian to score at a FIFA World Cup", "Goals in three FIFA World Cups"],
      verdict: "국가대표 기록형 개인 커리어가 강합니다.",
    },
    prime: {
      period: "2004-12 Everton and Australia peak",
      evidence: ["Everton Premier League attacking output", "2006 World Cup goals", "2010/2014 World Cup scoring continuation", "2015 Asian Cup title"],
      skills: ["Late box runs", "heading despite size", "second-ball finishing", "set-piece threat", "big-game mentality"],
      verdict: "국제대회 득점 감각과 박스 침투는 아시아/오세아니아 기준 최고권입니다.",
    },
    importance: {
      roles: ["Australia: all-time scoring face", "Everton: long-term Premier League goal threat"],
      moments: ["2006 World Cup Japan comeback goals", "2014 World Cup volley vs Netherlands", "2015 Asian Cup home title"],
      verdict: "대표팀 서사에서 대체 불가능한 장면을 여러 번 만든 선수입니다.",
    },
    legacy: {
      reasons: ["Australia all-time top scorer", "World Cup goals across three editions", "2015 Asian Cup title", "Everton cult hero status"],
      context: ["Australia's greatest player debate", "AFC/Oceania crossover legend"],
      verdict: "월드컵 장면과 대표팀 기록 때문에 오래 남습니다.",
    },
    sources: [
      { label: "Football Australia - Socceroos honours", url: "https://www.footballaustralia.com.au/socceroos-honours-board" },
      { label: "ESPN - Tim Cahill career", url: "https://www.espn.com/football/story/_/id/21681159/tim-cahill-career-glance" },
      { label: "Wikipedia - Tim Cahill", url: "https://en.wikipedia.org/wiki/Tim_Cahill" },
    ],
  }),
  "lionel messi": makeFocusedProfile({
    summary:
      "Lionel Messi는 Ballon d'Or 8회, World Cup, Copa America, Champions League, Barcelona 시대 지배를 모두 가진 축구사 최고 앵커입니다.",
    team: {
      clubs: ["Barcelona", "Paris Saint-Germain", "Inter Miami", "Argentina U20", "Argentina Olympic", "Argentina national team"],
      clubHonours: ["Barcelona: La Liga 10회, Copa del Rey 7회, Supercopa de Espana 8회", "Barcelona: UEFA Champions League 2005-06, 2008-09, 2010-11, 2014-15; UEFA Super Cup 3회; FIFA Club World Cup 3회", "Paris Saint-Germain: Ligue 1 2021-22, 2022-23", "Inter Miami: Leagues Cup 2023, Supporters' Shield 2024"],
      nationalHonours: ["Argentina: FIFA World Cup 2022", "Argentina: Copa America 2021, 2024; runner-up 2007, 2015, 2016", "Argentina: Finalissima 2022", "Argentina U20: FIFA World Youth Championship 2005", "Argentina Olympic: Olympic gold medal 2008"],
      verdict: "클럽/대표팀 최고 대회 우승과 장기 지배력을 모두 가진 팀 커리어입니다.",
    },
    individual: {
      awards: ["Ballon d'Or: 8회", "FIFA World Player/The Best/FIFA Ballon d'Or 계열 최고 개인상 다수", "European Golden Shoe: 6회", "FIFA World Cup Golden Ball: 2014, 2022"],
      records: ["Barcelona all-time top scorer", "Argentina all-time top scorer", "La Liga all-time top scorer", "Most Ballon d'Or wins"],
      verdict: "개인 수상과 기록 누적 모두 축구사 최고 기준입니다.",
    },
    prime: {
      period: "2008-09 to 2014-15 Barcelona, with 2021-22 Argentina legacy peak",
      evidence: ["2008-09 and 2014-15 trebles", "2011 Champions League final performance", "2012 calendar-year scoring record", "2022 World Cup Golden Ball and title"],
      skills: ["All-time dribbling", "chance creation", "left-foot finishing", "false nine playmaking", "set pieces", "final pass"],
      verdict: "프라임 실력은 축구사 최고 논쟁의 중심입니다.",
    },
    importance: {
      roles: ["Barcelona: system-defining attacking core", "Argentina: captain and final-third creator/scorer", "Inter Miami: franchise-level transformation figure"],
      moments: ["2011 Champions League final", "2021 Copa America title run", "2022 World Cup knockout run and final"],
      verdict: "팀 자체가 Messi 중심으로 정의될 정도의 비중입니다.",
    },
    legacy: {
      reasons: ["World Cup + Copa America + Champions League + Ballon d'Or 8회", "Barcelona/Argentina all-time records", "global GOAT debate top reference"],
      context: ["Direct comparison with Pele and Maradona", "Modern football's statistical and creative ceiling"],
      verdict: "100년 뒤에도 축구사 최고 논쟁의 1번 기준으로 남습니다.",
    },
    sources: [
      { label: "Wikipedia - Lionel Messi", url: "https://en.wikipedia.org/wiki/Lionel_Messi" },
      { label: "FIFA - Lionel Messi", url: "https://www.fifa.com/" },
      { label: "FC Barcelona - Lionel Messi", url: "https://www.fcbarcelona.com/en/football/first-team/players/4974/lionel-messi" },
    ],
  }),
  pele: makeFocusedProfile({
    summary:
      "Pele는 World Cup 3회 우승, Santos 왕조, 축구의 세계적 아이콘성을 모두 가진 역사적 앵커입니다.",
    team: {
      clubs: ["Santos", "New York Cosmos", "Brazil national team"],
      clubHonours: ["Santos: Copa Libertadores 1962, 1963; Intercontinental Cup 1962, 1963", "Santos: Campeonato Brasileiro/Taca Brasil-era national titles and Campeonato Paulista titles", "New York Cosmos: NASL Soccer Bowl 1977"],
      nationalHonours: ["Brazil: FIFA World Cup 1958, 1962, 1970"],
      verdict: "월드컵 3회 우승과 Santos의 대륙/세계 정상 커리어가 결합된 최고권 팀 커리어입니다.",
    },
    individual: {
      awards: ["FIFA Player of the Century co-winner", "IOC Athlete of the Century recognition", "Ballon d'Or Prix d'Honneur 2013", "World Cup Best Young Player 1958"],
      records: ["Brazil all-time historical icon", "Official and unofficial scoring records across Santos/Brazil career", "Only player with three FIFA World Cup winner medals"],
      verdict: "현대 개인상 제도 이전 시대라 수상 총량보다 월드컵/세기의 선수 평가가 핵심입니다.",
    },
    prime: {
      period: "1958 World Cup to early/mid-1960s Santos peak, plus 1970 Brazil",
      evidence: ["1958 World Cup teenage breakthrough", "1962-63 Santos Libertadores/Intercontinental titles", "1970 World Cup all-time great team"],
      skills: ["Two-footed finishing", "heading", "dribbling", "creative passing", "athleticism", "big-game scoring"],
      verdict: "시대 지배력과 월드컵 고점 모두 최고권입니다.",
    },
    importance: {
      roles: ["Brazil: 1958 and 1970 attacking symbol", "Santos: global touring superclub face"],
      moments: ["1958 World Cup final", "1970 World Cup final assist and tournament leadership", "Intercontinental Cup performances"],
      verdict: "국가와 클럽 모두를 세계적 브랜드로 만든 선수입니다.",
    },
    legacy: {
      reasons: ["Three World Cups", "Brazil 1970 symbol", "global football ambassador", "Santos golden era"],
      context: ["GOAT debate with Messi and Maradona", "Football's first truly global superstar"],
      verdict: "축구사를 설명할 때 반드시 등장하는 이름입니다.",
    },
    sources: [
      { label: "Wikipedia - Pele", url: "https://en.wikipedia.org/wiki/Pel%C3%A9" },
      { label: "FIFA - Pele", url: "https://www.fifa.com/" },
      { label: "Britannica - Pele", url: "https://www.britannica.com/biography/Pele-Brazilian-athlete" },
    ],
  }),
  "diego maradona": makeFocusedProfile({
    summary:
      "Diego Maradona는 1986 World Cup과 Napoli 우승 서사로 대표되는 프라임·팀 내 비중형 최고 앵커입니다.",
    team: {
      clubs: ["Argentinos Juniors", "Boca Juniors", "Barcelona", "Napoli", "Sevilla", "Newell's Old Boys", "Boca Juniors second spell", "Argentina national team"],
      clubHonours: ["Boca Juniors: Argentine Primera Division 1981 Metropolitano", "Barcelona: Copa del Rey 1982-83, Copa de la Liga 1983", "Napoli: Serie A 1986-87, 1989-90; Coppa Italia 1986-87; UEFA Cup 1988-89; Supercoppa Italiana 1990"],
      nationalHonours: ["Argentina: FIFA World Cup 1986; runner-up 1990", "Argentina U20: FIFA World Youth Championship 1979"],
      verdict: "팀 커리어 총량보다 Napoli와 Argentina를 직접 끌어올린 질적 임팩트가 핵심입니다.",
    },
    individual: {
      awards: ["FIFA Player of the Century co-winner", "FIFA World Cup Golden Ball: 1986", "South American Footballer of the Year: 1979, 1980", "Serie A top assist/provider-era elite recognition"],
      records: ["1986 World Cup all-time tournament peak candidate", "Napoli all-time icon", "Goal of the Century and Hand of God match"],
      verdict: "1986 월드컵 개인 지배력은 개인 수상 이상의 역사적 무게를 가집니다.",
    },
    prime: {
      period: "1984-90 Napoli and Argentina",
      evidence: ["1986 World Cup Golden Ball and title", "Napoli's first Serie A title 1986-87", "UEFA Cup 1988-89"],
      skills: ["Close-control dribbling", "press resistance", "final pass", "free kicks", "carrying under fouls", "solo chance creation"],
      verdict: "프라임 실력과 팀 내 비중은 축구사 최고권입니다.",
    },
    importance: {
      roles: ["Argentina: 1986 team-defining captain", "Napoli: club history-transforming attacking core"],
      moments: ["1986 England quarter-final", "1986 World Cup final", "Napoli Scudetto seasons"],
      verdict: "선수 한 명이 팀의 역사적 위치를 바꾼 대표 사례입니다.",
    },
    legacy: {
      reasons: ["1986 World Cup", "Napoli transformation", "Argentina national myth", "two most famous goals in one match"],
      context: ["GOAT debate with Messi and Pele", "Prime/importance model for high score despite lower trophy total"],
      verdict: "100년 뒤에도 축구사 프라임과 신화성을 설명하는 핵심 이름입니다.",
    },
    sources: [
      { label: "Wikipedia - Diego Maradona", url: "https://en.wikipedia.org/wiki/Diego_Maradona" },
      { label: "FIFA - Diego Maradona", url: "https://www.fifa.com/" },
      { label: "Britannica - Diego Maradona", url: "https://www.britannica.com/biography/Diego-Maradona" },
    ],
  }),
  ronaldo: makeFocusedProfile({
    summary:
      "Ronaldo Nazario는 부상에도 불구하고 1990년대 후반과 2002 World Cup에서 순수 스트라이커 프라임의 최고 기준을 만든 선수입니다.",
    team: {
      clubs: ["Cruzeiro", "PSV Eindhoven", "Barcelona", "Inter", "Real Madrid", "AC Milan", "Corinthians", "Brazil national team"],
      clubHonours: ["Barcelona: Copa del Rey 1996-97, UEFA Cup Winners' Cup 1996-97", "Real Madrid: La Liga 2002-03, 2006-07; Intercontinental Cup 2002", "Corinthians: Campeonato Paulista 2009, Copa do Brasil 2009"],
      nationalHonours: ["Brazil: FIFA World Cup 1994, 2002; runner-up 1998", "Brazil: Copa America 1997, 1999", "Brazil: FIFA Confederations Cup 1997"],
      verdict: "클럽 우승 총량은 GOAT 앵커보다 낮지만 대표팀 성과와 월드컵 커리어가 강합니다.",
    },
    individual: {
      awards: ["Ballon d'Or: 1997, 2002", "FIFA World Player of the Year: 1996, 1997, 2002", "FIFA World Cup Golden Ball 1998; Golden Shoe 2002"],
      records: ["World Cup 15 goals", "Youngest FIFA World Player winner era", "Barcelona 1996-97 single-season phenomenon"],
      verdict: "프라임과 월드컵 개인상은 역대 스트라이커 최상위권입니다.",
    },
    prime: {
      period: "1996-98 Barcelona/Inter and 2002 Brazil comeback",
      evidence: ["1996-97 Barcelona explosive scoring", "1997 Ballon d'Or/FIFA World Player", "2002 World Cup Golden Shoe and final brace"],
      skills: ["Explosive acceleration", "one-v-one dribbling", "rounding goalkeepers", "two-foot finishing", "power at speed"],
      verdict: "순수 9번 프라임으로는 축구사 최고 논쟁권입니다.",
    },
    importance: {
      roles: ["Brazil: 2002 title-winning finishing core", "Barcelona/Inter: attack built around individual rupture"],
      moments: ["2002 World Cup final two goals", "1998 World Cup Golden Ball run", "1996-97 Compostela goal"],
      verdict: "부상이 아니었다면 더 높은 커리어 총량을 기대할 정도의 중심성이 있었습니다.",
    },
    legacy: {
      reasons: ["Two Ballons d'Or", "Three FIFA World Player awards", "2002 World Cup redemption", "striker prototype influence"],
      context: ["All-time striker debate with Pele, Muller, Van Basten, Cristiano", "Highest pure striker peak candidate"],
      verdict: "프라임 기준 스트라이커 평가에서 계속 기준점으로 남습니다.",
    },
    sources: [
      { label: "Wikipedia - Ronaldo", url: "https://en.wikipedia.org/wiki/Ronaldo_(Brazilian_footballer)" },
      { label: "FIFA - Ronaldo", url: "https://www.fifa.com/" },
    ],
  }),
  garrincha: makeFocusedProfile({
    summary:
      "Garrincha는 Brazil의 1958/1962 World Cup 우승과 드리블 윙어의 원형으로 남은 역사적 오른쪽 윙입니다.",
    team: {
      clubs: ["Botafogo", "Corinthians", "Portuguesa Carioca", "Atletico Junior", "Flamengo", "Olaria", "Brazil national team"],
      clubHonours: ["Botafogo: Campeonato Carioca 1957, 1961, 1962", "Botafogo: Rio-Sao Paulo Tournament 1962, 1964"],
      nationalHonours: ["Brazil: FIFA World Cup 1958, 1962"],
      verdict: "대표팀 월드컵 임팩트가 클럽 우승 총량보다 훨씬 큽니다.",
    },
    individual: {
      awards: ["FIFA World Cup Golden Ball: 1962", "FIFA World Cup Golden Boot: 1962 shared", "FIFA World Cup All-Star Team: 1958, 1962"],
      records: ["1962 World Cup carried Brazil after Pele injury", "Botafogo and Brazil all-time icon"],
      verdict: "1962 월드컵 개인 지배력 하나만으로도 최상위 개인 근거입니다.",
    },
    prime: {
      period: "1958-62 Brazil and Botafogo",
      evidence: ["1958 World Cup title", "1962 World Cup Golden Ball/Golden Boot/title", "Botafogo peak years"],
      skills: ["Unrepeatable dribbling", "right-wing isolation", "crossing", "change of direction", "crowd-pulling flair"],
      verdict: "드리블 윙어 프라임의 역사적 최고 기준 중 하나입니다.",
    },
    importance: {
      roles: ["Brazil: decisive attacker in 1962 after Pele injury", "Botafogo: era-defining right winger"],
      moments: ["1962 World Cup knockout performances", "Brazil's back-to-back World Cups"],
      verdict: "1962 Brazil에서의 비중은 절대적이었습니다.",
    },
    legacy: {
      reasons: ["Two World Cups", "1962 Golden Ball", "mythic dribbler identity", "Brazilian joy/futebol arte symbol"],
      context: ["All-time right-wing debate", "Brazilian genius archetype"],
      verdict: "숫자보다 스타일과 월드컵 서사로 영구 보존될 선수입니다.",
    },
    sources: [
      { label: "Wikipedia - Garrincha", url: "https://en.wikipedia.org/wiki/Garrincha" },
      { label: "FIFA - Garrincha", url: "https://www.fifa.com/" },
    ],
  }),
  zico: makeFocusedProfile({
    summary:
      "Zico는 1980년대 Brazil과 Flamengo를 대표한 공격형 미드필더로, 월드컵 우승 없이도 프라임 실력과 기술로 최고권에 남은 선수입니다.",
    team: {
      clubs: ["Flamengo", "Udinese", "Flamengo second spell", "Sumitomo Metals/Kashima Antlers", "Brazil national team"],
      clubHonours: ["Flamengo: Copa Libertadores 1981; Intercontinental Cup 1981", "Flamengo: Campeonato Brasileiro titles 1980, 1982, 1983, Copa Uniao 1987"],
      nationalHonours: ["Brazil: FIFA World Cup appearances 1978, 1982, 1986"],
      verdict: "Flamengo의 남미/세계 정상 커리어는 강하지만 대표팀 우승 부재가 총점 상한입니다.",
    },
    individual: {
      awards: ["South American Footballer of the Year: 1977, 1981, 1982", "World Soccer Player of the Year: 1983", "Brazilian Bola de Ouro/Placar awards multiple"],
      records: ["Flamengo all-time top scorer", "1982 Brazil all-time great team symbol", "Udinese Serie A impact"],
      verdict: "월드컵 우승 없이도 개인 평가와 클럽 상징성이 매우 강합니다.",
    },
    prime: {
      period: "1977-83 Flamengo/Brazil",
      evidence: ["1981 Libertadores and Intercontinental Cup", "1982 Brazil creative peak", "1983 World Soccer Player of the Year"],
      skills: ["Free kicks", "through balls", "late box finishing", "two-foot technique", "attacking-midfield scoring"],
      verdict: "10번 프라임 기준으로 축구사 최고권입니다.",
    },
    importance: {
      roles: ["Flamengo: all-time greatest player and attacking core", "Brazil: 1982 creative symbol"],
      moments: ["1981 Intercontinental Cup vs Liverpool", "1982 World Cup team legacy"],
      verdict: "클럽에서는 절대 중심, 대표팀에서는 미완의 천재 서사입니다.",
    },
    legacy: {
      reasons: ["Flamengo all-time icon", "1982 Brazil symbol", "South American POTY 3회", "free-kick/playmaker archetype"],
      context: ["Best player never to win World Cup debate", "Brazil number 10 lineage"],
      verdict: "우승 부재에도 기술적 최고점 때문에 장기 보존됩니다.",
    },
    sources: [
      { label: "Wikipedia - Zico", url: "https://en.wikipedia.org/wiki/Zico_(footballer)" },
      { label: "Britannica - Zico", url: "https://www.britannica.com/biography/Zico" },
    ],
  }),
  ronaldinho: makeFocusedProfile({
    summary:
      "Ronaldinho는 Barcelona 부활, Brazil 2002 World Cup, Ballon d'Or, 놀이 같은 창조성으로 축구 문화에 남은 2000년대 최고 스타입니다.",
    team: {
      clubs: ["Gremio", "Paris Saint-Germain", "Barcelona", "AC Milan", "Flamengo", "Atletico Mineiro", "Queretaro", "Fluminense", "Brazil national team"],
      clubHonours: ["Barcelona: La Liga 2004-05, 2005-06; UEFA Champions League 2005-06", "AC Milan: Serie A 2010-11", "Atletico Mineiro: Copa Libertadores 2013"],
      nationalHonours: ["Brazil: FIFA World Cup 2002", "Brazil: Copa America 1999", "Brazil: FIFA Confederations Cup 2005"],
      verdict: "팀 커리어는 짧은 Barcelona 피크와 Brazil 2002, Libertadores까지 균형이 좋습니다.",
    },
    individual: {
      awards: ["Ballon d'Or: 2005", "FIFA World Player of the Year: 2004, 2005", "UEFA Club Footballer of the Year: 2005-06"],
      records: ["2005-06 Barcelona global face", "Bernabeu standing ovation 2005", "FIFA 100"],
      verdict: "개인상과 문화적 스타성이 동시에 최고급입니다.",
    },
    prime: {
      period: "2003-06 Barcelona",
      evidence: ["2004 and 2005 FIFA World Player", "2005 Ballon d'Or", "2005-06 Champions League title"],
      skills: ["Elastic dribbling", "no-look passing", "free kicks", "one-v-one creation", "improvisation", "wide playmaking"],
      verdict: "짧지만 압도적인 프라임으로 축구사 최고 재능 논쟁권입니다.",
    },
    importance: {
      roles: ["Barcelona: pre-Messi revival face", "Brazil: creative star in 2002/2005 title teams"],
      moments: ["2002 World Cup England free-kick", "2005 Bernabeu performance", "2006 Champions League run"],
      verdict: "Barcelona의 글로벌 매력을 되살린 중심 인물이었습니다.",
    },
    legacy: {
      reasons: ["Ballon d'Or", "World Cup", "Champions League", "football joy/flair icon", "influence on later creative players"],
      context: ["All-time entertainer and peak talent debate", "Brazilian flair lineage after Ronaldo/Rivaldo"],
      verdict: "기록보다 스타일과 문화적 기억으로도 오래 남을 선수입니다.",
    },
    sources: [
      { label: "Wikipedia - Ronaldinho", url: "https://en.wikipedia.org/wiki/Ronaldinho" },
      { label: "FC Barcelona - Ronaldinho", url: "https://www.fcbarcelona.com/" },
    ],
  }),
  romario: makeFocusedProfile({
    summary:
      "Romario는 1994 World Cup 우승과 Barcelona/PSV/브라질 리그 득점력을 결합한 박스 안 마무리의 역사적 기준점입니다.",
    team: {
      clubs: ["Vasco da Gama", "PSV Eindhoven", "Barcelona", "Flamengo", "Valencia", "Vasco da Gama returns", "Fluminense", "Al Sadd", "Miami FC", "Adelaide United", "America-RJ", "Brazil national team"],
      clubHonours: ["PSV Eindhoven: Eredivisie 1988-89, 1990-91, 1991-92", "Barcelona: La Liga 1993-94", "Vasco/Flamengo: Brazilian and Rio state honours across career"],
      nationalHonours: ["Brazil: FIFA World Cup 1994", "Brazil: Copa America 1989, 1997", "Brazil: FIFA Confederations Cup 1997"],
      verdict: "대표팀 월드컵 우승과 클럽 득점 커리어가 강하게 결합돼 있습니다.",
    },
    individual: {
      awards: ["FIFA World Player of the Year: 1994", "FIFA World Cup Golden Ball: 1994", "La Liga top scorer/Pichichi: 1993-94", "Multiple league top-scorer awards"],
      records: ["Brazil all-time scoring icon", "1000-goal claim context", "One of the greatest penalty-box scorers"],
      verdict: "1994년 개인 지배력과 득점왕 커리어가 핵심입니다.",
    },
    prime: {
      period: "1993-94 Barcelona and Brazil 1994",
      evidence: ["1993-94 La Liga top scorer", "1994 World Cup Golden Ball and title", "Barcelona Dream Team striker role"],
      skills: ["Short-area finishing", "first touch", "toe-poke finishes", "offside-line timing", "low-centre agility"],
      verdict: "박스 안 순수 마무리 프라임은 축구사 최고권입니다.",
    },
    importance: {
      roles: ["Brazil: 1994 title-winning attacking reference", "Barcelona: Cruyff Dream Team striker peak", "Vasco/Flamengo: domestic icon"],
      moments: ["1994 World Cup knockout goals and final run", "Barcelona 1993-94 scoring peak"],
      verdict: "1994 Brazil의 공격 정체성을 만든 선수입니다.",
    },
    legacy: {
      reasons: ["World Cup Golden Ball", "FIFA World Player 1994", "1994 World Cup champion", "penalty-box striker archetype"],
      context: ["All-time striker debate with Ronaldo, Muller, Van Basten", "Brazil number 9 lineage"],
      verdict: "득점 감각의 순수성 때문에 오래 비교될 선수입니다.",
    },
    sources: [
      { label: "Wikipedia - Romario", url: "https://en.wikipedia.org/wiki/Rom%C3%A1rio" },
      { label: "FIFA - Romario", url: "https://www.fifa.com/" },
    ],
  }),
  neymar: makeFocusedProfile({
    summary:
      "Neymar는 Santos, Barcelona, PSG, Brazil 대표팀을 거친 현대 브라질의 최고 공격 재능입니다. 팀 커리어와 개인 고점은 강하지만 월드컵 우승 부재가 상한입니다.",
    team: {
      clubs: ["Santos", "Barcelona", "Paris Saint-Germain", "Al Hilal", "Brazil U20", "Brazil Olympic", "Brazil national team"],
      clubHonours: ["Santos: Copa Libertadores 2011, Copa do Brasil 2010", "Barcelona: La Liga 2014-15, 2015-16; Copa del Rey 2014-15, 2015-16, 2016-17; UEFA Champions League 2014-15", "Paris Saint-Germain: Ligue 1 titles and domestic cups"],
      nationalHonours: ["Brazil Olympic: Olympic gold medal 2016; silver medal 2012", "Brazil: FIFA Confederations Cup 2013"],
      verdict: "클럽 우승은 매우 강하지만 Brazil 월드컵/코파 우승 핵심 서사가 빠져 있습니다.",
    },
    individual: {
      awards: ["South American Footballer of the Year: 2011, 2012", "FIFA Confederations Cup Golden Ball: 2013", "UEFA Champions League top scorer: 2014-15 shared", "Samba Gold and domestic awards"],
      records: ["Brazil all-time top scorer", "Most expensive transfer in football history", "MSN era attacking records"],
      verdict: "개인 기록과 재능 평가는 최고권이나 Ballon d'Or 수상 부재가 남습니다.",
    },
    prime: {
      period: "2014-17 Barcelona and Brazil, plus 2019-20 PSG Champions League run",
      evidence: ["2014-15 Champions League title and scoring", "MSN treble season", "2016 Olympic gold winning penalty", "2020 PSG Champions League final run"],
      skills: ["One-v-one dribbling", "creative passing", "left-side playmaking", "set pieces", "fouls won", "transition creation"],
      verdict: "순수 공격 재능 프라임은 브라질 역사 최고권이지만 지속성/부상이 감점입니다.",
    },
    importance: {
      roles: ["Brazil: post-2010s attacking face", "Barcelona: MSN left creator/scorer", "PSG: Champions League project star"],
      moments: ["La Remontada vs PSG", "2016 Olympic final penalty", "2014-15 Champions League knockout scoring"],
      verdict: "대표팀과 클럽 모두에서 공격의 중심이었지만 우승 완결성은 Messi/Pele급보다 낮습니다.",
    },
    legacy: {
      reasons: ["Brazil all-time top scorer", "Olympic gold icon", "MSN treble", "world-record transfer", "modern flair star"],
      context: ["Brazil's greatest talent after Ronaldo/Ronaldinho debate", "High peak but unfinished international legacy"],
      verdict: "기술과 기록으로 남지만 월드컵 우승 부재가 최상위 앵커 진입을 막습니다.",
    },
    sources: [
      { label: "Wikipedia - Neymar", url: "https://en.wikipedia.org/wiki/Neymar" },
      { label: "FC Barcelona - Neymar", url: "https://www.fcbarcelona.com/" },
      { label: "FIFA - Neymar", url: "https://www.fifa.com/" },
    ],
  }),
  "alfredo di stefano": makeFocusedProfile({
    summary:
      "Alfredo Di Stefano는 Real Madrid의 유러피언컵 5연패를 만든 전방위 공격수이자 축구사 초기 슈퍼클럽 시대의 기준점입니다.",
    team: {
      clubs: ["River Plate", "Huracan loan", "Millonarios", "Real Madrid", "Espanyol", "Argentina national team", "Colombia national team", "Spain national team"],
      clubHonours: ["Real Madrid: European Cup 1955-56, 1956-57, 1957-58, 1958-59, 1959-60", "Real Madrid: La Liga 8회, Copa del Rey 1961-62, Intercontinental Cup 1960", "River Plate/Millonarios: Argentine and Colombian league titles"],
      nationalHonours: ["Argentina: South American Championship 1947"],
      verdict: "클럽 팀 커리어는 축구사 최고권이며 대표팀 월드컵 서사가 없는 점만 한계입니다.",
    },
    individual: {
      awards: ["Ballon d'Or: 1957, 1959", "Super Ballon d'Or: 1989", "European Cup final scorer across five consecutive finals"],
      records: ["Real Madrid all-time foundational icon", "One of European Cup's defining early scorers", "Total football before Total Football archetype"],
      verdict: "초기 유럽 클럽 축구 개인상과 결승 지배력은 최상위입니다.",
    },
    prime: {
      period: "1955-60 Real Madrid European Cup dynasty",
      evidence: ["Five straight European Cups", "Goals in each European Cup final run/finals", "Two Ballons d'Or"],
      skills: ["All-phase attacking", "deep playmaking", "pressing before its era", "finishing", "tempo control", "leadership"],
      verdict: "포지션을 초월한 전방위 프라임의 역사적 원형입니다.",
    },
    importance: {
      roles: ["Real Madrid: dynasty-defining central player", "River/Millonarios: pre-Madrid continental star"],
      moments: ["European Cup finals 1956-60", "Real Madrid global rise"],
      verdict: "Real Madrid라는 클럽의 세계사적 위상을 만든 핵심입니다.",
    },
    legacy: {
      reasons: ["European Cup five-peat", "two Ballons d'Or", "Super Ballon d'Or", "Real Madrid founding myth"],
      context: ["All-time top 10-15 debate", "Club football dominance archetype"],
      verdict: "월드컵 부재에도 클럽 축구사에서는 반드시 남는 이름입니다.",
    },
    sources: [
      { label: "Wikipedia - Alfredo Di Stefano", url: "https://en.wikipedia.org/wiki/Alfredo_Di_St%C3%A9fano" },
      { label: "Real Madrid - Alfredo Di Stefano", url: "https://www.realmadrid.com/" },
      { label: "UEFA - Di Stefano", url: "https://www.uefa.com/" },
    ],
  }),
};

const curatedProfileOverrides: Record<string, CuratedProfileEntry> = {
  "abedi pele": {
    summary:
      "Abedi Pele는 1990년대 초 마르세유의 유럽 정상 등극과 가나 대표팀의 창조성을 상징한 플레이메이커입니다. 아프리카 선수의 유럽 빅클럽 영향력을 넓힌 선구자형 레전드로 평가합니다.",
    sections: {
      teamCareer: {
        explanation: "마르세유의 1993 UEFA Champions League 우승, 프랑스 리그 우승권 전력, 가나 대표팀 장기 중심성을 함께 봅니다.",
        bullets: ["마르세유에서 프랑스 리그와 유럽 무대를 동시에 지배한 핵심 공격형 미드필더였습니다.", "가나 대표팀에서는 1982 AFCON 우승 멤버이자 이후 세대의 기준점 역할을 했습니다."],
      },
      individualCareer: {
        explanation: "1991-93년 아프리카 올해의 선수 3연속 수상은 이 선수의 동시대 위상을 가장 잘 보여주는 지표입니다.",
        bullets: ["France Football African Player of the Year를 3년 연속 수상했습니다.", "IFFHS 아프리카 세기의 선수 투표에서도 최상위권에 들어간 역사적 이름입니다."],
      },
      primeSkill: {
        explanation: "짧은 터치, 전진 드리블, 마지막 패스, 득점 가담을 모두 갖춘 10번형 고점으로 평가합니다.",
        bullets: ["전성기에는 압박 사이를 빠져나와 직접 찬스를 만드는 능력이 아프리카 최고 수준이었습니다.", "유럽 컵 레벨에서도 템포 조절과 창의성이 통했던 플레이메이커였습니다."],
      },
      teamImportance: {
        explanation: "마르세유와 가나 양쪽에서 공격 구조를 연결하는 중심이었기 때문에 팀 내 비중 점수를 높게 둡니다.",
        bullets: ["마르세유에서는 공격 전개의 핵심 연결고리였습니다.", "가나에서는 단순 에이스를 넘어 국가 축구의 아이콘 역할을 했습니다."],
      },
      legacy: {
        explanation: "아프리카 플레이메이커가 유럽 정상급 클럽에서 중심이 될 수 있음을 증명한 상징성이 큽니다.",
        bullets: ["George Weah, Eto'o 이전 세대의 대표적 글로벌 아프리카 스타였습니다.", "가나 축구사에서는 세대를 넘어 호출되는 기준점입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Abedi Pele", url: "https://en.wikipedia.org/wiki/Abedi_Pele" },
      { label: "Britannica - Abedi Pele", url: "https://www.britannica.com/biography/Abedi-Ayew-Pele" },
      ...commonAfricaSources,
    ],
  },
  "michael essien": {
    summary:
      "Michael Essien은 리옹과 첼시에서 전성기를 보낸 박스 투 박스 미드필더입니다. 폭발적인 기동력, 수비 커버, 전진 운반을 모두 갖춘 현대적 중앙 미드필더의 아프리카 대표 사례입니다.",
    sections: {
      teamCareer: {
        explanation: "리옹의 Ligue 1 연속 우승, 첼시의 프리미어리그/FA컵/Champions League 커리어를 반영합니다.",
        bullets: ["리옹에서 프랑스 정상권 미드필더로 올라섰고 첼시에서는 무리뉴 1기와 이후 우승권 전력의 핵심이었습니다.", "가나 대표팀의 2006 월드컵 16강 진출 시기에도 중심 미드필더였습니다."],
      },
      individualCareer: {
        explanation: "아프리카 올해의 선수 최종권 평가와 리그 내 개인상을 보조 지표로 봅니다.",
        bullets: ["2005년 프랑스 리그 최고 선수급 평가를 받았습니다.", "CAF/BBC 아프리카 올해의 선수 경쟁권에 꾸준히 들었습니다."],
      },
      primeSkill: {
        explanation: "전성기 Essien은 피지컬, 압박 저항, 태클, 중거리 슈팅, 전진성을 한 번에 제공한 엘리트 미드필더였습니다.",
        bullets: ["중원 전 지역을 커버하는 운동량과 강도가 최고 장점이었습니다.", "수비형, 중앙, 오른쪽 풀백 대체까지 가능한 전술적 유연성이 있었습니다."],
      },
      teamImportance: {
        explanation: "첼시에서는 화려한 공격수보다 덜 보였지만, 밸런스를 잡는 핵심 부품이었습니다.",
        bullets: ["램파드, 마켈렐레, 발락 등과 함께 첼시 중원의 강도를 만든 선수입니다.", "가나에서는 국제 대회 경쟁력을 높인 대표팀의 중추였습니다."],
      },
      legacy: {
        explanation: "아프리카 박스 투 박스 미드필더를 말할 때 Yaya Toure와 함께 가장 먼저 비교되는 이름입니다.",
        bullets: ["EPL 시대의 대표적 아프리카 중앙 미드필더입니다.", "부상 변수가 없었다면 역사적 평가가 더 높아졌을 선수로 봅니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Michael Essien", url: "https://en.wikipedia.org/wiki/Michael_Essien" },
      { label: "Britannica - Michael Essien", url: "https://www.britannica.com/biography/Michael-Essien" },
      ...commonAfricaSources,
    ],
  },
  "samuel kuffour": {
    summary:
      "Samuel Kuffour는 바이에른 뮌헨에서 장기간 활약한 가나의 센터백입니다. 유럽 빅클럽 수비수로서의 누적과 Champions League 우승 커리어가 핵심입니다.",
    sections: {
      teamCareer: {
        explanation: "바이에른에서의 Bundesliga 우승, 2001 Champions League 우승, Intercontinental Cup 우승을 높게 반영합니다.",
        bullets: ["바이에른 수비진의 장기 멤버로 독일과 유럽 무대에서 많은 우승을 쌓았습니다.", "1999 결승의 좌절과 2001 우승을 모두 경험한 Champions League 서사의 중심 인물입니다."],
      },
      individualCareer: {
        explanation: "수비수 포지션 특성상 공격수보다 개인상은 적지만, 2001년 BBC African Footballer of the Year 수상 경력이 있습니다.",
        bullets: ["가나 올해의 선수급 평가를 여러 차례 받은 대표 수비수였습니다.", "아프리카 수비수 중 유럽 커리어 누적이 매우 높은 편입니다."],
      },
      primeSkill: {
        explanation: "강한 대인 수비, 제공권, 스피드, 투쟁성을 갖춘 1990년대 후반-2000년대 초반형 센터백입니다.",
        bullets: ["피지컬 경합과 커버 범위가 강점이었습니다.", "바이에른의 높은 수비 라인에서도 버틸 수 있는 운동 능력이 있었습니다."],
      },
      teamImportance: {
        explanation: "세계 최고급 팀에서 핵심 로테이션 이상을 장기간 맡았다는 점을 중시합니다.",
        bullets: ["바이에른에서 단기 게스트가 아니라 장기 전력으로 자리 잡았습니다.", "가나 대표팀 수비의 상징적 이름으로 남았습니다."],
      },
      legacy: {
        explanation: "아프리카 센터백 계보에서 유럽 빅클럽 성공 사례로 남는 선수입니다.",
        bullets: ["가나 수비수 평가에서 최상위권으로 자주 언급됩니다.", "아프리카 수비수의 유럽 정상권 커리어 모델 중 하나입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Samuel Kuffour", url: "https://en.wikipedia.org/wiki/Samuel_Kuffour" },
      { label: "Treccani - Samuel Kuffour", url: "https://www.treccani.it/enciclopedia/osei-kuffour_%28Enciclopedia-dello-Sport%29/" },
      ...commonAfricaSources,
    ],
  },
  "jay jay okocha": {
    summary:
      "Jay-Jay Okocha는 팀 커리어보다 순수 기술과 창의성으로 기억되는 나이지리아의 10번입니다. 드리블, 페인트, 볼 운반의 미학적 고점이 매우 높은 선수로 평가합니다.",
    sections: {
      teamCareer: {
        explanation: "PSG, Fenerbahce, Bolton 커리어와 나이지리아의 1994 AFCON 우승, 1996 올림픽 금메달 세대를 함께 봅니다.",
        bullets: ["나이지리아 황금세대에서 창조성을 맡은 핵심 공격형 미드필더였습니다.", "클럽 우승 누적은 최상위권 공격수들보다 낮지만 여러 리그에서 영향력을 보였습니다."],
      },
      individualCareer: {
        explanation: "대형 개인상 수상보다 토너먼트 베스트급 평가와 기술적 명성이 강한 유형입니다.",
        bullets: ["AFCON과 국제 대회에서 스타 플레이어로 인식됐습니다.", "개인상 누적보다 동료와 팬 평가에서 강한 선수입니다."],
      },
      primeSkill: {
        explanation: "아프리카 역사상 가장 화려한 볼 테크닉 중 하나로 평가할 수 있습니다.",
        bullets: ["좁은 공간 드리블, 바디 페인트, 볼 컨트롤은 세계적 수준이었습니다.", "프라임 실력은 커리어 트로피보다 훨씬 높게 봐야 하는 선수입니다."],
      },
      teamImportance: {
        explanation: "나이지리아와 Bolton에서 공격 전개를 개인 기술로 풀어주는 비중이 컸습니다.",
        bullets: ["Bolton에서는 팀의 상징이자 주장급 리더로 기억됩니다.", "나이지리아에서는 Kanu와 함께 공격의 상상력을 담당했습니다."],
      },
      legacy: {
        explanation: "트로피보다 하이라이트와 기술적 영향력으로 오래 남는 레전드입니다.",
        bullets: ["Ronaldinho가 영향을 언급할 정도로 기술적 계보에서 의미가 큽니다.", "아프리카 축구의 창의성과 쇼맨십을 상징합니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Jay-Jay Okocha", url: "https://en.wikipedia.org/wiki/Jay-Jay_Okocha" },
      ...commonAfricaSources,
    ],
  },
  "nwankwo kanu": {
    summary:
      "Nwankwo Kanu는 Ajax, Inter, Arsenal을 거친 나이지리아의 장신 테크니션입니다. Champions League, Premier League, FA Cup, 올림픽 금메달을 모두 가진 드문 커리어형 레전드입니다.",
    sections: {
      teamCareer: {
        explanation: "Ajax의 Champions League 우승, Arsenal의 Premier League/FA Cup 커리어, 1996 올림픽 금메달을 강하게 반영합니다.",
        bullets: ["Ajax와 Arsenal에서 유럽/잉글랜드 정상권 팀 커리어를 쌓았습니다.", "나이지리아의 1996 애틀랜타 올림픽 금메달은 대표팀 커리어의 핵심입니다."],
      },
      individualCareer: {
        explanation: "아프리카 올해의 선수 수상과 BBC 아프리카 올해의 선수 계열 평가를 포함합니다.",
        bullets: ["아프리카 올해의 선수 2회급 위상을 가진 나이지리아 대표 스타입니다.", "대형 클럽에서 주전과 슈퍼서브 역할을 모두 수행했습니다."],
      },
      primeSkill: {
        explanation: "큰 키에 어울리지 않는 터치, 볼 키핑, 순간 패스 선택이 강점이었습니다.",
        bullets: ["스트라이커와 세컨드 스트라이커 사이의 독특한 기술형 포워드였습니다.", "전성기에는 수비가 예측하기 어려운 리듬과 신체 조건을 동시에 가졌습니다."],
      },
      teamImportance: {
        explanation: "나이지리아에서는 상징성이 크고, Arsenal에서는 경기 흐름을 바꾸는 특수 카드였습니다.",
        bullets: ["국가대표에서는 황금세대의 얼굴 중 하나였습니다.", "클럽에서는 항상 절대 에이스는 아니었지만 중요한 순간에 영향력을 남겼습니다."],
      },
      legacy: {
        explanation: "커리어 트로피와 독특한 플레이 스타일을 함께 가진 나이지리아 대표 레전드입니다.",
        bullets: ["나이지리아 공격수 계보에서 가장 상징적인 이름 중 하나입니다.", "아프리카 선수 중 우승 컬렉션이 매우 넓은 편입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Nwankwo Kanu", url: "https://en.wikipedia.org/wiki/Nwankwo_Kanu" },
      ...commonAfricaSources,
    ],
  },
  "samuel eto o": {
    summary:
      "Samuel Eto'o는 바르셀로나와 인터 밀란에서 모두 유럽 정상에 선 아프리카 역사상 최고급 스트라이커입니다. 득점력, 압박, 큰 경기 결정력을 모두 갖춘 완성형 9번으로 평가합니다.",
    sections: {
      teamCareer: {
        explanation: "Barcelona의 2006/2009 Champions League 우승, Inter의 2010 트레블, 카메룬의 AFCON/올림픽 성과를 최상위로 반영합니다.",
        bullets: ["Barcelona와 Inter에서 연속적으로 유럽 정상급 팀의 핵심 공격수였습니다.", "카메룬 대표팀에서는 AFCON 우승 세대와 올림픽 금메달 세대의 간판이었습니다."],
      },
      individualCareer: {
        explanation: "아프리카 올해의 선수 4회 수상은 역대 공동 최다급 개인 커리어입니다.",
        bullets: ["CAF African Player of the Year 4회 수상자입니다.", "AFCON 역대 득점 기록과 카메룬 대표팀 득점 기록에서도 최상위권입니다."],
      },
      primeSkill: {
        explanation: "전성기 Eto'o는 박스 안 결정력과 뒷공간 침투, 전방 압박을 모두 제공했습니다.",
        bullets: ["2005-10년 전후의 순간 가속과 마무리는 세계 최고 스트라이커 레벨이었습니다.", "큰 경기에서 직접 골로 결과를 바꾸는 능력이 매우 강했습니다."],
      },
      teamImportance: {
        explanation: "Barcelona와 Inter 모두에서 단순 득점원이 아니라 공격 구조를 완성하는 핵심이었습니다.",
        bullets: ["2009 Barcelona의 전방 밸런스와 2010 Inter의 전술적 희생 모두 수행했습니다.", "카메룬 대표팀에서는 세대 전체를 대표한 절대 에이스였습니다."],
      },
      legacy: {
        explanation: "아프리카 역대 최고의 선수 논쟁에서 Weah, Milla, Drogba와 함께 반드시 들어가는 이름입니다.",
        bullets: ["클럽 커리어와 대표팀 커리어의 균형이 매우 좋습니다.", "현대 아프리카 스트라이커의 최고 기준점 중 하나입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Samuel Eto'o", url: "https://en.wikipedia.org/wiki/Samuel_Eto%27o" },
      { label: "FC Barcelona - Samuel Eto'o", url: "https://www.fcbarcelona.com/en/card/648033/samuel-etoogo" },
      ...commonAfricaSources,
    ],
  },
  "roger milla": {
    summary:
      "Roger Milla는 클럽 누적보다 월드컵 서사와 카메룬 대표팀 상징성이 압도적인 레전드입니다. 1990년 이탈리아 월드컵에서 아프리카 축구의 세계적 인식을 바꾼 선수로 평가합니다.",
    sections: {
      teamCareer: {
        explanation: "프랑스 클럽 커리어와 카메룬 대표팀의 1984/1988 AFCON 우승, 1990 월드컵 8강을 함께 봅니다.",
        bullets: ["카메룬의 1990 월드컵 8강 진출을 상징하는 공격수였습니다.", "대표팀 중심 커리어의 임팩트가 클럽 커리어보다 훨씬 큽니다."],
      },
      individualCareer: {
        explanation: "1976년과 1990년 아프리카 올해의 선수 수상, 월드컵 스타성을 높게 반영합니다.",
        bullets: ["38세에 월드컵 4골을 기록하며 전 세계적 스타가 됐습니다.", "아프리카 올해의 선수 2회 수상 경력이 있습니다."],
      },
      primeSkill: {
        explanation: "페널티 박스 주변에서의 민첩성, 터치, 슈팅 타이밍이 강점이었습니다.",
        bullets: ["전성기에는 기술적이고 유연한 세컨드 스트라이커형 공격수였습니다.", "노장 시기에도 짧은 시간 안에 경기를 바꾸는 결정력이 있었습니다."],
      },
      teamImportance: {
        explanation: "1990년 카메룬에서의 영향력은 단순 주전 이상의 국가적 상징성이 있습니다.",
        bullets: ["카메룬이 아프리카 최초 월드컵 8강에 오르는 과정의 얼굴이었습니다.", "대표팀에서 정서적, 전술적 임팩트가 모두 컸습니다."],
      },
      legacy: {
        explanation: "아프리카 월드컵 역사 전체를 대표하는 이름입니다.",
        bullets: ["골 세리머니와 1990년 서사는 월드컵 문화사에도 남았습니다.", "아프리카 축구가 세계 무대에서 주인공이 될 수 있음을 보여줬습니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Roger Milla", url: "https://en.wikipedia.org/wiki/Roger_Milla" },
      { label: "Britannica - Roger Milla", url: "https://www.britannica.com/biography/Roger-Milla" },
      { label: "IFFHS Africa Player of the Century", url: "https://portal.iffhs.com/posts/500" },
      ...commonAfricaSources,
    ],
  },
  "thomas n kono": {
    summary:
      "Thomas N'Kono는 아프리카 골키퍼 계보의 원형에 가까운 카메룬 레전드입니다. Espanyol 장기 커리어와 카메룬 대표팀에서의 영향력, 후대 골키퍼에게 준 영감이 핵심입니다.",
    sections: {
      teamCareer: {
        explanation: "Espanyol에서의 장기 활약과 카메룬의 월드컵/AFCON 세대 중심성을 반영합니다.",
        bullets: ["Espanyol에서 300경기 이상을 소화한 장기 주전 골키퍼였습니다.", "카메룬 대표팀에서는 1980년대 아프리카 최상위 골키퍼로 평가받았습니다."],
      },
      individualCareer: {
        explanation: "아프리카 올해의 선수 수상 골키퍼라는 희소성이 큽니다.",
        bullets: ["1979년, 1982년 아프리카 올해의 선수 수상 경력이 있습니다.", "골키퍼가 아프리카 개인상 최상위권에 오른 드문 사례입니다."],
      },
      primeSkill: {
        explanation: "반사신경, 위치 선정, 공중볼, 침착함이 조합된 전통적 엘리트 골키퍼로 봅니다.",
        bullets: ["후대 골키퍼들이 언급할 정도로 스타일적 영향력이 컸습니다.", "유럽 리그에서도 장기간 주전으로 버틸 만큼 안정적이었습니다."],
      },
      teamImportance: {
        explanation: "대표팀과 클럽 모두에서 수비 안정성의 기준점이었습니다.",
        bullets: ["카메룬 수비의 마지막 보루 역할을 오래 수행했습니다.", "Espanyol에서는 외국인 골키퍼로 장기 신뢰를 받은 특수한 사례입니다."],
      },
      legacy: {
        explanation: "아프리카 골키퍼 역사에서는 가장 먼저 거론해야 할 선수 중 하나입니다.",
        bullets: ["Gianluigi Buffon 등 후대 골키퍼에게 영감을 준 이름으로 자주 언급됩니다.", "카메룬 골키퍼 전통의 상징입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Thomas N'Kono", url: "https://en.wikipedia.org/wiki/Thomas_N%27Kono" },
      ...commonAfricaSources,
    ],
  },
  "didier drogba": {
    summary:
      "Didier Drogba는 첼시의 큰 경기 해결사이자 코트디부아르 대표팀의 절대적 상징입니다. 피지컬, 포스트플레이, 클러치 득점에서 역대급 영향력을 남겼습니다.",
    sections: {
      teamCareer: {
        explanation: "첼시의 Premier League 우승들, 2012 Champions League 우승, FA Cup 결승 서사를 핵심으로 봅니다.",
        bullets: ["2012 Champions League 결승 동점골과 승부차기 결승골은 팀 커리어의 정점입니다.", "첼시 2000년대 성공기의 대표 스트라이커였습니다."],
      },
      individualCareer: {
        explanation: "아프리카 올해의 선수 2회, Premier League 득점왕, 첼시 역사적 개인 기록을 반영합니다.",
        bullets: ["CAF African Player of the Year를 2006년과 2009년에 수상했습니다.", "Premier League와 컵 결승에서 남긴 개인 기록이 강합니다."],
      },
      primeSkill: {
        explanation: "전성기 Drogba는 피지컬 경합, 제공권, 왼발/오른발 마무리, 프리킥까지 갖춘 완성형 타깃맨이었습니다.",
        bullets: ["수비수를 등지고 팀 공격 전체를 살리는 힘이 탁월했습니다.", "결승전과 토너먼트에서 고점이 특히 크게 나타났습니다."],
      },
      teamImportance: {
        explanation: "첼시와 코트디부아르 모두에서 경기 계획의 중심이 되는 9번이었습니다.",
        bullets: ["첼시는 Drogba를 기준으로 직접적인 공격 루트를 설계할 수 있었습니다.", "코트디부아르 황금세대에서는 정신적 리더이자 득점 책임자였습니다."],
      },
      legacy: {
        explanation: "아프리카 스트라이커 역사에서 Eto'o와 함께 비교되는 대표적 이름입니다.",
        bullets: ["첼시 역사상 가장 상징적인 공격수 중 하나입니다.", "아프리카 선수의 EPL 지배력을 대표하는 인물입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Didier Drogba", url: "https://en.wikipedia.org/wiki/Didier_Drogba" },
      { label: "UEFA - Drogba final master", url: "https://www.uefa.com/uefachampionsleague/news/0261-107d82d75d76-8f0e9280f586-1000--how-brilliant-was-chelsea-s-final-master-didier-drogba/" },
      ...commonAfricaSources,
    ],
  },
  "yaya toure": {
    summary:
      "Yaya Toure는 바르셀로나의 트레블 멤버이자 맨체스터 시티 시대 개막의 핵심 미드필더입니다. 피지컬과 기술, 득점력을 함께 가진 중앙 미드필더 고점이 매우 높습니다.",
    sections: {
      teamCareer: {
        explanation: "Barcelona 2009 트레블, Manchester City의 Premier League 우승 세대 중심성을 반영합니다.",
        bullets: ["Barcelona에서는 수비형 미드필더와 센터백 대체까지 수행하며 트레블에 기여했습니다.", "Manchester City에서는 2011-12 첫 Premier League 우승 시대의 핵심 미드필더였습니다."],
      },
      individualCareer: {
        explanation: "CAF African Player of the Year 4회 연속 수상은 역대급 개인 위상입니다.",
        bullets: ["2011년부터 2014년까지 아프리카 올해의 선수를 연속 수상했습니다.", "Premier League Team of the Year급 평가와 클럽 올해의 선수급 시즌이 있습니다."],
      },
      primeSkill: {
        explanation: "2013-14 시즌 전후의 전진 운반, 중거리 슈팅, 세트피스, 박스 침투는 세계 최고 미드필더급이었습니다.",
        bullets: ["중앙에서 공을 운반해 직접 득점까지 끝내는 희소한 미드필더였습니다.", "힘과 터치가 동시에 뛰어나 압박을 깨는 능력이 강했습니다."],
      },
      teamImportance: {
        explanation: "City에서는 팀의 새 시대를 실질적으로 끌어올린 중심 선수였습니다.",
        bullets: ["아구에로, 실바, 콤파니와 함께 City 1기 왕조의 축이었습니다.", "코트디부아르 대표팀에서도 황금세대 중원 중심이었습니다."],
      },
      legacy: {
        explanation: "아프리카 중앙 미드필더 역대 1위 후보로 볼 만한 커리어와 고점을 함께 갖췄습니다.",
        bullets: ["피지컬형 미드필더의 고정관념을 넘어 기술과 득점을 모두 보여줬습니다.", "현대 EPL 미드필더 역사에서도 강하게 남는 이름입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Yaya Toure", url: "https://en.wikipedia.org/wiki/Yaya_Tour%C3%A9" },
      ...commonAfricaSources,
    ],
  },
  "kolo toure": {
    summary:
      "Kolo Toure는 Arsenal Invincibles와 Manchester City 우승권 전력, Liverpool까지 거친 코트디부아르 센터백입니다. 화려한 개인상보다는 정상권 팀에서의 수비 누적으로 평가합니다.",
    sections: {
      teamCareer: {
        explanation: "Arsenal의 무패 우승, Manchester City의 우승 전력, 코트디부아르 황금세대 커리어를 반영합니다.",
        bullets: ["2003-04 Arsenal Invincibles의 핵심 수비 멤버였습니다.", "Manchester City와 Liverpool까지 이어진 EPL 장기 커리어가 강점입니다."],
      },
      individualCareer: {
        explanation: "개인상 누적은 낮지만, 장기간 EPL 상위권 팀에서 인정받은 수비수였습니다.",
        bullets: ["수비수 특성상 공격수형 수상 기록은 제한적입니다.", "대신 빅클럽 선발 경쟁을 오래 버틴 누적 가치가 있습니다."],
      },
      primeSkill: {
        explanation: "빠른 발, 적극적 전진 수비, 넓은 커버 범위가 강점이었습니다.",
        bullets: ["Arsenal 시절에는 높은 수비 라인에 맞는 기동력이 돋보였습니다.", "피지컬 경합보다 스피드와 반응으로 수비 범위를 넓혔습니다."],
      },
      teamImportance: {
        explanation: "Arsenal에서는 팀 구조에 맞는 핵심 수비수였고, 대표팀에서는 경험 많은 리더였습니다.",
        bullets: ["코트디부아르 황금세대의 수비 리더 중 한 명이었습니다.", "동생 Yaya와 함께 국가대표 세대의 상징성을 만들었습니다."],
      },
      legacy: {
        explanation: "아프리카 EPL 수비수 역사에서 안정적이고 긴 커리어를 남긴 이름입니다.",
        bullets: ["Invincibles 멤버라는 서사가 강하게 남습니다.", "공격 스타가 많은 코트디부아르 풀에서 수비 쪽 대표 레전드입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Kolo Toure", url: "https://en.wikipedia.org/wiki/Kolo_Tour%C3%A9" },
      ...commonAfricaSources,
    ],
  },
  "george weah": {
    summary:
      "George Weah는 아프리카 선수 중 유일한 Ballon d'Or 수상자이자 Liberia 축구의 절대 상징입니다. PSG와 AC Milan에서 세계 최고 공격수로 인정받은 역대급 레전드입니다.",
    sections: {
      teamCareer: {
        explanation: "Monaco, PSG, AC Milan 커리어와 Serie A 우승을 중심으로 보되, Liberia 대표팀의 전력 한계도 함께 고려합니다.",
        bullets: ["AC Milan에서 Serie A 우승을 경험하며 세계 최고 클럽 레벨에서 활약했습니다.", "Liberia 대표팀은 전력이 약했지만 Weah 개인의 대표성은 절대적이었습니다."],
      },
      individualCareer: {
        explanation: "1995 Ballon d'Or, FIFA World Player of the Year, African Player of the Year를 모두 수상한 독보적 개인 커리어입니다.",
        bullets: ["아프리카 선수로는 유일하게 Ballon d'Or를 수상했습니다.", "1995년 세계 최고 선수로 공인된 개인상 커리어는 아프리카 역대 최상단입니다."],
      },
      primeSkill: {
        explanation: "파워, 스피드, 드리블, 마무리를 모두 가진 1990년대 최정상급 완성형 포워드였습니다.",
        bullets: ["하프라인부터 직접 운반해 득점할 수 있는 폭발력이 있었습니다.", "체격과 민첩성을 동시에 갖춘 희소한 공격수였습니다."],
      },
      teamImportance: {
        explanation: "Liberia에서는 국가 축구 전체를 대표했고, Milan/PSG에서는 공격의 차이를 만드는 스타였습니다.",
        bullets: ["대표팀 전력의 한계를 거의 혼자 끌어안은 선수였습니다.", "클럽에서는 최정상급 팀이 기대하는 개인 해결 능력을 제공했습니다."],
      },
      legacy: {
        explanation: "아프리카 축구사 전체의 최고 상징 중 하나입니다.",
        bullets: ["Ballon d'Or 수상이라는 단일 업적으로도 역사적 위상이 압도적입니다.", "IFFHS 아프리카 세기의 선수 1위로도 자주 인용됩니다."],
      },
    },
    sources: [
      { label: "Wikipedia - George Weah", url: "https://en.wikipedia.org/wiki/George_Weah" },
      { label: "IFFHS Africa Player of the Century", url: "https://portal.iffhs.com/posts/500" },
      ...commonAfricaSources,
    ],
  },
  "lucas radebe": {
    summary:
      "Lucas Radebe는 Leeds United와 남아공 대표팀의 주장을 맡은 수비 리더입니다. 우승 누적보다 리더십, 상징성, 수비 안정감으로 평가해야 하는 레전드입니다.",
    sections: {
      teamCareer: {
        explanation: "Leeds 장기 커리어, 남아공 대표팀 주장, 1996 AFCON 우승 세대의 의미를 함께 봅니다.",
        bullets: ["Leeds United에서 장기간 활약하며 주장까지 맡았습니다.", "남아공 대표팀에서는 국제무대 복귀 이후 세대의 얼굴 중 하나였습니다."],
      },
      individualCareer: {
        explanation: "대형 개인상 수상은 제한적이지만, 클럽과 국가에서 받은 존중을 반영합니다.",
        bullets: ["수비수와 리더 유형이라 개인상보다 주장 경력과 평판이 중요합니다.", "Leeds 팬덤과 남아공 축구사에서 상징성이 큽니다."],
      },
      primeSkill: {
        explanation: "침착한 수비 판단, 대인 방어, 리더십이 장점인 센터백입니다.",
        bullets: ["폭발적 스타성보다 안정감과 통솔력이 강한 수비수였습니다.", "EPL 레벨에서 오래 버틴 수비 집중력이 있었습니다."],
      },
      teamImportance: {
        explanation: "이 선수의 핵심 가치는 팀 내 비중과 리더십입니다.",
        bullets: ["Leeds와 Bafana Bafana 모두에서 주장으로 신뢰받았습니다.", "남아공 축구의 국제적 이미지를 높인 상징적 인물입니다."],
      },
      legacy: {
        explanation: "남아공 축구의 세계화 시기를 대표하는 수비수입니다.",
        bullets: ["South Africa 레전드 리스트에서는 매우 높은 우선순위를 가집니다.", "아프리카 선수의 EPL 리더십 사례로 남았습니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Lucas Radebe", url: "https://en.wikipedia.org/wiki/Lucas_Radebe" },
      { label: "SouthAfrica.info - Lucas Radebe", url: "https://www.southafrica.info/about/sport/greats/radebe.htm" },
    ],
  },
  "sadio mane": {
    summary:
      "Sadio Mane는 Liverpool 전성기의 핵심 윙어이자 Senegal의 첫 AFCON 우승을 이끈 상징입니다. 클럽과 대표팀 양쪽에서 모두 최상위 임팩트를 남겼습니다.",
    sections: {
      teamCareer: {
        explanation: "Liverpool의 Champions League/Premier League 우승, Senegal의 2021 AFCON 우승을 최상위로 반영합니다.",
        bullets: ["Liverpool에서 Klopp 팀의 전방 압박과 득점 구조를 완성한 핵심이었습니다.", "Senegal에서는 AFCON 우승과 월드컵 진출 서사의 중심에 있었습니다."],
      },
      individualCareer: {
        explanation: "CAF African Player of the Year 2회와 Ballon d'Or 상위권 평가를 반영합니다.",
        bullets: ["2019년과 2022년 아프리카 올해의 선수로 선정됐습니다.", "Liverpool 시절 세계 최고 윙어 논쟁에 들어간 시즌이 있습니다."],
      },
      primeSkill: {
        explanation: "전성기 Mane는 스피드, 압박, 침투, 결정력, 양발 활용이 모두 높은 윙어였습니다.",
        bullets: ["공이 없을 때의 움직임과 압박 기여가 매우 컸습니다.", "왼쪽 윙에서 중앙으로 침투해 득점하는 능력이 세계 최고급이었습니다."],
      },
      teamImportance: {
        explanation: "Liverpool에서는 Salah/Firmino와 함께 구조의 한 축, Senegal에서는 절대 에이스였습니다.",
        bullets: ["대표팀에서는 공격뿐 아니라 정신적 리더 역할도 맡았습니다.", "클럽에서는 전술적 희생과 결정력을 동시에 제공했습니다."],
      },
      legacy: {
        explanation: "Senegal 축구사에서는 최고 후보, 아프리카 현대 윙어 계보에서도 최상위권입니다.",
        bullets: ["Senegal의 첫 AFCON 우승을 상징하는 선수입니다.", "Premier League 아프리카 공격수 역사에서도 매우 높은 위치입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Sadio Mane", url: "https://en.wikipedia.org/wiki/Sadio_Man%C3%A9" },
      { label: "BBC - Mane African Footballer of the Year", url: "https://www.bbc.co.uk/sport/africa/62257143" },
      ...commonAfricaSources,
    ],
  },
  "kalidou koulibaly": {
    summary:
      "Kalidou Koulibaly는 Napoli 전성기 수비의 중심이자 Senegal 대표팀 우승 세대의 리더형 센터백입니다. 수비수로서의 프라임 고점과 대표팀 기여가 강합니다.",
    sections: {
      teamCareer: {
        explanation: "Napoli 장기 활약, Senegal의 AFCON 우승 세대, 이후 Chelsea/Al-Hilal 커리어를 반영합니다.",
        bullets: ["Napoli에서 Serie A 정상권 수비수로 오래 평가받았습니다.", "Senegal 대표팀에서는 2019 결승과 2021 우승 세대의 핵심 수비수였습니다."],
      },
      individualCareer: {
        explanation: "수비수 개인상은 제한적이지만 Serie A Team of the Year급 평가와 국가별 수상을 봅니다.",
        bullets: ["Napoli 시절 세계 최고 센터백 후보군으로 자주 거론됐습니다.", "Senegal 올해의 선수급 평가를 받은 시즌이 있습니다."],
      },
      primeSkill: {
        explanation: "강한 피지컬, 스피드, 넓은 커버 범위, 빌드업 안정감을 갖춘 현대형 센터백입니다.",
        bullets: ["높은 라인 뒤 공간을 커버할 수 있는 주력이 강점이었습니다.", "대인 수비와 볼 전진 모두 가능한 센터백이었습니다."],
      },
      teamImportance: {
        explanation: "Napoli와 Senegal 모두에서 수비 구조의 기준점 역할을 했습니다.",
        bullets: ["Senegal의 국제 대회 안정감은 Koulibaly 중심 수비에서 출발했습니다.", "Napoli에서는 수비 리더이자 후방 빌드업 출발점이었습니다."],
      },
      legacy: {
        explanation: "아프리카 현대 센터백 계보에서 최상위권 이름입니다.",
        bullets: ["Kuffour 이후 아프리카 빅리그 센터백 대표 사례입니다.", "Senegal 황금세대 수비의 얼굴로 남습니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Kalidou Koulibaly", url: "https://en.wikipedia.org/wiki/Kalidou_Koulibaly" },
      ...commonAfricaSources,
    ],
  },
  "achraf hakimi": {
    summary:
      "Achraf Hakimi는 Morocco의 월드컵 4강 세대와 PSG/Inter/Dortmund 커리어를 가진 현대 최고의 공격형 풀백 중 하나입니다. 스피드와 전진성이 평가의 핵심입니다.",
    sections: {
      teamCareer: {
        explanation: "Real Madrid 유스 출신 커리어, Dortmund/Inter/PSG 활약, Morocco 2022 월드컵 4강을 반영합니다.",
        bullets: ["Inter의 Serie A 우승과 PSG의 Ligue 1 우승권 전력에서 공격형 풀백으로 활약했습니다.", "Morocco의 2022 월드컵 4강은 대표팀 커리어의 핵심입니다."],
      },
      individualCareer: {
        explanation: "풀백 포지션의 개인상 한계를 감안하되, 세계 베스트급 후보 평가를 반영합니다.",
        bullets: ["FIFA/FIFPro 월드 베스트 후보군에 드는 현대 풀백입니다.", "아프리카 올해의 선수 경쟁에서도 수비수로는 높은 평가를 받았습니다."],
      },
      primeSkill: {
        explanation: "전성기 Hakimi는 속도, 오버래핑, 언더래핑, 마무리 능력을 모두 갖춘 하이브리드 풀백입니다.",
        bullets: ["윙어처럼 전진하고 풀백처럼 복귀하는 왕복 능력이 강점입니다.", "오른쪽 측면에서 직접 득점과 도움을 모두 만들 수 있습니다."],
      },
      teamImportance: {
        explanation: "Morocco에서는 공격 출구이자 수비 전환의 핵심입니다.",
        bullets: ["대표팀에서는 오른쪽 측면 전술의 출발점입니다.", "클럽에서도 전진성을 통해 팀 공격 폭을 넓힙니다."],
      },
      legacy: {
        explanation: "이미 Morocco 역대 베스트 풀백 후보이며, 커리어가 더 쌓일 여지가 큽니다.",
        bullets: ["2022 월드컵 세대의 상징으로 남았습니다.", "아프리카 풀백 역사에서 가장 높은 기술/운동능력 조합 중 하나입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Achraf Hakimi", url: "https://en.wikipedia.org/wiki/Achraf_Hakimi" },
      ...commonAfricaSources,
    ],
  },
  "hakim ziyach": {
    summary:
      "Hakim Ziyach는 Ajax의 2018-19 Champions League 돌풍과 Morocco 대표팀의 창의성을 상징하는 왼발 플레이메이커입니다. 이름 표기는 원본 리스트를 따르지만, 일반적으로 Hakim Ziyech로도 알려져 있습니다.",
    sections: {
      teamCareer: {
        explanation: "Ajax의 유럽 4강급 돌풍, Chelsea의 Champions League 우승 스쿼드, Morocco 월드컵 4강 세대를 반영합니다.",
        bullets: ["Ajax에서는 측면과 중앙을 오가며 공격 전개의 핵심이었습니다.", "Chelsea에서는 2020-21 Champions League 우승 스쿼드에 포함됐습니다."],
      },
      individualCareer: {
        explanation: "네덜란드 리그 베스트급 평가와 Morocco 대표팀 내 스타성을 반영합니다.",
        bullets: ["Eredivisie에서 도움, 찬스 생성, 장거리 패스 능력으로 높은 평가를 받았습니다.", "대형 개인상보다 리그 내 창조성 지표와 팬 평가가 강한 선수입니다."],
      },
      primeSkill: {
        explanation: "왼발 킥, 대각선 패스, 중거리 슈팅, 세트피스가 프라임 평가의 핵심입니다.",
        bullets: ["좁은 각도에서도 전환 패스와 크로스로 찬스를 만들었습니다.", "Ajax 전성기에는 유럽 상위권 수비도 흔드는 창조성을 보여줬습니다."],
      },
      teamImportance: {
        explanation: "Ajax와 Morocco 모두에서 공격의 예측 불가능성을 만든 선수입니다.",
        bullets: ["Ajax에서는 Tadic, Neres 등과 함께 공격의 방향을 결정했습니다.", "Morocco에서는 단단한 수비 블록에 창의성을 더하는 역할이 컸습니다."],
      },
      legacy: {
        explanation: "Morocco의 현대 공격형 재능을 대표하는 이름입니다.",
        bullets: ["2022 월드컵 세대의 주요 공격 자원으로 기억됩니다.", "Ajax 2018-19 시즌의 상징적 왼발 중 하나입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Hakim Ziyech", url: "https://en.wikipedia.org/wiki/Hakim_Ziyech" },
      ...commonAfricaSources,
    ],
  },
  "pierre emerick aubameyang": {
    summary:
      "Pierre-Emerick Aubameyang은 Dortmund와 Arsenal에서 폭발적 득점력을 보여준 Gabon의 역대 최고 스타입니다. 대표팀 전력 한계에도 개인 공격수 커리어는 아프리카 최상위권입니다.",
    sections: {
      teamCareer: {
        explanation: "Dortmund와 Arsenal에서의 득점 누적, 컵 우승, Gabon 대표팀 절대 에이스 역할을 반영합니다.",
        bullets: ["Dortmund에서 Bundesliga 정상급 스트라이커로 성장했습니다.", "Arsenal에서는 주장과 FA Cup 우승 주역 역할을 맡았습니다."],
      },
      individualCareer: {
        explanation: "2015 African Footballer of the Year와 Bundesliga/Premier League 득점왕급 시즌을 반영합니다.",
        bullets: ["2015년 아프리카 올해의 선수로 선정됐습니다.", "Dortmund와 Arsenal 모두에서 리그 득점왕 경쟁을 펼쳤습니다."],
      },
      primeSkill: {
        explanation: "최고 속도, 뒷공간 침투, 원터치 마무리가 프라임의 핵심입니다.",
        bullets: ["수비 라인 뒤를 파고드는 움직임과 가속이 압도적이었습니다.", "전성기에는 박스 안에서 간결하게 득점하는 능력이 매우 좋았습니다."],
      },
      teamImportance: {
        explanation: "Gabon에서는 전력 전체를 대표했고, Arsenal에서도 공격 생산의 중심이었습니다.",
        bullets: ["Gabon 대표팀에서는 사실상 절대 에이스였습니다.", "Arsenal의 어려운 시기에도 득점 책임을 크게 맡았습니다."],
      },
      legacy: {
        explanation: "Gabon 축구사에서는 대체 불가능한 1순위 레전드입니다.",
        bullets: ["작은 축구국가 출신으로 유럽 빅리그 득점왕급 커리어를 만든 사례입니다.", "아프리카 속도형 스트라이커 계보에서 매우 높은 위치입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Pierre-Emerick Aubameyang", url: "https://en.wikipedia.org/wiki/Pierre-Emerick_Aubameyang" },
      { label: "BBC - Aubameyang profile", url: "https://www.bbc.co.uk/sport/football/34671555" },
      ...commonAfricaSources,
    ],
  },
  "mohamed salah": {
    summary:
      "Mohamed Salah는 Liverpool 시대의 최상위 공격수이자 Egypt의 절대 에이스입니다. 득점, 창출, 지속성, 대표성 모두에서 아프리카 역대 최고 후보로 평가합니다.",
    sections: {
      teamCareer: {
        explanation: "Liverpool의 Champions League, Premier League, Club World Cup 우승과 Egypt 대표팀 월드컵 복귀 서사를 반영합니다.",
        bullets: ["Liverpool에서 Champions League와 Premier League 우승을 이끈 핵심 공격수였습니다.", "Egypt 대표팀에서는 득점과 상징성을 거의 혼자 짊어진 시대가 길었습니다."],
      },
      individualCareer: {
        explanation: "African Player of the Year, PFA/FWA 수상, Premier League Golden Boot, 각종 득점 기록을 최상위로 반영합니다.",
        bullets: ["2017-18 Premier League 32골 시즌은 리그 역사적 고점입니다.", "아프리카 올해의 선수 2회, PFA/FWA 올해의 선수급 커리어를 쌓았습니다."],
      },
      primeSkill: {
        explanation: "전성기 Salah는 컷인 득점, 속도, 오프볼 침투, 창출 능력을 모두 갖춘 세계 최고 윙포워드였습니다.",
        bullets: ["오른쪽에서 안쪽으로 들어오며 만드는 왼발 득점 패턴이 압도적이었습니다.", "단순 득점원을 넘어 도움과 찬스 생산도 높은 선수입니다."],
      },
      teamImportance: {
        explanation: "Liverpool과 Egypt 모두에서 공격 생산의 최우선 축입니다.",
        bullets: ["Klopp Liverpool의 전방 구조에서 가장 꾸준한 득점원입니다.", "Egypt에서는 전술과 심리 양면에서 절대 비중을 차지합니다."],
      },
      legacy: {
        explanation: "아프리카 역대 최고 논쟁에서 Weah, Eto'o와 함께 최상단에 놓을 수 있는 현대 레전드입니다.",
        bullets: ["Premier League 아프리카 득점 기록의 기준을 다시 썼습니다.", "현대 축구의 지속성까지 고려하면 역대급 평가가 가능합니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Mohamed Salah", url: "https://en.wikipedia.org/wiki/Mohamed_Salah" },
      { label: "Britannica - Mohamed Salah", url: "https://www.britannica.com/biography/Mohamed-Salah" },
      ...commonAfricaSources,
    ],
  },
  "riyad mahrez": {
    summary:
      "Riyad Mahrez는 Leicester City의 기적 같은 Premier League 우승과 Manchester City 트레블 커리어를 모두 가진 Algeria의 왼발 윙어입니다. 클럽 팀 커리어와 개인 고점이 모두 강합니다.",
    sections: {
      teamCareer: {
        explanation: "Leicester 2015-16 Premier League 우승, Manchester City의 다수 리그 우승과 2023 Champions League 우승, Algeria의 2019 AFCON 우승을 반영합니다.",
        bullets: ["Leicester 우승 시즌의 창조성과 득점력은 EPL 역사적 서사입니다.", "Manchester City에서는 트레블 포함 대형 트로피를 꾸준히 쌓았습니다."],
      },
      individualCareer: {
        explanation: "2016 PFA Players' Player of the Year, African Footballer of the Year를 매우 높게 반영합니다.",
        bullets: ["아프리카 선수 최초급 PFA 올해의 선수 수상자로 역사성이 있습니다.", "2016년 아프리카 올해의 선수로 선정됐습니다."],
      },
      primeSkill: {
        explanation: "전성기 Mahrez는 오른쪽 측면에서 왼발 터치, 드리블, 감아차기, 마지막 패스가 모두 위협적이었습니다.",
        bullets: ["수비수를 멈춰 세우고 타이밍을 빼앗는 1대1 능력이 뛰어났습니다.", "큰 경기에서도 왼발 한 방으로 균형을 바꿀 수 있었습니다."],
      },
      teamImportance: {
        explanation: "Leicester에서는 절대 핵심, City에서는 고급 로테이션 이상의 결정적 카드였습니다.",
        bullets: ["Leicester 우승은 Mahrez 없이는 설명하기 어렵습니다.", "Algeria 2019 AFCON 우승 과정에서도 스타성을 보였습니다."],
      },
      legacy: {
        explanation: "Algeria 현대 축구의 대표 아이콘이며, EPL 역사상 가장 상징적인 우승 서사의 주인공 중 하나입니다.",
        bullets: ["작은 팀을 우승으로 끌어올린 프라임 서사가 매우 강합니다.", "Madjer 이후 Algeria 공격수/윙어 계보의 최고 후보입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Riyad Mahrez", url: "https://en.wikipedia.org/wiki/Riyad_Mahrez" },
      { label: "FIFA - Riyad Mahrez profile", url: "https://www.fifa.com/en/articles/riyad-mahrez-algeria-quotes-records" },
      ...commonAfricaSources,
    ],
  },
  "rabah madjer": {
    summary:
      "Rabah Madjer는 1987 European Cup 결승의 상징적 백힐 골과 Porto 우승, Algeria의 1990 AFCON 우승으로 기억되는 레전드입니다. Algeria 역사상 최고 공격수 후보입니다.",
    sections: {
      teamCareer: {
        explanation: "Porto의 European Cup, European Super Cup, Intercontinental Cup, Algeria의 1990 AFCON 우승을 핵심으로 반영합니다.",
        bullets: ["1987 European Cup 결승에서 동점골과 결승골 도움으로 Porto 우승을 만들었습니다.", "Algeria의 1990 AFCON 우승에도 중심적 의미가 있습니다."],
      },
      individualCareer: {
        explanation: "1987 African Footballer of the Year와 유럽 결승 임팩트를 반영합니다.",
        bullets: ["1987년 아프리카 올해의 선수로 선정됐습니다.", "단일 결승전 임팩트가 매우 강한 역사적 개인 커리어입니다."],
      },
      primeSkill: {
        explanation: "기술적 센스, 박스 주변 움직임, 큰 경기 침착성이 강한 포워드였습니다.",
        bullets: ["백힐 골로 상징되는 창의적 마무리 감각이 있습니다.", "Porto 시절에는 유럽 정상급 경기에서도 차이를 만들었습니다."],
      },
      teamImportance: {
        explanation: "Porto와 Algeria 모두에서 결정적 순간의 주인공이었습니다.",
        bullets: ["Porto 유럽 제패 서사의 가장 기억나는 장면을 만든 선수입니다.", "Algeria 대표팀에서는 공격의 상징적 리더였습니다."],
      },
      legacy: {
        explanation: "Algeria 축구사에서 Mahrez와 함께 최상위 공격 레전드로 비교되는 이름입니다.",
        bullets: ["1987 결승의 'Madjer'는 기술적 골의 대명사처럼 남았습니다.", "아프리카 선수가 유럽 컵 결승을 지배한 초기 사례입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Rabah Madjer", url: "https://en.wikipedia.org/wiki/Rabah_Madjer" },
      { label: "UEFA - Madjer Porto final", url: "https://www.uefa.com/uefachampionsleague/news/0217-0e8b728f029a-f77a00abccd6-1000--brahimi-following-in-madjer-s-porto-footsteps/" },
      ...commonAfricaSources,
    ],
  },
};

const detailedAfricanProfileOverrides: Record<string, CuratedProfileEntry> = {
  "george weah": {
    summary:
      "George Weah는 African Player of the Century, 1995 Ballon d'Or, 1995 FIFA World Player를 모두 가진 Liberia의 절대적 축구 상징입니다. 클럽 우승 총량은 Eto'o/Salah보다 적지만, 개인 고점과 역사적 유일성은 아프리카 전체 최상단입니다.",
    sections: {
      teamCareer: {
        explanation: "소속팀 전체와 공식 우승 내역을 분리해 봅니다. Weah는 Monaco, PSG, Milan에서 커리어 핵심을 만들었고, Liberia 대표팀에서는 우승보다 국가 전체를 대표한 비중이 큽니다.",
        verdict: "팀 커리어는 Milan/PSG 우승과 Chelsea FA Cup까지 강하지만, Champions League 우승 부재와 Liberia 대표팀 전력 한계 때문에 개인 위상만큼 압도적이지는 않습니다.",
        facts: [
          {
            label: "소속팀",
            items: [
              "Young Survivors",
              "Bong Range United",
              "Mighty Barrolle",
              "Invincible Eleven",
              "Africa Sports",
              "Tonnerre Yaounde",
              "Monaco",
              "Paris Saint-Germain",
              "AC Milan",
              "Chelsea loan",
              "Manchester City",
              "Marseille",
              "Al Jazira",
              "Liberia national team",
            ],
          },
          {
            label: "팀 우승",
            items: [
              "Mighty Barrolle: Liberian Premier League 1986, Liberian FA Cup 1986",
              "Invincible Eleven: Liberian Premier League 1987",
              "Monaco: Coupe de France 1990-91",
              "Paris Saint-Germain: Division 1 1993-94, Coupe de France 1992-93/1994-95, Coupe de la Ligue 1994-95",
              "AC Milan: Serie A 1995-96, 1998-99",
              "Chelsea: FA Cup 1999-2000",
            ],
          },
          {
            label: "대표팀 성과",
            items: ["Liberia: West African Nations Cup runner-up 1987", "FIFA World Cup 본선 출전은 없음"],
          },
        ],
        bullets: ["PSG에서 1994-95 Champions League 득점왕을 차지했고 Milan에서는 Serie A 2회 우승을 기록했습니다.", "Liberia에서는 우승 기록보다 국가 축구 전체의 얼굴이라는 의미가 더 큽니다."],
      },
      individualCareer: {
        explanation: "Weah의 개인 수상은 아프리카 선수 역사상 가장 상징적인 단일 시즌을 포함합니다.",
        verdict: "1995년 Ballon d'Or와 FIFA World Player 동시 수상은 아프리카 선수 평가에서 여전히 가장 강한 개인상 근거입니다.",
        facts: [
          {
            label: "주요 개인 수상",
            items: [
              "African Footballer of the Year: 1989, 1995",
              "BBC African Footballer of the Year: 1995",
              "Ballon d'Or: 1995",
              "FIFA World Player of the Year: 1995; Silver Award: 1996",
              "Onze d'Or: 1995; Onze d'Argent: 1996",
              "RSSSF Player of the Year: 1995",
              "El Pais King of European Soccer: 1995",
              "FIFA Fair Play Award: 1996",
              "IFFHS African Player of the Century: 1999",
            ],
          },
          {
            label: "기록/명예",
            items: [
              "UEFA Champions League top scorer: 1994-95",
              "ESM Team of the Year: 1995-96",
              "FIFA 100: 2004",
              "Golden Foot Legends Award: 2005",
              "AC Milan Hall of Fame",
              "IFFHS All-time Africa Men's Dream Team: 2021",
            ],
          },
        ],
        bullets: ["아프리카 국적 선수로 Ballon d'Or와 FIFA World Player를 모두 받은 유일한 선수입니다.", "1995년은 PSG/Milan 활약과 개인상 결과가 한꺼번에 폭발한 커리어 정점입니다."],
      },
      primeSkill: {
        explanation: "1994-96년을 프라임으로 봅니다. PSG에서 유럽 득점력을 증명한 뒤 Milan에서 속도, 파워, 드리블, 마무리를 동시에 보여줬습니다.",
        verdict: "프라임 고점만 놓고 보면 아프리카 공격수 중 최고 후보입니다.",
        facts: [
          {
            label: "프라임 근거",
            items: [
              "1994-95 UEFA Champions League top scorer, PSG semi-final 진출",
              "1995 Ballon d'Or, FIFA World Player of the Year, Onze d'Or 동시 수상",
              "1995-96 Milan Serie A 우승 시즌 팀 내 핵심 공격수",
              "1996 FIFA World Player of the Year 2위",
            ],
          },
          {
            label: "스킬 프로필",
            items: ["긴 거리 운반 드리블", "폭발적인 가속과 몸싸움", "박스 안 마무리와 중거리 슈팅", "오픈 필드에서 수비 라인을 직접 파괴하는 능력"],
          },
        ],
        bullets: ["Hellas Verona전 단독 질주 골처럼 자기 진영부터 골까지 혼자 전진할 수 있는 희소한 공격수였습니다.", "동시대 유럽 최상위 수비수들을 상대로 피지컬과 기술을 모두 통과시킨 프라임입니다."],
      },
      teamImportance: {
        explanation: "클럽에서는 차이를 만드는 에이스형 포워드였고, Liberia에서는 전력 이상의 의미를 가진 국가 대표 아이콘이었습니다.",
        verdict: "Liberia 대표팀 비중은 축구사 전체에서도 특수한 수준입니다.",
        facts: [
          {
            label: "팀별 역할",
            items: [
              "PSG: 1994-95 유럽 대항전 공격의 중심",
              "AC Milan: 1995-96 우승 시즌 주 공격 옵션",
              "Liberia: 대표팀의 절대적 얼굴이자 전력 기준점",
            ],
          },
          {
            label: "감점/맥락",
            items: ["Milan에서는 팀 전체 왕조의 일부였고, Liberia에서는 국제대회 우승으로 연결되기 어려운 환경이었습니다."],
          },
        ],
        bullets: ["Liberia의 국제 경쟁력 한계 때문에 우승 결과는 적지만, 개인 의존도는 매우 높았습니다.", "PSG와 Milan에서는 우승 가능한 팀의 최종 차이를 만드는 공격수였습니다."],
      },
      legacy: {
        explanation: "100년 뒤에도 남을 객관 근거는 '유일한 아프리카 Ballon d'Or/FIFA World Player'와 'African Player of the Century'입니다.",
        verdict: "역사적 존재감은 아프리카 축구 전체 1위 후보입니다.",
        facts: [
          {
            label: "장기 보존 근거",
            items: [
              "현재까지 African nationality 기준 유일한 Ballon d'Or 수상자",
              "현재까지 유일한 African FIFA World Player of the Year 수상자",
              "IFFHS African Player of the Century",
              "축구 선수 출신 국가원수라는 축구 외적 역사성",
            ],
          },
        ],
        bullets: ["팀 트로피가 더 많은 선수는 있어도, Weah의 개인상 유일성은 대체가 어렵습니다.", "Liberia라는 작은 축구 국가 출신이라는 서사가 역사적 기억을 더 강하게 만듭니다."],
      },
    },
    sources: [
      { label: "Wikipedia - George Weah", url: "https://en.wikipedia.org/wiki/George_Weah" },
      { label: "RSSSF African Player of the Year", url: "https://www.rsssf.org/miscellaneous/afr-poy.html" },
      { label: "IFFHS Africa Player of the Century", url: "https://portal.iffhs.com/posts/500" },
    ],
  },
  "samuel eto o": {
    summary:
      "Samuel Eto'o는 Barcelona와 Inter에서 모두 Champions League를 든 아프리카 역사상 가장 완성도 높은 팀 커리어형 스트라이커입니다. 클럽 트로피, 대표팀 우승, 개인상, 큰 경기 득점이 모두 강합니다.",
    sections: {
      teamCareer: {
        explanation: "Eto'o는 소속팀 전체가 많지만, 팀 커리어의 핵심은 Mallorca, Barcelona, Inter, Cameroon입니다.",
        verdict: "팀 커리어만 놓으면 아프리카 공격수 중 최상위권입니다.",
        facts: [
          {
            label: "소속팀",
            items: [
              "Real Madrid B",
              "Leganes loan",
              "Espanyol loan",
              "Mallorca loan/permanent",
              "Barcelona",
              "Inter Milan",
              "Anzhi Makhachkala",
              "Chelsea",
              "Everton",
              "Sampdoria",
              "Antalyaspor",
              "Konyaspor",
              "Qatar SC",
              "Cameroon U23",
              "Cameroon national team",
            ],
          },
          {
            label: "클럽 우승",
            items: [
              "Mallorca: Copa del Rey 2002-03",
              "Barcelona: La Liga 2004-05, 2005-06, 2008-09",
              "Barcelona: Copa del Rey 2008-09",
              "Barcelona: Supercopa de Espana 2005, 2006",
              "Barcelona: UEFA Champions League 2005-06, 2008-09",
              "Inter Milan: Serie A 2009-10",
              "Inter Milan: Coppa Italia 2009-10, 2010-11",
              "Inter Milan: Supercoppa Italiana 2010",
              "Inter Milan: UEFA Champions League 2009-10",
              "Inter Milan: FIFA Club World Cup 2010",
            ],
          },
          {
            label: "대표팀 우승",
            items: ["Cameroon U23: Olympic Gold Medal 2000", "Cameroon: Africa Cup of Nations 2000, 2002", "Cameroon: Africa Cup of Nations runner-up 2008", "Cameroon: FIFA Confederations Cup runner-up 2003"],
          },
        ],
        bullets: ["2006, 2009 Champions League 결승에서 모두 득점했고 2010 Inter 트레블에도 주전으로 기여했습니다.", "Barcelona와 Inter에서 연속 시즌 대륙 트레블을 경험한 희귀한 커리어입니다."],
      },
      individualCareer: {
        explanation: "개인 수상은 African Player of the Year 4회를 중심으로, 유럽 베스트 XI급 평가와 득점왕 기록이 붙습니다.",
        verdict: "개인상 누적도 Weah 다음 급 최상단입니다.",
        facts: [
          {
            label: "주요 개인 수상/선정",
            items: [
              "Young African Player of the Year: 2000",
              "African Player of the Year: 2003, 2004, 2005, 2010",
              "ESM Team of the Year: 2004-05, 2005-06, 2008-09, 2010-11",
              "FIFA World Player of the Year Bronze Award: 2005",
              "FIFA FIFPro World XI: 2005, 2006",
              "UEFA Team of the Year: 2005, 2006",
              "CAF Team of the Year: 2005, 2006, 2008, 2009, 2010, 2011",
              "UEFA Club Forward of the Year: 2006",
              "Golden Foot: 2015",
              "Globe Soccer Player Career Award: 2016",
              "IFFHS All-time Africa Men's Dream Team: 2021",
              "Inter Milan Hall of Fame: 2021",
            ],
          },
          {
            label: "득점/기록상",
            items: [
              "Pichichi Trophy: 2005-06",
              "UEFA Champions League top assist provider: 2005-06",
              "Africa Cup of Nations top goalscorer: 2006, 2008",
              "FIFA Club World Cup Golden Ball: 2010",
              "Coppa Italia top goalscorer: 2010-11",
              "Russian Premier League MVP Award: 2012-13",
              "Africa Cup of Nations all-time top goalscorer",
              "RCD Mallorca all-time top goalscorer",
              "Cameroon all-time top goalscorer",
            ],
          },
        ],
        bullets: ["African Player of the Year 4회는 역사적 누적입니다.", "FIFPro World XI와 UEFA Team of the Year 선정은 단순 아프리카 범위를 넘어선 세계급 평가입니다."],
      },
      primeSkill: {
        explanation: "프라임 구간은 2004-10년입니다. Barcelona에서 폭발적 9번, Inter에서는 더 넓은 전술 역할까지 수행했습니다.",
        verdict: "득점형 스트라이커와 전술형 포워드를 모두 해낸 프라임입니다.",
        facts: [
          {
            label: "프라임 근거",
            items: [
              "2005-06 La Liga Pichichi, Champions League 결승 득점",
              "2008-09 Barcelona 트레블 시즌 주전 스트라이커, Champions League 결승 득점",
              "2009-10 Inter 트레블 시즌 주전, Mourinho 체제에서 윙/수비 가담까지 수행",
              "2005 FIFA World Player of the Year 3위",
            ],
          },
          {
            label: "스킬 프로필",
            items: ["순간 침투와 첫 터치", "양발 마무리와 박스 안 위치 선정", "전방 압박과 수비 가담", "큰 경기에서 직접 득점하는 클러치 능력"],
          },
        ],
        bullets: ["2006/2009 UCL 결승 득점은 프라임 실력의 가장 직접적인 근거입니다.", "2010 Inter에서는 득점만이 아니라 전술 희생까지 수행해 평가 폭이 넓습니다."],
      },
      teamImportance: {
        explanation: "Barcelona와 Cameroon에서는 직접 득점 축, Inter에서는 팀 구조를 완성하는 전술적 핵심이었습니다.",
        verdict: "대표팀과 클럽 양쪽에서 모두 핵심 역할을 증명했습니다.",
        facts: [
          {
            label: "팀별 역할",
            items: [
              "Barcelona: Ronaldinho/Messi/Henry와 함께한 공격의 중앙 마무리 축",
              "Inter Milan: 2009-10 트레블 팀에서 왼쪽 공격/수비 밸런스 담당",
              "Cameroon: AFCON 우승 세대의 간판 공격수이자 역대 최다 득점자",
            ],
          },
        ],
        bullets: ["Inter에서 보여준 역할 변화는 단순 골잡이 이상의 팀 비중을 증명합니다.", "Cameroon에서는 성과와 기록이 모두 따라온 대표팀 에이스였습니다."],
      },
      legacy: {
        explanation: "Eto'o의 장기 존재감은 트레블 2회, African Player of the Year 4회, AFCON 역대 득점 기록에서 나옵니다.",
        verdict: "아프리카 역대 최고 스트라이커 논쟁의 1순위 후보입니다.",
        facts: [
          {
            label: "장기 보존 근거",
            items: [
              "서로 다른 두 클럽으로 연속 Champions League 우승",
              "Barcelona 2009, Inter 2010 연속 트레블 멤버",
              "African Player of the Year 4회",
              "AFCON all-time top goalscorer",
              "Cameroon all-time top goalscorer",
            ],
          },
        ],
        bullets: ["팀 커리어, 대표팀 성과, 개인상, 기록이 모두 균형 잡힌 아프리카 레전드입니다.", "Weah의 개인상 유일성과 다른 방식으로, Eto'o는 우승과 지속성의 기준점입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Samuel Eto'o", url: "https://en.wikipedia.org/wiki/Samuel_Eto%27o" },
      { label: "FC Barcelona - Samuel Eto'o", url: "https://www.fcbarcelona.com/en/card/648033/samuel-etoogo" },
      { label: "RSSSF African Player of the Year", url: "https://www.rsssf.org/miscellaneous/afr-poy.html" },
    ],
  },
  "mohamed salah": {
    summary:
      "Mohamed Salah는 Liverpool 시대를 대표하는 오른쪽 윙포워드이자 Egypt의 절대 에이스입니다. 프리미어리그 기록, 개인상 누적, 클럽 우승, 대표팀 상징성을 모두 가진 현대 아프리카 최고 후보입니다.",
    sections: {
      teamCareer: {
        explanation: "Salah는 Basel, Chelsea, Fiorentina, Roma, Liverpool를 거쳤고, 팀 우승의 대부분은 Basel과 Liverpool에서 나왔습니다.",
        verdict: "팀 커리어는 Liverpool 왕조의 핵심으로 충분히 강하지만, Egypt 대표팀 우승이 없다는 점은 남습니다.",
        facts: [
          {
            label: "소속팀",
            items: ["Al Mokawloon", "Basel", "Chelsea", "Fiorentina loan", "Roma loan/permanent", "Liverpool", "Egypt U20", "Egypt U23", "Egypt national team"],
          },
          {
            label: "클럽 우승",
            items: [
              "Basel: Swiss Super League 2012-13, 2013-14",
              "Liverpool: Premier League 2019-20, 2024-25",
              "Liverpool: FA Cup 2021-22",
              "Liverpool: EFL Cup 2021-22, 2023-24",
              "Liverpool: FA Community Shield 2022",
              "Liverpool: UEFA Champions League 2018-19",
              "Liverpool: UEFA Super Cup 2019",
              "Liverpool: FIFA Club World Cup 2019",
            ],
          },
          {
            label: "대표팀 성과",
            items: ["Egypt: Africa Cup of Nations runner-up 2017, 2021", "Egypt: 2018 FIFA World Cup 본선 진출의 핵심"],
          },
        ],
        bullets: ["Liverpool에서 Champions League와 Premier League 우승의 핵심 득점원이었습니다.", "2024-25 두 번째 리그 우승까지 포함하면 클럽 누적도 매우 강합니다."],
      },
      individualCareer: {
        explanation: "Salah는 현대 아프리카 선수 중 개인상과 리그 기록 누적이 가장 강한 축입니다.",
        verdict: "Premier League 개인상 누적은 아프리카 선수 역대 최상단입니다.",
        facts: [
          {
            label: "주요 개인 수상",
            items: [
              "CAF Most Promising Talent of the Year: 2012",
              "Swiss Super League Player of the Year: 2013",
              "AS Roma Player of the Season: 2015-16",
              "Globe Soccer Best Arab Player of the Year: 2016",
              "African Footballer of the Year: 2017, 2018",
              "BBC African Footballer of the Year: 2017, 2018",
              "UAFA Golden Boy: 2012",
              "El Heddaf Arab Footballer of the Year: 2013, 2017, 2018",
              "PFA Players' Player of the Year: 2017-18, 2021-22, 2024-25",
              "FWA Footballer of the Year: 2017-18, 2021-22, 2024-25",
              "Premier League Player of the Season: 2017-18, 2024-25",
              "FIFA Puskas Award: 2018",
              "FIFA Club World Cup Golden Ball: 2019",
              "FSA Player of the Year: 2018, 2021, 2023",
              "Golden Foot: 2021",
              "Laureus Sporting Inspiration Award: 2021",
              "Globe Soccer Fans' Player of the Year: 2022",
              "FPL Pod Player of the Year: 2025",
              "The Athletic's Premier League Player of the Year: 2024-25",
            ],
          },
          {
            label: "득점/선정/기록",
            items: [
              "Premier League Golden Boot: 2017-18, 2018-19 shared, 2021-22 shared, 2024-25",
              "Premier League Playmaker of the Season: 2021-22, 2024-25",
              "Premier League Goal of the Season: 2021-22",
              "PFA Premier League Team of the Year: 2017-18, 2020-21, 2021-22, 2024-25",
              "Liverpool Players' Player of the Season: 2017-18, 2020-21, 2021-22, 2023-24, 2024-25",
              "PFA Fans' Player of the Year: 2017-18, 2020-21, 2021-22",
              "UEFA Champions League Squad of the Season: 2017-18",
              "ESM Team of the Year: 2017-18, 2021-22",
              "CAF Team of the Year: 2017, 2018, 2019, 2023, 2024",
              "Africa Cup of Nations Team of the Tournament: 2017, 2021",
              "Premier League Player of the Month: November 2017, February 2018, March 2018, October 2021, October 2023, November 2024, February 2025",
              "PFA Player of the Month: November 2017, December 2017, February 2018, March 2018, December 2018, January 2019, April 2019, September 2021, October 2021, February 2022, September 2023, October 2023, November 2024, February 2025",
              "BBC Goal of the Month: December 2017, February 2018, April 2019, September 2019, January 2021, October 2021, November 2024",
              "BBC Goal of the Season: 2021-22",
              "Liverpool Goal of the Season: 2018-19, 2021-22, 2022-23",
              "IFFHS Best CAF Men's Player of the Decade: 2011-2020",
              "IFFHS CAF Men's Team of the Decade: 2011-2020",
              "IFFHS CAF Men's Team of The Year: 2020, 2021, 2022, 2023, 2024",
              "IFFHS Best CAF Men's Player of the Year: 2021",
              "The Athletic Premier League Team of the Season: 2024-25",
              "The Athletic European Men's Team of the Season: 2024-25",
              "Premier League Fan Team of the Season: 2024-25",
              "EA Sports FC Premier League Team of the Season: 2024-25",
              "Time 100: 2019",
              "Liverpool all-time Premier League top scorer",
            ],
          },
        ],
        bullets: ["2017-18 32골 시즌은 38경기 체제 Premier League의 기준점으로 남습니다.", "득점왕과 플레이메이커상을 모두 받은 시즌들이 있어 단순 마무리형이 아닙니다."],
      },
      primeSkill: {
        explanation: "프라임은 2017-18, 2021-22, 2024-25를 핵심 고점으로 봅니다. 속도형 윙에서 창출형 포워드로 진화한 점이 중요합니다.",
        verdict: "현대 축구 기준 생산성, 지속성, 창출력을 모두 갖춘 월드클래스 윙포워드입니다.",
        facts: [
          {
            label: "프라임 근거",
            items: [
              "2017-18 Premier League 32골, PFA/FWA/PL Player of the Season",
              "2021-22 Premier League Golden Boot shared + Playmaker of the Season",
              "2024-25 PFA/FWA/PL Player of the Season, Golden Boot, Playmaker of the Season",
              "2018 and 2021 The Best FIFA Men's Player 3위",
            ],
          },
          {
            label: "스킬 프로필",
            items: ["오른쪽에서 안쪽으로 들어오는 왼발 득점", "뒷공간 침투와 박스 안 위치 선정", "전환 상황 스피드", "후기 커리어의 패스/찬스 창출 증가"],
          },
        ],
        bullets: ["프라임 Salah는 골과 도움을 동시에 리그 최상단으로 생산했습니다.", "단일 시즌 고점뿐 아니라 여러 시즌 반복 생산이 강점입니다."],
      },
      teamImportance: {
        explanation: "Liverpool에서는 Klopp 공격 구조의 최종 생산자, Egypt에서는 전술과 여론을 모두 짊어진 절대 에이스입니다.",
        verdict: "팀 내 비중은 현역 아프리카 선수 중 최고 수준입니다.",
        facts: [
          {
            label: "팀별 역할",
            items: [
              "Liverpool: Mane-Firmino-Salah 3톱의 최다 득점 축",
              "Liverpool: 2020년대 중반 이후에도 팀 공격 생산의 1순위",
              "Egypt: 주장, 월드컵 진출과 AFCON 결승 진출의 중심",
            ],
          },
          {
            label: "한계/맥락",
            items: ["Egypt에서는 AFCON 우승이 없어 대표팀 팀 커리어는 개인 영향력 대비 미완입니다."],
          },
        ],
        bullets: ["Liverpool에서는 시스템의 일부이면서 동시에 시스템을 결과로 바꾸는 최종 생산자였습니다.", "Egypt에서는 전술적 의존도와 상징성이 모두 매우 높습니다."],
      },
      legacy: {
        explanation: "Salah의 존재감은 Premier League 기록, Liverpool 역사 순위, Egypt 국가 상징성으로 장기 보존됩니다.",
        verdict: "100년 뒤에도 Weah/Eto'o와 함께 아프리카 역대 최고 논쟁에 남을 가능성이 큽니다.",
        facts: [
          {
            label: "장기 보존 근거",
            items: [
              "Liverpool all-time Premier League top scorer",
              "Premier League Golden Boot 4회",
              "PFA Players' Player of the Year 3회",
              "African Footballer of the Year 2회",
              "Egypt 축구의 세계적 상징",
            ],
          },
        ],
        bullets: ["현대 EPL의 글로벌 노출과 기록 누적이 결합돼 장기 기억에 유리합니다.", "대표팀 우승만 추가되면 역사적 위치는 더 올라갈 여지가 있습니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Mohamed Salah", url: "https://en.wikipedia.org/wiki/Mohamed_Salah" },
      { label: "Britannica - Mohamed Salah", url: "https://www.britannica.com/biography/Mohamed-Salah" },
      { label: "Liverpool FC - Salah awards references", url: "https://www.liverpoolfc.com/" },
    ],
  },
  "didier drogba": {
    summary:
      "Didier Drogba는 Chelsea의 결승 해결사이자 Cote d'Ivoire 황금세대의 주장입니다. 우승 내역, 클러치 득점, 대표팀 비중을 함께 봐야 하는 9번입니다.",
    sections: {
      teamCareer: {
        explanation: "Drogba는 Le Mans, Guingamp, Marseille, Chelsea, Shanghai Shenhua, Galatasaray, Montreal Impact, Phoenix Rising을 거쳤고, 우승 대부분은 Chelsea와 Galatasaray에서 나왔습니다.",
        verdict: "Chelsea 팀 커리어는 최상급이고, 대표팀은 결승까지 갔지만 AFCON 우승은 없습니다.",
        facts: [
          {
            label: "소속팀",
            items: ["Le Mans", "Guingamp", "Marseille", "Chelsea", "Shanghai Shenhua", "Galatasaray", "Chelsea second spell", "Montreal Impact", "Phoenix Rising", "Cote d'Ivoire national team"],
          },
          {
            label: "클럽 우승",
            items: [
              "Chelsea: Premier League 2004-05, 2005-06, 2009-10, 2014-15",
              "Chelsea: FA Cup 2006-07, 2008-09, 2009-10, 2011-12",
              "Chelsea: Football League Cup 2004-05, 2006-07, 2014-15",
              "Chelsea: FA Community Shield 2005, 2009",
              "Chelsea: UEFA Champions League 2011-12",
              "Galatasaray: Super Lig 2012-13",
              "Galatasaray: Turkish Cup 2013-14",
              "Galatasaray: Turkish Super Cup 2013",
              "Phoenix Rising: USL Western Conference 2018",
            ],
          },
          {
            label: "대표팀 성과",
            items: ["Cote d'Ivoire: Africa Cup of Nations runner-up 2006, 2012", "Cote d'Ivoire: 2006 FIFA World Cup 첫 본선 진출 세대 주장"],
          },
        ],
        bullets: ["2012 Champions League 결승 동점골과 승부차기 결승골은 팀 커리어의 정점입니다.", "Chelsea의 2000년대 우승 DNA를 상징하는 공격수입니다."],
      },
      individualCareer: {
        explanation: "Drogba의 개인상은 African Footballer of the Year 2회와 EPL/컵 결승 기록 중심입니다.",
        verdict: "개인상 총량보다 결승 기록과 클러치 서사가 강한 선수입니다.",
        facts: [
          {
            label: "개인 수상/선정",
            items: [
              "African Footballer of the Year: 2006, 2009",
              "BBC African Footballer of the Year: 2009",
              "Africa Cup of Nations Team of the Tournament: 2006, 2012",
              "Africa Cup of Nations Top Scorer: 2012",
              "CAF Team of the Year: 2005, 2006, 2009, 2010, 2012",
              "FIFPro World XI: 2007",
              "ESM Team of the Year: 2006-07",
              "Chelsea Players' Player of the Year: 2007",
              "Chelsea Player of the Year: 2010",
              "Ligue 1 Goal of the Year: 2003-04",
              "Ligue 1 Player of the Month: January 2004, May 2004",
              "Ligue 1 Player of the Year: 2003-04",
              "Ligue 1 Team of the Year: 2003-04",
              "MLS All-Star: 2016",
              "MLS Player of the Month: September 2015, October 2015",
              "Montreal Impact Top Scorer: 2015",
              "Onze d'Or: 2004",
              "Onze de Bronze: 2007",
              "Premier League Golden Boot: 2006-07, 2009-10",
              "Premier League Most Assists: 2005-06",
              "PFA Team of the Year: 2006-07 Premier League, 2009-10 Premier League",
              "Time 100: 2010",
              "Turkish Footballer of the Year: 2013",
              "Alan Hardaker Trophy: 2007",
              "FA Cup Final Man of the Match: 2010",
              "FA Community Shield Man of the Match: 2005",
              "UEFA Champions League Final Man of the Match: 2012",
              "UEFA Cup Top Scorer: 2003-04",
              "UEFA President's Award: 2020",
              "UEFA Team of the Year: 2007",
              "UNFP Trophy of Honour: 2019",
              "FWA Tribute Award: 2015",
            ],
          },
          {
            label: "기록",
            items: ["First African player to score 100 Premier League goals", "FA Cup finals 4경기 득점", "Chelsea 공식 경기 결승전 10골급 클러치 기록으로 자주 인용"],
          },
        ],
        bullets: ["2006-07, 2009-10 전후의 EPL 지배력과 2012 UCL 결승 퍼포먼스가 개인 평가의 핵심입니다.", "수상 목록 이상의 큰 경기 이미지가 강하게 남습니다."],
      },
      primeSkill: {
        explanation: "프라임은 2006-10년 Chelsea 1기 후반으로 봅니다. 피지컬, 포스트플레이, 제공권, 슈팅, 프리킥이 결합된 타깃맨 고점입니다.",
        verdict: "순수 타깃맨/클러치 9번으로는 아프리카 최고 후보입니다.",
        facts: [
          {
            label: "프라임 근거",
            items: ["2006 African Footballer of the Year", "2006-07 ESM Team of the Year, FIFPro World XI 2007", "2009 African Footballer of the Year", "2009-10 Chelsea Player of the Year", "2010 FA Cup Final Man of the Match"],
          },
          {
            label: "스킬 프로필",
            items: ["등지는 플레이와 롱볼 수신", "제공권과 몸싸움", "큰 경기 마무리", "중거리/프리킥 한 방", "수비 세트피스 기여"],
          },
        ],
        bullets: ["Drogba는 팀이 막힐 때 가장 단순하고 강력한 해법을 제공했습니다.", "전성기에는 수비수와의 물리적 경합 자체를 경기 계획으로 만들 수 있었습니다."],
      },
      teamImportance: {
        explanation: "Chelsea에서는 전술적 기준점, Cote d'Ivoire에서는 황금세대의 주장과 상징이었습니다.",
        verdict: "팀 내 비중은 Eto'o보다 높게 볼 여지가 있습니다.",
        facts: [
          {
            label: "팀별 역할",
            items: [
              "Chelsea: Mourinho/Ancelotti/Di Matteo 체제에서 직접 공격 루트의 기준점",
              "Chelsea: 2012 Champions League 우승의 결정적 해결사",
              "Cote d'Ivoire: 2006/2010/2014 월드컵 세대의 주장",
            ],
          },
        ],
        bullets: ["Chelsea는 Drogba가 있으면 경기 양상이 달라지는 팀이었습니다.", "코트디부아르에서는 우승은 없었지만 황금세대의 정신적 중심이었습니다."],
      },
      legacy: {
        explanation: "Drogba는 Chelsea 역사와 아프리카 EPL 공격수 역사에서 장기 보존될 근거가 확실합니다.",
        verdict: "100년 뒤에도 '큰 경기의 9번'을 말할 때 남을 이름입니다.",
        facts: [
          {
            label: "장기 보존 근거",
            items: ["Chelsea 2012 Champions League 우승의 상징", "African Footballer of the Year 2회", "Premier League 100골을 넘긴 최초의 아프리카 선수", "Cote d'Ivoire all-time top goalscorer"],
          },
        ],
        bullets: ["Weah/Salah/Eto'o가 개인상과 기록의 축이라면 Drogba는 결승 서사의 축입니다.", "Chelsea 팬덤에서의 기억 강도는 역대 스트라이커 중 최상급입니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Didier Drogba", url: "https://en.wikipedia.org/wiki/Didier_Drogba" },
      { label: "UEFA - Drogba final master", url: "https://www.uefa.com/uefachampionsleague/news/0261-107d82d75d76-8f0e9280f586-1000--how-brilliant-was-chelsea-s-final-master-didier-drogba/" },
      { label: "RSSSF African Player of the Year", url: "https://www.rsssf.org/miscellaneous/afr-poy.html" },
    ],
  },
  "yaya toure": {
    summary:
      "Yaya Toure는 Barcelona 트레블과 Manchester City 시대 개막, Cote d'Ivoire AFCON 우승을 모두 가진 중앙 미드필더입니다. 피지컬, 운반, 득점력을 결합한 프라임이 강합니다.",
    sections: {
      teamCareer: {
        explanation: "소속팀 전체를 나열하고, 공식 우승은 Olympiacos, Barcelona, Manchester City, Qingdao Huanghai, Cote d'Ivoire에서 확인합니다.",
        verdict: "팀 커리어는 중앙 미드필더 기준 아프리카 최상위권입니다.",
        facts: [
          {
            label: "소속팀",
            items: ["ASEC Mimosas", "Beveren", "Metalurh Donetsk", "Olympiacos", "Monaco", "Barcelona", "Manchester City", "Olympiacos second spell", "Qingdao Huanghai", "Cote d'Ivoire national team"],
          },
          {
            label: "팀 우승",
            items: [
              "Olympiacos: Alpha Ethniki 2005-06, Greek Football Cup 2005-06",
              "Barcelona: La Liga 2008-09, 2009-10",
              "Barcelona: Copa del Rey 2008-09",
              "Barcelona: Supercopa de Espana 2009",
              "Barcelona: UEFA Champions League 2008-09",
              "Barcelona: UEFA Super Cup 2009",
              "Barcelona: FIFA Club World Cup 2009",
              "Manchester City: Premier League 2011-12, 2013-14, 2017-18",
              "Manchester City: FA Cup 2010-11",
              "Manchester City: Football League Cup 2013-14, 2015-16",
              "Manchester City: FA Community Shield 2012",
              "Qingdao Huanghai: China League One 2019",
              "Cote d'Ivoire: Africa Cup of Nations 2015; runner-up 2006, 2012",
            ],
          },
        ],
        bullets: ["Barcelona에서는 2009 UCL 결승을 센터백으로 소화했고, City에서는 우승 시대를 연 중원의 핵심이었습니다.", "2015 AFCON 우승은 대표팀 커리어의 결정적 완성입니다."],
      },
      individualCareer: {
        explanation: "개인 수상은 African Footballer of the Year 4연속 수상이 핵심입니다.",
        verdict: "미드필더로 African Player of the Year를 4회 받은 점은 독보적입니다.",
        facts: [
          {
            label: "개인 수상/선정",
            items: [
              "Ivory Coast Player of the Year: 2009",
              "CAF Team of the Year: 2008, 2009, 2011, 2012, 2013, 2014, 2015",
              "African Footballer of the Year: 2011, 2012, 2013, 2014",
              "Premio Bulgarelli Number 8: 2013",
              "ESM Team of the Year: 2013-14",
              "PFA Team of the Year: 2011-12 Premier League, 2013-14 Premier League",
            ],
          },
        ],
        bullets: ["2011-14년 아프리카 올해의 선수 4연속 수상은 전성기 지배력을 보여줍니다.", "2013-14 시즌은 EPL 중앙 미드필더 단일 시즌 고점 논쟁에 들어갈 만합니다."],
      },
      primeSkill: {
        explanation: "프라임은 2011-14 Manchester City 시기입니다. 특히 2013-14는 득점형 8번으로 폭발했습니다.",
        verdict: "피지컬형 미드필더 중에서도 기술과 득점을 모두 가진 특수한 고점입니다.",
        facts: [
          {
            label: "프라임 근거",
            items: [
              "2011-12 Premier League 우승 시즌 PFA Team of the Year",
              "2013-14 Premier League 우승 시즌 PFA Team of the Year, ESM Team of the Year",
              "2011-14 African Footballer of the Year 4연속 수상",
            ],
          },
          {
            label: "스킬 프로필",
            items: ["중앙 운반 드리블", "압박 저항", "박스 침투와 중거리 슈팅", "세트피스", "수비형/중앙/공격형 미드필더 역할 전환"],
          },
        ],
        bullets: ["전성기 Yaya는 미드필더가 직접 공을 운반해 득점까지 끝내는 보기 드문 유형이었습니다.", "Barcelona 시절 수비적 역할과 City 시절 공격적 역할 모두 소화한 전술 폭이 강점입니다."],
      },
      teamImportance: {
        explanation: "City에서는 새 왕조의 핵심, Cote d'Ivoire에서는 2015 우승 주장급 중심, Barcelona에서는 훌륭한 팀 조각이었습니다.",
        verdict: "City에서의 비중은 Barcelona보다 훨씬 높습니다.",
        facts: [
          {
            label: "팀별 역할",
            items: [
              "Manchester City: 2010년대 초반 팀 격상기의 핵심 중앙 미드필더",
              "Cote d'Ivoire: 황금세대 중원 중심, 2015 AFCON 우승 멤버",
              "Barcelona: 트레블 팀의 전술적 보조 축, 결승 센터백 대체",
            ],
          },
        ],
        bullets: ["City가 우승 가능한 팀으로 바뀌는 시기에 중원의 물리적/기술적 기준을 세웠습니다.", "대표팀에서는 우승 전까지 이어진 황금세대의 부담을 함께 짊어졌습니다."],
      },
      legacy: {
        explanation: "중앙 미드필더 포지션에서의 African Player of the Year 4회, City 역사 내 비중, EPL 고점 시즌이 장기 근거입니다.",
        verdict: "아프리카 중앙 미드필더 역대 1위 후보입니다.",
        facts: [
          {
            label: "장기 보존 근거",
            items: ["African Footballer of the Year 4회", "Manchester City 2010년대 왕조 초석", "Barcelona 2009 트레블 멤버", "Cote d'Ivoire 2015 AFCON 우승 멤버"],
          },
        ],
        bullets: ["아프리카 미드필더 평가에서는 Essien, Okocha, Abedi Pele와 비교되는 중심축입니다.", "팀 우승과 개인 고점을 모두 가진 미드필더라는 점이 오래 남습니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Yaya Toure", url: "https://en.wikipedia.org/wiki/Yaya_Tour%C3%A9" },
      { label: "Manchester City - Yaya wins CAF award", url: "https://www.mancity.com/news/first-team/first-team-news/2014/january/yaya-toure-wins-third-successive-african-footballer-of-the-year-award" },
      { label: "UEFA - Toure named best in Africa", url: "https://www.uefa.com/uefachampionsleague/news/0211-0e885e8ccd8b-55326a1fefe0-1000--toure-named-best-in-africa-for-third-time-in-a-row/" },
    ],
  },
  "sadio mane": {
    summary:
      "Sadio Mane는 Liverpool의 전방 압박과 득점 구조를 완성한 윙어이자 Senegal 첫 AFCON 우승의 상징입니다. 클럽과 대표팀 양쪽에서 모두 결과를 만든 현대 레전드입니다.",
    sections: {
      teamCareer: {
        explanation: "Mane의 팀 커리어는 Salzburg, Liverpool, Bayern, Al-Nassr, Senegal에서 확인됩니다.",
        verdict: "팀 커리어는 Liverpool와 Senegal 성과 때문에 매우 강합니다.",
        facts: [
          {
            label: "소속팀",
            items: ["Generation Foot youth", "Metz B", "Metz", "Red Bull Salzburg", "Southampton", "Liverpool", "Bayern Munich", "Al-Nassr", "Senegal Olympic", "Senegal national team"],
          },
          {
            label: "팀 우승",
            items: [
              "Red Bull Salzburg: Austrian Bundesliga 2013-14, Austrian Cup 2013-14",
              "Liverpool: Premier League 2019-20",
              "Liverpool: FA Cup 2021-22",
              "Liverpool: EFL Cup 2021-22",
              "Liverpool: UEFA Champions League 2018-19",
              "Liverpool: UEFA Super Cup 2019",
              "Liverpool: FIFA Club World Cup 2019",
              "Bayern Munich: Bundesliga 2022-23",
              "Bayern Munich: DFL-Supercup 2022",
              "Al-Nassr: Arab Club Champions Cup 2023",
              "Al-Nassr: Saudi Pro League 2025-26",
              "Senegal: Africa Cup of Nations 2021; runner-up 2019",
              "Senegal: 2025 Africa Cup of Nations final was initially won on the pitch, then overturned by CAF to Morocco after the final walk-off dispute",
            ],
          },
        ],
        caveat: "2025 AFCON은 2026년 1월 결승 직후 Senegal 우승/Mané MVP로 발표됐지만, 이후 CAF가 결승 결과를 Morocco 3-0 몰수승으로 뒤집은 이슈가 있어 팀 우승 목록에는 단정형으로 넣지 않았습니다.",
        bullets: ["Liverpool에서는 2019 UCL, 2020 PL 우승의 핵심 전방 자원이었습니다.", "Senegal의 2021 AFCON 첫 우승은 국가사적 팀 커리어입니다."],
      },
      individualCareer: {
        explanation: "개인상은 African Footballer of the Year 2회, Premier League Golden Boot, AFCON MVP가 중심입니다.",
        verdict: "대표팀 토너먼트 개인상까지 있어 단순 클럽 스타 이상입니다.",
        facts: [
          {
            label: "개인 수상/선정",
            items: [
              "African Footballer of the Year: 2019, 2022",
              "Premier League Golden Boot: 2018-19 shared",
              "Africa Cup of Nations Player of the Tournament: 2021",
              "Africa Cup of Nations Player of the Tournament: 2025 initially awarded by CAF, later affected by the final result dispute",
              "Africa Cup of Nations Team of the Tournament: 2019, 2021, 2025",
              "PFA Team of the Year: 2016-17, 2018-19, 2019-20, 2021-22 Premier League",
              "UEFA Champions League Squad of the Season: 2018-19",
              "UEFA Team of the Year: 2019",
              "Onze d'Or: 2018-19",
              "ESM Team of the Year: 2018-19",
              "PFA Fans' Player of the Year: 2019-20 Premier League",
              "CAF Team of the Year: 2015, 2016, 2018, 2019, 2023",
              "IFFHS CAF Men's Team of the Decade: 2011-2020",
              "Socrates Award: 2022",
            ],
          },
        ],
        bullets: ["2019 Ballon d'Or 4위, 2022 Ballon d'Or 2위권 평가가 프라임 인지도를 보강합니다.", "AFCON 우승 대회 MVP는 대표팀 비중과 개인 수상을 동시에 설명합니다."],
      },
      primeSkill: {
        explanation: "프라임은 2018-22 Liverpool/Senegal 시기입니다. 압박, 침투, 결정력, 전환 속도가 함께 최고 수준이었습니다.",
        verdict: "공 없는 움직임과 압박까지 포함하면 현대 윙어 고점이 매우 높습니다.",
        facts: [
          {
            label: "프라임 근거",
            items: [
              "2018-19 Premier League Golden Boot shared",
              "2018-19 UEFA Champions League 우승 및 Squad of the Season",
              "2019 UEFA Team of the Year",
              "2021 AFCON Player of the Tournament, 우승 결승 승부차기 성공",
              "2025 AFCON semi-final Egypt전 결승골 및 CAF 최초 Player of the Tournament 발표",
              "2022 African Footballer of the Year, Ballon d'Or 2위",
            ],
          },
          {
            label: "스킬 프로필",
            items: ["전방 압박", "왼쪽에서 중앙 침투", "스피드와 몸싸움", "양발 마무리", "토너먼트 멘털리티"],
          },
        ],
        bullets: ["Mane의 가치는 득점뿐 아니라 Klopp 시스템의 압박 강도를 유지한 데 있습니다.", "대표팀에서는 공격 생산과 심리적 리더십이 동시에 나타났습니다."],
      },
      teamImportance: {
        explanation: "Liverpool에서는 3톱의 동등한 축, Senegal에서는 절대 에이스에 가까웠습니다.",
        verdict: "대표팀 비중은 Salah와 함께 현대 아프리카 최상단입니다.",
        facts: [
          {
            label: "팀별 역할",
            items: [
              "Liverpool: Mane-Firmino-Salah 3톱의 왼쪽 압박/득점 축",
              "Senegal: 2021 AFCON 우승의 결정적 선수, 결승 승부차기 마무리",
              "Bayern/Al-Nassr: 주전 공격 자원이나 역사적 비중은 Liverpool/Senegal보다 낮음",
            ],
          },
        ],
        bullets: ["Senegal 첫 AFCON 우승은 Mane의 팀 내 비중을 가장 강하게 증명합니다.", "Liverpool에서는 Salah만큼 눈에 띄지 않는 순간에도 전술 완성도가 매우 컸습니다."],
      },
      legacy: {
        explanation: "Senegal 첫 AFCON 우승, Ballon d'Or 2위, Liverpool 왕조 핵심이라는 세 축이 장기 기억을 만듭니다.",
        verdict: "Senegal 역대 1위 논쟁의 강력한 기준점입니다.",
        facts: [
          {
            label: "장기 보존 근거",
            items: ["Senegal 첫 AFCON 우승 주역", "African Footballer of the Year 2회", "Premier League/Champions League 우승 핵심", "Ballon d'Or 2022 2위"],
          },
        ],
        bullets: ["국가대표 우승 서사가 있어 100년 뒤에도 Senegal 역사에서 지워지기 어렵습니다.", "Liverpool 전성기와 함께 기억되는 글로벌 클럽 서사도 강합니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Sadio Mane", url: "https://en.wikipedia.org/wiki/Sadio_Man%C3%A9" },
      { label: "Liverpool FC - Sadio Mane", url: "https://www.liverpoolfc.com/info/sadio-mane" },
      { label: "BBC - Mane African Footballer of the Year", url: "https://www.bbc.co.uk/sport/africa/62257143" },
      { label: "CAF - Mane AFCON 2025 best player", url: "https://www.cafonline.com/afcon2025/news/sadio-mane-best-player-of-afcon-2025-the-coronation-of-leadership/" },
      { label: "BBC - AFCON 2025 result overturned", url: "https://www.bbc.co.uk/sport/football/articles/ce949glzzglo" },
    ],
  },
  "abedi pele": {
    summary:
      "Abedi Pele는 Marseille의 1993 Champions League 우승과 Ghana의 1982 AFCON 우승, 1990년대 초 아프리카 개인상 지배를 함께 가진 플레이메이커입니다. Weah 이전 글로벌 아프리카 스타 계보의 핵심입니다.",
    sections: {
      teamCareer: {
        explanation: "Abedi Pele의 소속팀은 여러 리그에 걸쳐 있으며, 팀 우승은 Marseille, Al Ain, Ghana 성과가 핵심입니다.",
        verdict: "팀 커리어는 1993 Marseille UCL 우승 하나만으로도 매우 강합니다.",
        facts: [
          {
            label: "소속팀",
            items: [
              "Real Tamale United",
              "Al Sadd",
              "Dragons de l'Oueme",
              "Real Tamale United second spell",
              "Niort",
              "Mulhouse",
              "Marseille",
              "Lille loan",
              "Marseille second spell",
              "Lyon",
              "Torino",
              "1860 Munich",
              "Al Ain",
              "Ghana national team",
            ],
          },
          {
            label: "팀 우승",
            items: [
              "Marseille: French Division 1 1990-91, 1991-92",
              "Marseille: UEFA Champions League 1992-93",
              "Al Ain: UAE Pro-League 1999-2000",
              "Al Ain: UAE President's Cup 1999",
              "Ghana: African Cup of Nations 1982; runner-up 1992",
              "Ghana: West African Nations Cup 1982, 1983, 1984",
            ],
          },
        ],
        bullets: ["1993 Marseille UCL 우승은 아프리카 플레이메이커가 유럽 정상팀 중심에 설 수 있음을 보여준 사건입니다.", "Ghana에서는 1982 AFCON 우승 멤버이자 1992 결승 진출 세대의 핵심이었습니다."],
      },
      individualCareer: {
        explanation: "Abedi Pele의 개인상은 1991-93 African Footballer of the Year 3연속 수상이 핵심입니다.",
        verdict: "1990년대 초 아프리카 개인상 지배력은 Weah 이전 최고급입니다.",
        facts: [
          {
            label: "개인 수상/선정",
            items: [
              "BBC African Footballer of the Year: 1991",
              "African Footballer of the Year: 1991, 1992, 1993",
              "Africa Cup of Nations Golden Ball: 1992",
              "Africa Cup of Nations Team of the Tournament: 1992, 1994, 1996",
              "Ghana Footballer of the Year: 1993",
              "MasterCard African Team of the 20th Century: 1998",
              "IFFHS African Player of the Century: 3rd",
              "IFFHS All-time Africa Men's Dream Team: 2021",
            ],
          },
        ],
        bullets: ["1991-93 개인상 3연속은 동시대 아프리카 지배력을 명확히 보여줍니다.", "1992 AFCON Golden Ball은 대표팀 대회에서의 개인 고점을 보강합니다."],
      },
      primeSkill: {
        explanation: "프라임은 1991-93 Marseille/Ghana 시기입니다. 짧은 터치, 전진 패스, 드리블, 득점 가담을 갖춘 10번형 고점입니다.",
        verdict: "창조형 미드필더로는 아프리카 역대 최고 후보입니다.",
        facts: [
          {
            label: "프라임 근거",
            items: [
              "African Footballer of the Year 1991, 1992, 1993",
              "1992 AFCON Golden Ball",
              "Marseille French Division 1 1990-91, 1991-92",
              "Marseille UEFA Champions League 1992-93",
            ],
          },
          {
            label: "스킬 프로필",
            items: ["공격형 미드필더/포워드 겸용", "좁은 공간 드리블", "마지막 패스", "중앙과 하프스페이스에서 템포 조절", "대표팀 공격 창조성"],
          },
        ],
        bullets: ["Marseille에서의 유럽 정상 경험과 AFCON 개인상은 프라임 근거가 분명합니다.", "순수 기술과 창조성 기준으로는 Okocha와 함께 최고급 비교 대상입니다."],
      },
      teamImportance: {
        explanation: "Marseille와 Ghana 양쪽에서 공격 연결의 중심 역할을 했습니다.",
        verdict: "팀 내 비중은 우승팀의 일부가 아니라 공격 구조를 움직인 축으로 봐야 합니다.",
        facts: [
          {
            label: "팀별 역할",
            items: ["Marseille: 유럽 정상권 팀의 창조형 공격 자원", "Ghana: 1980-90년대 대표팀 핵심 플레이메이커", "Ghana: 1992 AFCON 결승 진출 과정의 중심, 결승은 경고 누적으로 결장"],
          },
        ],
        bullets: ["1992 AFCON 결승 결장은 오히려 Ghana가 그에게 얼마나 의존했는지를 보여주는 맥락입니다.", "Marseille에서는 개인 드리블보다 팀 공격 흐름을 만드는 역할이 컸습니다."],
      },
      legacy: {
        explanation: "Abedi Pele의 장기 존재감은 '아프리카 10번의 원형', 3연속 개인상, Marseille UCL 우승으로 남습니다.",
        verdict: "아프리카 플레이메이커 계보에서는 반드시 보존될 이름입니다.",
        facts: [
          {
            label: "장기 보존 근거",
            items: ["African Footballer of the Year 3연속", "Marseille 1993 Champions League 우승 멤버", "Ghana 역대 최고 선수 후보", "IFFHS African Player of the Century 3위"],
          },
        ],
        bullets: ["George Weah, Eto'o 이전 세대의 대표 글로벌 아프리카 스타입니다.", "Ayew 가문과 Ghana 축구사 전체에서도 상징성이 큽니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Abedi Pele", url: "https://en.wikipedia.org/wiki/Abedi_Pele" },
      { label: "Britannica - Abedi Pele", url: "https://www.britannica.com/biography/Abedi-Ayew-Pele" },
      { label: "L'Equipe - Abedi Pele", url: "https://www.lequipe.fr/Football/FootballFicheJoueur14331.html" },
      { label: "RSSSF African Player of the Year", url: "https://www.rsssf.org/miscellaneous/afr-poy.html" },
    ],
  },
  "roger milla": {
    summary:
      "Roger Milla는 Cameroon의 AFCON 우승과 1990 월드컵 8강 서사를 만든 공격수입니다. 클럽 커리어도 길지만, 장기 존재감은 월드컵과 아프리카 대표팀 역사에서 나옵니다.",
    sections: {
      teamCareer: {
        explanation: "Milla는 Cameroon과 France, Reunion 클럽을 두루 거쳤고, 팀 우승은 Cameroon 국내/프랑스 컵/대표팀 AFCON 성과가 중심입니다.",
        verdict: "팀 커리어는 유럽 빅클럽형은 아니지만, 대표팀 성과와 국내/프랑스 컵 우승 누적이 탄탄합니다.",
        facts: [
          {
            label: "소속팀",
            items: [
              "Eclair de Douala",
              "Leopards Douala",
              "Tonnerre Yaounde",
              "Valenciennes",
              "Monaco",
              "Bastia",
              "Saint-Etienne",
              "Montpellier",
              "Saint-Pierroise",
              "Tonnerre Yaounde second spell",
              "Pelita Jaya",
              "Putra Samarinda",
              "Cameroon national team",
            ],
          },
          {
            label: "팀 우승",
            items: [
              "Leopards Douala: Cameroon Premiere Division 1971-72, 1972-73, 1973-74",
              "Tonnerre Yaounde: African Cup Winners' Cup 1975",
              "Tonnerre Yaounde: Cameroonian Cup 1991",
              "Monaco: Coupe de France 1979-80",
              "Bastia: Coupe de France 1980-81",
              "Montpellier: Division 2 1986-87",
              "Saint-Pierroise: D1 Pro 1989, 1990",
              "Saint-Pierroise: Coupe de la Reunion 1989",
              "Cameroon: Africa Cup of Nations 1984, 1988; runner-up 1986",
              "Cameroon: Afro-Asian Cup of Nations 1985",
            ],
          },
        ],
        bullets: ["1984/1988 AFCON 우승은 대표팀 팀 커리어의 핵심입니다.", "1990 월드컵 8강은 우승은 아니지만 Cameroon과 아프리카 축구사 전체의 역사적 팀 성과입니다."],
      },
      individualCareer: {
        explanation: "Milla의 개인상은 African Footballer of the Year 2회와 1986/1988 AFCON 개인상, 1990 월드컵 수상입니다.",
        verdict: "개인상 총량보다 월드컵 문화사에 남은 임팩트가 강합니다.",
        facts: [
          {
            label: "개인 수상/선정",
            items: [
              "African Footballer of the Year: 1976, 1990",
              "Africa Cup of Nations best player: 1986, 1988",
              "Africa Cup of Nations top scorer: 1986, 1988",
              "FIFA World Cup Bronze Boot: 1990",
              "FIFA World Cup All-Star Team: 1990",
              "FIFA 100",
              "CAF Best African Player of the last 50 years: 2007",
              "Golden Foot Legends Award: 2014",
              "IFFHS Legends",
              "World Soccer: The 100 Greatest Footballers of All Time",
              "CAF Golden Jubilee #1 Best Player",
              "Knight of the Legion of Honour: 2006",
            ],
          },
        ],
        bullets: ["1990년 38세 월드컵 4골과 Bronze Boot는 개인 커리어의 상징입니다.", "CAF가 뽑은 지난 50년 최고 아프리카 선수라는 평가는 레거시 근거가 강합니다."],
      },
      primeSkill: {
        explanation: "프라임은 두 갈래로 봅니다. 1970년대 중후반 Cameroon/프랑스 진출 초기의 실제 고점과, 1986-90 대표팀 토너먼트 고점입니다.",
        verdict: "순수 빅리그 장기 지배형은 아니지만, 토너먼트 결정력과 기술적 센스가 역사적입니다.",
        facts: [
          {
            label: "프라임 근거",
            items: [
              "African Footballer of the Year 1976",
              "AFCON best player/top scorer 1986, 1988",
              "1990 World Cup Bronze Boot and All-Star Team",
              "Cameroon 1990 World Cup quarter-final 진출 과정에서 Romania/Colombia전 결정적 득점",
            ],
          },
          {
            label: "스킬 프로필",
            items: ["박스 주변 민첩성", "턴 동작과 짧은 터치", "노장 시기에도 살아 있던 마무리 타이밍", "교체 투입 후 경기 흐름을 바꾸는 결정력"],
          },
        ],
        bullets: ["1990 월드컵은 프라임 나이는 아니지만, 국제 토너먼트 고점으로는 매우 강합니다.", "Milla의 기술은 스피드보다 박스 주변 센스와 타이밍에 가까웠습니다."],
      },
      teamImportance: {
        explanation: "Cameroon 대표팀에서의 Milla는 단순 공격수 이상으로, 팀을 월드컵 서사의 주인공으로 만든 상징입니다.",
        verdict: "대표팀 팀 내 비중은 아프리카 역사 전체에서도 최상위권입니다.",
        facts: [
          {
            label: "팀별 역할",
            items: [
              "Cameroon: 1984/1988 AFCON 우승 세대의 핵심 공격수",
              "Cameroon: 1990 World Cup에서 결정적 조커/득점원",
              "Leopards/Tonnerre: Cameroon 국내 우승과 대륙 컵 성과의 핵심 공격수",
            ],
          },
        ],
        bullets: ["1990 월드컵 Cameroon은 Milla의 골과 세리머니를 통해 전 세계가 기억하는 팀이 됐습니다.", "대표팀 상징성은 클럽 커리어 규모를 넘어섭니다."],
      },
      legacy: {
        explanation: "Milla의 장기 존재감은 1990 월드컵, 최고령 득점 서사, CAF 50년 최고 선수 선정, FIFA 100에서 나옵니다.",
        verdict: "월드컵 문화사 기준으로는 아프리카 선수 중 가장 오래 남을 이름 중 하나입니다.",
        facts: [
          {
            label: "장기 보존 근거",
            items: [
              "Cameroon 1990 World Cup quarter-final 상징",
              "1990 World Cup Bronze Boot and All-Star Team",
              "FIFA 100",
              "CAF Best African Player of the last 50 years",
              "월드컵 코너 플래그 댄스 세리머니의 상징성",
            ],
          },
        ],
        bullets: ["Weah의 Ballon d'Or, Eto'o의 클럽 트로피와 다른 축에서 Milla는 월드컵 서사의 대표입니다.", "100년 뒤에도 1990 Cameroon을 설명할 때 빠질 수 없습니다."],
      },
    },
    sources: [
      { label: "Wikipedia - Roger Milla", url: "https://en.wikipedia.org/wiki/Roger_Milla" },
      { label: "BBC - Milla is CAF's best from 50 years", url: "http://news.bbc.co.uk/sport2/hi/football/africa/6262747.stm" },
      { label: "FIFA archive - Roger Milla", url: "https://web.archive.org/web/20150924082424/http://www.fifa.com/classicfootball/players/player=174748/" },
    ],
  },
};

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
    const rating = makePlayerRating(parsedName.name, scores);

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
      overallScore: rating.overallScore,
      scoreMode: rating.scoreMode,
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

  const override = scoreOverrides[normalizedName(name)];
  if (!override) {
    return scores;
  }
  const scoreOverride = override.scores ?? override;

  return {
    teamCareer: scoreOverride.teamCareer ?? scores.teamCareer,
    individualCareer: scoreOverride.individualCareer ?? scores.individualCareer,
    primeSkill: scoreOverride.primeSkill ?? scores.primeSkill,
    teamImportance: scoreOverride.teamImportance ?? scores.teamImportance,
    legacy: scoreOverride.legacy ?? scores.legacy,
  };
}

function makePlayerRating(name: string, scores: PlayerScores): { overallScore: number; scoreMode: ScoreMode } {
  const override = scoreOverrides[normalizedName(name)];

  return {
    overallScore: override?.overallScore ?? calculateOverallScore(scores),
    scoreMode: override?.scoreMode ?? "computed",
  };
}

function calculateOverallScore(scores: PlayerScores) {
  return Math.round(
    scores.teamCareer * 0.22 +
      scores.individualCareer * 0.22 +
      scores.primeSkill * 0.26 +
      scores.teamImportance * 0.18 +
      scores.legacy * 0.12,
  );
}

function makeNonEuropeBaselineProfile(
  name: string,
  country: string,
  position: PositionCode,
  status: PlayerStatus,
  scores: PlayerScores,
): PlayerProfile {
  const continent = getContinent(country);
  const statusNote =
    status === "active-hold"
      ? "현역 커리어가 진행 중이라 최종 점수와 수상 목록은 추후 재검토합니다."
      : status === "delete-candidate"
        ? "원본 리스트에서 삭제 후보로 표시되어 유지 여부부터 재검토해야 합니다."
        : status === "active-legend"
          ? "현역이지만 이미 레전드로 확정된 선수입니다."
          : status === "watch"
            ? "원본 리스트에서 비교 검토가 필요한 선수입니다."
            : "레전드 풀에 포함된 확정 선수입니다.";
  const regionalContext =
    continent === "Africa"
      ? "아프리카 레전드 풀은 이미 개별 큐레이션을 우선 적용하고, 남은 선수는 국가별 위상과 클럽/대표팀 성과를 기준으로 보강합니다."
      : continent === "Asia"
        ? "아시아 레전드 풀은 유럽 빅리그 성과, 월드컵/아시안컵 영향력, 국가대표 상징성을 함께 봅니다."
        : "아메리카 레전드 풀은 월드컵/코파 아메리카, 남미 클럽컵, 유럽 빅클럽 커리어, 국가별 역사성을 함께 봅니다.";
  const sourceQuery = encodeURIComponent(`${name} footballer honours`);

  return {
    isCurated: false,
    summary: `${name}는 ${country}의 ${positionLabels[position]} 레전드 후보입니다. ${regionalContext} ${statusNote}`,
    sources: [
      { label: `Wikipedia search - ${name}`, url: `https://en.wikipedia.org/w/index.php?search=${sourceQuery}` },
      { label: "RSSSF international football records", url: "https://www.rsssf.org/" },
      { label: "FIFA player and tournament archive", url: "https://www.fifa.com/" },
    ],
    sections: {
      teamCareer: makeProfileSection({
        score: scores.teamCareer,
        title: "팀 커리어",
        explanation:
          "팀 커리어는 소속 클럽 전체, 클럽 우승, 대표팀 토너먼트 성과, 우승 과정에서의 역할을 분리해 채점합니다.",
        verdict: "이 선수는 유럽 제외 전체 풀에 포함됐으므로 국가/대륙 단위 비교 대상입니다.",
        facts: [
          {
            label: "현재 분류",
            items: [`국가: ${country}`, `대륙: ${continent}`, `기본 포지션: ${position}`, `리스트 상태: ${statusNote}`],
          },
          {
            label: "팀 커리어 입력 항목",
            items: [
              "소속했던 클럽 전체를 커리어 순서대로 입력",
              "리그, 국내컵, 리그컵, 슈퍼컵, 대륙 대항전 우승을 팀별로 분리",
              "대표팀 우승, 준우승, 월드컵/대륙컵 최고 성과를 분리",
              "각 성과에서 핵심/주전/로테이션/후보였는지 표시",
            ],
          },
        ],
        bullets: [
          "유럽 제외 선수는 국가대표 상징성이 팀 커리어 점수에 크게 작동할 수 있습니다.",
          "클럽 우승 총량과 대표팀 역사적 성과를 섞지 않고 따로 비교합니다.",
        ],
        caveat: "아직 개별 선수의 모든 소속팀과 우승 목록을 완전 입력한 상태는 아닙니다. 이 기본 프로필은 상세 큐레이션 전의 구조화된 입력 틀입니다.",
      }),
      individualCareer: makeProfileSection({
        score: scores.individualCareer,
        title: "개인 수상",
        explanation:
          "개인 수상은 글로벌 개인상, 대륙 올해의 선수, 리그 MVP, 득점왕/도움왕, 베스트 XI, 토너먼트 수상 기록을 분리합니다.",
        verdict: "후보/선정/수상은 서로 다른 무게로 처리합니다.",
        facts: [
          {
            label: "개인 수상 입력 항목",
            items: [
              "Ballon d'Or, FIFA/The Best, World Soccer 등 글로벌 개인상",
              "CAF/AFC/CONMEBOL 및 리그 올해의 선수",
              "득점왕, 도움왕, 골든볼, 골든부트",
              "Team of the Year, Team of the Tournament, Hall of Fame",
              "최종 후보와 순위는 실제 수상보다 낮은 가중치로 기록",
            ],
          },
        ],
        bullets: [
          "개인상 총량은 포지션과 시대를 보정해 봅니다.",
          "최신 시즌 항목은 공식 발표 또는 신뢰 언론 확인 전까지 단정하지 않습니다.",
        ],
        caveat: "개별 수상 목록은 후속 큐레이션에서 공식/신뢰 출처로 교차 확인해 채웁니다.",
      }),
      primeSkill: makeProfileSection({
        score: scores.primeSkill,
        title: "프라임 실력",
        explanation:
          "프라임 실력은 누적 커리어와 분리해 전성기 1-3시즌의 순수 경기력, 포지션 내 희소성, 같은 시대 최고권 비교를 봅니다.",
        verdict: "총점보다 프라임 점수가 높은 선수는 트로피보다 고점형 레전드로 해석합니다.",
        facts: [
          {
            label: "프라임 입력 항목",
            items: [
              "전성기 기간",
              "해당 기간 수상/기록/팀 성과",
              "포지션별 핵심 무기",
              "동시대 최고 선수와의 비교 위치",
              "월드컵, 대륙컵, UCL/Libertadores 등 큰 경기 고점",
            ],
          },
          {
            label: "포지션 기준",
            items: [
              "공격수: 득점, 침투, 연계, 압박, 큰 경기 결정력",
              "미드필더: 운반, 패스, 압박 저항, 수비 범위, 템포 조절",
              "수비수/골키퍼: 대인 수비, 위치 선정, 리더십, 선방, 빌드업",
            ],
          },
        ],
        bullets: [
          "프라임 실력은 앱의 가장 높은 가중치 축입니다.",
          "팀 커리어가 낮아도 전성기 실력이 역사적이면 이 항목에서 보정됩니다.",
        ],
      }),
      teamImportance: makeProfileSection({
        score: scores.teamImportance,
        title: "팀 내 비중",
        explanation:
          "팀 내 비중은 클럽과 대표팀에서 선수가 얼마나 대체 불가능했는지, 팀 성과가 그 선수 중심으로 설명되는지를 봅니다.",
        verdict: "빅클럽 소속 여부와 팀의 실제 중심 역할은 분리해서 봅니다.",
        facts: [
          {
            label: "팀 내 비중 입력 항목",
            items: [
              "클럽 전술 역할과 우승팀 내 서열",
              "대표팀 주장/에이스 여부",
              "결승전, 토너먼트, 월드컵, 승부차기 등 결정적 장면",
              "선수가 빠졌을 때 팀 구조가 얼마나 흔들렸는지",
            ],
          },
        ],
        bullets: [
          "국가대표 전력 차이가 큰 대륙 선수들은 대표팀 비중이 특히 중요합니다.",
          "유명세보다 실제 팀 성과와 연결된 역할을 우선합니다.",
        ],
      }),
      legacy: makeProfileSection({
        score: scores.legacy,
        title: "100년 뒤 존재감",
        explanation:
          "장기 존재감은 기록, 상징 장면, 국가/대륙 최초성, 후대 비교 기준으로 남을 가능성을 평가합니다.",
        verdict: "장기 레거시는 인기보다 반복 소환 가능한 역사적 근거를 우선합니다.",
        facts: [
          {
            label: "레거시 입력 항목",
            items: [
              "국가 또는 대륙 역대 최고 논쟁 포함 여부",
              "월드컵, 코파, 아시안컵, AFCON 등 대회 상징 장면",
              "포지션별 기준점 또는 최초/유일 기록",
              "후대 선수와 비교될 때 기준으로 호출되는지",
            ],
          },
        ],
        bullets: [
          "축구사 전체에서 반복 설명될 이름인지와 국가 내부에서만 강한 이름인지를 구분합니다.",
          "세부 큐레이션 후 총점과 함께 가장 많이 보정될 수 있는 항목입니다.",
        ],
      }),
    },
  };
}

function makePlayerProfile(
  name: string,
  country: string,
  position: PositionCode,
  status: PlayerStatus,
  scores: PlayerScores,
): PlayerProfile {
  const curatedProfile =
    detailedAfricanProfileOverrides[normalizedName(name)] ??
    focusedNonEuropeProfileOverrides[normalizedName(name)] ??
    curatedProfileOverrides[normalizedName(name)];
  if (curatedProfile) {
    return {
      isCurated: true,
      summary: curatedProfile.summary,
      sections: makeCuratedProfileSections(curatedProfile, scores),
      sources: curatedProfile.sources,
    };
  }

  if (getContinent(country) !== "Europe") {
    return makeNonEuropeBaselineProfile(name, country, position, status, scores);
  }

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
    sources: [],
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

function makeCuratedProfileSections(entry: CuratedProfileEntry, scores: PlayerScores): Record<ScoreKey, PlayerProfileSection> {
  return (Object.keys(entry.sections) as ScoreKey[]).reduce(
    (sections, key) => ({
      ...sections,
      [key]: makeProfileSection({
        score: scores[key],
        title: scoreLabelsForData[key],
        bullets: entry.sections[key].bullets,
        caveat: entry.sections[key].caveat,
        explanation: entry.sections[key].explanation,
        facts: entry.sections[key].facts,
        verdict: entry.sections[key].verdict,
      }),
    }),
    {} as Record<ScoreKey, PlayerProfileSection>,
  );
}

const scoreLabelsForData: Record<ScoreKey, string> = {
  teamCareer: "팀 커리어",
  individualCareer: "개인 수상",
  primeSkill: "프라임 실력",
  teamImportance: "팀 내 비중",
  legacy: "100년 뒤 존재감",
};

function makeProfileSection({
  score,
  title,
  bullets,
  caveat,
  explanation,
  facts,
  verdict,
}: {
  score: number;
  title: string;
  bullets: string[];
  caveat?: string;
  explanation: string;
  facts?: Array<{ label: string; items: string[] }>;
  verdict?: string;
}): PlayerProfileSection {
  return {
    score,
    grade: score >= 97 ? "S+" : score >= 92 ? "S" : score >= 86 ? "A" : score >= 78 ? "B" : "C",
    title,
    verdict,
    facts,
    bullets,
    explanation,
    caveat,
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
