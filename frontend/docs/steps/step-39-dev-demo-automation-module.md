# 39 개발 서버 시연 자동화 모듈 구현 가이드

## 1. 작업 목적

개발 Docker 환경에서 발표 시연용 데이터가 자동으로 들어오도록 backend demo simulator를 추가했다. 목표는 사용자가 메인 대시보드와 상세 화면에서 실시간으로 바뀌는 하수구 상태를 확인하고, 발표 영상으로 캡처할 수 있게 만드는 것이다.

이번 구현은 다음 시연 흐름을 기준으로 한다.

```text
메인 대시보드
-> 5개 하수구가 서로 다른 상태로 보이는 overview 장면 확인
-> DR-003 선택
-> 상세 화면 진입
-> DR-003이 good -> caution -> danger -> unknown 순서로 변화
-> 센서 차트, 위험 이력, 분석 이력이 누적되는 모습 확인
```

## 2. 변경 범위

| 파일 | 내용 |
|---|---|
| `backend/app/services/demo_simulator.py` | 개발 전용 시연 자동화 loop 추가 |
| `backend/app/core/config.py` | demo simulator 환경변수 추가 |
| `backend/app/main.py` | FastAPI startup/shutdown에서 simulator 시작/종료 |
| `docker-compose.dev.yml` | dev compose에서 발표용 simulator 값을 직접 주입 |
| `.env.example` | compose demo 설정 예시 추가 |
| `backend/.env.example` | backend 단독 실행용 demo 설정 예시 추가 |
| `frontend/components/realtime-drain-sync.tsx` | WebSocket 상태 이벤트 수신 시 대시보드 요약 cache 즉시 갱신 |
| `frontend/lib/api/adapters.ts` | 센서 차트 시간 라벨에 초 단위 포함 |
| `frontend/app/drains/[id]/page.tsx` | 상세 화면 실시간 센서 포인트 시간 라벨에 초 단위 포함 |

## 3. 동작 방식

### 3.1 dev compose 발표 기본값

이번 시연 브랜치에서는 dev merge 후 별도 환경변수를 주입하지 않아도 바로 동작하도록 `docker-compose.dev.yml`에 발표용 값을 직접 넣어둔다.

```yaml
DEMO_SIMULATOR_ENABLED: "true"
DEMO_SIMULATOR_MODE: "direct"
DEMO_SIMULATOR_INTERVAL_SECONDS: "30"
DEMO_SIMULATOR_START_DELAY_SECONDS: "10"
DEMO_SIMULATOR_TARGET_DRAIN_CODE: "DR-003"
```

주의:

- 이 값은 발표용 임시 설정이다.
- 시연이 끝나면 `DEMO_SIMULATOR_ENABLED`를 `"false"`로 바꾸거나 해당 block을 제거한다.
- `.env.example`, `backend/.env.example`의 기본값은 안전하게 off 예시를 유지한다.

### 3.2 `direct` 모드

발표 본시연 추천 모드다.

```text
simulator
-> SensorData 생성
-> YoloResult 생성
-> XgboostResult 생성
-> AnalysisJob completed 기록
-> YOLO_RESULT_UPDATED broadcast
-> XGBOOST_RESULT_UPDATED broadcast
-> DRAIN_STATUS_UPDATED broadcast
```

장점:

- 실제 YOLO 속도에 영향을 받지 않는다.
- good, caution, danger, unknown 상태를 예측 가능하게 보여줄 수 있다.
- WebSocket, DB 저장, 프론트 실시간 반영 흐름은 확인할 수 있다.

주의:

- 실제 YOLO 모델이 이미지를 보고 판단한 결과는 아니다.
- 발표에서는 "시연용 자동 데이터"라고 설명하는 것이 안전하다.

### 3.3 `async` 모드

실제 AI Service를 태우는 검증 모드다.

```text
simulator
-> SensorData 생성
-> analysis_async_service.start_analysis_for_drain()
-> AI Service 실제 분석
-> Backend callback
-> WebSocket broadcast
```

장점:

- 실제 Backend -> AI Service -> Backend callback 흐름을 탄다.

주의:

- 실제 YOLO 분석 속도와 모델 결과에 따라 화면 변화가 늦거나 예상과 다를 수 있다.
- 발표 본시연보다는 기술 검증 장면 또는 백업 녹화용으로 권장한다.

### 3.4 DR-003 상태별 이미지

DR-003 상세 시나리오는 상태별 이미지가 있으면 해당 이미지를 우선 사용한다. 이미지가 없으면 기존 `/api/mock-images/drain_3.jpg`로 자동 fallback된다.

권장 위치:

```text
mock_data/ai_image_samples/demo/
```

권장 파일명:

```text
drain_3_good.jpg
drain_3_caution.jpg
drain_3_danger.jpg
drain_3_unknown.jpg
```

지원 확장자:

```text
.jpg
.jpeg
.png
.webp
```

예를 들어 `drain_3_caution.png`만 있어도 simulator는 다음 URL을 저장한다.

```text
/api/mock-images/demo/drain_3_caution.png
```

