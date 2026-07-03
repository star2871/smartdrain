# 30 발표용 시연 제어와 공개 관람 시나리오 계획

## 1. 작업 개요

| 항목 | 내용 |
| --- | --- |
| 작업 규모 | 큰 작업 - 발표용 제어 화면, 공개 관람 시나리오, Backend demo API, 접근 제어까지 포함한다. |
| 최종 목표 | 실제 발표에서 사용할 2가지 시연을 안정적으로 제공한다. |
| 시연 1 | 발표자가 특정 빗물받이 1개를 선택해 양호, 주의, 위험, 판단불가 상태를 직접 바꾸는 수동 시연 |
| 시연 2 | QR 코드로 접속한 관람객이 5개 빗물받이의 날씨 기반 자동 변화를 보는 공개 시연 사이트 |
| 문서 범위 | 구현 전 방향성, 화면/API/데이터/운영 범위, 단계별 우선순위, 검증 계획 정리 |
| 수정 가능 범위 | 사용자 요청에 따라 전체 범위 가능. 단, 실제 구현 전에는 Backend, AI Service, Docker, 접근 제어 변경을 다시 확인한다. |

## 2. 참고한 기준

| 문서 | 반영 내용 |
| --- | --- |
| `frontend/agents.md` | `/frontend/docs/plans` 문서 작성 규칙, 큰 작업의 승인 필요 항목, 검증 및 커밋 메시지 제안 방식 |
| `frontend/docs/convention/documentation-convention.md` | plan 문서 작성 기준과 한국어 문서화 기준 |
| `docs/01_프로젝트정의서.md` | SmartDrain MVP의 핵심 흐름: 샘플 이미지, 모의 센서, YOLO, XGBoost, WebSocket, 지도 대시보드 |
| `docs/03_요구사항정의서.md` | `good / caution / danger / unknown` 위험도 체계와 대시보드·상세·WebSocket 요구사항 |
| `docs/04_MVP범위.md` | MVP 성공 기준: 지도, 위험 목록, 상세 화면, 센서·이미지·분석 이력 확인 |
| `plan-26-dev-demo-automation-module.md` | 기존 demo simulator 방향, overview와 single-drain-story 개념 |
| 사용자 첨부 방향성 | `/demo-control`에서 수동 시연과 자동 날씨 시나리오를 함께 제어하는 제안 |

## 3. 문제 정의

현재 구현된 demo simulator는 발표용 자동 변화의 1차 기반으로는 유용하지만, 실제 발표 운영에는 아직 부족한 부분이 있다.

| 문제 | 설명 |
| --- | --- |
| 수동 제어 화면 없음 | 발표자가 특정 시설을 확실하게 양호, 주의, 위험, 판단불가로 바꾸는 UI가 없다. |
| 관람객 시연과 발표자 조작이 섞일 수 있음 | 공개 대시보드와 제어 기능의 접근 권한, API 보호가 분리되어야 한다. |
| 자동 시나리오가 단순 tick 중심 | 날씨 단계, 시설별 성격, 수동 override 충돌 방지 같은 발표 흐름이 아직 명확하지 않다. |
| 알림 경험 미정 | 상태 변화가 있을 때 관람객 화면에 어떤 알림이 쌓이고 표시되는지 기준이 필요하다. |
| 초기화와 복구 절차 부족 | 발표 리허설, 본시연, 재시연을 위해 원클릭 초기화와 전체 복구가 필요하다. |

## 4. 목표 시연 구성

발표에서는 두 가지 시연을 분리해서 운영한다.

| 구분 | 목적 | 주 사용자 | 권장 화면 |
| --- | --- | --- | --- |
| 로컬 발표자 수동 시연 | 특정 빗물받이 하나가 상태별로 어떻게 변하는지 확실하게 보여준다. | 발표자 | `/demo-control`, `/`, `/drains/{id}` |
| 원격 공개 자동 시연 | 관람객이 QR로 접속해 실제 관제 화면처럼 여러 시설 변화와 알림을 본다. | 관람객 | `/` |

