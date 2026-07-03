# 26 개발 서버 시연 자동화 모듈 계획

## 1. 작업 개요

| 항목 | 내용 |
|---|---|
| 목적 | 개발 서버에서 5개 하수구가 정해진 시나리오에 따라 자동으로 변하는 발표 시연 흐름을 만든다. |
| 주요 대상 | Backend, AI Service, DB, WebSocket, Frontend 실시간 화면 |
| 문서 범위 | 실제 구현 전 필요한 방향성, 수정 범위, 사용자 확인 사항, 추천 구현안을 정리한다. |
| 권장 방식 | 개발 환경 전용 backend demo simulator를 추가하고, 30초마다 1개 하수구를 갱신하는 B안을 기본으로 한다. |
| 주의 | `frontend/AGENTS.md` 기준으로 `/frontend` 밖 수정은 사용자 확인 후 진행해야 한다. 이번 문서는 사용자 요청에 따라 `/frontend/docs`에 작성한다. |

## 2. 확인한 현재 구조

| 영역 | 현재 상태 | 시연 자동화와의 관계 |
|---|---|---|
| Backend sensor API | `POST /api/sensor-data`가 센서 데이터를 저장한다. | 시연 모듈이 직접 DB에 `SensorData`를 만들거나 기존 service를 재사용할 수 있다. |
| Backend async analysis | `POST /api/analysis/async-run`이 최신 센서값으로 AI 분석 job을 시작한다. | 센서값 생성 후 기존 `analysis_async_service.start_analysis_for_drain()`을 호출하면 기존 흐름을 그대로 탄다. |
| AI callback | YOLO callback 저장 후 `YOLO_RESULT_UPDATED`, XGBoost callback 저장 후 `XGBOOST_RESULT_UPDATED`, `DRAIN_STATUS_UPDATED`를 broadcast한다. | 별도 WebSocket 이벤트 형식을 새로 만들 필요가 적다. |
| Scheduler | `ANALYSIS_SCHEDULER_ENABLED=false`가 기본이며, 켜도 최신 센서값을 분석할 뿐 센서값을 만들지는 않는다. | 자동 시연용으로 기존 scheduler만 켜는 것은 부족하다. |
| AI image source | AI Service는 drain id 1~5를 `mock_data/ai_image_samples/drain_1.jpg` 등으로 매핑한다. | 실제 YOLO 분석 시 drain별 대표 이미지가 고정된다. 상태별 이미지 순환을 하려면 별도 이미지 매핑 확장이 필요하다. |
| Backend static image | `/api/mock-images`가 `mock_data/ai_image_samples`를 제공한다. | 프론트 표시용 이미지 URL은 `/api/mock-images/...` 형태로 안정적으로 쓸 수 있다. |
| Frontend WebSocket | `/ws/drains/status` 이벤트를 받아 목록, 지도, 선택 패널 일부 상태를 갱신한다. | 실시간 상태 변화는 이미 받아낼 수 있다. 상세 히스토리까지 즉시 갱신되는지는 별도 확인이 필요하다. |
| Frontend query | 대시보드 목록은 이벤트 merge, 상세/이력은 일부 invalidate 또는 재조회 의존이다. | 발표 화면이 상세 페이지 중심이면 이벤트 후 query invalidate 보강이 필요할 수 있다. |

## 3. 문제 정의

현재 수동 시연은 Swagger 또는 터미널에서 다음 흐름을 직접 실행해야 한다.

```text
POST /api/sensor-data
POST /api/analysis/async-run
AI Service 실제 분석 또는 mock 분석
Backend callback 저장
WebSocket 이벤트 수신
Frontend 화면 확인
```

이 방식은 기능 검증에는 좋지만 발표 시연에는 다음 문제가 있다.

