# 46 발표용 시연 제어 구성 및 사용 가이드라인

## 1. 문서 목적

이 문서는 `plan-30-presentation-demo-control-and-public-scenario.md`의 추천 방향을 실제 발표 운영 절차로 풀어쓴 가이드다. 발표자는 이 문서만 보고 로컬 수동 시연과 관람객용 공개 자동 시나리오를 준비하고 진행할 수 있어야 한다.

이번 단계에서 1차 구현까지 완료했다. Backend는 `/api/demo/*` 제어 API를 제공하고, Frontend는 `/demo-control` 페이지에서 수동 preset과 자동 날씨 시나리오를 제어한다.

## 1.1 구현 요약

| 영역              | 구현 내용                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Backend config    | `DEMO_SIMULATOR_AUTO_START`, `DEMO_CONTROL_TOKEN` 설정 추가                                |
| Backend router    | `/api/demo/status`, `/api/demo/drains/{drainId}/preset`, `/api/demo/scenario/*` API 추가   |
| Backend simulator | 수동 preset, 자동 날씨 단계, manual override, reset/recover 제어 함수 추가                 |
| Backend 자연화    | 자동 날씨 시나리오에서 수위, 유속, 막힘률을 상태별 범위와 시설별 특성에 맞춰 부드럽게 변동 |
| Frontend API      | `frontend/lib/api/demo.ts` 추가                                                            |
| Frontend route    | `frontend/app/demo-control/page.tsx` 추가                                                  |
| Compose/env       | backend container에 demo 제어 환경변수 전달                                                |
| 문서              | plan-30 추천 구성을 확정값 중심으로 갱신                                                   |

## 2. 확정 추천 방향

| 항목             | 기준                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| 본시연 방식      | direct preset 기반 시연을 기본으로 한다.                                        |
| 발표자 제어 화면 | `/demo-control` 한 곳에서 수동 시연과 자동 시나리오를 제어한다.                 |
| 관람객 공개 화면 | QR 코드는 `/` 공개 대시보드로 연결한다.                                         |
| 수동 시연 대상   | 기본값은 DR-005로 두되, 발표 흐름상 더 설명하기 쉬운 시설로 변경 가능하게 한다. |
| 자동 시나리오    | 5개 시설이 날씨 단계에 따라 서로 다르게 변한다.                                 |
| 자동 시작        | 서버 시작 시 자동 실행하지 않는다. 발표자가 직접 시작한다.                      |
| 접근 보호        | `/demo-control`과 `/api/demo/*`는 발표자만 접근 가능하게 보호한다.              |
| 알림             | `danger`와 `unknown`을 종 알림에 올리고, 시설별 최신 상태로 병합한다.           |

## 2.1 실제 API와 환경변수

### Demo API

| Method | Endpoint                              | 용도                                                        |
| ------ | ------------------------------------- | ----------------------------------------------------------- |
| GET    | `/api/demo/status`                    | 현재 demo 제어 상태 조회                                    |
| POST   | `/api/demo/drains/{drainId}/preset`   | 선택 시설에 `GOOD`, `CAUTION`, `DANGER`, `UNAVAILABLE` 적용 |
| DELETE | `/api/demo/drains/{drainId}/override` | 선택 시설의 수동 override 해제                              |
| POST   | `/api/demo/reset`                     | 발표용 overview 초기 상태 적용                              |
| POST   | `/api/demo/scenario/start`            | 자동 날씨 시나리오 시작                                     |
| POST   | `/api/demo/scenario/pause`            | 자동 날씨 시나리오 일시정지                                 |
| POST   | `/api/demo/scenario/resume`           | 자동 날씨 시나리오 재개                                     |
| POST   | `/api/demo/scenario/stop`             | 자동 날씨 시나리오 정지                                     |
| POST   | `/api/demo/scenario/next`             | 다음 날씨 단계 즉시 적용                                    |
| POST   | `/api/demo/scenario/step`             | 지정한 날씨 단계 즉시 적용                                  |
| POST   | `/api/demo/scenario/interval`         | 자동 진행 간격을 런타임에 변경                              |
| POST   | `/api/demo/scenario/recover`          | 전체 시설 복구 단계 적용                                    |
| POST   | `/api/demo/scenario/reset`            | 자동 시나리오 초기화                                        |

### 인증 헤더

`DEMO_CONTROL_TOKEN`이 반드시 설정되어야 한다. `/demo-control` 화면의 토큰 입력란에 같은 값을 넣으면 브라우저 sessionStorage에 저장하고, API 요청에 아래 헤더를 함께 보낸다.

```text
Authorization: Bearer <DEMO_CONTROL_TOKEN>
X-Demo-Control-Token: <DEMO_CONTROL_TOKEN>
```

