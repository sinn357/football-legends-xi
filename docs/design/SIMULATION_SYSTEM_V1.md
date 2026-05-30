# Simulation System v1

## 방향

Godot 없이 현재 Next.js 앱 안에서 웹 기반 매니저 시뮬레이션으로 만든다. 목표는 실시간 조작 축구 게임이 아니라, 레전드 데이터와 Best XI 조합을 바탕으로 "이 팀이 축구팀으로 얼마나 잘 작동하는지"를 보여주는 FM식 결과 엔진이다.

핵심 재미는 세 가지다.

- 내가 만든 XI끼리 붙여본다.
- 전술 선택이 결과와 리포트에 영향을 준다.
- 단순 총점 합산이 아니라 역할 균형, 포지션 적합도, 약점 노출, 큰 경기 영향력이 반영된다.

## 제외 범위

v1에서는 아래를 하지 않는다.

- Godot, Unity 같은 외부 게임 엔진 도입
- 실시간 2D/3D 선수 이동
- 유망주 성장, 이적시장, 재정, 계약
- 부상/체력/폼의 깊은 시즌 운영
- 실제 클럽/국대 스케줄 복제

이 앱의 첫 시뮬레이션은 "전술이 반영되는 레전드 단판 경기"에 집중한다.

## MVP: Match Simulator

첫 구현 목표는 단판 경기다.

입력:

- Team A: 저장한 XI 또는 현재 Best XI
- Team B: 저장한 XI 또는 자동 생성 XI
- 각 팀 전술 프리셋
- 선택 옵션: 홈 어드밴티지, 랜덤성 강도, 시드

출력:

- 최종 스코어
- xG
- 슈팅 / 유효슈팅
- 점유율
- 패스 흐름 지표
- 압박 성공
- 세트피스 위협
- MOM
- 선수별 평점
- 주요 이벤트 타임라인
- 전술 리포트

## 선수 능력 변환

현재 선수 데이터는 역사 평가용 점수다.

- `overallScore`
- `scores.teamCareer`
- `scores.individualCareer`
- `scores.primeSkill`
- `scores.teamImportance`
- `scores.legacy`
- `primaryPosition`
- `positions`
- `profile.summary`

시뮬레이션에서는 이를 경기 능력치로 변환한다.

### 기본 능력치

각 선수는 경기 엔진 내부에서 다음 능력치를 가진다.

| 능력치 | 의미 | 주요 입력 |
|---|---|---|
| scoring | 득점 기대치 | primeSkill, individualCareer, 포지션 |
| chanceCreation | 찬스 창출 | primeSkill, teamImportance |
| ballProgression | 전진/운반/빌드업 | primeSkill, teamImportance |
| control | 점유 안정성 | primeSkill, teamCareer |
| defending | 수비 기여 | primaryPosition, teamImportance |
| pressing | 압박 기여 | position group, teamImportance |
| aerial | 제공권/세트피스 | position group, overallScore 보정 |
| bigMatch | 큰 경기 영향력 | teamCareer, individualCareer, legacy |
| leadership | 팀 안정화 | teamCareer, teamImportance, legacy |
| versatility | 포지션 유연성 | positions 개수, primaryPosition |

### 1차 변환 공식

초기 버전은 데이터가 가진 점수 체계를 최대한 활용한다.

```ts
base = overallScore

scoring = weighted(base, primeSkill 0.50, individualCareer 0.30, teamImportance 0.20) + positionBonus
chanceCreation = weighted(base, primeSkill 0.55, teamImportance 0.30, individualCareer 0.15) + creatorBonus
ballProgression = weighted(base, primeSkill 0.45, teamImportance 0.35, teamCareer 0.20) + midfieldBonus
control = weighted(base, primeSkill 0.35, teamCareer 0.35, teamImportance 0.30)
defending = weighted(base, teamImportance 0.45, teamCareer 0.30, primeSkill 0.25) + defensivePositionBonus
pressing = weighted(base, teamImportance 0.45, primeSkill 0.30, teamCareer 0.25)
aerial = weighted(base, teamCareer 0.35, teamImportance 0.35, primeSkill 0.30) + roleBonus
bigMatch = weighted(base, teamCareer 0.40, individualCareer 0.35, legacy 0.25)
leadership = weighted(base, teamImportance 0.40, teamCareer 0.35, legacy 0.25)
versatility = clamp(70 + positions.length * 4 + secondaryRoleBonus, 70, 96)
```

포지션 보너스는 작게 둔다. 위대한 공격수라고 해서 수비 능력치가 40점으로 떨어지면 레전드 시뮬레이터의 감성이 깨진다. 대신 "역할 적합도"에서 차이를 크게 둔다.