| 문제 | 설명 |
|---|---|
| 발표자가 계속 조작해야 함 | 모바일 화면 또는 발표 자료 설명 중 Swagger 조작이 필요하다. |
| 시나리오 재현성이 약함 | 랜덤값 또는 수동 입력값이 달라지면 발표 흐름과 화면이 어긋날 수 있다. |
| 스케줄러만으로 부족 | 기존 scheduler는 센서 데이터를 만들지 않아서 자동 변화가 시작되지 않는다. |
| 실제 YOLO는 지연 가능 | 로컬 Docker, CPU, 모델 파일 상태에 따라 분석 시간이 들쭉날쭉할 수 있다. |
| 이미지 상태 변화 제한 | 현재 AI Service는 drain별 단일 이미지 경로만 본다. good/caution/danger 이미지 순환은 별도 설계가 필요하다. |

## 4. 목표 시연 경험

개발 서버를 켜면 발표자가 별도 조작을 많이 하지 않아도 5개 하수구가 자연스럽게 변한다.

```text
서버 시작
-> seed 데이터 준비
-> demo simulator 활성화
-> 30초마다 1개 하수구 센서값 갱신
-> 기존 async analysis 실행
-> callback 저장
-> WebSocket으로 대시보드와 상세 화면 갱신
```

권장 변화 속도는 모바일 사용자 기준으로 너무 빠르지 않게 잡는다.

| 항목 | 추천값 |
|---|---|
| tick 간격 | 30초 |
| tick당 변경 수 | 기본 1개, 특정 단계에서만 2개 선택 가능 |
| 전체 순환 시간 | 2분 30초~3분 |
| 센서값 | 완전 랜덤이 아니라 고정 시나리오에 작은 변동만 추가 |
| 발표 백업 | 동일 시나리오를 수동 Swagger로도 재현 가능하게 유지 |

## 4.1 사용자 목표 기준 시연 구성

사용자가 이번 시연에서 보여주려는 핵심은 단순히 값이 바뀌는 것이 아니라, 실제 사용자가 보는 화면 흐름이다.

```text
1. 메인 화면에서 하수구 목록과 지도 상태가 실시간으로 바뀌는 장면을 보여준다.
2. seed 데이터처럼 5개 하수구가 각각 다른 이미지/상태를 가진 초기 장면을 보여준다.
3. 특정 하수구 1개를 골라 양호 -> 주의 -> 위험 -> 판단 불가 경우의 수를 순서대로 보여준다.
4. 상세 화면에 들어가서 센서값, 이미지, AI 분석 결과, 위험 이력이 시간에 따라 누적되는 모습을 보여준다.
5. 이 전체 흐름을 발표용 시연 영상으로 캡처한다.
```

따라서 자동화 모듈은 두 가지 시연 모드를 지원하는 방향이 좋다.

| 모드 | 목적 | 추천 화면 |
|---|---|---|
| `overview` | 5개 하수구가 서로 다른 상태로 보이는 seed-like 초기 장면과 목록 변화 확인 | 메인 대시보드 |
| `single-drain-story` | 특정 하수구 1개가 양호, 주의, 위험, 판단 불가로 바뀌고 값이 누적되는 장면 확인 | 상세 화면 |

이번 발표 영상 기준으로는 `overview`로 시작한 뒤, `single-drain-story`를 DR-003 같은 대표 하수구에 적용하는 구성이 가장 설명하기 쉽다.

```text
메인 대시보드
-> 5개 하수구 상태 확인
-> 목록 정렬/지도 마커/요약 카드 변화 확인
-> DR-003 선택
-> 상세 화면 진입
-> DR-003 상태가 순차적으로 변화
-> 센서 차트와 분석 이력이 누적되는 장면 캡처
```

## 5. 구현 선택지

### A안. 기존 scheduler만 활용

센서 데이터를 미리 넣고 `ANALYSIS_SCHEDULER_ENABLED=true`로 주기 분석을 돌린다.

| 장점 | 단점 |
|---|---|
| 새 코드가 가장 적다. | 센서값을 자동으로 만들지 않는다. |
| 기존 분석 job 정책을 그대로 쓴다. | 기본 interval 300초, initial delay 60초라 발표 흐름에 느리다. |
| 운영 scheduler 검증에도 도움이 된다. | 5개 하수구가 시나리오대로 변하는 연출을 만들기 어렵다. |

