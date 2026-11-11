# FPS BOXING 🥊

브라우저에서 바로 하는 1인칭 복싱 게임 (Three.js). 시점은 항상 상대 선수에게 고정되고, WASD로 상대 주위를 돌며 싸웁니다.

- **AI 대전**: 쉬움 / 보통 / 어려움
- **온라인 1:1**: 빠른 매칭(아무나와 바로) 또는 방 만들기(4자리 코드로 친구 초대)

## 온라인 대전 구조
- 서버(`server.js`)가 경기를 직접 계산합니다(서버 권한). 두 플레이어는 키 입력만 보내고, 서버가 초당 30번 경기 상태를 보내줍니다 → 판정이 서로 다르게 보이는 일이 없습니다.
- 통신은 WebSocket(`/ws`)이며 외부 패키지 없이 Node 기본 모듈로 구현되어 있습니다.
- 클라이언트는 상태와 상태 사이를 예측해서 부드럽게 그립니다. 핑(지연)은 화면 상단 시계 위에 표시됩니다.
- 경기 중 상대가 나가면 기권승, 경기가 끝나면 재대결 신청 가능.
- 온라인 경기 중 Esc를 눌러도 경기는 멈추지 않습니다.

## 조작법
펀치 키는 **J(왼손)·K(오른손)** 두 개뿐이고, 다른 키를 누른 채로 치면 펀치 종류가 바뀝니다. 회피도 **Space** 하나에 방향키 조합입니다. (총 12키)

| 키 | 동작 |
|---|---|
| W / A / S / D | 이동 (A/D는 상대 주위를 서클링) |
| Shift (누르기) | 가드 |
| C (누르기) | 덕킹 |
| **J / K** | 잽 / 스트레이트 |
| **F** + J / K | 레프트 훅 / 라이트 훅 |
| **V** + J / K | 레프트 어퍼컷 / 라이트 어퍼컷 |
| **C** + J / K | 바디 잽 / 바디 스트레이트 |
| **C + F** + J / K | 레프트 바디훅 / 라이트 바디훅 |
| Shift + J | 패리 (스트레이트 쳐내기) |
| Shift + K | 페인트 (속임 동작) |
| **Space** | 위빙 |
| A / D + Space | 좌 / 우 슬립 |
| S + Space | 스웨이백 |
| Tab / Esc | 조작법 숨기기 / 일시정지 |

## 게임 규칙
- 3라운드 × 90초, 10점 채점제 판정
- 체력이 0이 되면 다운 → 10카운트 안에 일어나야 함 (내가 다운되면 스페이스바 연타)
- 한 경기에서 3번 다운되면 TKO
- 상대 글러브가 빛나면 펀치 예고 — 스트레이트는 슬립/패리, 훅은 덕킹/위빙, 어퍼컷은 스웨이백으로 회피
- 회피·패리 직후 반격은 카운터(1.4배), 숙인 상대에게 어퍼컷은 1.5배
- 가드는 머리 공격을 대부분 막지만 바디샷·어퍼컷은 일부 통과
- 펀치·회피는 스태미나를 소모하고, 바디샷은 상대 스태미나를 크게 깎음

## 파일 구조
```
public/
  index.html   화면 구성, HUD, 메뉴
  style.css    스타일
  game.js      Three.js 렌더링 · 입력 · 사운드 · 카메라
  fight.js     게임 로직 (펀치/회피 판정, AI, 라운드) — 렌더링과 분리
  pose.js      선수 자세/애니메이션 계산
server.js      Render Web Service용 Node 서버: 정적 파일 + WebSocket 매칭/대전 (외부 패키지 없음)
package.json   npm start 스크립트
render.yaml    Render Blueprint 설정
```
Three.js는 브라우저에서 CDN(unpkg)으로 불러옵니다.

## 로컬에서 실행
```bash
npm start
# 브라우저에서 http://localhost:3000
# 온라인 테스트: 브라우저 창 두 개로 접속해서 한쪽은 방 만들기, 다른 쪽은 코드로 참가
```

## GitHub에 올리기
```bash
git init
git add .
git commit -m "FPS boxing game"
git branch -M main
git remote add origin https://github.com/<내아이디>/fps-boxing.git
git push -u origin main
```

## Render Web Service로 배포
1. Render 대시보드 → **New → Web Service**
2. GitHub 저장소 연결 후 `fps-boxing` 선택
3. 설정
   - **Language / Runtime**: Node
   - **Branch**: main
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (원하는 것)
4. (선택) Advanced → **Health Check Path**: `/healthz`
5. **Create Web Service** → 배포가 끝나면 `https://fps-boxing-xxxx.onrender.com` 주소로 접속

> `render.yaml`이 들어 있으므로 **New → Blueprint**로 저장소를 고르면 위 설정이 자동으로 적용되기도 합니다.

- 서버는 Render가 넘겨주는 `PORT` 환경변수를 자동으로 사용합니다.
- Render 웹 서비스는 WebSocket을 기본 지원하므로 추가 설정이 필요 없습니다.
- 현재 접속자/방 수는 `/stats` 주소에서 확인할 수 있습니다.
- 지연을 줄이려면 Render 서비스 리전을 **Singapore**로 만드는 것을 추천합니다 (한국에서 가장 가까움).
- 서버를 재시작/재배포하면 진행 중인 온라인 경기는 끊어집니다.
- 무료 인스턴스는 15분간 접속이 없으면 잠들어서, 다음 첫 접속 때 깨어나는 데 30초~1분 정도 걸릴 수 있습니다.
- GitHub에 push하면 자동으로 다시 배포됩니다.
