# FPS BOXING 🥊

브라우저에서 바로 하는 1인칭 복싱 게임 (Three.js). 시점은 항상 상대 선수에게 고정되고, WASD로 상대 주위를 돌며 싸웁니다.

## 조작법

| 키 | 동작 |
|---|---|
| W / S | 전진 / 후퇴 |
| A / D | 상대를 중심으로 좌우 서클링 |
| Shift (누르기) | 가드 |
| C (누르기) | 덕킹 — 이 상태에서 펀치하면 **바디샷** |
| Q / E | 좌 / 우 슬립 |
| Space | 위빙 (A/D를 같이 누르면 그 방향으로) |
| F | 스웨이백 (상체 젖히기) |
| X | 패리 (스트레이트 쳐내기) |
| J / K | 잽 / 스트레이트 |
| U / I | 레프트 훅 / 라이트 훅 |
| N / M | 레프트 어퍼컷 / 라이트 어퍼컷 |
| H / L | 레프트 바디훅 / 라이트 바디훅 |
| R | 페인트 (속임 동작) |
| Tab | 조작법 표시/숨기기 |
| Esc | 일시정지 |

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
render.yaml    Render 배포 설정
```
빌드 과정이 없는 정적 사이트이며, Three.js는 CDN(unpkg)에서 불러옵니다.

## 로컬에서 실행
ES 모듈을 쓰기 때문에 파일을 더블클릭하면 안 되고, 간단한 서버로 열어야 합니다.
```bash
cd public
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
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

## Render 배포
**방법 A — Blueprint (render.yaml 사용)**
1. Render 대시보드 → **New → Blueprint**
2. 위 GitHub 저장소 선택 → Apply

**방법 B — 직접 Static Site 만들기**
1. Render 대시보드 → **New → Static Site**
2. 저장소 선택
3. Build Command: 비워두거나 `echo ok`
4. Publish Directory: `public`
5. Create Static Site

이후 GitHub에 push할 때마다 자동으로 다시 배포됩니다.