판단: 이번 발표 시연 목적에는 부적합하다.

### B안. Backend demo simulator 추가

Backend startup에서 개발 환경 전용 task를 띄워 30초마다 센서값을 만들고 기존 async analysis를 호출한다.

| 장점 | 단점 |
|---|---|
| 기존 DB, AI callback, WebSocket 흐름을 그대로 검증한다. | backend 설정과 startup/shutdown 코드가 추가된다. |
| 발표자가 조작하지 않아도 화면이 변한다. | 실제 YOLO를 계속 돌리면 로컬 환경에 따라 지연될 수 있다. |
| 환경 변수로 dev에서만 켤 수 있다. | 중복 job, 실패 job, DB 누적량 제어가 필요하다. |
| 30초 간격 B안에 가장 잘 맞는다. | `/frontend` 밖 수정이 필요하므로 사용자 확인 후 진행해야 한다. |

판단: 추천안.

### C안. 외부 Python CLI 시연 도구

별도 스크립트가 REST API를 호출해 센서 생성과 async-run을 반복한다.

| 장점 | 단점 |
|---|---|
| 서버 코드 변경이 적다. | 발표 당일 터미널, 패키지, 포트, 실행 순서에 민감하다. |
| 실패 시 종료하기 쉽다. | dev server와 생명주기가 분리되어 재현성이 낮다. |
| 수동 제어가 쉽다. | 발표자가 별도 프로세스를 기억해야 한다. |

판단: 보조 도구 또는 백업용으로는 가능하지만 메인 시연 장치로는 덜 안전하다.

### D안. Frontend-only mock animation

프론트에서 mock 이벤트를 만들어 화면만 바꾼다.

| 장점 | 단점 |
|---|---|
| 화면 연출은 가장 빠르고 부드럽다. | DB, AI, WebSocket 통합 시연이 아니다. |
| 실제 분석 지연이 없다. | 발표에서 백엔드/AI 연동 설명과 어긋날 수 있다. |
| 모바일 UX 확인에는 좋다. | 실제 API 결과와 다르게 보일 위험이 있다. |

판단: 백업 화면용으로만 고려한다.

## 6. 추천 방향

추천은 B안이다.

```text
Backend demo simulator
+ 환경 변수로 dev에서만 활성화
+ 30초 tick
+ tick당 1개 하수구 변경
+ 고정 시나리오 순환
+ 기존 async analysis 호출
+ 기존 WebSocket 이벤트로 Frontend 갱신
```

발표 안정성을 위해 실제 YOLO 분석과 mock 분석을 분리해서 선택할 수 있게 한다.

| 모드 | 설명 | 추천 사용처 |
|---|---|---|
| `mock-ai` | mock AI server 또는 규칙 기반 callback으로 빠르게 결과를 만든다. | 발표 본시연 |
| `real-ai` | AI Service 실제 YOLO/OpenCV/XGBoost 흐름을 탄다. | 기술 검증 시연, 발표 전 녹화 |
| `manual` | Swagger로 특정 drain만 수동 실행한다. | 장애 시 백업 |

## 7. 필요한 수정 범위

### 7.1 Backend

| 파일/영역 | 필요한 작업 |
|---|---|
| `backend/app/core/config.py` | `DEMO_SIMULATOR_ENABLED`, `DEMO_SIMULATOR_INTERVAL_SECONDS`, `DEMO_SIMULATOR_MODE`, `DEMO_SIMULATOR_START_DELAY_SECONDS` 같은 설정 추가 |
| `backend/app/main.py` | startup/shutdown에서 demo simulator task 시작/중지 |
| `backend/app/services/demo_simulator.py` | 5개 하수구 시나리오, tick loop, 센서 생성, async analysis 호출 구현 |
| `backend/app/services/sensor_service.py` | 기존 create service 재사용 가능 여부 확인. 직접 model 생성 시 트랜잭션 기준 정리 |
| `backend/app/services/analysis_async_service.py` | demo trigger type 또는 image URL 정책 확장 필요 여부 확인 |
| `backend/app/models/analysis_job.py` | 현재 `trigger_type`은 문자열이므로 `demo` 저장 가능 여부 확인. DB 제약이 없으면 migration 불필요 |
| `docker-compose.dev.yml` | 개발 환경에서 demo simulator를 켤 env 주입 여부 결정 |

