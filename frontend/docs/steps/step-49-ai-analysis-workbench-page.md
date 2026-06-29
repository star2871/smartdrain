# 49 AI 분석 검증 워크벤치 페이지 구현 결과

## 작업 목표

발표용 이미지 후보를 고르기 위해 사용자가 이미지를 업로드하고, 임의의 수위·유속 값을 입력한 뒤 실제 YOLO 분석 결과와 XGBoost 판단 결과를 한 화면에서 확인할 수 있게 했다.

이번 범위에서는 대시보드 반영, DB 저장, WebSocket 갱신은 제외했다.

## 변경 내용

| 영역 | 파일 | 변경 내용 |
| --- | --- | --- |
| Frontend | `app/ai-analysis-workbench/page.tsx` | 이미지 업로드, 센서값 입력, 분석 실행, 결과 표시, 최근 8건 비교 UI 추가 |
| Frontend | `lib/api/ai-analysis-workbench.ts` | `/api/demo/ai-analysis/preview` multipart 요청 함수 추가 |
| Frontend | `lib/api/types.ts` | AI preview 분석 응답 DTO 추가 |
| Backend | `app/routers/demo.py` | demo token으로 보호되는 `/api/demo/ai-analysis/preview` endpoint 추가 |
| Backend | `app/services/ai_client.py` | AI 서비스 preview endpoint로 이미지와 센서값을 전달하는 client 함수 추가 |
| AI Service | `analysis/preview_service.py` | 업로드 이미지 경로로 YOLO를 실행하고 XGBoost 결과를 즉시 반환하는 preview service 추가 |
| AI Service | `http/routes.py` | `/ai/analysis/preview` multipart endpoint 추가 |

## 동작 흐름

```text
Frontend /ai-analysis-workbench
-> POST /api/demo/ai-analysis/preview
-> Backend가 token과 이미지 파일 검증
-> Backend가 AI Service /ai/analysis/preview 호출
-> AI Service가 임시 파일로 이미지 저장
-> YOLO 분석 실행
-> YOLO 결과와 수위·유속으로 XGBoost 판단
-> Backend ApiResponse로 결과 반환
-> Frontend가 결과 카드와 최근 비교 목록 표시
```

## 화면 기능

| 기능 | 설명 |
| --- | --- |
| 이미지 업로드 | jpg, png, webp 파일을 최대 10MB까지 선택 |
| 미리보기 | 선택한 이미지를 화면에서 즉시 확인 |
| 센서 입력 | 수위는 0~120cm, 유속은 0~3m/s 범위로 숫자 입력과 슬라이더 제공 |
| 분석 결과 | YOLO 막힘률, 신뢰도, 상태와 XGBoost 위험도, 위험 점수, 최종 판단 표시 |
| Feature 확인 | XGBoost에 들어간 정규화 feature 값을 표시 |
| 최근 비교 | 최근 8건의 이미지, 센서값, YOLO, XGBoost 결과를 비교 |

## 운영 조건

| 항목 | 조건 |
| --- | --- |
| Frontend 경로 | `/ai-analysis-workbench` |
| Backend endpoint | `/api/demo/ai-analysis/preview` |
| AI Service endpoint | `/ai/analysis/preview` |
| 접근 제어 | 기존 demo token 정책 사용 |
| 필요 환경 | `DEMO_SIMULATOR_ENABLED=true`, `DEMO_CONTROL_TOKEN` 설정, `AI_SERVER_ENABLED=true` |
| AI 모델 | AI 서비스의 YOLO 모델 파일과 XGBoost 모델 파일 필요 |

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm.cmd run lint` | 통과. 기존 `components/fallback-image.tsx`의 native `<img>` 경고 1건 유지 |
| `npm.cmd run build` | 통과. `/ai-analysis-workbench` 라우트 생성 확인 |
| `python -m compileall ai_service backend/app` | 통과 |

## 남은 리스크

| 리스크 | 내용 |
| --- | --- |
| 실제 모델 파일 | AI 서비스에 `ai_service/model/best.pt`와 XGBoost 모델 파일이 없으면 preview 분석이 실패할 수 있다. |
| 실행 시간 | YOLO 모델 로딩과 추론 시간이 길면 프론트 요청이 timeout 될 수 있다. 현재 프론트 요청 timeout은 45초다. |
| 접근 조건 | Backend demo access 정책을 재사용하므로 demo token과 simulator enabled 설정이 필요하다. |
| 결과 저장 | 최근 비교 목록은 브라우저 상태에만 존재하므로 새로고침하면 사라진다. |
| 대시보드 반영 | 이번 작업에서는 의도적으로 제외했다. 후보 확정 후 별도 적용 API로 확장한다. |

## 제안 커밋 메시지

제목:

```text
feat: AI 분석 검증 워크벤치 추가
```

내용:

```text
- 이미지 업로드와 수위·유속 입력으로 AI preview 분석을 실행하는 페이지를 추가한다.
- Backend demo API가 AI Service preview endpoint를 프록시하도록 연결한다.
- AI Service에 callback 없이 YOLO/XGBoost 결과를 즉시 반환하는 preview endpoint를 추가한다.
```