토큰이 비어 있으면 demo 기능이 켜져 있어도 `/api/demo/*`는 `403 Demo control token is not configured`으로 거부된다.

### 발표용 env 예시

```env
COMPOSE_DEMO_SIMULATOR_ENABLED=true
COMPOSE_DEMO_SIMULATOR_MODE=direct
COMPOSE_DEMO_SIMULATOR_AUTO_START=false
COMPOSE_DEMO_SIMULATOR_RANDOMIZE=true
COMPOSE_DEMO_SIMULATOR_INTERVAL_SECONDS=30
COMPOSE_DEMO_SIMULATOR_START_DELAY_SECONDS=10
COMPOSE_DEMO_SIMULATOR_TARGET_DRAIN_CODE=DR-003
DEMO_CONTROL_TOKEN=<발표자가-입력할-긴-토큰>
```

Jenkins Secret File을 쓰는 VM 배포에서는 `DEMO_CONTROL_TOKEN`도 Secret File에 추가한다. 토큰은 발표 자료나 공개 QR에 넣지 않는다.

`COMPOSE_DEMO_SIMULATOR_RANDOMIZE=true`이면 자동 날씨 시나리오에서 수위, 유속, 막힘률이 상태별 범위 안에서 조금씩 달라진다. 수동 preset은 항상 고정값이다.

## 2.2 자동 시나리오 자연화 기준

자동 날씨 시나리오는 완전 랜덤이 아니라 현재 상태와 목표 상태 사이를 부드럽게 이동한다.

| 상태     |    수위 |         유속 | 막힘률 | 설명                                     |
| -------- | ------: | -----------: | -----: | ---------------------------------------- |
| 양호     |  4~12cm | 0.18~0.50m/s |  4~18% | 안정적인 배수 상태                       |
| 주의     | 16~30cm | 0.55~1.15m/s | 26~50% | 수위와 막힘이 올라가는 상태              |
| 위험     | 34~60cm | 1.05~1.90m/s | 58~92% | 현장 확인이 필요한 상태                  |
| 판단불가 | 20~36cm | 0.45~1.20m/s |   0~8% | 이미지 분석은 불안정하지만 센서값은 유지 |

시설별 특성도 반영한다.

| 시설   | 특성          | 효과                                  |
| ------ | ------------- | ------------------------------------- |
| DR-001 | 안정형        | 수위와 막힘률 상승이 낮고 회복이 빠름 |
| DR-002 | 막힘 증가형   | 막힘률이 더 빠르게 증가               |
| DR-003 | 침수 취약형   | 수위가 더 빠르게 상승                 |
| DR-004 | 카메라 장애형 | 집중호우에서 판단불가 역할            |
| DR-005 | 회복 지연형   | 복구 단계에서도 천천히 내려감         |

## 2.3 상태별 이미지 준비 목록

상태별 이미지가 있으면 Backend가 우선 사용한다. 이미지가 없으면 기존 `/mock_data/ai_image_samples/drain_N.jpg`로 fallback된다.

이미지 위치:

```text
mock_data/ai_image_samples/demo/
```

파일 형식:

```text
jpg, jpeg, png, webp
```

권장 형식:

```text
1280x720 또는 16:9 비율 jpg
```

파일명 규칙:

```text
drain_{DB 숫자 id}_{risk_level}.jpg
```

현재 seed 기준으로 DB 숫자 id가 `DR-001 -> 1`, `DR-002 -> 2` 순서라면 아래 파일을 준비한다.

| 시설   | 양호               | 주의                  | 위험                 | 판단불가              |
| ------ | ------------------ | --------------------- | -------------------- | --------------------- |
| DR-001 | `drain_1_good.jpg` | `drain_1_caution.jpg` | `drain_1_danger.jpg` | `drain_1_unknown.jpg` |
| DR-002 | `drain_2_good.jpg` | `drain_2_caution.jpg` | `drain_2_danger.jpg` | `drain_2_unknown.jpg` |
| DR-003 | `drain_3_good.jpg` | `drain_3_caution.jpg` | `drain_3_danger.jpg` | `drain_3_unknown.jpg` |
| DR-004 | `drain_4_good.jpg` | `drain_4_caution.jpg` | `drain_4_danger.jpg` | `drain_4_unknown.jpg` |
| DR-005 | `drain_5_good.jpg` | `drain_5_caution.jpg` | `drain_5_danger.jpg` | `drain_5_unknown.jpg` |

이미지 내용 추천:

| 상태    | 이미지 형태                                                 |
| ------- | ----------------------------------------------------------- |
| good    | 빗물받이가 잘 보이고 주변 이물질이 거의 없는 장면           |
| caution | 낙엽, 작은 쓰레기, 얕은 물고임이 일부 보이는 장면           |
| danger  | 물고임, 쓰레기, 배수 불량이 강하게 보이는 장면              |
| unknown | 빗방울, 흐림, 렌즈 오염, 야간 노이즈처럼 분석이 어려운 장면 |