### 7.2 AI Service

| 파일/영역 | 필요한 작업 |
|---|---|
| `ai_service/image_source/constants.py` | real-ai에서 상태별 이미지를 쓰려면 drain별 단일 이미지 매핑을 확장해야 한다. |
| `mock_data/ai_image_samples` | 상태별 이미지 세트 추가 시 파일명 규칙 정리 |
| `mock_ai_server/main.py` 또는 `ai_service` | 발표 본시연은 mock-ai를 쓸지 real-ai를 쓸지 결정 필요 |

### 7.3 Frontend

| 파일/영역 | 필요한 작업 |
|---|---|
| `frontend/components/realtime-drain-sync.tsx` | 상세 페이지 열림 상태에서 이벤트 후 detail/latest/history query invalidate가 충분한지 확인 |
| `frontend/lib/api/adapters.ts` | `YOLO_RESULT_UPDATED.imageUrl`과 `DRAIN_STATUS_UPDATED` 병합이 발표 화면에 충분한지 확인 |
| `frontend/components/cctv-snapshot-card.tsx` | 이미지 URL 변경 시 fallback/preview가 자연스럽게 보이는지 확인 |
| `frontend/app/drains/[id]/page.tsx` | 상세 페이지에서 실시간 이벤트 후 최신 분석 카드와 히스토리가 갱신되는지 확인 |
| `frontend/docs` | 구현 후 step/pr 문서 추가 |

### 7.4 문서/운영

| 파일/영역 | 필요한 작업 |
|---|---|
| `README.md` 또는 frontend 배포 문서 | dev 시연 실행 명령과 env 예시 추가 여부 결정 |
| `frontend/docs/test` | 시연 체크리스트와 실패 시 백업 절차 추가 |

## 8. 시나리오 초안

30초마다 한 하수구만 변경하는 흐름을 기본으로 한다.

| tick | 변경 대상 | 상태 변화 | 센서값 예시 |
|---:|---|---|---|
| 0 | DR-002 | good -> caution | water 52cm, flow 0.48m/s |
| 1 | DR-003 | caution -> danger | water 78cm, flow 0.18m/s |
| 2 | DR-004 | danger -> caution | water 58cm, flow 0.42m/s |
| 3 | DR-005 | unknown 유지 또는 복구 시도 | water 0~20cm, flow 0.0~0.8m/s |
| 4 | DR-001 | good -> caution | water 48cm, flow 0.55m/s |
| 5 | DR-002 | caution -> danger | water 82cm, flow 0.12m/s |
| 6 | DR-003 | danger -> caution | water 60cm, flow 0.35m/s |
| 7 | DR-004 | caution -> good | water 25cm, flow 1.10m/s |
| 8 | DR-001 | caution -> good | water 22cm, flow 1.20m/s |
| 9 | 전체 | 다음 루프로 반복 |  |

센서값은 mock AI 기준과 실제 XGBoost 입력을 모두 고려해 다음 범위를 우선 사용한다.

| 상태 | waterLevelCm | flowVelocityMps | 의도 |
|---|---:|---:|---|
| good | 15~35 | 0.9~1.4 | 정상 흐름 |
| caution | 45~65 | 0.35~0.7 | 일부 막힘 또는 수위 상승 |
| danger | 75~90 | 0.05~0.25 | 침수 위험 |
| unknown | 0~20 또는 이미지 실패 | 0.0~0.3 | 판단 불가 |

### 8.1 발표 영상용 추천 시나리오

