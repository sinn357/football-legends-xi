# Score and Profile System

이 문서는 `football-legends-xi`의 선수 평가 기준과 선수 정보 입력 구조를 고정한다. 다음 선수 데이터를 넣기 전에 먼저 이 기준을 따른다.

## 목적

앱의 점수는 "좋은 선수인가"가 아니라 "축구사 전체에서 어느 위치인가"를 표현한다. 따라서 모든 레전드가 95점 이상으로 몰리면 안 된다.

점수 체계는 두 단계를 가진다.

1. 역사적 앵커 선수의 총점을 먼저 고정한다.
2. 일반 선수는 팀 커리어, 개인 수상, 프라임 실력, 팀 내 비중, 100년 뒤 존재감 정보를 취합한 뒤 총점을 산정한다.

## 총점 앵커

아래 선수들은 전체 축구사 기준점이다. 이 점수는 계산 결과가 아니라 평가 체계의 천장이다.

| 선수 | 총점 | 역할 |
|---|---:|---|
| Lionel Messi | 99 | 현대 축구 최고 누적, 최고 개인상, 월드컵 우승, 클럽 왕조를 모두 가진 1번 기준 |
| Pele | 98 | 월드컵 3회 우승과 축구사 원형 스타 기준 |
| Diego Maradona | 98 | 팀 커리어 총량보다 프라임 실력, 팀 내 비중, 월드컵 서사로 최고점에 도달하는 기준 |
| Johan Cruyff | 97 | 선수 실력과 전술/문화 레거시가 결합된 기준 |
| Cristiano Ronaldo | 97 | 클럽 커리어, 득점 기록, 개인상 누적의 최고 기준 |
| Franz Beckenbauer | 96 | 수비수/리베로 포지션에서 팀 커리어와 개인상이 모두 최고인 기준 |
| Ferenc Puskas | 96 | 시대 지배력, 득점력, 장기 레거시 기준 |
| Zinedine Zidane | 96 | 프라임 토너먼트 영향력과 상징성 기준 |
| Ronaldo | 96 | 부상에도 불구하고 순수 프라임 실력과 월드컵 임팩트로 최고권에 남는 기준 |

이 앵커를 기준으로 아프리카 최상위 선수도 보통 94-95가 상한이다. Weah, Eto'o, Salah는 94-95권 후보이고, Drogba/Yaya/Mane는 91-94권에서 비교한다.

## 점수 필드

선수는 총점과 세부 점수를 모두 가진다.

```ts
type ScoreMode = "anchor" | "computed" | "adjusted";

type PlayerRating = {
  overallScore: number;
  scoreMode: ScoreMode;
  scores: {
    teamCareer: number;
    individualCareer: number;
    primeSkill: number;
    teamImportance: number;
    legacy: number;
  };
};
```

### ScoreMode

| mode | 의미 | 적용 대상 |
|---|---|---|
| `anchor` | 총점을 먼저 고정하고 세부 점수는 그 총점을 설명한다. | Messi, Pele, Maradona 같은 축구사 기준점 |
| `computed` | 취합한 정보와 가중치로 총점을 계산한다. | 대부분의 국가별 레전드 |
| `adjusted` | 계산값은 있지만 역사적 합의/서사와 어긋나 보정한다. | Weah, Eto'o, Salah, Drogba처럼 단순 계산보다 맥락이 중요한 선수 |

## 가중치

총점 기본 계산식은 아래를 사용한다.

```txt
overall =
  teamCareer * 0.22 +
  individualCareer * 0.22 +
  primeSkill * 0.26 +
  teamImportance * 0.18 +
  legacy * 0.12
```

프라임 실력의 비중을 가장 높게 둔다. 축구사 평가는 누적 트로피뿐 아니라 "전성기 때 어느 정도였나"가 강하게 작동하기 때문이다.

## 세부 점수 해석

### 1. 팀 커리어

소속팀 전체와 공식 팀 성과를 평가한다.

필수 입력:

- 소속했던 클럽 전체
- 대표팀
- 클럽 우승: 리그, 국내컵, 리그컵, 슈퍼컵, 대륙 대항전, 클럽 월드컵
- 대표팀 우승/준우승: 월드컵, 대륙컵, 올림픽, 기타 공식 대회
- 각 우승에서 선수 역할: 핵심, 주전, 로테이션, 유망주/후보

점수 감각:

| 점수 | 기준 |
|---:|---|
| 97-100 | 복수 빅클럽/대표팀에서 핵심 우승, UCL/월드컵급 최고 대회 우승 중심 |
| 93-96 | 빅클럽 핵심 우승 다수 또는 대표팀 대륙/월드컵급 성과 확실 |
| 88-92 | 강한 클럽 커리어 또는 대표팀 성과가 있으나 최고권 누적은 부족 |
| 80-87 | 리그/컵 성과는 있으나 세계사 기준 팀 커리어는 제한적 |
| 70-79 | 국가 내 레전드이나 국제 팀 커리어 근거가 약함 |

### 2. 개인 수상

개인상과 공식 선정 기록을 평가한다.

필수 입력:

- Ballon d'Or, FIFA 올해의 선수, The Best, World Soccer 등 글로벌 개인상
- 대륙 올해의 선수: CAF, UEFA 등
- 리그 올해의 선수, 선수협/기자단 올해의 선수
- 득점왕, 도움왕, 토너먼트 골든볼/골든부트
- Team of the Year, Team of the Tournament, Hall of Fame
- 후보/순위: Ballon d'Or 순위, FIFA 올해의 선수 순위

점수 감각:

| 점수 | 기준 |
|---:|---|
| 97-100 | Ballon d'Or/FIFA급 최고 개인상 복수 또는 압도적 글로벌 지배 |
| 93-96 | 대륙 올해의 선수 복수, 글로벌 개인상 최상위 순위, 리그 MVP급 성과 |
| 88-92 | 대륙/리그 개인상과 베스트 XI 누적이 강함 |
| 80-87 | 국가/리그 단위 개인상은 강하지만 글로벌 근거 부족 |
| 70-79 | 수상 총량이 제한적이고 서사 중심 평가 |

### 3. 프라임 실력

전성기 1-3시즌의 실제 실력과 경기 지배력을 평가한다.

필수 입력:

- 프라임 기간
- 해당 기간 팀/대표팀 성과
- 득점/도움/클린시트/수상 등 포지션별 근거
- 같은 시대 최고 선수들과의 비교 위치
- 포지션별 희소성
- 기술 프로필: 득점, 창조성, 압박, 수비, 전술 이해, 신체 능력

점수 감각:

| 점수 | 기준 |
|---:|---|
| 99-100 | 축구사 전체 최고 프라임 논쟁권 |
| 96-98 | 시대 최고 선수 논쟁권, 포지션 역대 최고권 |
| 92-95 | 월드클래스 고점, 빅리그/국제대회에서 반복 검증 |
| 86-91 | 매우 강한 고점이나 최고권 직접 비교는 제한 |
| 78-85 | 국가/리그 기준 고점은 확실하나 세계사 기준 제한 |

### 4. 팀 내 비중

팀 성과에서 그 선수가 얼마나 대체 불가능했는지 평가한다.

필수 입력:

- 클럽에서의 전술적 역할
- 대표팀에서의 역할
- 주장/리더십 여부
- 우승 또는 역사적 성과에서 결정적 장면
- 그 선수가 빠졌을 때 팀 구조가 얼마나 흔들리는지

점수 감각:

| 점수 | 기준 |
|---:|---|
| 97-100 | 팀 자체가 선수 중심으로 정의될 정도의 절대 비중 |
| 93-96 | 우승팀/대표팀의 명확한 핵심 |
| 88-92 | 강한 주전/핵심이나 절대 의존도는 아님 |
| 80-87 | 중요한 선수지만 팀 서사의 중심은 아님 |
| 70-79 | 개인 명성 대비 팀 내 비중 근거가 약함 |

### 5. 100년 뒤 존재감

기록과 서사가 장기적으로 보존될 가능성을 평가한다.

필수 입력:

- 축구사에서 반복 소환될 고유 사건
- 포지션/국가/대륙 최초 또는 기준점
- 월드컵/UCL/대륙컵 같은 큰 대회 서사
- 팬덤/문화적 이미지
- 후대 선수와 비교될 기준점 여부

점수 감각:

| 점수 | 기준 |
|---:|---|
| 98-100 | 축구사를 설명할 때 반드시 등장 |
| 94-97 | 대륙/포지션/시대 설명에서 거의 항상 등장 |
| 89-93 | 국가/클럽 역사에서는 확실히 보존, 세계사에서는 비교 맥락 |
| 82-88 | 특정 팬덤/국가에서 강하게 남음 |
| 75-81 | 장기 기억은 있으나 세계사 반복 소환 가능성 제한 |