주의:

- 파일명은 `risk_level` 기준으로 `good`, `caution`, `danger`, `unknown`을 사용한다.
- `UNAVAILABLE` preset도 이미지 파일명은 `unknown`을 사용한다.
- DB 숫자 id가 다르면 파일명의 숫자도 실제 `drains.id`에 맞춰야 한다.
- VM에서는 이 폴더가 Git에 포함되거나 배포 workspace에 복사되어 있어야 한다.

## 2.4 알림 UX 기준

종 알림은 모든 변화에 뜨지 않는다. 관람객 화면이 산만해지지 않도록 아래 상태만 알림으로 올린다.

| 상태    | 알림 여부 | 이유                                                      |
| ------- | --------- | --------------------------------------------------------- |
| danger  | 표시      | 즉시 확인이 필요한 위험 상태                              |
| unknown | 표시      | 영상 분석이 불가능해 별도 확인이 필요한 상태              |
| caution | 미표시    | 자동 시나리오에서 자주 발생하므로 목록/지도 색상으로 확인 |
| good    | 미표시    | 복구 상태는 요약과 목록에서 확인                          |

한 번에 여러 시설이 위험이 되어도 알림은 시설별 한 건으로 유지한다. 같은 시설의 알림은 새 상태로 갱신되고, 알림 패널 상단에서 읽지 않은 위험/판단불가 개수를 따로 보여준다.

## 3. 발표 전 전체 준비 체크리스트

발표 전에는 기능이 되는지보다 “같은 순서로 다시 해도 같은 화면이 나오는지”를 먼저 확인한다.

| 순서 | 확인 항목                            | 기대 상태                                                       |
| ---: | ------------------------------------ | --------------------------------------------------------------- |
|    1 | Git 브랜치와 배포 대상 확인          | 발표용 브랜치 또는 dev 배포 브랜치가 맞다.                      |
|    2 | `.env` 또는 Jenkins Secret File 확인 | demo 기능이 켜져 있고, `DEMO_CONTROL_TOKEN`과 모델 경로가 맞다. |
|    3 | Docker Compose 기동                  | `db`, `backend`, `ai-service`, `frontend`, `nginx`가 healthy다. |
|    4 | seed 데이터 확인                     | DR-001부터 DR-005까지 존재한다.                                 |
|    5 | 공개 대시보드 접속                   | `/`에서 지도, 목록, 요약, 이미지가 보인다.                      |
|    6 | WebSocket 연결 확인                  | 화면 새로고침 후 실시간 연결 상태가 끊기지 않는다.              |
|    7 | `/demo-control` 접속                 | 발표자만 접근 가능하고 제어 UI가 보인다.                        |
|    8 | 발표 초기화 실행                     | 5개 시설이 발표용 초기 상태로 돌아간다.                         |
|    9 | 수동 preset 1회 테스트               | 선택 시설 상태가 즉시 바뀐다.                                   |
|   10 | 자동 시나리오 1단계 테스트           | 시작, 일시정지, 다음 단계, 복구가 동작한다.                     |

## 4. 로컬 발표자 수동 시연 가이드

### 4.1 화면 배치

발표 노트북에서는 브라우저 창을 2개 또는 탭 3개로 준비한다.

| 화면             | 용도                                      |
| ---------------- | ----------------------------------------- |
| `/`              | 메인 대시보드 변화 확인                   |
| `/demo-control`  | 발표자가 버튼을 누르는 제어 화면          |
| `/drains/DR-005` | 필요 시 상세 센서, 이미지, 분석 이력 확인 |

추천 배치는 발표 화면에는 `/` 또는 상세 화면을 띄우고, 발표자 노트북 보조 화면에 `/demo-control`을 둔다. 관객에게 제어 화면을 보여줘야 할 때는 버튼 누르기 직전에만 짧게 보여준다.

### 4.2 시작 전 초기화

1. `/demo-control`에 접속한다.
2. 접근 토큰 입력란에 `DEMO_CONTROL_TOKEN` 값을 입력하고 `저장`을 누른다.
3. `발표 초기화` 버튼을 누른다.
4. `/` 화면을 새로고침한다.
5. 5개 시설의 상태가 발표용 초기 상태인지 확인한다.
6. 자동 시나리오 상태가 `정지`인지 확인한다.

초기 상태 예시는 다음 구성이 가장 설명하기 좋다.

| 시설   | 초기 상태 | 발표 설명               |
| ------ | --------- | ----------------------- |
| DR-001 | 양호      | 정상 기준 시설          |
| DR-002 | 주의      | 일부 막힘이 있는 시설   |
| DR-003 | 위험      | 우선 대응이 필요한 시설 |
| DR-004 | 판단불가  | 영상 품질 문제 예시     |
| DR-005 | 양호      | 수동 시연 대상          |