두 시연은 같은 데이터 모델과 WebSocket 갱신 흐름을 사용하되, 제어 권한과 실행 모드는 분리한다.

```text
발표자 /demo-control
-> demo API 호출
-> 센서값, 이미지, YOLO, XGBoost 결과 저장
-> 알림 생성
-> WebSocket broadcast
-> 발표자 화면과 관람객 화면 동시 갱신
```

## 5. 화면 구성

### 5.1 공개 대시보드

경로:

```text
/
```

관람객과 발표자가 함께 보는 화면이다. 조회만 가능하며 데이터 변경 UI는 두지 않는다.

| 영역 | 표시 내용 |
| --- | --- |
| 요약 | 양호, 주의, 위험, 판단불가 시설 수 |
| 지도 | 5개 빗물받이 위치와 위험도 색상 마커 |
| 위험 목록 | 위험도가 높은 시설 우선 정렬 |
| 선택 패널 | 선택 시설의 이미지, 수위, 유속, 막힘률, 최근 변경 시간 |
| 알림 | 읽지 않은 알림 수와 최근 상태 변경 알림 |

### 5.2 시연 제어 페이지

경로:

```text
/demo-control
```

발표자 전용 화면이다. Cloudflare Access 또는 토큰 기반 보호를 전제로 한다.

| 영역 | 필요한 기능 |
| --- | --- |
| 실행 상태 요약 | 현재 모드, 자동 시나리오 상태, 날씨 단계, 수동 override 수 |
| 단일 시설 수동 시연 | 시설 선택, 양호/주의/위험/판단불가 적용, 수동 상태 해제, 초기 상태 복구 |
| 자동 날씨 시나리오 | 초기화, 시작, 일시정지, 재개, 다음 단계, 전체 복구 |
| 현재 적용 데이터 | 선택 시설의 수위, 유속, 막힘률, 위험도, 이미지, 마지막 변경 시각 |
| 운영 로그 | 최근 demo API 성공/실패, WebSocket 전송 상태, 마지막 오류 |

UI는 발표 중 빠르게 조작해야 하므로, 입력 필드 중심이 아니라 버튼과 선택 컨트롤 중심으로 만든다.

## 6. 단일 시설 수동 시연

수동 시연은 랜덤값 없이 고정 프리셋을 사용한다. 발표자가 버튼을 누를 때마다 같은 결과가 나와야 설명과 화면이 어긋나지 않는다.

| preset | 화면 표시 | waterLevelCm | flowVelocityMps | obstructionRatio | yoloStatus | finalDecision |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `GOOD` | 양호 | 7 | 0.3 | 0.08 | `clear` | `normal` |
| `CAUTION` | 주의 | 23 | 0.8 | 0.38 | `partially_blocked` | `field_check` |
| `DANGER` | 위험 | 46 | 1.6 | 0.78 | `blocked` | `dispatch_required` |
| `UNAVAILABLE` | 판단불가 | 31 | 1.2 | null | `unknown` | `monitoring` |

추천 발표 흐름:

```text
1. 초기 overview에서 5개 시설 상태를 보여준다.
2. DR-005 또는 발표자가 선택한 시설을 대상으로 지정한다.
3. GOOD -> CAUTION -> DANGER -> UNAVAILABLE 순서로 버튼을 누른다.
4. 지도 마커, 위험 목록, 선택 패널, 상세 이력, 알림 변화를 확인한다.
5. 초기 상태 복구 버튼으로 재시연 가능한 상태로 되돌린다.
```

## 7. 공개 자동 날씨 시나리오

자동 시나리오는 완전 랜덤이 아니라 날씨 단계와 시설별 성격을 조합한다.