## 총점 밴드

| 총점 | 의미 |
|---:|---|
| 98-99 | 축구사 최고 논쟁의 중심 |
| 96-97 | 역대 Top 10-15 논쟁권 |
| 94-95 | 대륙 역대 최고급, 전체 축구사 Top 20-40 후보 |
| 91-93 | 대륙/포지션 역대 최고권, 전체 축구사 Top 50-100 후보 |
| 88-90 | 국가 역대 최고권, 대륙 레전드권 |
| 84-87 | 국가 레전드, 빅리그/국제대회 근거 보유 |
| 80-83 | 국가 중요 선수, 세계사 기준 보조 레전드 |
| 70-79 | 리스트에는 남기되 상세 비교에서는 하위권 |

## 선수 정보 구조

선수 상세 프로필은 아래 구조로 취합한다.

```ts
type PlayerEvidenceProfile = {
  summary: string;
  teamCareer: {
    clubs: string[];
    nationalTeams: string[];
    clubHonours: string[];
    nationalTeamHonours: string[];
    roleNotes: string[];
    caveat?: string;
  };
  individualCareer: {
    awards: string[];
    scoringAndSelectionRecords: string[];
    rankings: string[];
    caveat?: string;
  };
  primeSkill: {
    primePeriod: string;
    evidence: string[];
    skillProfile: string[];
    eraComparison: string[];
    caveat?: string;
  };
  teamImportance: {
    clubRole: string[];
    nationalTeamRole: string[];
    decisiveMoments: string[];
    caveat?: string;
  };
  legacy: {
    longTermReasons: string[];
    historicalLabels: string[];
    comparisonContext: string[];
    caveat?: string;
  };
  sources: Array<{ label: string; url: string }>;
};
```

## 선수 정보 작성 템플릿

앱의 선수 상세 drawer에는 각 평가 항목마다 아래 5개 요소를 넣는다.

| 필드 | 용도 |
|---|---|
| `explanation` | 해당 항목을 한 문단으로 요약 |
| `verdict` | 점수 판단을 한 문장으로 결론 |
| `facts` | 검증 가능한 사실 목록 |
| `bullets` | 해석 포인트 1-3개 |
| `caveat` | 논란, 최신 변경, 출처 불일치, 감점 맥락 |

### 팀 커리어 작성 규칙

반드시 아래 fact group을 둔다.

```txt
소속팀
- 클럽 전체를 커리어 순서대로 나열
- 임대, 2기, 유스/리저브가 평가에 필요하면 표시
- 대표팀도 별도 표기

클럽 우승
- 팀명: 대회명 시즌
- 같은 대회 복수 우승은 한 줄에 묶되 시즌은 모두 표기
- 선수 역할이 애매하면 roleNotes 또는 caveat에 표시

대표팀 성과
- 국가: 대회명 시즌/연도
- 우승, 준우승, 월드컵 본선, 역사적 최고 성적을 구분
```

금지:

- "많은 우승", "리그 우승 다수"처럼 뭉뚱그려 쓰지 않는다.
- 소속팀을 일부만 쓰지 않는다.
- 팀 우승과 개인 수상을 섞지 않는다.

### 개인 수상 작성 규칙

반드시 아래 fact group을 둔다.

```txt
주요 개인 수상
- 올해의 선수, MVP, Ballon d'Or, FIFA, 대륙 올해의 선수
- 리그/컵/토너먼트 공식 개인상

득점/선정/기록
- 득점왕, 도움왕, 베스트 XI, 토너먼트 팀, 명예의 전당
- 국가/클럽 역대 최다 기록

후보/순위
- Ballon d'Or 순위
- FIFA/The Best 순위
- 주요 시상식 최종 후보
```

금지:

- 후보, 베스트 XI, 팬 투표상을 같은 무게로 쓰지 않는다.
- 최신 시즌 수상은 공식 발표 또는 신뢰 언론 없이는 넣지 않는다.
- Wikipedia 목록만 보고 논란 있는 항목을 단정하지 않는다.

### 프라임 실력 작성 규칙

반드시 아래 fact group을 둔다.

```txt
프라임 기간
- 1개 시즌 또는 2-3개 시즌 구간
- 다른 성격의 고점이 있으면 복수 구간 허용

프라임 근거
- 해당 기간 수상, 기록, 팀 성과, 토너먼트 장면
- 같은 시대 최고 선수들과 비교 가능한 근거

스킬 프로필
- 포지션별 핵심 무기
- 단순 감상이 아니라 실제 경기에서 반복된 능력
```