### 4.3 수동 시연 진행 순서

1. `/demo-control`에서 대상 시설을 `DR-005`로 선택한다.
2. `/` 화면에서 DR-005가 현재 양호 상태인지 확인한다.
3. `양호 적용`을 누른다.
4. 화면에서 낮은 수위, 낮은 막힘률, 초록 상태가 보이는지 확인한다.
5. `주의 적용`을 누른다.
6. 위험 목록에서 DR-005의 순위가 올라가는지 확인한다.
7. 지도 마커가 주의 색상으로 바뀌는지 확인한다.
8. `위험 적용`을 누른다.
9. DR-005가 위험 목록 상단 근처로 이동하는지 확인한다.
10. 요약 카드의 위험 수가 증가하는지 확인한다.
11. `판단불가 적용`을 누른다.
12. 이미지 분석 상태가 판단불가로 바뀌고, 센서값은 계속 표시되는지 확인한다.
13. 상세 화면을 열어 센서 차트와 위험 이력이 누적되는지 보여준다.
14. `수동 상태 해제` 또는 `발표 초기화`를 눌러 재시연 가능한 상태로 되돌린다.

### 4.4 발표 중 설명 포인트

| 상태     | 화면에서 보여줄 포인트                                       |
| -------- | ------------------------------------------------------------ |
| 양호     | 수위와 막힘률이 낮고, 지도 마커와 상태 뱃지가 초록색이다.    |
| 주의     | 수위나 막힘률이 올라가며 위험 목록에서 우선순위가 올라간다.  |
| 위험     | 지도, 목록, 요약 카드가 모두 위험 상태를 강하게 표시한다.    |
| 판단불가 | 영상 분석은 실패할 수 있지만 센서값은 별도로 확인할 수 있다. |

발표 멘트는 “AI가 항상 답을 내는 것”보다 “이미지와 센서가 서로 보완하고, 판단불가도 관리자가 알아야 할 상태로 표시한다”에 맞추는 편이 좋다.

## 5. 관람객용 공개 자동 시나리오 가이드

### 5.1 원격 VM 준비

관람객용 시연은 발표 전에 VM에서 미리 켜 둔다.

| 순서 | 작업                                 | 기대 결과                       |
| ---: | ------------------------------------ | ------------------------------- |
|    1 | VM 접속                              | 배포 디렉터리 접근 가능         |
|    2 | `.env` 또는 Jenkins Secret File 확인 | demo 기능과 모델 경로가 맞음    |
|    3 | Docker Compose 배포                  | 전체 컨테이너 healthy           |
|    4 | Cloudflare Tunnel 확인               | 공개 도메인 접속 가능           |
|    5 | 모바일 접속 테스트                   | QR 도메인에서 `/` 대시보드 표시 |
|    6 | `/demo-control` 접근 테스트          | 발표자만 접근 가능              |
|    7 | 발표 초기화                          | 자동 시나리오 시작 전 안정 상태 |

### 5.2 QR 공개 전

1. `/demo-control`에서 `발표 초기화`를 누른다.
2. 자동 시나리오 상태가 `정지`인지 확인한다.
3. 날씨 단계가 `CLEAR` 또는 `강우 전`인지 확인한다.
4. 발표자 휴대폰으로 QR을 스캔한다.
5. 대시보드가 모바일에서 깨지지 않는지 확인한다.
6. 관람객에게 QR을 공개한다.

QR 공개 직후에는 바로 자동 시나리오를 시작하지 않는다. 관람객이 접속할 시간을 20~30초 정도 둔다.

### 5.3 자동 시나리오 시작

1. 발표자가 “이제 강우 상황을 시작하겠습니다”라고 안내한다.
2. `/demo-control`에서 `시작`을 누른다.
3. 첫 단계가 `LIGHT_RAIN`으로 넘어가는지 확인한다.
4. `/` 화면에서 일부 시설이 주의 상태로 바뀌는지 확인한다.
5. 관람객에게 지도 색상과 위험 목록 순위를 보라고 안내한다.

### 5.4 단계별 진행

| 단계           | 발표자 조작              | 관람객에게 볼 것               |
| -------------- | ------------------------ | ------------------------------ |
| CLEAR          | QR 접속 대기             | 5개 시설의 초기 상태           |
| LIGHT_RAIN     | 시작                     | 일부 시설이 주의로 바뀜        |
| HEAVY_RAIN     | 자동 진행 또는 다음 단계 | 위험 시설 발생, 목록 순위 변화 |
| CLOUDBURST     | 자동 진행 또는 다음 단계 | 판단불가와 위험 상태 동시 표시 |
| RAIN_WEAKENING | 자동 진행                | 위험이 주의로 완화되는 시설    |
| RECOVERY       | 자동 진행 또는 복구      | 대부분 양호로 돌아오는 흐름    |

