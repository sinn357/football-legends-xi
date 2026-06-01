# Football Legends XI

국가별 역대 축구 레전드 풀을 바탕으로 평가 가중치와 포메이션을 조절해 베스트11을 만들어보는 로컬 전용 앱입니다.

## 데이터 소스

- 원본 문서: `/Users/woocheolshin/Documents/Vibecoding/축구 레전드/축구 레전드.md`
- 배포용 포함 문서: `data/football-legends.md`
- 앱은 서버에서 마크다운을 읽어 국가, 포지션, 선수명, 보류/삭제 후보 메모를 파싱합니다.
- 선수별 세부 점수는 MVP용 임시 시드이며, 현재는 문서 내 포지션 순서와 상태 메모를 기준으로 생성합니다.
- 점수 체계와 선수 정보 입력 기준: `docs/design/SCORE_AND_PROFILE_SYSTEM.md`
- 웹 기반 매치 시뮬레이션 설계: `docs/design/SIMULATION_SYSTEM_V1.md`

## 실행

```bash
npm install
npm run dev
```

기본 포트는 `3008`입니다.

## MVP 기능

- Atlas 기본 화면: 대륙 → 국가 → 포지션별 레전드 리스트 탐색
- 국가명은 전체 영어 표기로 정규화
- 선수 상세 drawer: 팀 커리어, 개인 수상, 프라임 실력, 팀 내 비중, 100년 뒤 존재감 섹션
- 국가별 선수 풀 탐색
- 팀 커리어, 개인 커리어, 프라임 실력, 팀 내 비중, 100년 뒤 존재감 가중치 조절
- World/Nation/Continent 필터 기반 4-3-3, 4-2-3-1, 4-4-2, 3-4-3, 3-5-2 추천 XI 생성
- 전체 선수 검색 기반 슬롯별 선수 수동 교체
- 피치 위 선수 카드 드래그 배치, 가까운 슬롯 스냅, 선수 간 스왑
- 후보군/전체 로스터 확인
- 가중치 기반 Top 100 Ranking Lab
- 최대 4명 선수 비교
- 브라우저 로컬 저장소 기반 XI 저장 및 비교
- 웹 기반 매치 시뮬레이션 설계 확정: Godot 없이 Next.js 앱 안에서 순수 엔진과 UI를 단계적으로 구현
- Sim 결과 기반 Watch Match: 2D 피치 위 선수 22명, 공, 패스 라인/슛 궤적, 전술별 움직임 보정, chance/flow 이벤트 밀도, 코너/프리킥/PK 세트피스 상황, 파울/옐로/레드카드 판정, 모멘텀/후반 에너지 흐름, 주요 장면 하이라이트 리플레이, 태클/인터셉트/GK 처리 수비 액션, 연속 flow motion, 90분 경기 시간축, Quick/Standard/Extended/Tactical 재생 길이, Build/Connect/Finish 3단계 장면 재생, Finish 결과 마커/골문 플래시, 이벤트 피드 애니메이션
- 4팀 더블 라운드로빈 Season 모드: 순위표, 득점/도움/평점/MVP 리더보드, 라운드별 결과 생성