## 포지션 그룹

포지션은 경기 엔진에서 그룹으로 묶는다.

- GK: `GK`
- Center Back: `CB`
- Fullback/Wingback: `LB`, `RB`, `LWB`, `RWB`
- Defensive Midfield: `DM`
- Central Midfield: `CM`
- Attacking Midfield: `AM`
- Wide Forward: `LW`, `RW`
- Second Striker: `SS`
- Striker: `ST`

Best XI 피치에서 자유 배치된 위치와 슬롯 라벨을 함께 본다.

예:

- `ST` 슬롯에 `CM`을 넣으면 득점력보다 연계/창출은 살지만 박스 결정력은 하락
- `CB` 없이 풀백/미드필더만 수비 라인에 두면 제공권과 수비 안정성 하락
- `DM` 없는 하이라인 전술은 역습 실점 위험 상승

## 팀 지표

선수 능력치를 팀 지표로 집계한다.

| 팀 지표 | 설명 |
|---|---|
| attackPower | 전체 공격 위협 |
| chanceQuality | 좋은 슈팅을 만드는 능력 |
| finishing | 찬스 대비 득점 전환 |
| midfieldControl | 중원 장악과 점유 안정 |
| progression | 후방에서 전방으로 전진하는 힘 |
| defensiveSecurity | 중앙 수비 안정성 |
| wideSecurity | 측면 수비 안정성 |
| pressingPower | 높은 위치에서 탈취하는 힘 |
| transitionThreat | 역습 위협 |
| setPieceThreat | 세트피스 득점 위협 |
| goalkeeperImpact | GK 선방/실점 억제 |
| chemistry | 역할 균형과 조합 안정성 |
| roleConflict | 공격 자원 과밀, 수비 공백 같은 충돌 |

## 팀 밸런스 규칙

총점 높은 선수 11명이 무조건 이기는 구조를 피한다.

### 긍정 보정

- 최소 1명의 GK
- 최소 2명의 CB 성격 수비수
- 최소 1명의 DM/수비형 CM
- 좌우 측면 담당 존재
- 전방 득점원 + 찬스 메이커 공존
- 리더십 높은 선수 존재
- 전술과 선수 특성이 잘 맞음

### 페널티

- GK 없음: 큰 페널티
- CB 부족: 중앙 수비 안정성 급락
- DM 없음 + High Press/High Line: 역습 실점 위험 증가
- 공격수 과밀: roleConflict 증가
- 크리에이터 과밀: chanceCreation은 높지만 finishing/chemistry 감소
- 측면 담당 부족: wideSecurity 감소
- 느린 수비 조합 + 높은 라인: transition defense 하락

## 전술 옵션

v1 UI에서는 복잡한 FM 전술판 대신 선택지를 제한한다.

### Style

- Balanced: 모든 지표를 안정적으로 사용
- Possession: midfieldControl, chanceQuality 증가 / transitionThreat 감소
- Direct: progression, setPieceThreat 증가 / control 감소
- Counter: transitionThreat 증가 / possession 감소
- High Press: pressingPower 증가 / 뒷공간 위험 증가
- Low Block: defensiveSecurity 증가 / attackPower 감소

### Tempo

- Slow: control 증가, 슈팅 수 감소
- Normal: 보정 없음
- Fast: 이벤트 수 증가, 실수와 전환 증가

### Line Height

- Low: 수비 안정, 압박 감소
- Mid: 보정 없음
- High: 압박 증가, 역습 취약

### Risk

- Conservative: 실점 위험 감소, 득점 기대치 감소
- Normal: 보정 없음
- Aggressive: 득점 기대치 증가, 실점 위험 증가

## 경기 엔진 구조

v1은 90분을 이벤트 기반으로 계산한다.

1. 양 팀 선수 능력치 계산
2. 양 팀 팀 지표 계산
3. 전술 보정 적용
4. 경기 템포에 따라 이벤트 수 결정
5. 각 이벤트의 소유권, 공격 유형, 슈팅 여부, xG, 골 여부 계산
6. 선수별 관여도 누적
7. 최종 스탯/평점/리포트 생성

### 이벤트 유형

- openPlay: 일반 공격
- counter: 역습
- setPiece: 세트피스
- wideAttack: 측면 공격
- centralCombination: 중앙 연계
- pressWin: 압박 탈취 후 찬스
- error: 실책성 찬스
- lateMoment: 후반 막판 큰 장면

### 이벤트 예시

```ts
event = {
  minute: 37,
  teamId: "A",
  type: "centralCombination",
  xg: 0.18,
  scorerId: "messi",
  assisterId: "maradona",
  outcome: "goal",
  text: "37' Maradona가 중앙에서 압박을 벗기고 Messi에게 결정적인 패스를 넣었다. Messi가 왼발로 마무리했다."
}
```

