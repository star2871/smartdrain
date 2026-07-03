## PR 제목

[feat] 발표 시연 제어와 공개 자동 시나리오 추가

## 작업 내용

- 발표자 전용 `/demo-control` 화면을 추가했습니다.
- Backend에 `/api/demo/*` 제어 API를 추가했습니다.
  - 수동 preset 적용과 수동 override 해제
  - 발표 초기화
  - 자동 날씨 시나리오 시작, 일시정지, 재개, 정지
  - 다음 단계 이동, 특정 날씨 단계 강제 적용
  - 리허설용 자동 진행 간격 변경
  - 복구 단계 적용
- 자동 날씨 시나리오가 시설별 특성과 상태별 범위 안에서 자연스럽게 수위, 유속, 막힘률을 생성하도록 보강했습니다.
- 상태별 demo 이미지가 있으면 `mock_data/ai_image_samples/demo/` 파일을 우선 사용하고, 없으면 기존 mock image로 fallback하도록 했습니다.
- `ai-service`가 model 파일 검사 후 종료되지 않도록 기본 compose에도 `uvicorn` foreground command를 명시했습니다.
- Nginx에 `/demo-control` 라우팅을 추가해 dev VM의 `18080` 경로에서 제어 화면이 열리도록 했습니다.
- 위험 알림 UX를 보강했습니다.
  - 위험과 판단불가를 긴급 알림 대상으로 분리
  - 여러 시설이 동시에 위험해져도 알림 패널에서 읽지 않은 위험/판단불가 개수를 확인 가능
- 발표 시연 계획과 사용 가이드를 문서화했습니다.
  - 발표자 수동 시연
  - 관람객 공개 자동 시나리오
  - 상태별 이미지 준비 목록
  - 리허설 빠른 모드
  - Cloudflare Access 권장 정책
  - Jenkins Secret File 체크리스트
  - 발표 후 demo 비활성화 절차

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| Demo API router | `backend/app/routers/demo.py` |
| Demo simulator | `backend/app/services/demo_simulator.py` |
| Backend 설정·router 등록 | `backend/app/core/config.py`, `backend/app/main.py` |
| Compose/env 설정 | `docker-compose.yml`, `docker-compose.dev.yml`, `.env.example` |
| Frontend 제어 화면 | `frontend/app/demo-control/page.tsx` |
| Frontend demo API client | `frontend/lib/api/demo.ts` |
| 알림 UX | `frontend/components/app-header.tsx`, `frontend/store/drain-store.ts`, `frontend/lib/urgent-alert-policy.ts` |
| Nginx routing | `nginx/default.conf`, `nginx/default.dev.conf` |
| 계획 문서 | `frontend/docs/plans/plan-30-presentation-demo-control-and-public-scenario.md` |
| 사용 가이드 | `frontend/docs/steps/step-46-presentation-demo-control-usage-guideline.md` |

## 실행 방법

로컬 dev compose 기준:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

확인 URL:

```text
http://localhost:18080
http://localhost:18080/demo-control
```

`/demo-control`에서 `.env` 또는 Jenkins Secret File의 `DEMO_CONTROL_TOKEN` 값을 입력한 뒤 사용합니다.

## 검증 결과

- Backend Python AST parse 통과
- `npm.cmd --prefix frontend run lint` 통과
  - 기존 `frontend/components/fallback-image.tsx`의 native `<img>` 경고 1건 유지
- `npm.cmd --prefix frontend run build` 통과
  - `/demo-control` static route 생성 확인
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` 확인
  - Backend에 demo env가 렌더링되는 것 확인

## 리뷰 포인트

- `/api/demo/*`가 `DEMO_CONTROL_TOKEN` 없이는 접근되지 않는지 확인합니다.
- `/demo-control` 화면의 버튼명이 발표 운영 흐름과 맞는지 확인합니다.
  - `발표 초기화`
  - `복구 단계 적용`
  - `정지`
  - `단계 적용`
  - `10초`, `15초`, `30초`, `60초`
- 자동 날씨 시나리오 자연화 범위가 발표 화면에서 과하지 않고 자연스럽게 보이는지 확인합니다.
- 여러 시설이 동시에 위험/판단불가가 되었을 때 알림 패널의 count와 목록 표시가 이해하기 쉬운지 확인합니다.
- Cloudflare Access와 `DEMO_CONTROL_TOKEN`을 함께 쓰는 운영 가이드가 충분한지 확인합니다.
- VM에서 `ai-service`가 `Restarting` 루프 없이 `healthy` 상태로 유지되는지 확인합니다.
- 발표 후 `COMPOSE_DEMO_SIMULATOR_ENABLED=false`로 되돌리는 절차가 명확한지 확인합니다.

## 비고

- 상태별 시연 이미지는 repository에 포함하지 않고 VM에 직접 배치하는 방식으로 진행합니다.
- 이미지 파일은 `mock_data/ai_image_samples/demo/` 아래에 `drain_{DB 숫자 id}_{risk_level}.*` 또는 `drain_{DB 숫자 id}_{risk_level}_{variant}.*` 형태로 둡니다.
- `direct` 모드는 실제 YOLO 모델 판단이 아니라 발표 안정성을 위한 시연 데이터 생성 방식입니다.
- 실제 YOLO 분석 흐름을 보여줘야 할 때는 `DEMO_SIMULATOR_MODE=async`로 별도 리허설합니다.
- 발표용 토큰은 발표 자료, QR, 공개 문서에 포함하지 않습니다.