예시:

- 공격수: 득점력, 박스 움직임, 연계, 압박, 큰 경기 결정력
- 미드필더: 전진 운반, 압박 저항, 패스, 수비 범위, 템포 조절
- 수비수: 1대1, 라인 컨트롤, 제공권, 빌드업, 리더십
- 골키퍼: 선방, 위치 선정, 크로스 처리, 발밑, 토너먼트 영향력

### 팀 내 비중 작성 규칙

반드시 클럽과 대표팀을 분리한다.

```txt
클럽 역할
- 전술적 역할
- 우승팀 내 서열
- 대체 불가능성

대표팀 역할
- 주장/에이스 여부
- 대표팀 최고 성과와의 연결
- 팀이 선수를 중심으로 구성됐는지

결정적 장면
- 결승전, 토너먼트, 월드컵, 승부차기, 핵심 골/도움
```

금지:

- 유명한 선수라는 이유만으로 팀 내 비중을 높게 주지 않는다.
- 빅클럽 소속과 핵심 역할을 동일하게 취급하지 않는다.

### 100년 뒤 존재감 작성 규칙

반드시 아래 기준 중 최소 2개 이상을 근거로 쓴다.

```txt
장기 보존 근거
- 축구사 최초/유일 기록
- 월드컵/UCL/대륙컵의 상징 장면
- 국가 또는 대륙 역대 최고 논쟁
- 포지션의 기준점
- 팬덤과 문화적 이미지

비교 맥락
- 누구와 비교되는가
- 어떤 축으로 기억되는가
- 무엇이 부족해서 더 높은 점수는 아닌가
```

레거시는 단순 인기 점수가 아니다. 기록, 상징 장면, 반복 소환 가능성을 함께 봐야 한다.

## 출처 우선순위

정확성이 필요한 항목은 최소 2종 출처를 교차 확인한다. 특히 최신 시즌 수상, 논란, 번복된 결과는 단정하지 않는다.

우선순위:

1. FIFA, UEFA, CAF, 각 리그/협회 공식 사이트
2. 클럽 공식 사이트
3. RSSSF, IFFHS, Ballon d'Or/France Football, Premier League 공식 기록
4. BBC, Guardian, ESPN, Sky Sports 등 주요 언론
5. Wikipedia는 전체 목록 확인용으로 사용하되, 논란/최신 항목은 공식/언론으로 보강

## 입력 절차

선수 정보를 넣을 때는 아래 순서를 따른다.

1. 선수 이름 정규화 확인
2. 소속팀 전체 목록 작성
3. 팀 우승을 클럽/대표팀으로 분리
4. 개인 수상과 선정 기록을 분리
5. 프라임 기간을 1-3개 구간으로 정의
6. 팀 내 비중을 클럽/대표팀으로 분리
7. 100년 뒤 존재감 근거를 작성
8. 세부 점수 산정
9. 계산 총점 산정
10. 앵커 기준과 비교해 `computed` 또는 `adjusted` 결정

## 아프리카 선수 작업 순서

이미 상세 프로필을 넣은 상위 8명은 먼저 총점 기준에 맞춰 리스케일한다.

| 선수 | 총점 | mode | 팀 커리어 | 개인 수상 | 프라임 실력 | 팀 내 비중 | 100년 뒤 존재감 | 판단 근거 |
|---|---:|---|---:|---:|---:|---:|---:|---|
| George Weah | 95 | adjusted | 89 | 97 | 96 | 95 | 98 | Ballon d'Or/FIFA 올해의 선수 유일성, Liberia 상징성은 최고급이나 팀 우승 총량은 최상위 앵커보다 낮음 |
| Samuel Eto'o | 95 | adjusted | 97 | 95 | 95 | 95 | 95 | Barcelona/Inter 연속 트레블, AFCON/Olympic Gold, African POTY 4회로 팀 커리어 최상위 |
| Mohamed Salah | 95 | adjusted | 95 | 96 | 96 | 96 | 95 | Premier League 기록과 Liverpool 역사 지위는 최고급이나 대표팀 우승 부재 때문에 96+는 보류 |
| Didier Drogba | 93 | adjusted | 94 | 91 | 94 | 96 | 94 | Chelsea 결승 서사와 Cote d'Ivoire 비중은 매우 높지만 개인상 총량은 Weah/Eto'o/Salah보다 낮음 |
| Yaya Toure | 93 | adjusted | 95 | 93 | 94 | 93 | 92 | Barcelona/City/Cote d'Ivoire 팀 커리어와 미드필더 고점은 강하나 장기 대중 레거시는 공격수들보다 약함 |
| Sadio Mane | 93 | adjusted | 94 | 93 | 93 | 94 | 93 | Liverpool 왕조와 Senegal 첫 AFCON 우승 핵심, 다만 프라임/개인상 천장은 95권보다 낮게 둠 |
| Abedi Pele | 92 | adjusted | 91 | 92 | 93 | 92 | 93 | Marseille UCL, African POTY 3연속, Ghana 플레이메이커 원형으로 92권 |
| Roger Milla | 92 | adjusted | 88 | 91 | 91 | 95 | 96 | 클럽 커리어는 낮지만 1990 World Cup/Cameroon/CAF 50년 서사 때문에 레거시와 팀 비중을 높게 둠 |