사용자 목표를 기준으로 자동 시연은 다음 순서로 나누는 것이 좋다.

#### Phase 1. 메인 화면 overview

5개 하수구를 seed 데이터처럼 서로 다른 대표 상태로 보여준다. 이 단계는 발표 영상 첫 장면에 적합하다.

| 하수구 | 초기 상태 | 의도 | 이미지 전략 |
|---|---|---|---|
| DR-001 | good | 정상 시설 기준점 | 깨끗한 하수구 이미지 |
| DR-002 | caution | 일부 막힘 또는 수위 상승 | 잎/작은 쓰레기 이미지 |
| DR-003 | good 또는 caution | 이후 상세 시나리오의 주인공 | 상태 변화용 이미지 |
| DR-004 | danger | 긴급 대응 대상 | 물 고임/막힘 이미지 |
| DR-005 | unknown | 이미지 품질 저하 또는 판단 불가 | 흐림/렌즈 오염/수집 실패 이미지 |

이 단계의 목표는 다음 UI가 한 화면에서 구분되는지 확인하는 것이다.

| UI 영역 | 확인할 내용 |
|---|---|
| 요약 카드 | good/caution/danger/unknown 개수가 상태와 맞게 보이는지 |
| 위험 목록 | 위험도가 높은 하수구가 상단에 올라오는지 |
| 지도 마커 | 상태 색상과 선택 표시가 자연스러운지 |
| 선택 패널 | 선택된 하수구의 수위, 유속, 막힘률, 이미지가 최신 상태로 보이는지 |

#### Phase 2. 단일 하수구 상태 변화 story

대표 하수구 하나를 골라 모든 경우의 수를 순서대로 보여준다. 현재 대화 기준으로는 DR-003이 적합하다.

| 순서 | DR-003 상태 | waterLevelCm | flowVelocityMps | 화면에서 보여줄 포인트 |
|---:|---|---:|---:|---|
| 1 | good | 24 | 1.15 | 정상 흐름, 낮은 위험도 |
| 2 | caution | 55 | 0.45 | 수위 상승, 일부 막힘 |
| 3 | danger | 82 | 0.12 | 위험 목록 상단 이동, 긴급 상태 표시 |
| 4 | unknown | 0 또는 18 | 0.00 또는 0.20 | 이미지/센서 신뢰도 문제로 판단 불가 |
| 5 | caution 또는 good | 48 또는 26 | 0.55 또는 1.05 | 복구 또는 모니터링 전환 |

이 단계는 30초 간격보다 조금 짧은 별도 캡처 모드가 필요할 수 있다. 발표 영상 촬영 목적이라면 두 가지 옵션을 둔다.

| 옵션 | 간격 | 용도 | 판단 |
|---|---:|---|---|
| 모바일 실제 사용감 | 30초 | 실제 사용자처럼 천천히 변화 확인 | 기본 추천 |
| 영상 캡처 압축 | 10~15초 | 발표 영상 길이를 줄이기 위한 녹화용 | 별도 env로만 허용 |

기본 개발 서버 시연은 30초를 유지하고, 영상 캡처용으로만 `DEMO_SIMULATOR_INTERVAL_SECONDS=10` 또는 `15`를 임시 설정하는 방식이 좋다.

#### Phase 3. 상세 화면 누적 확인

DR-003 상세 화면에서 지금까지 들어온 값이 어떻게 쌓이는지 보여준다.

| 상세 화면 영역 | 기대 변화 |
|---|---|
| 상단 상태 요약 | 최신 riskLevel, riskScore, finalDecision 반영 |
| 센서 차트 | 상태 변화 순서대로 waterLevelCm, flowVelocityMps 포인트 누적 |
| CCTV/YOLO 영역 | 상태별 이미지 또는 최신 drain image 표시 |
| XGBoost 카드 | 최신 위험도 판단과 참조 sensor/yolo id 표시 |
| 위험 이력 | good -> caution -> danger -> unknown 같은 변화 이력 누적 |
| 분석 이력 | YOLO/XGBoost 결과가 시간순으로 추가 |