| 단계 | 권장 시간 | 설명 |
| --- | ---: | --- |
| `CLEAR` | 30초 | QR 접속과 초기 화면 확인 |
| `LIGHT_RAIN` | 60초 | 일부 시설 주의 발생 |
| `HEAVY_RAIN` | 90초 | 주의 증가와 첫 위험 발생 |
| `CLOUDBURST` | 90초 | 위험 및 판단불가 발생 |
| `RAIN_WEAKENING` | 60초 | 위험 완화, 일부 시설은 회복 지연 |
| `RECOVERY` | 60초 | 대부분 양호 복구 |

시설별 역할:

| 시설 | 역할 | 상태 흐름 |
| --- | --- | --- |
| DR-001 | 안정형 | 양호 -> 양호 -> 양호 -> 주의 -> 양호 -> 양호 |
| DR-002 | 막힘 증가형 | 양호 -> 양호 -> 주의 -> 위험 -> 주의 -> 양호 |
| DR-003 | 침수 취약형 | 양호 -> 주의 -> 위험 -> 위험 -> 주의 -> 양호 |
| DR-004 | 카메라 장애형 | 양호 -> 양호 -> 주의 -> 판단불가 -> 주의 -> 양호 |
| DR-005 | 회복 지연형 | 양호 -> 양호 -> 주의 -> 주의 -> 주의 -> 양호 |

## 8. 수동 override 충돌 방지

자동 시나리오 실행 중 발표자가 특정 시설을 수동으로 바꿀 수 있어야 한다. 이때 자동 시나리오가 바로 덮어쓰면 발표가 흔들리므로 override 정책이 필요하다.

| 상황 | 처리 |
| --- | --- |
| 수동 preset 적용 | 해당 drain은 `manualOverride=true`로 표시하고 자동 시나리오 갱신 대상에서 제외 |
| 수동 상태 해제 | 현재 날씨 단계와 시설 프로필 기준으로 다시 자동 상태 계산 |
| 전체 복구 | 모든 override 해제, 기본 시나리오의 `CLEAR` 또는 `RECOVERY` 상태로 복구 |
| 자동 시나리오 정지 | 현재 상태 유지, 수동 제어는 계속 허용 |

## 9. 알림 규칙

알림은 모든 데이터 갱신마다 만들지 않고, 상태가 실제로 바뀔 때만 생성한다.

| 변화 | 알림 생성 |
| --- | --- |
| 양호 -> 주의 | 생성 |
| 주의 -> 위험 | 생성 |
| 위험 -> 주의 | 생성 |
| 주의 -> 양호 | 생성 |
| 분석 가능 -> 판단불가 | 생성 |
| 위험 -> 위험 | 생성하지 않음 |
| 주의 -> 주의 | 생성하지 않음 |

알림 문구 예시:

```text
DR-003이 주의에서 위험 상태로 변경되었습니다.
DR-004의 영상 분석이 불가능합니다.
DR-005가 정상 상태로 복구되었습니다.
```

## 10. 필요한 API 초안

### 10.1 수동 시연 API

```http
GET    /api/demo/status
POST   /api/demo/drains/{drainId}/preset
DELETE /api/demo/drains/{drainId}/override
POST   /api/demo/reset
```

`POST /api/demo/drains/{drainId}/preset` 요청 예시:

```json
{
    "preset": "DANGER"
}
```

### 10.2 자동 시나리오 API

```http
GET  /api/demo/scenario/status
POST /api/demo/scenario/start
POST /api/demo/scenario/pause
POST /api/demo/scenario/resume
POST /api/demo/scenario/next
POST /api/demo/scenario/reset
POST /api/demo/scenario/recover
```

### 10.3 처리 흐름

```text
demo API 호출
-> drain 현재 상태 조회
-> sensor_data 생성
-> yolo_result 생성 또는 mock image URL 지정
-> xgboost_result 생성
-> drain.status 갱신
-> 상태 변화 비교 후 notification 생성
-> YOLO_RESULT_UPDATED, XGBOOST_RESULT_UPDATED, DRAIN_STATUS_UPDATED broadcast
```

