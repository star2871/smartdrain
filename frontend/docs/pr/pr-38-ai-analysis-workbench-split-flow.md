## PR 제목

[feat] AI 분석 워크벤치 실행 흐름 분리

## 작업 내용

- AI 분석 검증 워크벤치에서 best.pt 기반 YOLO 이미지 분석과 XGBoost 최종 판단 실행을 분리했습니다.
- 사용자가 같은 이미지의 YOLO 결과를 유지한 채 수위·유속 값만 바꿔 XGBoost 최종 위험도 변화를 반복 확인할 수 있게 했습니다.
- 이미지 업로드 제한을 50MB로 상향하고, 프론트·Backend·AI Service·Nginx 제한값을 맞췄습니다.
- 50MB 초과 이미지를 선택하거나 서버에서 413 응답이 돌아오면 사용자가 알 수 있도록 팝업 안내를 추가했습니다.
- `/demo-control` 수동 시연에서 preset별 지정 이미지는 유지하되, 수위와 유속을 직접 입력해 적용할 수 있게 했습니다.
- 수동 시연 기본 수위·유속은 DB에 저장하지 않고 환경 변수로 관리하도록 추가했습니다.
- `plan-33`에 추가 요구사항을 간략히 반영하고, `step-49`에 구현 흐름과 검증 결과를 상세히 기록했습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| AI 워크벤치 UI | `frontend/app/ai-analysis-workbench/page.tsx` |
| Demo 제어 UI | `frontend/app/demo-control/page.tsx` |
| Frontend API | `frontend/lib/api/ai-analysis-workbench.ts`, `frontend/lib/api/demo.ts`, `frontend/lib/api/types.ts` |
| Backend demo API | `backend/app/routers/demo.py`, `backend/app/services/ai_client.py` |
| Backend demo 설정 | `backend/app/core/config.py`, `backend/app/services/demo_simulator.py` |
| AI Service preview | `ai_service/analysis/preview_service.py`, `ai_service/http/routes.py` |
| 업로드 제한/환경 변수 | `.env.example`, `backend/.env.example`, `docker-compose.yml`, `docker-compose.dev.yml`, `nginx/default.conf`, `nginx/default.dev.conf` |
| 문서 | `frontend/docs/plans/plan-33-ai-analysis-workbench-page.md`, `frontend/docs/steps/step-49-ai-analysis-workbench-page.md` |

## 변경 전/후

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| AI 워크벤치 실행 | 이미지와 센서값을 한 번에 보내 YOLO/XGBoost 결과를 받음 | YOLO 이미지 분석 후, 화면에 보관된 YOLO 결과와 센서값으로 XGBoost 최종 판단 실행 |
| 이미지 업로드 제한 | 10MB 기준 | 50MB 기준 |
| 큰 이미지 오류 | 413 응답만 표시될 수 있음 | 프론트 사전 차단 및 413 응답 팝업 안내 |
| Demo 수동 시연 | preset 고정값의 수위·유속 사용 | 사용자가 입력한 수위·유속 사용 |
| 수동 시연 기본값 | 코드의 기본값에 의존 | 환경 변수로 기본 수위·유속 조정 |

## 검증 결과

- `npm.cmd run lint` 통과
  - 기존 `frontend/components/fallback-image.tsx`의 native `<img>` 경고 1건 유지
- `npm.cmd run build` 통과
  - `/ai-analysis-workbench`, `/demo-control` 라우트 빌드 확인
- Python 변경 파일 AST 문법 확인 통과
  - `ai_service/analysis/preview_service.py`
  - `ai_service/http/routes.py`
  - `backend/app/core/config.py`
  - `backend/app/routers/demo.py`
  - `backend/app/services/ai_client.py`
  - `backend/app/services/demo_simulator.py`
- `git diff --check` 통과

## 비고

- `python -m compileall ai_service backend/app`는 현재 로컬 작업환경에서 `.venv`와 기존 `__pycache__`까지 순회하며 권한 오류가 발생해 변경 파일만 대상으로 문법 확인했습니다.
- 실제 YOLO/XGBoost 추론은 `ai_service/model/best.pt`와 XGBoost 모델 파일이 있어야 동작합니다.
- `/demo-control` 수동 시연은 센서값만 직접 입력하고, 위험도와 이미지는 선택한 preset 기준을 유지합니다.

## 리뷰 포인트

- 워크벤치에서 YOLO 이미지 분석 후 XGBoost 최종 판단 버튼이 순서대로 자연스럽게 동작하는지 확인합니다.
- 같은 YOLO 결과에서 수위·유속만 바꿨을 때 XGBoost 결과가 갱신되는지 확인합니다.
- 50MB 초과 파일 선택 시 팝업 안내가 표시되는지 확인합니다.
- Nginx를 경유한 업로드에서도 50MB 이하 이미지가 413 없이 Backend까지 전달되는지 확인합니다.
- `/demo-control` 수동 preset 적용 시 입력한 수위·유속이 대시보드와 상세 화면에 반영되는지 확인합니다.
- 환경 변수 기본값 변경 후 demo status와 수동 시연 입력 초기값이 기대대로 표시되는지 확인합니다.
