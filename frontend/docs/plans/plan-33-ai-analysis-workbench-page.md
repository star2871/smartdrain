# 33 AI 분석 검증 워크벤치 페이지 계획

## 1. 작업 목표

발표용으로 사용할 빗물받이 이미지를 선별하기 위해, 사용자가 이미지를 업로드하고 임의의 센서값을 입력한 뒤 YOLO 분석 결과와 XGBoost 최종 판단을 한 화면에서 확인할 수 있는 전용 페이지를 추가한다.

기존 `/demo-control`은 발표자가 상태 preset과 자동 시나리오를 제어하는 화면이므로, 실제 이미지 후보를 비교하고 AI 분석값을 검증하는 용도와 분리한다.

## 2. 문제 정의

| 문제 | 영향 |
| --- | --- |
| 이미지 업로드 후 YOLO 분석 결과를 바로 확인할 전용 화면이 없다. | 발표에 적합한 이미지를 선별하기 어렵다. |
| 수위, 유속 값을 사용자가 직접 바꿔 XGBoost 결과 변화를 확인하기 어렵다. | 같은 이미지라도 센서값에 따라 위험도가 어떻게 달라지는지 설명하기 어렵다. |
| `/demo-control`은 시나리오 제어와 preset 적용 기능이 중심이다. | AI 결과 확인 화면으로 사용하면 기능이 중복되고 화면 흐름이 복잡해진다. |
| 결과를 실제 대시보드나 상세 화면에서 확인하려면 여러 페이지를 오가야 한다. | 발표 준비 중 이미지, 센서값, YOLO, XGBoost 결과를 빠르게 비교하기 어렵다. |
| 실제 AI 분석과 발표용 direct preset의 목적이 섞일 수 있다. | 발표 안정성과 모델 검증 목적이 서로 충돌한다. |

## 3. 확정 방향

새 페이지는 `/ai-analysis-workbench` 경로의 검증용 워크벤치로 만든다.

이 페이지는 운영 관리자 화면이 아니라 발표 준비자와 개발자가 사용하는 내부 도구로 본다. 사용자가 확인한 최종 목적은 이미지 후보 선별이므로 대시보드 상태 반영, WebSocket 발행, 특정 drain 저장은 1차 범위에서 제외한다.

| 항목 | 추천 |
| --- | --- |
| 페이지 성격 | AI 분석 검증 워크벤치 |
| 권장 경로 | `/ai-analysis-workbench` |
| 1차 목표 | 이미지 업로드, 센서값 입력, 실제 YOLO/XGBoost preview 결과 확인 |
| 2차 목표 | 선택 결과를 데모 데이터나 특정 빗물받이에 적용 |
| `/demo-control`과 관계 | 발표 상태 제어는 유지하고, AI 검증은 새 페이지로 분리 |
| 결과 저장 | 브라우저 세션의 최근 결과 비교 목록에만 임시 보관 |
| 접근 정책 | `/demo-control`과 같은 내부 접근 보호 권장 |

## 4. 사용자 확인 결과와 남은 확인 사항

이번 작업 전에 확인된 내용은 다음과 같다.

| 항목 | 확정 내용 |
| --- | --- |
| 주목적 | 사용자가 발표에 쓸 이미지를 고르는 것 |
| 대시보드 반영 | 이번 범위에서 제외하고 나중에 진행 |
| 수정 범위 | frontend 밖 backend, ai_service 수정 가능 |
| 목표 결과 | 실제 이미지를 올리면 분석 결과를 화면에서 확인 가능 |
| 추가 개선 | 큰 이미지 업로드 시 413 오류를 줄이고, 제한 초과는 화면 팝업으로 안내 |
| 분석 분리 | best.pt 기반 YOLO 이미지 분석과 센서값 기반 XGBoost 최종 판단을 분리 |
| 시연 제어 | `/demo-control` 수동 preset은 지정 이미지 경로를 유지하고 수위·유속만 직접 입력 |
| 수동 기본값 | 시연 제어 기본 수위·유속은 DB가 아니라 환경 변수로 관리 |

아래 항목은 구현 또는 운영 중 추가 확인이 필요하다.