발표 시간이 부족하면 `다음 단계` 버튼으로 바로 넘긴다. 설명이 더 필요하면 `일시정지`를 누르고 현재 화면을 기준으로 설명한다.

## 6. `/demo-control` 버튼 사용 기준

| 버튼                           | 언제 누르는가                                     | 주의점                                            |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------- |
| `발표 초기화`                  | 시나리오를 처음부터 다시 시작하고 싶을 때         | 관람객 화면도 초기 상태로 바뀐다.                 |
| `시작`                         | QR 접속 확인 후 자동 시나리오를 시작할 때         | 시작 전 공개 화면이 정상인지 확인한다.            |
| `일시정지`                     | 특정 단계에서 설명을 길게 해야 할 때              | 수동 preset은 계속 사용할 수 있다.                |
| `재개`                         | 일시정지한 자동 시나리오를 이어갈 때              | 현재 단계부터 진행한다.                           |
| `정지`                         | 자동 진행을 완전히 멈추고 수동 시연으로 전환할 때 | 현재 화면 상태는 유지된다.                        |
| `다음 단계`                    | 발표 시간을 줄이거나 특정 장면을 바로 보여줄 때   | 너무 자주 누르면 관람객이 변화를 따라가기 어렵다. |
| `단계 적용`                    | 리허설 중 특정 날씨 장면을 바로 보여줄 때         | 선택한 단계가 즉시 DB와 화면에 반영된다.          |
| `10초`, `15초`, `30초`, `60초` | 영상 촬영, 짧은 리허설, 실제 발표 속도를 맞출 때  | 컨테이너 재기동 전까지 유지되는 런타임 설정이다.  |
| `복구 단계 적용`               | 발표 종료 또는 재시연 전                          | 모든 override와 자동 상태를 정리한다.             |
| `수동 상태 해제`               | 특정 시설을 자동 시나리오에 다시 합류시킬 때      | 현재 날씨 단계 기준 상태로 돌아간다.              |

### 6.1 리허설 빠른 모드 사용법

영상 촬영이나 발표 리허설에서는 `.env`를 바꾸지 말고 `/demo-control`에서 간격 버튼을 사용한다.

1. `/demo-control`에서 접근 토큰을 저장한다.
2. `10초` 또는 `15초`를 누른다.
3. `시작`을 눌러 자동 시나리오를 돌린다.
4. 장면 전환이 너무 빠르면 `일시정지` 후 `30초` 또는 `60초`로 바꾼다.
5. 실제 발표 직전에는 `30초`를 기본값으로 두고 `발표 초기화`를 누른다.

### 6.2 특정 장면 강제 선택

발표자가 바로 보여줄 장면을 골라야 하면 날씨 단계 선택 후 `단계 적용`을 누른다.

| 단계             | 추천 사용 상황                            |
| ---------------- | ----------------------------------------- |
| `CLEAR`          | 발표 시작 전 정상 화면                    |
| `LIGHT_RAIN`     | 값이 천천히 올라가는 설명                 |
| `HEAVY_RAIN`     | 위험 알림이 생기는 장면                   |
| `CLOUDBURST`     | 여러 시설이 위험/판단불가로 갈라지는 장면 |
| `RAIN_WEAKENING` | 위험이 완화되는 장면                      |
| `RECOVERY`       | 발표 종료와 복구 확인                     |

## 7. 장애 대응 가이드

### 7.1 대시보드가 안 바뀔 때

1. 브라우저를 새로고침한다.
2. `/api/drains` 응답이 최신인지 확인한다.
3. WebSocket 연결이 끊겨 있으면 페이지를 다시 연다.
4. `/demo-control`에서 같은 preset을 다시 누르지 말고 다른 상태로 한 번 바꿔 상태 변화 이벤트를 만든다.
5. 그래도 안 되면 `복구 단계 적용` 후 수동 시연으로 전환한다.

### 7.2 `/demo-control` 버튼이 실패할 때

1. 화면의 오류 메시지를 확인한다.
2. `DEMO_CONTROL_TOKEN` 입력값이 맞는지 확인한다.
3. 인증 만료 가능성이 있으면 다시 로그인하거나 Cloudflare Access를 재인증한다.
4. Backend 컨테이너 상태를 확인한다.
5. DB가 healthy인지 확인한다.
6. 발표 중이면 Swagger나 curl 백업 대신, 이미 준비한 녹화 화면 또는 로컬 수동 시연으로 전환한다.

### 7.3 이미지가 깨질 때