## 11. 접근 제어

공개 조회와 제어 기능을 반드시 분리한다.

| 경로 | 접근 정책 |
| --- | --- |
| `/` | 공개 |
| `/drains/{id}` | 공개 또는 발표 상황에 맞춰 공개 |
| `/api/drains/*` | 공개 조회 |
| `/api/dashboard/*` | 공개 조회 |
| `/ws/drains/status` | 공개 수신 |
| `/demo-control` | 발표자만 접근 |
| `/api/demo/*` | 인증 필수 |
| `/docs`, `/redoc`, `/openapi.json` | Cloudflare Access 또는 내부 접근 |

1차 구현에서는 배포 환경의 Cloudflare Access와 API 토큰을 함께 고려한다. 화면만 숨기는 방식은 충분하지 않으므로 실제 데이터를 바꾸는 `/api/demo/*`도 보호해야 한다.

## 12. 환경 변수 초안

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `COMPOSE_DEMO_SIMULATOR_ENABLED` | `false` | 시연 기능 허용 여부 |
| `COMPOSE_DEMO_SIMULATOR_MODE` | `direct` | 기존 direct 모드 또는 향후 `scenario-with-override` |
| `COMPOSE_DEMO_SIMULATOR_AUTO_START` | `false` | 서버 시작 시 자동 시나리오 시작 여부 |
| `COMPOSE_DEMO_SIMULATOR_INTERVAL_SECONDS` | `30` | 자동 단계 진행 간격 |
| `COMPOSE_DEMO_SIMULATOR_TARGET_DRAIN_CODE` | `DR-003` | 단일 스토리 기본 대상 |
| `DEMO_CONTROL_TOKEN` | 없음 | `/api/demo/*` 보호용 토큰 |

발표 본시연에서는 `AUTO_START=false`를 추천한다. 발표자가 `/demo-control`에서 초기화와 시작 버튼을 누르기 전까지 화면이 움직이지 않아야 리허설과 본시연이 안정적이다.

## 13. 구현 단계 제안

### Step 1. 계획 확정과 범위 잠금

완료 기준:

- 발표자 수동 시연 대상 drain 확정
- 관람객 공개 시나리오 공개 범위 확정
- `/demo-control` 접근 보호 방식 확정
- Backend, Docker, Nginx, Cloudflare Access 변경 승인

### Step 2. Backend demo API와 상태 적용 서비스

완료 기준:

- 수동 preset 적용 API 동작
- 자동 시나리오 상태 조회와 start/pause/resume/next/reset 동작
- 수동 override가 자동 시나리오에 덮이지 않음
- DB 저장과 WebSocket broadcast가 기존 대시보드와 상세 화면에 반영

### Step 3. Frontend `/demo-control` 구현

완료 기준:

- 현재 실행 상태 표시
- 시설 선택과 preset 버튼 제공
- 자동 시나리오 제어 버튼 제공
- 오류, 로딩, 버튼 연속 클릭 방지 처리
- 모바일보다는 발표자 노트북 화면 기준으로 조작성이 좋음

### Step 4. 공개 대시보드 알림 경험 보강

완료 기준:

- 상태 변경 알림 수 표시
- 최근 알림 목록 표시
- 같은 상태 반복 갱신은 알림 중복 생성하지 않음
- 관람객 화면에서 제어 기능이 노출되지 않음

### Step 5. 배포와 리허설 문서화

완료 기준:

- 로컬 발표용 실행 절차 문서화
- VM/Cloudflare 공개 시연 절차 문서화
- 실패 시 복구, 전체 초기화, 수동 백업 절차 문서화

## 14. 예상 변경 범위