상태별 이미지가 준비되면 별도 코드 수정 없이 backend를 다시 띄우면 된다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend frontend nginx
```

### 3.5 센서값 랜덤 정책

시연값은 완전 고정값이 아니라 상태별 범위 안에서 매 tick마다 조금씩 달라진다.

| 상태 | 수위 범위 | 유속 범위 | 의도 |
|---|---:|---:|---|
| good | 18~32cm | 0.95~1.35m/s | 정상 흐름 |
| caution | 48~64cm | 0.35~0.65m/s | 일부 막힘/수위 상승 |
| danger | 76~90cm | 0.05~0.22m/s | 위험 상태 |
| unknown | 0~20cm | 0.00~0.25m/s | 판단 불가 |

이 방식은 숫자가 매번 너무 똑같아 보이지 않으면서도, 상태 자체는 발표 흐름에 맞게 안정적으로 유지한다.

## 4. Docker 실행 순서

### 4.1 깨끗한 DB에서 처음 실행

5개 하수구 seed가 들어간 뒤 backend simulator가 시작되는 순서가 가장 깔끔하다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db migrate
docker compose --profile seed run --rm seed
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

처음 빌드하거나 프론트/백엔드 이미지가 꼬였으면:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

### 4.2 이미 개발 서버가 떠 있는 상태에서 seed를 다시 넣은 경우

backend가 seed보다 먼저 떠 있었다면 overview 초기 적용이 지나갔을 수 있으므로 backend를 한 번 재시작한다.

```powershell
docker compose --profile seed run --rm seed
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart backend
```

### 4.3 simulator 실행

현재 dev compose에는 발표용 `direct` 모드 값이 이미 들어 있으므로 별도 `$env:COMPOSE_DEMO_...` 설정이 필요 없다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend frontend nginx
```

영상 캡처용으로 빠르게 보고 싶을 때만 `docker-compose.dev.yml`의 interval을 임시로 줄인다.

```yaml
DEMO_SIMULATOR_INTERVAL_SECONDS: "10"
```

리허설 후 기본 30초로 되돌리는 것을 권장한다.

```yaml
DEMO_SIMULATOR_INTERVAL_SECONDS: "30"
```

### 4.4 simulator 끄기

시연이 끝났거나 일반 개발 모드로 되돌릴 때는 `docker-compose.dev.yml`에서 값을 바꾼다.

```yaml
DEMO_SIMULATOR_ENABLED: "false"
```

그 뒤 backend를 다시 띄운다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend
```

발표 브랜치가 끝나면 compose의 발표용 block 자체를 제거하는 것이 가장 안전하다.

## 5. 화면 확인 순서

### 5.1 메인 대시보드

접속:

```text
http://localhost:8080
```

확인할 것:

| 영역 | 기대 결과 |
|---|---|
| 요약 카드 | good/caution/danger/unknown 개수가 simulator 이벤트에 맞춰 바뀐다. |
| 위험 목록 | 위험도가 높은 하수구가 상단으로 올라온다. |
| 지도 마커 | 상태 색상이 변경된다. |
| 선택 패널 | 수위, 유속, 막힘률, 이미지, 최종 판단이 최신값으로 바뀐다. |
| 실시간 연결 상태 | WebSocket 연결이 유지된다. |

초기 overview는 backend 시작 후 `DEMO_SIMULATOR_START_DELAY_SECONDS` 뒤에 5개 하수구에 순차 적용된다.

### 5.2 DR-003 상세 화면

접속:

```text
http://localhost:8080/drains/DR-003
```

확인할 것:

| 영역 | 기대 결과 |
|---|---|
| 상단 상태 | DR-003의 최신 위험 상태가 바뀐다. |
| 센서 차트 | 30초 단위 포인트가 누적된다. |
| CCTV/YOLO | 최신 YOLO 결과와 이미지가 표시된다. |
| XGBoost | 최신 위험도와 최종 판단이 바뀐다. |
| 위험 이력 | good -> caution -> danger -> unknown 흐름이 누적된다. |
| 분석 이력 | YOLO/XGBoost 결과가 추가된다. |

## 6. 로그 확인

backend 로그:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend
```

정상 로그 예시:

```text
Demo simulator started: mode=direct interval=30s start_delay=10s target=DR-003
Demo simulator applied: drain_code=DR-003 risk=danger water=82 flow=0.12
```

AI Service 로그는 `async` 모드에서만 중요하다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f ai-service
```

## 7. DB 확인

분석 job 확인:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db psql -U smartdrain -d smartdrain_db -c "select request_id, status, trigger_type, created_at, updated_at from analysis_jobs order by id desc limit 10;"
```

센서 데이터 확인:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db psql -U smartdrain -d smartdrain_db -c "select drain_id, water_level_cm, flow_velocity_mps, measured_at from sensor_data order by id desc limit 10;"
```

위험도 확인:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db psql -U smartdrain -d smartdrain_db -c "select drain_id, risk_level, risk_score, evaluated_at from xgboost_results order by id desc limit 10;"
```

## 8. WebSocket 확인

Chrome DevTools:

```text
F12
-> Network
-> WS
-> /ws/drains/status
-> Messages
```