1. 이미지 영역의 fallback이 표시되는지 확인한다.
2. 상태 변화 설명은 센서값, 위험도, 목록 정렬 중심으로 이어간다.
3. 발표 후 이미지 URL과 mock image 파일 경로를 확인한다.

### 7.4 Cloudflare 공개 도메인이 안 열릴 때

1. 발표자 로컬 화면으로 시연을 계속한다.
2. 관람객 QR 시연은 녹화본 또는 스크린샷으로 대체한다.
3. 발표 후 VM, Tunnel, DNS, Access 정책을 순서대로 점검한다.

### 7.5 `ai-service`가 Restarting 상태일 때

`docker inspect`에서 `OOMKilled=false`, `ExitCode=0`, 실행 시간이 1초 미만이면 메모리 부족이나 앱 crash보다 컨테이너의 foreground command가 바로 끝난 상황을 먼저 의심한다.

이번 demo compose에서는 `ai-service`가 시작 전에 `/app/ai_service/model/best.pt` 파일을 검사한다. 검사 후 `uvicorn ai_service.http.app:app --host 0.0.0.0 --port 9000`이 foreground로 실행되어야 한다. 기본 compose에 `command`가 없으면 entrypoint의 `exec "$@"`가 빈 인자로 끝나 `ExitCode=0` 재시작 루프가 발생할 수 있다.

확인 순서:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps ai-service
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=80 ai-service
```

`config` 출력에서 `ai-service` 아래에 아래 command가 보여야 한다.

```yaml
command:
  - uvicorn
  - ai_service.http.app:app
  - --host
  - 0.0.0.0
  - --port
  - "9000"
