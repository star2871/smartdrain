# 49 AI 분석 검증 워크벤치 페이지 구현 결과

## 작업 목표

발표용 이미지 후보를 고르기 위해 사용자가 이미지를 업로드하고, 임의의 수위·유속 값을 입력한 뒤 실제 YOLO 분석 결과와 XGBoost 판단 결과를 한 화면에서 확인할 수 있게 했다.

추가 개선으로 best.pt 기반 YOLO 이미지 분석과, YOLO 결과 및 사용자가 지정한 수위·유속을 입력으로 쓰는 XGBoost 최종 판단을 분리했다. 같은 이미지를 한 번 분석한 뒤 센서값만 바꿔 최종 위험도 변화를 반복 확인할 수 있게 하기 위한 변경이다.

이번 범위에서는 대시보드 반영, DB 저장, WebSocket 갱신은 제외했다.

## 변경 내용

| 영역 | 파일 | 변경 내용 |
| --- | --- | --- |
| Frontend | `app/ai-analysis-workbench/page.tsx` | 이미지 업로드, 센서값 입력, 분석 실행, 결과 표시, 최근 8건 비교 UI 추가 |
| Frontend | `app/ai-analysis-workbench/page.tsx` | YOLO 이미지 분석 버튼과 XGBoost 최종 판단 버튼 분리, 50MB 초과 이미지 팝업 안내 추가 |
| Frontend | `app/demo-control/page.tsx` | 수동 시연 preset 적용 시 수위·유속을 직접 입력하도록 UI 추가 |
| Frontend | `lib/api/ai-analysis-workbench.ts` | 통합 preview 호출에 더해 `/preview/yolo`, `/preview/xgboost` 분리 호출 함수 추가 |
| Frontend | `lib/api/demo.ts` | 수동 preset 요청에 `waterLevelCm`, `flowVelocityMps` 전달 |
| Frontend | `lib/api/types.ts` | YOLO preview DTO, XGBoost preview DTO, 통합 preview DTO 분리 |
| Backend | `app/routers/demo.py` | demo token으로 보호되는 통합 preview, YOLO preview, XGBoost preview endpoint 제공 |
| Backend | `app/services/ai_client.py` | AI 서비스의 통합/YOLO/XGBoost preview endpoint 호출 함수 추가 |
| Backend | `app/services/demo_simulator.py` | 수동 preset에 입력 센서값을 반영하고 없으면 환경 변수 기본값 사용 |
| Backend | `app/core/config.py` | `DEMO_MANUAL_DEFAULT_WATER_LEVEL_CM`, `DEMO_MANUAL_DEFAULT_FLOW_VELOCITY_MPS` 설정 추가 |
| Infra | `nginx/default.conf`, `nginx/default.dev.conf` | `client_max_body_size 50m` 설정으로 Nginx 413 차단 완화 |
| Infra | `.env.example`, `backend/.env.example`, `docker-compose*.yml` | 수동 시연 기본 센서값 환경 변수와 backend 주입값 추가 |
| AI Service | `analysis/preview_service.py` | YOLO 분석과 XGBoost 판단 함수를 분리하고 통합 함수는 두 함수를 조합 |
| AI Service | `http/routes.py` | `/ai/analysis/preview`, `/ai/analysis/preview/yolo`, `/ai/analysis/preview/xgboost` endpoint 제공 |

## 동작 흐름

```text
Frontend /ai-analysis-workbench
-> POST /api/demo/ai-analysis/preview/yolo
-> Backend가 token과 이미지 파일 검증
-> Backend가 AI Service /ai/analysis/preview/yolo 호출
-> AI Service가 임시 파일로 이미지 저장
-> best.pt로 YOLO 분석 실행
-> Backend ApiResponse로 YOLO 결과 반환
-> Frontend가 YOLO 결과를 화면에 보관
-> 사용자가 수위·유속 조정
-> POST /api/demo/ai-analysis/preview/xgboost
-> Backend가 AI Service /ai/analysis/preview/xgboost 호출
-> AI Service가 YOLO 결과와 센서값으로 XGBoost 판단
-> Frontend가 최종 결과 카드와 최근 비교 목록 표시
```

기존 통합 endpoint 흐름도 호환용으로 유지한다.

```text
Frontend /ai-analysis-workbench 또는 외부 테스트 도구
-> POST /api/demo/ai-analysis/preview
-> Backend가 token과 이미지 파일 검증
-> Backend가 AI Service /ai/analysis/preview 호출
-> AI Service가 YOLO 분석 후 XGBoost 판단까지 한 번에 실행
-> Backend ApiResponse로 결과 반환
```

## 화면 기능