## 확률과 재현성

시뮬레이션은 랜덤성을 가지되 재현 가능해야 한다.

- 같은 팀, 같은 전술, 같은 seed면 같은 결과
- "다시 시뮬레이션"은 seed를 바꿔 다른 결과 생성
- 랜덤성 강도는 `Controlled`, `Normal`, `Wild` 정도로 둘 수 있음

초기 구현은 외부 라이브러리 없이 간단한 seeded random 함수를 사용한다.

## 선수 평점

평점은 6.0을 기준으로 시작한다.

가산:

- 골
- 도움
- 높은 xG 관여
- 찬스 생성
- 압박 성공
- 수비 기여
- GK 선방
- 팀 전술 핵심 역할 수행

감산:

- 실점 관여
- 큰 찬스 미스
- 포지션 부적합
- 전술 충돌
- 압박 실패/공간 노출

MOM은 평점, 골 관여, bigMatch, 경기 중요 이벤트 관여도를 섞어 결정한다.

## 결과 리포트

결과 화면은 숫자와 해석을 같이 보여준다.

섹션:

- Scoreboard
- Match Stats
- Key Events
- Player Ratings
- Tactical Notes
- Why They Won
- Weak Point

예:

- "Team A는 중원 장악력에서 앞섰지만, DM 부재 때문에 빠른 전환 상황에서 2개의 큰 찬스를 허용했다."
- "Team B의 Low Block은 슈팅 수를 줄였지만, 전방 고립으로 xG가 낮았다."
- "Messi와 Maradona 조합은 chanceCreation을 크게 끌어올렸지만, 측면 수비 지원이 부족했다."

## UI 설계

새 탭 이름은 `Sim` 또는 `Match Sim`이 적합하다. 앱 탭이 이미 많기 때문에 짧은 이름이 좋다.

### 화면 구조

왼쪽:

- Team A 선택
- Team B 선택
- 저장한 XI 목록
- 현재 Best XI 불러오기
- 자동 생성 XI 불러오기

중앙:

- 경기 설정
- 전술 선택
- 시뮬레이션 실행 버튼
- 결과 리포트
- 이벤트 타임라인

오른쪽:

- 선택 팀 요약
- 팀 지표 레이더/바
- 약점/강점
- 선수 상세 drawer 재사용

## 저장 데이터

초기에는 브라우저 `localStorage`만 사용한다.

- 저장된 시뮬레이션 결과
- 마지막 선택 팀
- 마지막 전술 설정
- seed

서버 저장이나 DB는 도입하지 않는다.

## 코드 구조 제안

```text
lib/simulation/types.ts
lib/simulation/player-ratings.ts
lib/simulation/team-metrics.ts
lib/simulation/tactics.ts
lib/simulation/match-engine.ts
components/LegendBuilder.tsx
app/globals.css
```

초기에는 파일을 너무 쪼개지 않고, 엔진은 `lib/simulation`에 둔다. UI는 기존 `LegendBuilder` 탭 구조에 붙인다.

## 구현 순서

### Phase 1A: 설계/타입/순수 엔진

- 시뮬레이션 타입 정의
- 선수 능력치 변환 함수
- 팀 지표 계산 함수
- 전술 보정 함수
- seed 기반 단판 경기 함수
- 최소 단위 테스트 또는 샘플 검증

### Phase 1B: UI 연결

- `Sim` 탭 추가
- Team A/B 선택
- 전술 컨트롤
- 시뮬레이션 실행
- 스코어/xG/이벤트/평점 표시

### Phase 1C: Best XI 연동

- 현재 Best XI를 Team A로 불러오기
- 저장한 XI를 Team A/B로 불러오기
- 자동 생성 XI를 상대팀으로 선택

### Phase 2: 토너먼트

- 4팀/8팀 토너먼트
- 국가별 레전드 월드컵
- 라운드별 결과 저장

### Phase 3: 시즌

- 커스텀 리그
- 승점표
- 득점왕/도움왕/MVP
- 경기별 리포트 저장

## 첫 구현 결정

다음 실제 코딩 작업은 Phase 1A로 시작한다.

- UI보다 순수 엔진을 먼저 만든다.
- 결과가 납득 가능한지 콘솔/간단 출력으로 검증한다.
- 그 다음 `Sim` 탭 UI에 연결한다.

이 순서가 중요한 이유는 UI를 먼저 만들면 결과가 랜덤 점수표처럼 보일 위험이 크기 때문이다. 엔진의 논리를 먼저 세워야 이후 리포트와 재미 기능이 흔들리지 않는다.