| 확인 항목 | 선택지 | 추천 방향 |
| --- | --- | --- |
| 분석 방식 | 실제 AI 서버 호출 / 백엔드 테스트 API 호출 / 프론트 mock | 실제 AI 서버 preview endpoint를 호출한다. |
| 이미지 전달 방식 | multipart 업로드 / public URL 입력 / 기존 샘플 이미지 선택 | 1차는 multipart 업로드를 사용한다. |
| 분석 결과 저장 여부 | 저장하지 않음 / 세션 내 임시 저장 / DB 저장 | 브라우저 세션 내 최근 8건만 임시 저장한다. |
| 대시보드 반영 여부 | 반영하지 않음 / 선택 drain에 적용 / 새 테스트 drain 생성 | 이번 범위에서는 반영하지 않는다. |
| 대상 drain 선택 필요 여부 | 필요 없음 / 기존 drain 선택 / 새 drain 생성 | XGBoost와 WebSocket까지 확인하려면 기존 drain 선택을 옵션으로 둔다. |
| 센서 입력 범위 | 자유 입력 / 슬라이더 preset / 둘 다 | 수위와 유속은 숫자 입력 + 슬라이더를 함께 제공한다. |
| 결과 비교 방식 | 단일 결과만 표시 / 여러 실행 결과 누적 비교 | 이미지 선별 목적이므로 최근 실행 결과를 목록으로 누적 비교한다. |
| 보안 | 공개 접근 / demo token / Cloudflare Access | `/demo-control`과 같은 보호 정책을 적용한다. |
| 구현 범위 | 프론트만 / 백엔드 API 포함 / AI 서버 API 포함 | Frontend, Backend proxy, AI Service preview endpoint를 함께 구현한다. |
| 분석 실행 단위 | 통합 실행 / YOLO 후 XGBoost 분리 실행 | 같은 이미지에 센서값만 바꿔 비교할 수 있도록 YOLO와 XGBoost 실행을 분리한다. |
| 업로드 제한 | 10MB 유지 / 50MB 상향 / 무제한 | Nginx, Backend, AI Service 제한을 50MB로 맞추고 프론트에서 초과 파일을 사전 안내한다. |

## 5. 화면 구성 제안

### 5.1 상단 요약

| UI | 내용 |
| --- | --- |
| 페이지 제목 | AI 분석 검증 워크벤치 |
| 실행 상태 | AI 서버 연결 상태, 마지막 분석 성공/실패, 처리 시간 |
| 접근 토큰 | 필요한 경우 demo token 또는 내부 도구 token 입력 |

### 5.2 입력 영역

| UI | 기능 |
| --- | --- |
| 이미지 업로드 | jpg, png 업로드, 미리보기 표시 |
| 샘플 이미지 선택 | `public/test-snapshots` 또는 백엔드 샘플 목록에서 선택 |
| 대상 drain 선택 | 선택 사항. 결과를 실제 drain과 연결할 때 사용 |
| 수위 입력 | `waterLevelCm`, cm 단위 숫자 입력과 슬라이더 |
| 유속 입력 | `flowVelocityMps`, m/s 단위 숫자 입력과 슬라이더 |
| 품질 상태 | 기본 `valid`, 필요 시 `invalid` 또는 `missing` 선택 |
| 분석 실행 버튼 | 업로드 이미지와 센서값으로 분석 요청 |
| 초기화 버튼 | 이미지, 센서값, 결과를 기본값으로 복구 |

추천 기본값:

| 항목 | 기본값 | 이유 |
| --- | ---: | --- |
| 수위 | 30cm | 주의와 양호 사이의 변화를 보기 쉽다. |
| 유속 | 0.8m/s | 일반적인 시연값으로 설명하기 쉽다. |
| 품질 상태 | `valid` | 이미지와 센서값 영향성을 먼저 확인한다. |

### 5.3 결과 영역