나머지 아프리카 선수도 국가별 큐레이션 프로필을 완료했다.

1. Ghana: Michael Essien, Samuel Kuffour
2. Nigeria: Jay-Jay Okocha, Nwankwo Kanu
3. Cameroon: Thomas N'Kono
4. Cote d'Ivoire: Kolo Toure
5. South Africa: Lucas Radebe
6. Senegal: Kalidou Koulibaly
7. Morocco: Achraf Hakimi, Hakim Ziyech
8. Gabon: Pierre-Emerick Aubameyang
9. Algeria: Riyad Mahrez, Rabah Madjer

## 구현 메모

현재 앱은 `scores`와 별도 `overallScore`, `scoreMode`를 함께 가진다.

- `overallScore`: 공식 축구사 총점
- `scoreMode`: `anchor`, `computed`, `adjusted`
- `scores`: 팀 커리어, 개인 수상, 프라임 실력, 팀 내 비중, 장기 존재감 세부 점수
- 가중치 조절 기능은 "사용자 시뮬레이션 점수"로 유지한다.
- 선수 상세 drawer에서는 공식 총점과 세부 점수를 함께 보여준다.

## 현재 커버리지 상태

- Africa 21명: 모두 개별 큐레이션 프로필 보유
- Africa 상위 8명: 상세 fact group, 소속팀, 팀 우승, 개인 수상, 프라임 근거, 팀 비중, 레거시 근거 보유
- Asia 62명: South Korea 39명, Japan 21명, Ali Daei, Tim Cahill 전체 큐레이션 프로필 적용
- America 130명: Argentina 37명, Brazil 55명, 기타 America 38명 전체 큐레이션 프로필 적용
- 유럽 제외 총 213명: profile override 누락 0명
- Europe 1 63명: Switzerland, Bulgaria, Croatia, Romania, Ukraine, Russia, Bosnia and Herzegovina, Poland, Serbia, Montenegro, Hungary, Austria, Czech Republic, Slovenia, Slovakia, Armenia 전체 큐레이션 프로필 적용
- Europe 2 47명: Northern Ireland, Scotland, Wales, Ireland, Iceland, Norway, Denmark, Sweden, Finland 전체 큐레이션 프로필 적용
- Germany 53명: 전체 큐레이션 프로필 적용
- Italy 60명: 전체 큐레이션 프로필 적용
- France 38명: 전체 큐레이션 프로필 적용
- Spain 48명: 전체 큐레이션 프로필 적용
- England 53명: 전체 큐레이션 프로필 적용
- Europe 누적 362명: profile override 누락 0명
- Europe 잔여 81명: 기존 generic profile 유지

Baseline profile은 이제 Germany/Italy/France/Spain/England를 제외한 Core Europe 선수에게만 남아 있다. 유럽 제외 선수와 Europe 1/2/Germany/Italy/France/Spain/England 선수는 모두 선수별 큐레이션 profile override를 우선 사용한다.

Focused profile 적용 완료:

1. Asia 핵심: Son Heung-min, Cha Bum-kun, Park Ji-sung, Hong Myung-bo, Hidetoshi Nakata, Keisuke Honda, Shunsuke Nakamura, Shinji Kagawa, Ali Daei, Tim Cahill
2. South Korea 확장: Hwang Sun-hong, Lee Dong-gook, Ahn Jung-hwan, Kim Joo-sung, Yoo Sang-chul, Ki Sung-yueng, Lee Young-pyo, Kim Min-jae, Lee Woon-jae, Kim Byung-ji
3. Japan 확장: Shinji Okazaki, Kazuyoshi Miura, Kunishige Kamamoto, Kaoru Mitoma, Takefusa Kubo, Shinji Ono, Yasuhito Endo, Makoto Hasebe, Wataru Endo, Yuto Nagatomo, Atsuto Uchida, Yuji Nakazawa, Masami Ihara, Maya Yoshida, Takehiro Tomiyasu, Yoshikatsu Kawaguchi, Eiji Kawashima
4. America 앵커: Lionel Messi, Diego Maradona, Pele, Ronaldo, Garrincha, Zico, Ronaldinho, Romario, Neymar, Alfredo Di Stefano
5. America 1차 확장: Gabriel Batistuta, Mario Kempes, Angel Di Maria, Juan Roman Riquelme, Daniel Passarella, Javier Zanetti, Ubaldo Fillol, Fernando Redondo, Jose Manuel Moreno, Adolfo Pedernera, Rivaldo, Jairzinho, Didi, Cafu, Roberto Carlos, Nilton Santos, Djalma Santos, Carlos Alberto, Kaka, Gilmar
6. America 2차 확장: Sergio Aguero, Hernan Crespo, Lautaro Martinez, Omar Sivori, Carlos Tevez, Javier Mascherano, Juan Sebastian Veron, Luis Monti, Oscar Ruggeri, Roberto Ayala, Leonidas da Silva, Vava, Tostao, Roberto Rivellino, Socrates, Gerson, Roberto Falcao, Zito, Lucio, Dani Alves
7. America 3차 확장: Gonzalo Higuain, Diego Milito, Angel Labruna, Ricardo Bochini, Osvaldo Ardiles, Esteban Cambiasso, Walter Samuel, Pablo Zabaleta, Silvio Marzolini, Emiliano Martinez, Bebeto, Mario Zagallo, Careca, Ademir de Menezes, Zinzinho, Toninho Cerezo, Carlos Dunga, Carlos Casemiro, Mauro Silva, Thiago Silva
8. America 4차 확장: Julian Alvarez, Pablo Aimar, Roberto Perfumo, Juan Pablo Sorin, Elber, Jose Altafini, Juninho Pernambucano, Ze Roberto, Gilberto Silva, Emerson, Fernandinho, Hilderaldo Bellini, Aldair, Domingos da Guia, Marquinhos, Maicon, Marcelo Vieira, Leovegildo Junior, Claudio Taffarel, Dida, Julio Cesar, Alisson Becker
9. America 5차 확장: Hector Scarone, Jose Nasazzi, Obdulio Varela, Juan Schiaffino, Luis Suarez, Diego Forlan, Edinson Cavani, Enzo Francescoli, Federico Valverde, Diego Godin, Hector Castro, Pedro Rocha, Pedro Petrone, Pedro Cea, Jose Leandro Andrade, Paolo Montero, Jose Santamaria, Elias Figueroa, Ivan Zamorano, Arturo Vidal, Alexis Sanchez, Marcelo Salas, Claudio Bravo, Hector Chumpitaz, Teofilo Cubillas, Claudio Pizarro, Carlos Valderrama, James Rodriguez, Ivan Cordoba, Radamel Falcao, Hugo Sanchez, Rafael Marquez, Guillermo Ochoa, Javier Hernandez, Jose Chilavert, Dwight Yorke, Landon Donovan, Keylor Navas
10. South Korea 잔여 확장: Park Chu-young, Choi Yong-soo, Hwang Hee-chan, Seol Ki-hyeon, Lee Chun-soo, Lee Chung-yong, Seo Jung-won, Lee Kang-in, Koo Ja-cheol, Lee Jae-sung, Shin Tae-yong, Hwang In-beom, Cho Kwang-rae, Kim Nam-il, Huh Jung-moo, Lee Eul-yong, Park Joo-ho, Ha Seok-ju, Song Chong-gug, Cha Du-ri, Kim Young-gwon, Kim Tae-young, Choi Jin-cheul, Jo Hyeon-woo, Kim Seung-gyu
11. 비유럽 이름 정규화: Hangul NFKD 분해 후 NFC 재조합을 추가해 Korean profile/score override lookup이 빈 문자열로 충돌하지 않도록 수정
12. Europe 1 확장: Stephane Chapuisat, Xherdan Shaqiri, Granit Xhaka, Manuel Akanji, Yann Sommer, Hristo Stoichkov, Dimitar Berbatov, Zvonimir Boban, Davor Suker, Luka Modric, Ivan Rakitic, Mario Mandzukic, Ivan Perisic, Mateo Kovacic, Marcelo Brozovic, Gheorghe Hagi, Christian Chivu, Igor Belanov, Oleg Blokhin, Andriy Shevchenko, Lev Yashin, Edin Dzeko, Miralem Pjanic, Hasan Salihamidzic, Robert Lewandowski, Zbigniew Boniek, Grzegorz Lato, Kazimierz Deyna, Wlodzimierz Lubanski, Wladyslaw Zmuda, Wojciech Szczesny, Dragan Dzajic, Nemanja Vidic, Sinisa Mihajlovic, Dejan Stankovic, Branislav Ivanovic, Predrag Mijatovic, Ferenc Puskas, Laszlo Kubala, Sandor Kocsis, Nandor Hidegkuti, Josef Bozsik, Florian Albert, Gyorgy Sarosi, Zoltan Czibor, Gyula Grosics, Ferenc Bene, Matthias Sindelar, Ernst Ocwirk, Hans Krankl, David Alaba, Pavel Nedved, Josef Masopust, Petr Cech, Oldrich Nejedly, Antonin Panenka, Antonin Puc, Tomas Rosicky, Jan Koller, Jan Oblak, Samir Handanovic, Marek Hamsik, Henrikh Mkhitaryan
13. 유럽 이름 정규화: Polish `ł`, Balkan `đ`, Scandinavian `ø`, German `ß` 같은 NFKD 비분해 문자를 ASCII로 치환해 score/profile lookup이 원본 표기와 맞도록 수정
14. Europe 2 확장: George Best, Danny Blanchflower, Pat Jennings, Denis Law, Ally McCoist, Kenny Dalglish, John Robertson, Jimmy Johnstone, Graeme Souness, Billy Bremner, Danny McGrain, Andrew Robertson, John Greig, Alan Hansen, Billy McNeill, John Charles, Gareth Bale, Ryan Giggs, Ian Rush, Mark Hughes, Roy Keane, Denis Irwin, Robbie Keane, Eidur Gudjohnsen, Erling Haaland, Martin Odegaard, Ole Gunnar Solskjaer, John Arne Riise, Preben Elkjaer, Allan Simonsen, Soren Lerby, Christian Eriksen, Brian Laudrup, Michael Laudrup, Andreas Christensen, Morten Olsen, Simon Kjaer, Peter Schmeichel, Zlatan Ibrahimovic, Gunnar Nordahl, Henrik Larsson, Gunnar Gren, Freddie Ljungberg, Kurt Hamrin, Nils Liedholm, Jari Litmanen, Sami Hyypia
15. Germany 확장: Gerd Muller, Miroslav Klose, Uwe Seeler, Jurgen Klinsmann, Rudi Voller, Jupp Heynckes, Mario Gomez, Thomas Muller, Karl-Heinz Rummenigge, Helmut Rahn, Pierre Littbarski, Jurgen Grabowski, Marco Reus, Fritz Walter, Gunter Netzer, Wolfgang Overath, Bernd Schuster, Mesut Ozil, Thomas Hassler, Andreas Moller, Lothar Matthaus, Toni Kroos, Michael Ballack, Bastian Schweinsteiger, Ilkay Gundogan, Stefan Effenberg, Uli Stielike, Rainer Bonhof, Sami Khedira, Franz Beckenbauer, Matthias Sammer, Jurgen Kohler, Karl-Heinz Forster, Hans-Georg Schwarzenbeck, Klaus Augenthaler, Jerome Boateng, Mats Hummels, Philipp Lahm, Berti Vogts, Manfred Kaltz, Stefan Reuter, Joshua Kimmich, Paul Breitner, Andreas Brehme, Karl-Heinz Schnellinger, Hans-Peter Briegel, Manuel Neuer, Sepp Maier, Harald Schumacher, Jens Lehmann, Oliver Kahn, Bodo Illgner, Marc-Andre ter Stegen
16. Italy 확장: Luigi Riva, Silvio Piola, Angelo Schiavio, Paolo Rossi, Christian Vieri, Gianluca Vialli, Alessandro Altobelli, Filippo Inzaghi, Luca Toni, Giuseppe Meazza, Roberto Baggio, Francesco Totti, Alessandro Del Piero, Roberto Bettega, Roberto Mancini, Gianfranco Zola, Giuseppe Signori, Antonio Di Natale, Bruno Conti, Giampiero Boniperti, Franco Causio, Roberto Donadoni, Mauro Camoranesi, Mario Corso, Raimundo Orsi, Gianni Rivera, Alessandro Mazzola, Valentino Mazzola, Giovanni Ferrari, Giacomo Bulgarelli, Gennaro Gattuso, Carlo Ancelotti, Marco Verratti, Claudio Marchisio, Antonio Conte, Nicolo Barella, Andrea Pirlo, Marco Tardelli, Demetrio Albertini, Daniele De Rossi, Franco Baresi, Fabio Cannavaro, Gaetano Scirea, Alessandro Nesta, Pietro Vierchowod, Giorgio Chiellini, Leonardo Bonucci, Ciro Ferrara, Alessandro Costacurta, Andrea Barzagli, Giuseppe Bergomi, Claudio Gentile, Gianluca Zambrotta, Paolo Maldini, Giacinto Facchetti, Antonio Cabrini, Gianluigi Buffon, Dino Zoff, Walter Zenga, Gianluigi Donnarumma
17. France 확장: Kylian Mbappe, Thierry Henry, Karim Benzema, Jean-Pierre Papin, Just Fontaine, David Trezeguet, Olivier Giroud, Antoine Griezmann, Eric Cantona, Youri Djorkaeff, Ousmane Dembele, Franck Ribery, Robert Pires, Zinedine Zidane, Michel Platini, Raymond Kopa, Alain Giresse, Patrick Vieira, N'Golo Kante, Jean Tigana, Blaise Matuidi, Paul Pogba, Didier Deschamps, Claude Makelele, Emmanuel Petit, Marcel Desailly, Laurent Blanc, Raphael Varane, Maxime Bossis, Marius Tresor, Lilian Thuram, Willy Sagnol, Bixente Lizarazu, Patrice Evra, Eric Abidal, Theo Hernandez, Hugo Lloris, Fabien Barthez
18. Spain 확장: David Villa, Telmo Zarra, Fernando Torres, Fernando Morientes, Carlos Santillana, Raul Gonzalez, Emilio Butragueno, Amancio Amaro, Michel, Juanito, Luis Enrique, Joaquin, Pedro Rodriguez, Francisco Gento, Luis Suarez Miramontes, Andres Iniesta, David Silva, Juan Carlos Valeron, Rafael Martin Vazquez, Jose Mari Bakero, Isco, Xavi, Luis del Sol, Jose Pirri, Cesc Fabregas, Thiago Alcantara, Koke, Gaizka Mendieta, Santi Cazorla, Rodri, Sergio Busquets, Xabi Alonso, Josep Guardiola, Sergio Ramos, Carles Puyol, Fernando Hierro, Gerard Pique, Daniel Carvajal, Michel Salgado, Chendo, Cesar Azpilicueta, Jesus Navas, Jose Antonio Camacho, Jordi Alba, Rafael Gordillo, Iker Casillas, Andoni Zubizarreta, Victor Valdes
19. England 확장: Gary Lineker, Jimmy Greaves, Harry Kane, Alan Shearer, Michael Owen, Geoff Hurst, Roger Hunt, Andy Cole, Jamie Vardy, Kevin Keegan, Wayne Rooney, Johnny Haynes, Teddy Sheringham, Stanley Matthews, David Beckham, Bukayo Saka, Steve McManaman, Tom Finney, John Barnes, Raheem Sterling, Chris Waddle, Bobby Charlton, Paul Gascoigne, Steven Gerrard, Frank Lampard, Paul Scholes, Bryan Robson, Michael Carrick, Jordan Henderson, James Milner, Ian Callaghan, Declan Rice, Terry McDermott, Bobby Moore, John Terry, Rio Ferdinand, Billy Wright, Tony Adams, Sol Campbell, Jack Charlton, John Stones, Kyle Walker, Gary Neville, George Cohen, Jimmy Armfield, Phil Neal, Trent Alexander-Arnold, Ashley Cole, Ray Wilson, Gordon Banks, Peter Shilton, David Seaman, Ray Clemence

다음 데이터 입력 우선순위:

1. Core Europe 2 잔여: Netherlands
2. Core Europe 3: Portugal, Belgium
3. 유럽 제외 선수의 팀 우승/개인 수상 세부 항목 교차 검증
4. 현역보류/삭제후보 선수 유지 여부 재검토