| 영역 | 예상 파일/작업 |
| --- | --- |
| Frontend route | `frontend/app/demo-control/page.tsx` 신규 |
| Frontend API client | `frontend/lib/api/demo.ts` 신규 |
| Frontend UI | demo control 전용 컴포넌트, 알림 UI 보강 |
| Frontend state | 기존 WebSocket/store와 알림 수신 흐름 확인 |
| Backend API | `/api/demo/*` router 신규 또는 기존 simulator 확장 |
| Backend service | 수동 preset, 자동 scenario, override, notification 생성 |
| DB | override와 notification 저장을 DB에 둘지 메모리/기존 테이블로 둘지 결정 |
| Docker/env | demo env, token, Cloudflare/Nginx 접근 정책 |
| Docs | plan, step, PR, 리허설 체크리스트 |

## 15. 검증 계획

| 검증 | 방법 | 기대 결과 |
| --- | --- | --- |
| Frontend 정적 검사 | `pnpm lint`, `pnpm build` | 문법 및 빌드 오류 없음 |
| Backend API | Swagger 또는 curl로 `/api/demo/*` 호출 | preset과 scenario 제어 성공 |
| WebSocket | 브라우저 Network WS 확인 | 상태 변경 이벤트 수신 |
| 대시보드 | `/` 접속 | 지도, 목록, 요약, 알림이 변경됨 |
| 상세 화면 | `/drains/DR-003` 등 접속 | 센서, 이미지, 분석 결과, 이력 갱신 |
| 접근 보호 | 비인증 상태로 `/demo-control`, `/api/demo/*` 접근 | 차단됨 |
| 관람객 모바일 | QR 도메인 모바일 접속 | 조회 화면만 보이고 레이아웃 깨짐 없음 |
| 리허설 반복 | reset -> start -> pause -> next -> recover 반복 | 상태가 예측 가능하게 복구됨 |

## 16. 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| 제어 API가 공개됨 | 관람객이 데이터를 바꿀 수 있음 | `/demo-control`과 `/api/demo/*` 모두 인증 필수 |
| 자동 시나리오가 발표자 수동 변경을 덮음 | 설명 중 화면이 바뀜 | manual override 정책 적용 |
| DB 이력이 과도하게 쌓임 | 상세 화면과 성능에 영향 | 발표 전 reset/recover 절차와 최근 N개 조회 유지 |
| 실제 YOLO 지연 | 시연 화면 반영이 늦음 | 본시연은 direct preset, 기술 검증은 real-ai 별도 |
| 알림 중복 | 관람객 화면이 산만함 | 상태 변화가 있을 때만 알림 생성 |
| VM/Cloudflare 장애 | 관람객 접속 실패 | 로컬 녹화 영상과 로컬 Docker 시연 백업 준비 |

## 17. 확정 추천 구성

1차 구현은 발표 안정성을 우선한다. 기능을 많이 넣는 것보다 발표자가 예측 가능한 화면을 반복해서 만들 수 있는 구성을 기본값으로 둔다.

```text
direct preset 기반 수동 시연
+ /demo-control 제어 화면
+ 5개 시설 날씨 시나리오
+ manual override 충돌 방지
+ 공개 대시보드 조회 유지
+ /api/demo/* 보호
+ WebSocket으로 기존 화면 갱신
```

추천 기본값은 다음과 같다.

