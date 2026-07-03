## PR 제목

[feat] 개발 서버 시연 자동화 모듈 추가

## 작업 내용

- 개발 서버 전용 demo simulator를 backend에 추가했습니다.
- 발표 브랜치의 dev compose에는 simulator `direct` 모드 값을 직접 넣어 별도 환경변수 주입 없이 시연이 시작되도록 했습니다.
- `direct` 모드에서 센서, YOLO, XGBoost, AnalysisJob 데이터를 직접 생성하고 기존 WebSocket 이벤트를 발행하도록 했습니다.
- `async` 모드에서는 기존 Backend -> AI Service -> Backend callback 흐름을 사용할 수 있게 했습니다.
- 메인 대시보드 요약 cache가 `DRAIN_STATUS_UPDATED` 이벤트에 맞춰 즉시 갱신되도록 보강했습니다.
- 상세 센서 차트가 30초 단위 시연 데이터를 구분할 수 있도록 시간 라벨에 초 단위를 포함했습니다.
- DR-003 상태별 이미지가 있으면 `/api/mock-images/demo/drain_3_{state}.*`를 우선 사용하고, 없으면 기존 `drain_3.jpg`로 fallback하도록 했습니다.
- 센서값과 분석값은 상태별 범위 안에서 랜덤 샘플링해 발표 화면의 숫자가 자연스럽게 변하도록 했습니다.
- 실행 가이드, 이미지 규칙, 이미지 생성 프롬프트를 `step-39` 문서에 정리했습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| Backend simulator | `backend/app/services/demo_simulator.py` |
| Backend 설정 | `backend/app/core/config.py`, `backend/app/main.py` |
| Docker dev 설정 | `docker-compose.dev.yml` |
| Env 예시 | `.env.example`, `backend/.env.example` |
| Frontend 실시간 반영 | `frontend/components/realtime-drain-sync.tsx` |
| Frontend 시간 라벨 | `frontend/lib/api/adapters.ts`, `frontend/app/drains/[id]/page.tsx` |
| 작업 계획 | `frontend/docs/plans/plan-26-dev-demo-automation-module.md` |
| 실행 가이드 | `frontend/docs/steps/step-39-dev-demo-automation-module.md` |

## 실행 방법

깨끗한 DB에서 처음 실행할 때:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db migrate
docker compose --profile seed run --rm seed
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

이미 서버가 떠 있는 상태에서 seed를 다시 넣었다면:

```powershell
docker compose --profile seed run --rm seed
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart backend
```

확인 URL:

```text
http://localhost:8080
http://localhost:8080/drains/DR-003
```

## 검증 결과

- `python -m compileall backend` 통과
- `npm.cmd run build` 통과
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet` 통과

## 리뷰 포인트

- 발표 브랜치에서 `docker-compose.dev.yml`의 `DEMO_SIMULATOR_ENABLED: "true"`를 직접 유지하는 방식이 적절한지 확인합니다.
- 시연 종료 후 `DEMO_SIMULATOR_ENABLED: "false"`로 되돌리거나 demo block을 제거하는 운영 방식이 충분히 명확한지 확인합니다.
- `direct` 모드가 발표 안정성을 위한 시연 데이터라는 점이 문서와 발표 설명에 충분히 드러나는지 확인합니다.
- DR-003 상태별 이미지 파일명과 fallback 정책이 발표 자료 준비 흐름에 맞는지 확인합니다.

## 비고

- `direct` 모드는 실제 YOLO 모델 판단이 아니라 발표 안정성을 위한 시연 데이터 생성 방식입니다.
- 실제 YOLO 흐름을 보여주려면 `docker-compose.dev.yml`의 `DEMO_SIMULATOR_MODE`를 `async`로 바꿔 별도 리허설합니다.
- 상태별 이미지는 사용자가 `mock_data/ai_image_samples/demo/` 아래에 추가해야 합니다.
- 시연 반복 후 DB 이력이 많이 쌓이면 발표 전 DB volume 초기화 여부를 결정합니다.
