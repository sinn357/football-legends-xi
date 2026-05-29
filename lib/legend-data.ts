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
  "abedi pele": { teamCareer: 94, individualCareer: 93, primeSkill: 95, teamImportance: 95, legacy: 95 },
  "michael essien": { teamCareer: 92, individualCareer: 86, primeSkill: 92, teamImportance: 93, legacy: 90 },
  "samuel kuffour": { teamCareer: 91, individualCareer: 82, primeSkill: 88, teamImportance: 90, legacy: 87 },
  "jay jay okocha": { teamCareer: 82, individualCareer: 86, primeSkill: 95, teamImportance: 89, legacy: 91 },
  "nwankwo kanu": { teamCareer: 91, individualCareer: 89, primeSkill: 91, teamImportance: 88, legacy: 90 },
  "samuel eto o": { teamCareer: 98, individualCareer: 97, primeSkill: 98, teamImportance: 98, legacy: 98 },
  "roger milla": { teamCareer: 87, individualCareer: 90, primeSkill: 92, teamImportance: 98, legacy: 96 },
  "thomas n kono": { teamCareer: 86, individualCareer: 90, primeSkill: 92, teamImportance: 93, legacy: 91 },
  "didier drogba": { teamCareer: 96, individualCareer: 94, primeSkill: 96, teamImportance: 98, legacy: 96 },
  "yaya toure": { teamCareer: 96, individualCareer: 95, primeSkill: 97, teamImportance: 96, legacy: 96 },
  "kolo toure": { teamCareer: 93, individualCareer: 82, primeSkill: 87, teamImportance: 89, legacy: 87 },
  "george weah": { teamCareer: 91, individualCareer: 100, primeSkill: 98, teamImportance: 98, legacy: 100 },
  "lucas radebe": { teamCareer: 78, individualCareer: 76, primeSkill: 86, teamImportance: 95, legacy: 87 },
  "sadio mane": { teamCareer: 98, individualCareer: 96, primeSkill: 96, teamImportance: 97, legacy: 96 },
  "kalidou koulibaly": { teamCareer: 88, individualCareer: 87, primeSkill: 92, teamImportance: 93, legacy: 91 },
  "achraf hakimi": { teamCareer: 95, individualCareer: 88, primeSkill: 93, teamImportance: 91, legacy: 91 },
  "hakim ziyach": { teamCareer: 90, individualCareer: 84, primeSkill: 90, teamImportance: 88, legacy: 86 },
  "pierre emerick aubameyang": { teamCareer: 86, individualCareer: 91, primeSkill: 94, teamImportance: 93, legacy: 91 },
  "mohamed salah": { teamCareer: 100, individualCareer: 100, primeSkill: 99, teamImportance: 100, legacy: 99 },
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
  sections: Record<ScoreKey, { bullets: string[]; explanation: string }>;
  sources: PlayerProfileSource[];
};

const commonAfricaSources: PlayerProfileSource[] = [
  { label: "RSSSF African Player of the Year", url: "https://www.rsssf.org/miscellaneous/afr-poy.html" },
];

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
  const curatedProfile = curatedProfileOverrides[normalizedName(name)];
  if (curatedProfile) {
    return {
      isCurated: true,
      summary: curatedProfile.summary,
      sections: makeCuratedProfileSections(curatedProfile, scores),
      sources: curatedProfile.sources,
    };
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
        explanation: entry.sections[key].explanation,
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