| 영역 | 표시 내용 |
| --- | --- |
| 이미지 미리보기 | 원본 이미지, 분석 대상 이미지, 가능하면 bbox overlay |
| YOLO 결과 | `obstructionRatio`, `confidenceScore`, `yoloStatus`, 처리 시간 |
| XGBoost 결과 | `riskScore`, `riskLevel`, `finalDecision`, 판단 시각 |
| 입력 Feature | XGBoost에 전달된 `obstructionRatio`, `confidenceScore`, `waterLevelCm`, `flowVelocityMps` |
| 판정 설명 | 왜 해당 위험도가 나왔는지 사람이 읽을 수 있는 짧은 설명 |
| 오류 상태 | 이미지 형식 오류, AI 서버 오류, 분석 실패, confidence 부족 |

### 5.4 비교 목록

이미지 선별이 목적이므로 실행 결과를 최근 순서로 누적해서 비교한다.

| 컬럼 | 내용 |
| --- | --- |
| 썸네일 | 업로드 또는 샘플 이미지 |
| 센서값 | 수위, 유속 |
| YOLO | 막힘률, 신뢰도, 상태 |
| XGBoost | 위험 점수, 위험도, 최종 판단 |
| 적합성 메모 | 발표 후보, 보류, 제외 같은 사용자 메모 |
| 액션 | 다시 불러오기, 결과 복사, 후보 표시 |

## 6. API 설계 초안

현재 문서 기준으로 기존 AI 비동기 API는 백엔드가 최신 센서값을 AI 서버에 전달하고, AI 서버가 내부 목업 이미지를 사용한다. 이번 워크벤치는 사용자가 업로드한 이미지를 분석해야 하므로 별도 테스트 endpoint가 필요하다.

### 6.1 추천 신규 API

```http
POST /api/demo/ai-analysis/preview
Content-Type: multipart/form-data
```

요청 필드:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `image` | file | Y | 분석할 빗물받이 이미지 |
| `drainId` | string | N | 기존 drain과 연결할 때 사용 |
| `waterLevelCm` | number | Y | 수위, cm |
| `flowVelocityMps` | number | Y | 유속, m/s |
| `qualityStatus` | string | N | 기본 `valid` |

응답 예시:

```json
{
  "success": true,
  "data": {
    "requestId": "AI_PREVIEW_001",
    "imagePreviewUrl": "/api/demo/ai-analysis/previews/AI_PREVIEW_001.jpg",
    "input": {
      "waterLevelCm": 70,
      "flowVelocityMps": 0.2
    },
    "yoloResult": {
      "obstructionRatio": 0.82,
      "confidenceScore": 0.94,
      "yoloStatus": "blocked"
    },
    "xgboostResult": {
      "riskScore": 0.91,
      "riskLevel": "danger",
      "finalDecision": "dispatch_required"
    },
    "elapsedMs": 1430,
    "createdAt": "2026-06-29T16:30:00+09:00"
  }
}
```

### 6.2 대안 API

AI 서버가 multipart 업로드를 직접 받을 수 있다면 백엔드는 proxy 역할만 한다.

```text
Frontend
-> Backend /api/demo/ai-analysis/preview
-> AI Server /ai/analysis/preview
-> Backend response
-> Frontend result render
```

AI 서버 수정이 어렵다면 1차는 기존 테스트 API를 조합한다.

```text
1. POST /api/analysis/yolo
2. POST /api/sensor-data
3. POST /api/analysis/xgboost
4. GET /api/drains/{id} 또는 GET latest result
```

단, 이 방식은 실제 이미지 업로드 YOLO 분석이 아니라 결과 저장 테스트에 가까우므로 이미지 선별 목적에는 약하다.

## 7. 데이터 흐름

```text
사용자 이미지 업로드
-> 프론트 미리보기 생성
-> best.pt 기반 YOLO 이미지 분석 실행
-> YOLO 막힘률, 신뢰도, 상태를 화면에 보관
-> 수위/유속 입력 또는 조정
-> YOLO 결과와 센서값으로 XGBoost 최종 판단 실행
-> 백엔드가 단건 응답 반환
-> 프론트가 결과 카드와 비교 목록에 표시
```

2차에서 특정 빗물받이에 적용할 경우:

```text
분석 결과 선택
-> drainId 지정
-> apply API 호출
-> sensor_data, yolo_result_data, xgboost_data 저장
-> DRAIN_STATUS_UPDATED WebSocket 발행
-> 대시보드와 상세 화면 갱신
```

## 8. 예상 변경 범위

### 8.1 Frontend

| 파일 | 변경 |
| --- | --- |
| `app/ai-analysis-workbench/page.tsx` | 신규 페이지 |
| `lib/api/ai-analysis-workbench.ts` | preview 분석 API 호출 함수 |
| `lib/api/types.ts` | preview 분석 응답 타입 추가 |
| `components/ai-analysis-workbench/*` | 입력 패널, 결과 패널, 비교 목록 컴포넌트 |
| `components/app-header.tsx` | 내부 도구 링크 노출 여부 검토 |
| `docs/steps/step-XX-ai-analysis-workbench-page.md` | 구현 완료 기록 |
| `docs/pr/pr-XX-ai-analysis-workbench-page.md` | PR 요약 기록 |

### 8.2 Backend 및 AI Server

`frontend/AGENTS.md` 기준으로 `/frontend` 밖 수정은 사용자 확인 후 진행해야 한다.

| 영역 | 필요 작업 |
| --- | --- |
| Backend router | preview 분석 endpoint 추가 |
| Backend service | multipart 이미지 수신, 임시 저장 또는 AI 서버 전달 |
| AI Server | 업로드 이미지 기반 YOLO + XGBoost preview 분석 endpoint |
| Storage | preview 이미지를 임시 저장할지, 메모리/임시 파일로 둘지 결정 |
| Security | demo token 또는 내부 접근 보호 적용 |

## 9. 단계별 구현 제안

### Step 1. API 계약 확정

완료 기준:

| 항목 | 기준 |
| --- | --- |
| preview endpoint | `POST /api/demo/ai-analysis/preview` 또는 확정된 대안 |
| 이미지 전달 | multipart 업로드 여부 확정 |
| 응답 DTO | YOLO, XGBoost, 입력 feature, 처리 시간 포함 |
| 저장 정책 | preview 결과를 DB에 저장하지 않는지 확정 |

### Step 2. Frontend 워크벤치 UI 구현

완료 기준:

| 항목 | 기준 |
| --- | --- |
| 이미지 업로드 | 파일 선택과 미리보기 가능 |
| 센서 입력 | 수위, 유속을 직접 입력 가능 |
| 분석 실행 | 로딩, 성공, 실패 상태 표시 |
| 결과 표시 | YOLO와 XGBoost 결과를 한 화면에서 확인 |
| 비교 목록 | 최근 실행 결과를 누적 비교 |

### Step 3. Backend/AI preview 분석 연결

완료 기준:

| 항목 | 기준 |
| --- | --- |
| 업로드 처리 | 이미지 파일 검증과 크기 제한 적용 |
| AI 호출 | 업로드 이미지와 센서값으로 실제 분석 실행 |
| 오류 처리 | AI 서버 지연, 실패, 낮은 confidence 처리 |
| 응답 변환 | 프론트가 바로 표시 가능한 camelCase DTO 반환 |
| 분리 실행 | YOLO preview endpoint와 XGBoost preview endpoint를 나누어 제공 |
| 업로드 크기 | 프론트, Nginx, Backend, AI Service 제한값을 일관되게 적용 |

### Step 3-1. Demo 수동 시연 센서값 제어

완료 기준:

| 항목 | 기준 |
| --- | --- |
| 이미지 경로 | 기존 preset별 지정 이미지 경로를 유지 |
| 센서값 입력 | `/demo-control`에서 수위와 유속을 직접 입력 |
| 기본값 | `DEMO_MANUAL_DEFAULT_WATER_LEVEL_CM`, `DEMO_MANUAL_DEFAULT_FLOW_VELOCITY_MPS` 환경 변수 사용 |
| 저장 정책 | 개발자 시연용 값이므로 별도 DB 설정 테이블은 추가하지 않음 |

### Step 4. 발표 후보 선별 보강

완료 기준:

| 항목 | 기준 |
| --- | --- |
| 후보 표시 | 결과 목록에서 발표 후보 체크 가능 |
| 메모 | 이미지별 짧은 메모 입력 가능 |
| 결과 복사 | 발표 자료나 문서에 붙일 수 있는 JSON 또는 요약 복사 |
| 적용 기능 | 필요 시 특정 drain에 결과 적용 |

## 10. 검증 계획

| 검증 | 기대 결과 |
| --- | --- |
| `npm.cmd run lint` | 신규 lint 오류 없음 |
| `npm.cmd run build` | Next.js 빌드 성공 |
| 이미지 업로드 | jpg, png 파일이 미리보기로 표시됨 |
| 잘못된 파일 | 이미지가 아닌 파일은 분석 실행 전 차단 |
| 센서값 입력 | 수위와 유속 값이 요청 payload에 정확히 포함됨 |
| YOLO 결과 | 막힘률, 신뢰도, 상태가 표시됨 |
| XGBoost 결과 | 위험 점수, 위험도, 최종 판단이 표시됨 |
| 결과 비교 | 여러 이미지를 분석해 최근 결과를 비교할 수 있음 |
| API 실패 | 사용자가 원인을 알 수 있는 오류 메시지 표시 |
| 모바일/데스크톱 | 입력 영역과 결과 영역이 겹치지 않음 |

## 11. 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| AI 서버가 업로드 이미지를 받는 API가 없음 | 실제 YOLO 검증이 불가능 | preview endpoint를 백엔드/AI 서버에 먼저 추가 |
| 분석 시간이 길어짐 | 사용자가 멈춘 것처럼 느낄 수 있음 | 로딩 상태와 처리 시간 표시, timeout 설정 |
| 이미지 파일이 너무 큼 | 서버 부하 또는 실패 | 파일 크기 제한과 클라이언트 안내 |
| preview 결과가 실제 저장 결과와 다름 | 발표 자료와 대시보드가 어긋남 | 2차 적용 기능에서는 같은 service를 사용 |
| `/demo-control`과 역할 중복 | 내부 도구가 복잡해짐 | 제어는 `/demo-control`, 검증은 `/ai-analysis-workbench`로 분리 |
| 공개 접근 시 악용 가능 | AI 서버 부하와 임의 업로드 위험 | 내부 접근 보호와 token 적용 |

## 12. 최종 추천 구성

1차 구현은 이미지 선별과 모델 반응 확인에 집중한다.

```text
/ai-analysis-workbench
+ 이미지 업로드
+ 수위/유속 입력
+ YOLO 결과 표시
+ XGBoost 결과 표시
+ 최근 분석 결과 비교
+ 내부 접근 보호
```

2차 구현은 분석 결과를 발표 데이터로 연결한다.

```text
분석 결과 후보 저장
+ 특정 drain에 결과 적용
+ WebSocket으로 실제 화면 갱신
+ 발표 후보 이미지 세트 관리
+ step 문서에 시연 이미지 선정 결과 기록
```

추천 우선순위는 다음과 같다.

| 우선순위 | 작업 | 이유 |
| --- | --- | --- |
| 1 | preview 분석 API 계약 확정 | 실제 YOLO 결과를 확인하려면 API 형태가 먼저 정해져야 한다. |
| 2 | 프론트 워크벤치 UI | 발표 이미지 선별 작업을 한 화면에서 수행할 수 있다. |
| 3 | 결과 비교 목록 | 여러 이미지를 빠르게 비교해야 선별 효율이 좋아진다. |
| 4 | 특정 drain 적용 | 실제 대시보드 반영은 발표 안정성 확인 후 붙이는 편이 안전하다. |

## 13. 제안 커밋 메시지

제목:

```text
docs: AI 분석 검증 워크벤치 계획 추가
```

내용:

```text
- 이미지 업로드와 임의 센서값 입력으로 YOLO/XGBoost 결과를 확인하는 신규 페이지 계획을 추가한다.
- /demo-control과 AI 검증 페이지의 역할을 분리한다.
- 사용자 확인이 필요한 API, 저장, 접근 보호, 대시보드 반영 범위를 정리한다.
```