| 항목 | 추천값 | 이유 |
| --- | --- | --- |
| 발표자 수동 시연 방식 | direct preset | 실제 YOLO 지연이나 모델 상태에 영향을 받지 않고 같은 결과를 반복할 수 있다. |
| 수동 시연 기본 대상 | DR-005 | 초기 overview에서 정상 시설로 보여준 뒤 주의, 위험, 판단불가로 바꾸기 쉽다. |
| 관람객 자동 시나리오 시작 | `AUTO_START=false` | QR 접속 확인 후 발표자가 직접 시작해야 화면 타이밍을 맞출 수 있다. |
| 자동 시나리오 간격 | 30초 | 모바일 관람객이 변화를 읽을 시간이 있고, 발표자가 설명하기에도 급하지 않다. |
| 영상 캡처용 간격 | 10~15초 | 녹화본 길이를 줄일 때만 임시로 사용한다. |
| 상태별 이미지 | 1차 기존 이미지/URL, 2차 상태별 이미지 | 발표 안정성을 먼저 확보하고 이미지 연출은 별도 확장한다. |
| 알림 저장 | 1차 메모리 또는 계산형, 2차 DB 영속화 | MVP 발표에서는 화면 변화 확인이 우선이고, 장기 보관은 후속으로 둔다. |
| 접근 보호 | Cloudflare Access + API token | 화면 접근과 실제 데이터 변경 API를 함께 보호한다. |

2차 구현은 발표 자료와 이미지 준비 상태에 맞춰 진행한다.

```text
상태별 이미지 세트 확장
notification DB 영속화
Cloudflare Access 정책 세분화
영상 캡처용 10~15초 압축 모드
실제 YOLO 검증 모드 분리
```

## 18. 구현 시 기본 운영 가정

아래 가정을 기본으로 구현한다. 실제 코드 작업 직전 환경 또는 발표 방식이 바뀌면 이 표만 다시 확인한다.

| 항목 | 기본 운영 가정 |
| --- | --- |
| 공개 화면 | 관람객은 `/` 대시보드만 안내한다. 상세 화면은 발표자가 설명할 때만 사용한다. |
| 제어 화면 | `/demo-control`은 발표자 노트북 또는 운영자 계정에서만 연다. |
| 로컬 발표 | 발표 노트북에서는 수동 시연을 중심으로 사용하고, 자동 시나리오는 정지 상태에서 시작한다. |
| 원격 공개 시연 | VM과 Cloudflare Tunnel을 미리 켜고, 관람객 QR 접속을 확인한 뒤 자동 시나리오를 시작한다. |
| 본시연 분석 방식 | direct preset을 사용한다. real-ai는 별도 기술 검증 또는 녹화 장면으로 분리한다. |
| 복구 기준 | 발표 전과 발표 후 모두 `recover` 또는 `reset`으로 5개 시설을 예측 가능한 상태로 되돌린다. |
| 문서화 | 구현 완료 후 `steps` 문서에는 실제 사용 순서, 버튼 의미, 실패 시 대응을 자세히 기록한다. |

## 19. Step 문서 작성 기준

구현 완료 문서는 단순 변경 요약이 아니라 발표자가 그대로 따라할 수 있는 사용 가이드로 작성한다.

필수로 포함할 내용:

| 구분 | 작성 내용 |
| --- | --- |
| 사전 준비 | 로컬 Docker, VM, Cloudflare, 환경변수, seed 데이터, 모델 파일 확인 |
| 화면 준비 | 발표자 대시보드, `/demo-control`, 상세 화면, 관람객 QR 화면 배치 |
| 수동 시연 절차 | 대상 시설 선택, preset 버튼 순서, 화면에서 확인할 변화 |
| 자동 시나리오 절차 | 초기화, QR 공개, 시작, 일시정지, 다음 단계, 복구 순서 |
| 관람객 안내 | QR 접속 후 무엇을 보라고 설명할지 |
| 실패 대응 | WebSocket 미갱신, API 실패, VM 접속 실패, 이미지 깨짐, 시나리오 중단 대응 |
| 종료 절차 | 자동 시나리오 정지, 전체 복구, demo env 비활성화 여부 확인 |

## 20. 제안 커밋 메시지

제목:

```text
docs: 발표용 시연 제어 계획 추가
```

내용:

```text
- 발표자 수동 시연과 관람객 공개 자동 시나리오를 분리해 계획한다.
- /demo-control 화면, demo API, 접근 제어, 알림, override 정책을 정리한다.
- 구현 단계와 검증 계획, 발표 운영 리스크를 문서화한다.
```