| 기능 | 설명 |
| --- | --- |
| 이미지 업로드 | jpg, png, webp 파일을 최대 50MB까지 선택 |
| 큰 이미지 안내 | 50MB 초과 파일 선택 또는 서버 413 응답 시 팝업으로 안내 |
| 미리보기 | 선택한 이미지를 화면에서 즉시 확인 |
| 센서 입력 | 수위는 0~120cm, 유속은 0~3m/s 범위로 숫자 입력과 슬라이더 제공 |
| YOLO 분석 | best.pt 모델로 이미지 분석을 먼저 실행하고 막힘률, 신뢰도, 상태 표시 |
| XGBoost 판단 | 화면의 YOLO 결과와 사용자가 지정한 수위·유속으로 최종 위험도 계산 |
| 분석 결과 | YOLO 막힘률, 신뢰도, 상태와 XGBoost 위험도, 위험 점수, 최종 판단 표시 |
| Feature 확인 | XGBoost에 들어간 정규화 feature 값을 표시 |
| 최근 비교 | 최근 8건의 이미지, 센서값, YOLO, XGBoost 결과를 비교 |

## Demo 수동 시연 변경

`/demo-control`의 단일 빗물받이 수동 시연은 여전히 preset별 지정 이미지 경로를 사용한다. 다만 수위와 유속은 화면에서 직접 입력한 값을 사용한다.

| 항목 | 변경 후 |
| --- | --- |
| 이미지 | 기존 `_mock_image_url(drain_id, risk_level)` 흐름 유지 |
| 수위 | 화면 입력값을 `waterLevelCm`으로 전달 |
| 유속 | 화면 입력값을 `flowVelocityMps`로 전달 |
| 기본 수위 | `DEMO_MANUAL_DEFAULT_WATER_LEVEL_CM`, 기본 30cm |
| 기본 유속 | `DEMO_MANUAL_DEFAULT_FLOW_VELOCITY_MPS`, 기본 0.8m/s |
| 저장 정책 | 기본값은 DB에 저장하지 않고 환경 변수로만 관리 |

## 운영 조건

| 항목 | 조건 |
| --- | --- |
| Frontend 경로 | `/ai-analysis-workbench` |
| Backend endpoint | `/api/demo/ai-analysis/preview` |
| Backend 분리 endpoint | `/api/demo/ai-analysis/preview/yolo`, `/api/demo/ai-analysis/preview/xgboost` |
| AI Service endpoint | `/ai/analysis/preview` |
| AI Service 분리 endpoint | `/ai/analysis/preview/yolo`, `/ai/analysis/preview/xgboost` |
| 접근 제어 | 기존 demo token 정책 사용 |
| 필요 환경 | `DEMO_SIMULATOR_ENABLED=true`, `DEMO_CONTROL_TOKEN` 설정, `AI_SERVER_ENABLED=true` |
| AI 모델 | AI 서비스의 YOLO 모델 파일과 XGBoost 모델 파일 필요 |
| 업로드 제한 | 프론트, Backend, AI Service, Nginx 기준 50MB |
| 수동 시연 기본값 | `DEMO_MANUAL_DEFAULT_WATER_LEVEL_CM`, `DEMO_MANUAL_DEFAULT_FLOW_VELOCITY_MPS` |

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm.cmd run lint` | 통과. 기존 `components/fallback-image.tsx`의 native `<img>` 경고 1건 유지 |
| `npm.cmd run build` | 통과. `/ai-analysis-workbench` 라우트 생성 확인 |
| Python 변경 파일 AST 문법 확인 | 통과. 변경된 `ai_service`와 `backend/app` Python 파일 6개를 대상으로 확인 |

참고로 `python -m compileall ai_service backend/app`는 현재 작업환경에서 `.venv`와 기존 `__pycache__`까지 훑으며 권한 오류가 발생했다. 따라서 변경 파일만 대상으로 AST 문법 확인을 수행했다.

## 남은 리스크

| 리스크 | 내용 |
| --- | --- |
| 실제 모델 파일 | AI 서비스에 `ai_service/model/best.pt`와 XGBoost 모델 파일이 없으면 preview 분석이 실패할 수 있다. |
| 실행 시간 | YOLO 모델 로딩과 추론 시간이 길면 프론트 요청이 timeout 될 수 있다. 현재 프론트 요청 timeout은 45초다. |
| 접근 조건 | Backend demo access 정책을 재사용하므로 demo token과 simulator enabled 설정이 필요하다. |
| 결과 저장 | 최근 비교 목록은 브라우저 상태에만 존재하므로 새로고침하면 사라진다. |
| 대시보드 반영 | 이번 작업에서는 의도적으로 제외했다. 후보 확정 후 별도 적용 API로 확장한다. |
| 50MB 초과 파일 | 더 큰 원본 이미지는 여전히 업로드하지 않고 사용자가 리사이즈하거나 압축해야 한다. |
| 수동 시연 위험도 | `/demo-control` 수동 preset은 센서값만 직접 지정하며, 위험도와 이미지 상태는 선택한 preset 기준을 유지한다. |

## 제안 커밋 메시지

제목:

```text
feat: AI 분석 워크벤치 실행 흐름 분리
```

내용:

```text
- AI 분석 워크벤치에서 YOLO 이미지 분석과 XGBoost 최종 판단 실행을 분리한다.
- 50MB 이미지 업로드 제한을 프론트, Backend, AI Service, Nginx에 맞추고 초과 파일 팝업 안내를 추가한다.
- Demo 수동 preset에 사용자가 지정한 수위·유속을 반영하고 기본값은 환경 변수로 관리한다.
```