이 목표를 만족하려면 frontend 상세 화면이 WebSocket 이벤트만으로 충분히 갱신되는지 확인해야 한다. 부족하면 이벤트 수신 후 detail, sensors, risk-history, analysis-history query invalidate를 추가하는 것이 필요하다.

## 9. 이미지 전략

현재 AI Service는 `drain_1.jpg`~`drain_5.jpg` 단일 매핑이다. 따라서 이미지 전략은 두 단계로 나누는 것이 좋다.

### 9.1 1차 구현

상태별 이미지 순환 없이 기존 파일명을 사용한다.

```text
drain_1.jpg
drain_2.jpg
drain_3.jpg
drain_4.jpg
drain_5.jpg
```

장점은 코드 변경이 적고 실제 YOLO 분석 흐름을 바로 쓸 수 있다는 점이다.

### 9.2 2차 구현

상태별 이미지 파일을 추가한다.

```text
drain_1_good.jpg
drain_1_caution.jpg
drain_1_danger.jpg
...
drain_5_unknown.jpg
```

이 경우 필요한 설계는 둘 중 하나다.

| 방식 | 설명 | 판단 |
|---|---|---|
| 파일 교체 방식 | tick마다 `drain_3.jpg` 내용을 상태별 이미지로 덮어쓴다. | dev에서는 가능하지만 파일 변경 부작용이 커서 비추천 |
| image source 확장 | AI Service가 demo 상태에 따라 다른 파일을 읽는다. | 명확하지만 payload/설정 확장이 필요 |
| backend display URL만 변경 | 실제 AI 입력은 고정, 프론트 표시 이미지만 상태별 URL로 저장한다. | 발표 연출에는 좋지만 실제 YOLO 입력과 표시 이미지가 달라질 수 있음 |

추천은 1차는 기존 `drain_N.jpg`로 진행하고, 2차에서 image source 확장을 별도 작업으로 분리하는 것이다.

## 10. 사용자 확인이 필요한 사항

구현 전 다음 사항은 확정이 필요하다.

| 번호 | 확인 사항 | 선택지 | 추천 |
|---:|---|---|---|
| 1 | 본시연 분석 모드 | `mock-ai`, `real-ai`, 혼합 | 본시연은 `mock-ai`, 기술 검증은 `real-ai` |
| 2 | tick 간격 | 20초, 30초, 45초 | 모바일 기준 30초 |
| 3 | tick당 변경 수 | 1개, 2개, 전체 5개 | 1개 |
| 4 | 자동 시작 방식 | 서버 시작 즉시, delay 후 시작, API로 시작/중지 | env 활성화 + 10초 delay |
| 5 | 시연 대상 | 5개 전체, DR-003 중심, 위험 하수구 중심 | 5개 전체 순환, DR-003은 실제 YOLO 검증용 강조 |
| 6 | 이미지 전략 | 기존 5장, 상태별 15장, 표시 이미지만 확장 | 1차 기존 5장, 2차 15장 |
| 7 | DB 누적 정책 | 계속 누적, 최근 N개만 유지, 시연 전 초기화 | 발표 전 seed/초기화 절차 문서화 |
| 8 | 상세 페이지 실시간 갱신 | 현재 수준 유지, query invalidate 보강 | 상세 발표가 있다면 보강 |

## 11. 구현 단계 제안

### Step 1. 문서 승인

이 문서의 추천 방향과 사용자 확인 사항을 확정한다.

완료 기준:

- 시연 모드, tick 간격, tick당 변경 수 확정
- 이미지 전략 1차/2차 범위 확정
- `/frontend` 밖 수정 승인

### Step 2. Backend demo simulator 1차 구현

Backend에 개발 전용 simulator를 추가한다.

완료 기준:

- env가 꺼져 있으면 아무 일도 하지 않는다.
- env가 켜져 있으면 startup delay 후 30초마다 tick이 돈다.
- tick마다 지정된 drain에 sensor_data가 생성된다.
- 기존 async analysis service가 호출된다.
- 실패해도 loop 전체가 죽지 않고 로그를 남긴다.