```

모델 파일이 없거나 비어 있으면 `ERROR: YOLO model file is missing...` 메시지와 함께 `ExitCode=1`로 종료되는 것이 정상이다. 이 경우 `.env`의 `SMARTDRAIN_YOLO_MODEL_PATH`가 실제 VM의 `best.pt` 파일을 가리키는지 확인한다.

## 8. 운영/보안 마무리 절차

1. `/demo-control`에서 자동 시나리오를 `일시정지` 또는 `정지`한다.
2. `복구 단계 적용`을 눌러 5개 시설을 복구 상태로 되돌린다.
3. 관람객 공개 QR 접속을 닫거나 Cloudflare Access 정책을 원래대로 돌린다.
4. 필요하면 `.env` 또는 Jenkins Secret File에서 demo 기능을 비활성화한다.
5. 발표 중 생성된 데이터가 많으면 정리 대상인지 확인한다.
6. 최종 화면 캡처나 로그가 필요하면 컨테이너 종료 전에 확보한다.

### 8.1 Cloudflare Access 권장 정책

관람객에게는 공개 대시보드만 열고, 제어/문서/스키마는 발표자만 접근하도록 분리한다.

| 경로                               | 권장 정책                                         |
| ---------------------------------- | ------------------------------------------------- |
| `/`                                | 공개 QR 허용                                      |
| `/drains/*`                        | 공개 QR 허용                                      |
| `/api/drains/*`                    | 공개 QR 허용                                      |
| `/api/dashboard/*`                 | 공개 QR 허용                                      |
| `/ws/drains/status`                | 공개 QR 허용                                      |
| `/demo-control`                    | 발표자 이메일만 허용                              |
| `/api/demo/*`                      | 발표자 이메일만 허용, `DEMO_CONTROL_TOKEN`도 유지 |
| `/docs`, `/redoc`, `/openapi.json` | 발표자 또는 운영자만 허용                         |

Cloudflare Access를 걸어도 `DEMO_CONTROL_TOKEN`은 제거하지 않는다. Access는 외부 진입 보호이고, token은 API 자체 보호다.

### 8.2 Jenkins Secret File 체크리스트

발표 VM 배포용 Secret File에는 아래 값을 확인한다.

```env
COMPOSE_DEMO_SIMULATOR_ENABLED=true
COMPOSE_DEMO_SIMULATOR_MODE=direct
COMPOSE_DEMO_SIMULATOR_AUTO_START=false
COMPOSE_DEMO_SIMULATOR_RANDOMIZE=true
COMPOSE_DEMO_SIMULATOR_INTERVAL_SECONDS=30
COMPOSE_DEMO_SIMULATOR_TARGET_DRAIN_CODE=DR-003
DEMO_CONTROL_TOKEN=<긴-랜덤-토큰>
SMARTDRAIN_YOLO_MODEL_PATH=./ai_service/model/best.pt
```

발표 후에는 `COMPOSE_DEMO_SIMULATOR_ENABLED=false`로 바꾸거나 demo env가 없는 Secret File로 되돌린 뒤 재배포한다. 재배포 후 `/api/demo/status`가 `404 Demo control is disabled`를 반환하면 비활성화가 완료된 것이다.

## 9. 검증 결과

| 검증                                                              | 결과                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| Backend Python AST parse                                          | 통과                                                    |
| `npm.cmd --prefix frontend run lint`                              | 통과. 기존 `fallback-image.tsx`의 `<img>` 경고 1건 유지 |
| `npm.cmd --prefix frontend run build`                             | 통과. `/demo-control` static route 생성 확인            |
| `docker compose --env-file .env.jenkins -p smartdrain-dev config` | backend 환경에 demo env가 렌더링되는 것 확인            |

## 10. 사용자가 직접 실행할 테스트 방식

아래 절차는 발표 리허설 전에 로컬에서 직접 확인하기 위한 기준이다. 테스트 전 `.env`에 demo 설정을 넣고, `DEMO_CONTROL_TOKEN` 값을 기억해 둔다.

### 10.1 로컬 env 확인

`.env`에 아래 값이 있는지 확인한다.

```env
COMPOSE_DEMO_SIMULATOR_ENABLED=true
COMPOSE_DEMO_SIMULATOR_MODE=direct
COMPOSE_DEMO_SIMULATOR_AUTO_START=false
COMPOSE_DEMO_SIMULATOR_RANDOMIZE=true
COMPOSE_DEMO_SIMULATOR_INTERVAL_SECONDS=30
COMPOSE_DEMO_SIMULATOR_TARGET_DRAIN_CODE=DR-003
DEMO_CONTROL_TOKEN=<직접 정한 토큰>
```

`DEMO_CONTROL_TOKEN`이 비어 있으면 `/api/demo/*`가 `403`으로 막히는 것이 정상이다.

### 10.2 정적 검증

프론트 코드 검증:

```powershell
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

기대 결과:

| 명령    | 기대 결과                                                              |
| ------- | ---------------------------------------------------------------------- |
| `lint`  | error 없음. 기존 `fallback-image.tsx`의 `<img>` warning은 남을 수 있음 |
| `build` | `/demo-control` route가 생성됨                                         |

Backend 문법 확인:

```powershell
python -c "import ast, pathlib; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8')) for p in ['backend/app/services/demo_simulator.py','backend/app/routers/demo.py','backend/app/core/config.py','backend/app/main.py']]"
```

출력이 없으면 통과다.

### 10.3 Docker Compose 실행

로컬 통합 실행:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

상태 확인:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
```

기대 결과:

```text
db          healthy
backend     healthy
ai-service  healthy
frontend    healthy
nginx       healthy
```

`ai-service`만 `Restarting`이면 아래를 먼저 확인한다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=80 ai-service
```

`config`에 `ai-service.command`가 `uvicorn ai_service.http.app:app ...`으로 렌더링되어야 한다. 이 command가 보이는데도 실패하면 `SMARTDRAIN_YOLO_MODEL_PATH`와 `/app/ai_service/model/best.pt` bind mount 상태를 확인한다.

### 10.4 Seed 데이터 확인

DR-001부터 DR-005가 없으면 seed를 실행한다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile seed run --rm seed
```

확인:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db psql -U smartdrain -d smartdrain_db -c "select id, drain_code, status from drains order by id;"
```

기대 결과는 `DR-001`부터 `DR-005`가 존재하는 것이다.

### 10.5 브라우저 수동 확인

브라우저에서 아래 화면을 연다.

| URL                                    | 확인 내용                |
| -------------------------------------- | ------------------------ |
| `http://localhost:18080/`              | 공개 대시보드            |
| `http://localhost:18080/demo-control`  | 시연 제어 화면           |
| `http://localhost:18080/drains/DR-005` | 수동 시연 대상 상세 화면 |

`/demo-control`에서 접근 토큰 입력란에 `.env`의 `DEMO_CONTROL_TOKEN` 값을 넣고 `저장`을 누른다.

404가 뜨면 먼저 어떤 404인지 구분한다.

| 증상                                                  | 원인 가능성                                                                     | 해결                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `http://localhost:18080/demo-control` 화면 자체가 404 | frontend image가 새로 빌드되지 않았거나 Nginx가 이전 설정을 물고 있음           | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build nginx frontend` 실행 |
| `/demo-control` 화면은 뜨지만 상태 조회가 404         | `COMPOSE_DEMO_SIMULATOR_ENABLED=false` 상태에서 `/api/demo/status`가 비활성화됨 | `.env`에서 `COMPOSE_DEMO_SIMULATOR_ENABLED=true`로 바꾸고 backend 재기동                           |
| 상태 조회가 403                                       | `DEMO_CONTROL_TOKEN`이 비어 있거나 화면에 입력한 token과 다름                   | `.env`에 token을 넣고 `/demo-control`에 같은 값을 저장                                             |

로컬에서 demo API를 켠 뒤 backend만 재기동하려면 다음 명령을 사용한다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build backend nginx frontend
```

### 10.6 수동 preset 테스트

1. `/demo-control`에서 대상 시설을 `DR-005`로 선택한다.
2. `발표 초기화`를 누른다.
3. `/`에서 DR-005가 양호 상태인지 확인한다.
4. `주의 적용`을 누른다.
5. `/`에서 DR-005의 상태, 목록 순위, 지도 마커가 바뀌는지 확인한다.
6. `위험 적용`을 누른다.
7. `/drains/DR-005`에서 센서 차트와 위험 이력이 추가되는지 확인한다.
8. `판단불가 적용`을 누른다.
9. 이미지 분석 상태가 판단불가로 바뀌고 센서값은 남는지 확인한다.
10. `수동 상태 해제` 또는 `발표 초기화`로 원상 복구한다.

### 10.7 자동 시나리오 테스트

1. `/demo-control`에서 `발표 초기화`를 누른다.
2. `/`를 새로고침한다.
3. `10초`를 눌러 리허설 빠른 모드를 적용한다.
4. `시작`을 누른다.
5. 날씨 단계가 진행되고 5개 시설 상태가 바뀌는지 확인한다.
6. `일시정지`를 누르고 화면 변화가 멈추는지 확인한다.
7. `CLOUDBURST`를 선택하고 `단계 적용`을 눌러 즉시 집중호우 장면이 적용되는지 확인한다.
8. `다음 단계`를 눌러 즉시 다음 날씨 단계가 적용되는지 확인한다.
9. `30초`를 눌러 실제 발표 속도로 되돌린다.
10. `재개`를 눌러 자동 진행이 이어지는지 확인한다.
11. `복구 단계 적용`을 눌러 대부분 양호 상태로 돌아오는지 확인한다.

### 10.8 API 직접 테스트

브라우저 테스트가 애매하면 API를 직접 호출한다. PowerShell에서 `$token` 값을 `.env`의 `DEMO_CONTROL_TOKEN`과 같게 둔다.

```powershell
$token = "<직접 정한 토큰>"
$headers = @{ Authorization = "Bearer $token"; "X-Demo-Control-Token" = $token }
Invoke-RestMethod -Headers $headers -Uri "http://localhost:18080/api/demo/status"
Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" -Body '{"preset":"DANGER"}' -Uri "http://localhost:18080/api/demo/drains/DR-005/preset"
Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" -Body '{"intervalSeconds":10}' -Uri "http://localhost:18080/api/demo/scenario/interval"
Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" -Body '{"weatherStep":"CLOUDBURST"}' -Uri "http://localhost:18080/api/demo/scenario/step"
Invoke-RestMethod -Method Post -Headers $headers -Uri "http://localhost:18080/api/demo/scenario/next"
Invoke-RestMethod -Method Post -Headers $headers -Uri "http://localhost:18080/api/demo/scenario/recover"
```

기대 결과:

| 호출               | 기대 결과                           |
| ------------------ | ----------------------------------- |
| `/api/demo/status` | `success=true`, `data.enabled=true` |
| preset 적용        | `manualOverrides`에 `DR-005` 포함   |
| scenario interval  | `intervalSeconds=10`                |
| scenario step      | `weatherStep=CLOUDBURST`            |
| scenario next      | `weatherStep`이 다음 단계로 변경    |
| recover            | `weatherStep=RECOVERY`              |

### 10.9 종료

테스트가 끝나면 자동 시나리오를 복구하고 컨테이너를 내린다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

발표 서버에서는 `down`하지 않고 `/demo-control`에서 `복구 단계 적용`만 실행한 뒤 공개 접근 정책을 원래대로 돌린다.

## 11. 구현 완료 후 추가 확인할 항목

실제 VM 리허설 뒤 아래 정보를 기록한다.

| 항목                | 기록할 내용                                   |
| ------------------- | --------------------------------------------- |
| 실제 URL            | 로컬, VM, Cloudflare 공개 주소                |
| 실제 버튼명         | UI에 표시된 버튼명과 API 동작                 |
| 실제 env            | 발표용 `.env` 예시와 Jenkins Secret File 항목 |
| 실제 API            | `/api/demo/*` 요청/응답 예시                  |
| 실제 검증 결과      | lint, build, Docker health, 모바일 확인 결과  |
| 실제 장애 대응 결과 | 리허설 중 발생한 문제와 해결 방법             |

## 12. 제안 커밋 메시지

제목:

```text
docs: 발표 시연 사용 가이드라인 추가
```

내용:

```text
- 발표자 수동 시연과 관람객 자동 시나리오의 운영 절차를 정리한다.
- /demo-control 버튼 사용 기준과 단계별 발표 흐름을 문서화한다.
- 발표 전 준비, 장애 대응, 종료 절차를 체크리스트로 추가한다.
```