기대 이벤트:

```text
YOLO_RESULT_UPDATED
XGBOOST_RESULT_UPDATED
DRAIN_STATUS_UPDATED
```

## 9. 장애 대응

### 9.1 화면이 안 바뀔 때

1. simulator가 켜져 있는지 확인한다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=100 backend
```

2. seed가 들어가 있는지 확인한다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db psql -U smartdrain -d smartdrain_db -c "select id, drain_code, status from drains order by id;"
```

3. WebSocket 연결을 확인한다.

```text
Chrome DevTools > Network > WS
```

### 9.2 데이터가 너무 많이 쌓였을 때

발표 전 완전히 깨끗한 DB가 필요하면 Docker volume 초기화가 필요하다. 단, DB 데이터가 삭제되므로 신중히 실행한다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
docker compose --profile seed run --rm seed
```

DB를 지우지 않고 발표만 진행할 경우에는 위험 이력/분석 이력이 많아져도 최신순으로 보이므로 보통 문제는 작다.

### 9.3 실제 YOLO 결과를 보고 싶을 때

`direct` 대신 `async` 모드로 바꾼다.

```yaml
DEMO_SIMULATOR_ENABLED: "true"
DEMO_SIMULATOR_MODE: "async"
DEMO_SIMULATOR_INTERVAL_SECONDS: "30"
```

적용 후 다시 띄운다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend ai-service frontend nginx
```

주의:

- 실제 YOLO 모델과 이미지 품질에 따라 `unknown` 같은 발표용 상태가 의도대로 나오지 않을 수 있다.
- 발표 본시연은 `direct` 모드를 권장한다.

## 10. 발표 영상 캡처 추천 흐름

```text
1. dev compose의 simulator direct 모드 30초 설정 확인
2. http://localhost:8080 접속
3. overview 상태가 5개 하수구에 들어오는 장면 캡처
4. DR-003 선택
5. 상세 화면으로 이동
6. DR-003 상태 변화가 2~3회 누적되는 장면 캡처
7. 필요하면 compose interval을 10초로 줄여 good/caution/danger/unknown 전체 흐름을 빠르게 캡처
8. 캡처 후 compose interval을 30초로 되돌림
```

## 10.1 DR-003 이미지 생성 프롬프트

현재 `drain_3.jpg`를 reference image로 넣고 아래 프롬프트를 사용한다. 시연용이므로 위치, 카메라 각도, 도로 질감은 최대한 유지하고 상태만 바꾸는 것이 좋다.

공통 프롬프트:

```text
Use the provided storm drain CCTV image as the visual reference. Create a realistic demo CCTV snapshot of the same urban storm drain. Preserve the same camera angle, drain position, pavement texture, curb shape, lighting direction, and overall scene identity. The image should look like a practical monitoring camera frame, not a cinematic render. Do not add people, vehicles, text, UI overlays, logos, watermarks, or labels. Only change the visible drain condition, debris, water level, and image clarity according to the requested status.
```

`drain_3_good.jpg`:

```text
Create a GOOD condition version. The storm drain opening is clearly visible and mostly clean. There may be small dust or a few tiny leaves around the grate, but water can flow normally. No flooding, no major debris blockage, no muddy water. Keep the same location and CCTV-like viewpoint as the reference.
```

`drain_3_caution.jpg`:

```text
Create a CAUTION condition version. The same storm drain is partially blocked by leaves, small trash, mud, and debris near the grate. Some shallow water is collecting around the drain, but the road is not fully flooded. The drain opening should still be partly visible. Keep the same location and CCTV-like viewpoint as the reference.
```

`drain_3_danger.jpg`:

```text
Create a DANGER condition version. The same storm drain is heavily blocked by debris, leaves, plastic waste, and mud. Water is pooled around the drain and spreading across the nearby pavement. The drain opening is mostly covered or difficult to see. Make it urgent but realistic, like a monitoring snapshot after heavy rain. Keep the same location and CCTV-like viewpoint as the reference.
```

`drain_3_unknown.jpg`:

```text
Create an UNKNOWN condition version for a CCTV or image acquisition failure case. The same storm drain scene is visible but difficult to judge: slightly blurred, low contrast, rain streaks or water droplets on the lens, and partial obstruction of the view. Do not make the image completely black. Keep it realistic and suitable for a monitoring dashboard.
```

## 11. 완료 기준

- simulator off 상태에서는 기존 개발 서버 동작이 바뀌지 않는다.
- simulator direct 모드에서 5개 하수구 overview 데이터가 생성된다.
- DR-003이 순차적으로 good, caution, danger, unknown 상태를 보여준다.
- 메인 대시보드 목록, 지도, 요약 카드가 WebSocket 이벤트에 맞춰 갱신된다.
- 상세 화면에서 센서 차트와 위험/분석 이력이 누적된다.
- Docker dev 환경에서 별도 환경변수 주입 없이 발표 시연을 시작할 수 있다.
- 발표 종료 후 `docker-compose.dev.yml`의 demo block을 제거하거나 `DEMO_SIMULATOR_ENABLED`를 `"false"`로 되돌린다.