### Step 3. Compose dev env 연결

개발 compose에서 demo env를 쉽게 켤 수 있게 한다.

완료 기준:

- 기본값은 off다.
- `.env` 또는 compose env로 켤 수 있다.
- README 또는 test 문서에 실행 명령이 남는다.

### Step 4. Frontend 반영 확인과 필요한 보강

대시보드와 상세 페이지에서 이벤트 반영을 확인한다.

완료 기준:

- 대시보드 목록, 지도, 선택 패널이 30초 tick에 맞춰 바뀐다.
- 상세 페이지에서 센서 차트, 최신 분석, 이미지, 히스토리 반영 범위를 확인한다.
- 부족하면 query invalidate 또는 event merge를 보강한다.

### Step 5. 발표 리허설 체크리스트 작성

시연 시작, 중지, 장애 대응, 백업 Swagger 절차를 문서화한다.

완료 기준:

- dev 시연 시작 명령이 있다.
- 시연 중 확인할 화면이 정리되어 있다.
- 실패 시 수동 Swagger 절차가 있다.

## 12. 검증 계획

| 검증 | 명령/방법 | 기대 결과 |
|---|---|---|
| Python syntax | `python -m compileall backend ai_service mock_ai_server` | 문법 오류 없음 |
| Docker dev boot | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` | backend, ai-service, frontend, nginx 정상 |
| Seed | `docker compose --profile seed run --rm seed` | 5개 drain 존재 |
| Simulator off | env off 상태로 부팅 | 자동 sensor/job 생성 없음 |
| Simulator on | env on 상태로 부팅 | 30초마다 sensor/job 생성 |
| Callback | backend logs, DB `analysis_jobs` | completed job 생성 |
| WebSocket | Chrome DevTools Network WS | 3개 이벤트 수신 |
| Dashboard | `http://localhost:8080` | 지도/목록/요약 갱신 |
| Detail | `http://localhost:8080/drains/DR-003` | 최신 센서/분석 반영 |
| Mobile | 브라우저 모바일 viewport | 변화 속도가 산만하지 않음 |

## 13. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 실제 YOLO가 느림 | WebSocket 갱신이 몇 초 이상 늦게 보일 수 있음 | 발표 본시연은 mock-ai 권장, real-ai는 기술 검증 장면으로 분리 |
| 중복 active job | 같은 drain에 processing job이 있으면 다음 tick 분석이 skip되거나 실패할 수 있음 | demo simulator에서 active job 확인 또는 tick 간격 유지 |
| DB 데이터 누적 | 반복 시연 후 history가 길어진다. | 발표 전 seed/초기화 절차 마련 |
| 이미지 URL 404 | 상세 CCTV 이미지가 깨질 수 있다. | `/api/mock-images/drain_N.jpg` 기준으로 우선 통일 |
| 상세 화면 즉시 갱신 부족 | 대시보드는 바뀌지만 상세 history가 늦을 수 있음 | query invalidate 보강 |
| 개발 env가 운영에 섞임 | 운영 서버에서 demo가 돌 수 있음 | 기본 off, `DEMO_SIMULATOR_ENABLED=true`일 때만 실행, production compose에는 미설정 |
| 발표 중 예측 불가 랜덤 | 설명과 화면이 어긋난다. | 고정 시나리오 + 작은 jitter만 사용 |

## 14. 추천 최종 방향

1차 구현은 다음 범위로 진행하는 것을 추천한다.

```text
Backend demo simulator 추가
DEMO_SIMULATOR_ENABLED=false 기본값
DEMO_SIMULATOR_INTERVAL_SECONDS=30
DEMO_SIMULATOR_START_DELAY_SECONDS=10
overview 모드로 5개 drain의 대표 상태 구성
single-drain-story 모드로 DR-003 상태 변화 연출
기본 tick당 1개 drain 변경
기존 drain_N.jpg 이미지 유지
기존 async analysis + callback + WebSocket 사용
메인 목록/지도/선택 패널 실시간 반영 확인
상세 화면 센서/위험/분석 이력 query 갱신 보강
```

2차 구현은 발표 이미지 준비 상황에 맞춰 진행한다.

```text
상태별 이미지 15장 추가
AI image source 또는 backend display image URL 정책 확장
상세 페이지 이미지 갱신 검증
모바일 리허설
```

발표 영상 촬영 흐름은 다음 순서로 고정하는 것을 추천한다.

```text
1. 메인 대시보드 진입
2. 5개 하수구가 good/caution/danger/unknown으로 구분된 overview 장면 캡처
3. DR-003 선택
4. DR-003 상세 화면 진입
5. DR-003 good -> caution -> danger -> unknown 변화 캡처
6. 센서 차트와 분석/위험 이력이 누적되는 장면 캡처
7. 필요하면 메인으로 돌아와 목록 정렬과 지도 마커 변화 재확인
```

## 15. 구현 전 사용자 확인 요청

다음 답변을 받은 뒤 코드 구현에 들어가는 것이 안전하다.

1. 본시연은 `mock-ai` 안정 모드로 가고, 실제 YOLO는 별도 검증 장면으로 둘까요?
2. tick 간격은 30초, tick당 변경은 1개로 확정할까요?
3. 1차 구현에서는 기존 `drain_1.jpg`~`drain_5.jpg`만 사용하고, 상태별 이미지는 2차로 분리할까요?
4. `/frontend` 밖 backend, ai_service, docker compose dev 파일 수정까지 허용할까요?
5. 상세 페이지 실시간 갱신까지 발표에 포함하나요, 아니면 대시보드 중심인가요?
6. 대표 단일 하수구는 DR-003으로 확정할까요?
7. 영상 캡처용으로만 10~15초 빠른 모드를 별도 env로 허용할까요?

## 16. 예상 산출물

| 산출물 | 설명 |
|---|---|
| `backend/app/services/demo_simulator.py` | 개발 전용 자동 시연 loop |
| `backend/app/core/config.py` 수정 | demo env 설정 |
| `backend/app/main.py` 수정 | startup/shutdown 연결 |
| `docker-compose.dev.yml` 또는 `.env.example` 수정 | dev 활성화 옵션 |
| Frontend query 보강 | 필요 시 상세 화면 최신화 |
| `frontend/docs/steps/step-26-dev-demo-automation-module.md` | 구현 후 결과 기록 |
| `frontend/docs/pr/pr-26-dev-demo-automation-module.md` | PR 요약 |

## 17. 제안 커밋 메시지

제목:

```text
docs: 개발 서버 시연 자동화 계획 추가
```

내용:

```text
- 5개 하수구 자동 시연 모듈의 추천 방향을 정리했다.
- backend demo simulator, AI 모드, 이미지 전략, frontend 반영 범위를 나눠 기록했다.
- 구현 전 사용자 확인이 필요한 사항과 검증 계획을 문서화했다.
```

## 18. 구현 후 결정 사항

사용자 확인 후 발표 브랜치에서는 dev merge 시 별도 환경변수 주입 없이 시연이 바로 동작하도록 `docker-compose.dev.yml`에 demo simulator 값을 직접 넣는 방향으로 확정했다.

```yaml
DEMO_SIMULATOR_ENABLED: "true"
DEMO_SIMULATOR_MODE: "direct"
DEMO_SIMULATOR_INTERVAL_SECONDS: "30"
DEMO_SIMULATOR_START_DELAY_SECONDS: "10"
DEMO_SIMULATOR_TARGET_DRAIN_CODE: "DR-003"
```

이 값은 발표용 임시 설정이므로 발표 종료 후 `DEMO_SIMULATOR_ENABLED`를 `"false"`로 바꾸거나 demo block을 제거한다. 안전한 예시 파일인 `.env.example`, `backend/.env.example`은 기본 off 값을 유지한다.
