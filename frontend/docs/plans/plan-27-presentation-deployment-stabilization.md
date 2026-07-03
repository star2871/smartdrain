# 27 발표·배포 재현성 안정화 계획

## 1. 작업 개요

| 항목 | 내용 |
| --- | --- |
| 작업 브랜치 | `chore/presentation-deployment-stabilization` |
| 작업 규모 | 큰 작업 — frontend 설정과 Docker Compose·Jenkins·운영 문서의 실제 배포 흐름을 함께 확인한다. |
| 최종 목표 | 발표 환경에서 같은 명령과 같은 시연 순서로 MVP를 재현할 수 있게 빌드·환경변수·모델·프록시·수동 검증 절차를 고정한다. |
| 핵심 원칙 | 기능 확장, 데이터 흐름 재설계, 패키지 업그레이드 대신 현재 기능의 빌드·배포·시연 실패 가능성만 최소 범위로 낮춘다. |
| 비목표 | Jenkins 권한/Docker socket 구조 변경, Redis·queue·DLQ, blue-green·rollback, 인증/RBAC, WebSocket·API·상태 관리 재설계, 새 테스트 프레임워크 도입 |

## 2. 실제 확인 결과

| 영역 | 확인 결과 | 발표 영향 |
| --- | --- | --- |
| Frontend 타입 검사 | `npx tsc --noEmit`이 통과했지만 `next.config.mjs`에 `typescript.ignoreBuildErrors: true`가 있다. | build가 타입 오류를 숨길 수 있어 높음 |
| Frontend production build | 로컬 `npm.cmd run build`는 통과했다. Next.js build 자체는 타입 검사를 건너뛴다. | 중간 |
| Google Fonts | `app/layout.tsx`가 `next/font/google`의 Geist 계열을 사용한다. 과거 build 기록에는 외부 다운로드 실패 이력이 있다. | 배포 환경 네트워크에 따라 중간 |
| 패키지 기준 | `package-lock.json`과 `pnpm-lock.yaml`이 공존하지만 Dockerfile·README·Docker 기반 Jenkins 검증은 pnpm을 사용한다. | 환경별 설치 결과 차이 가능성 |
| Risk score | Adapter가 이력 점수를 `0`으로 만들지만, 현재 위험 이력 화면은 점수를 표시하지 않는다. | 현재 시연 영향 낮음 |
| Compose | 운영 Compose와 개발 Compose 병합 설정 검증이 통과했다. 현재 기동 중인 컨테이너·이미지는 없다. | 실제 runtime 확인 필요 |
| 환경변수·모델 | 필수 환경변수 키가 존재하고 YOLO 모델 파일은 존재하며 0바이트가 아니다. Jenkins Secret File 실제 주입은 미확인이다. | 중간 |
| Nginx·migration | `/`, `/api`, `/ws` same-origin proxy와 WebSocket Upgrade 설정, DB health → migrate → backend 순서가 코드에 있다. | 실제 runtime 확인 필요 |
| Jenkins | `customWorkspace`와 `DEPLOY_DIR`가 `/home/yp/apps/smart-drain`으로 일치한다. 실제 Jenkins 실행 로그는 미확인이다. | 중간 |
| Smoke test | 현재는 `/`와 `/api/dashboard/summary`까지만 확인한다. 분석 callback·WebSocket 화면 반영은 자동 검증하지 않는다. | 시연 전 수동 절차 필요 |

## 3. 권장 방향과 우선순위

### P0 — 발표 전 필수

1. **타입 오류 은폐를 제거할 수 있는지 확정한다.**
   - 현재 TypeScript 검사가 통과했으므로 `ignoreBuildErrors`를 제거하거나 `false`로 전환한 뒤, 다시 타입 검사와 production build를 실행한다.
   - 전환 후 오류가 생기면 설정을 임의로 유지하지 않고, 오류 범위와 발표 영향부터 보고한다.
2. **실제 배포 환경에서 Compose 기동과 health를 확인한다.**
   - Jenkins 또는 발표 VM에서 `.env` 주입, 모델 mount, `migrate`, `backend`, `ai-service`, `frontend`, `nginx` health를 확인한다.
3. **분석 요청부터 WebSocket 반영까지 한 번 수동 시연한다.**
   - 대시보드 → 시설 상세 → 분석 요청 → AnalysisJob → AI callback → DB 저장 → WebSocket → 지도·목록·상세 갱신 순서로 확인한다.

### 조건부 수정

| 항목 | 적용 조건 | 권장 최소 변경 |
| --- | --- | --- |
| Google Fonts | Docker/Jenkins build에서 외부 폰트 다운로드가 실패할 때만 | Geist import를 시스템 폰트 fallback으로 전환하고 build 재검증 |
| 환경변수·경로 | Jenkins Secret File·모델·Nginx mount가 실제 배포 경로와 다를 때만 | 실패한 한 경로 또는 변수 참조만 수정 |
| Nginx proxy | `/api` 또는 `/ws` smoke가 실패할 때만 | 해당 location의 upstream·Upgrade header만 보정 |
| migration | 빈 DB 또는 기존 DB에서 migration이 실패할 때만 | migration·seed 실행 순서 또는 운영 절차를 최소 보정 |
| Smoke test | 실제 시연에서 반복 확인이 필요한 경우 | 기존 smoke를 깨지 않는 health/API 1~2개만 추가하거나 수동 체크리스트로 대체 |

### 확인만 필요

- `riskHistoryDtoToItem`의 `score: 0`: 현재 UI에서 표시·정렬·그래프 계산에 사용하지 않으므로 발표 전 수정하지 않는다.
- lockfile 중복: pnpm을 Docker/Jenkins/공식 실행 기준으로 유지한다. `package-lock.json` 삭제·의존성 재설치·버전 업데이트는 하지 않는다.
- 과거 Jenkins 경로(`/apps`, `/deploy`): 현재 실행 파일이 아닌 이력 문서에서만 발견되어 코드 변경하지 않는다.

## 4. 구현 범위

| 구분 | 예상 경로 | 작업 내용 |
| --- | --- | --- |
| Frontend build 안정화 | `frontend/next.config.mjs` | P0 검증 통과 후 `ignoreBuildErrors` 제거 또는 `false` 전환 |
| Font fallback | `frontend/app/layout.tsx`, `frontend/app/globals.css` | 외부 폰트 실패가 재현될 때만 시스템 폰트 기반으로 최소 전환 |
| Frontend 실행 기준 | `frontend/README.md` | pnpm 기준 명령, 직접 URL·새로고침·오류 화면 확인 절차 보완 |
| 발표 운영 절차 | `docs/17_배포_운영_런북.md` | 실제 서비스명 기준 health·로그·복구·수동 시연 체크리스트 추가 |
| 검증 기준 | `docs/16_테스트_전략_및_E2E_검증.md` | 자동 범위와 발표 전 수동 분석·callback·WebSocket 확인 범위 명확화 |
| 완료 기록 | `frontend/docs/steps/step-41-presentation-deployment-stabilization.md` | 실제 변경·실행 명령·미실행 사유·남은 리스크 기록 |
| PR 요약 | `frontend/docs/pr/pr-32-presentation-deployment-stabilization.md` | 변경 요약·검증·리뷰 포인트 기록 |

`docs/16`, `docs/17`과 Jenkins·Compose 파일은 `/frontend` 밖에 있으므로, 실제 수정은 별도 사용자 승인 후에만 수행한다.

## 5. 사용자 확인이 필요한 사항

| 확인 항목 | 추천 방향 | 이유 |
| --- | --- | --- |
| `ignoreBuildErrors` | **타입 검사·build가 재통과하면 제거** | 발표 직전 타입 오류가 숨겨지는 위험을 없앤다. 실패 시에는 원인 보고 후 범위를 다시 결정한다. |
| Google Fonts | **현재는 유지, Jenkins/Docker에서 실패할 때만 시스템 폰트 fallback 적용** | 현재 로컬 build는 통과하므로 디자인 변경을 앞당기지 않는다. |
| 패키지 관리자 | **pnpm을 배포 기준으로 고정하고 lockfile 삭제는 보류** | Dockerfile과 Jenkins Docker 검증이 pnpm을 사용하며, 발표 직전 lockfile 정리는 회귀 위험이 있다. |
| 루트 운영 문서 | **`docs/16`, `docs/17`에 발표 체크리스트·복구 명령을 추가** | 시연 재현성과 장애 대응에 직접 도움이 되지만 `/frontend` 밖 수정 권한이 필요하다. |
| Jenkins/Compose 실행 | **실제 발표 VM 또는 Jenkins에서 read-only 확인부터 수행** | 로컬 Compose 문법 통과만으로 Secret File·host mount·네트워크를 보장할 수 없다. |
| smoke 확장 | **대규모 자동화 대신 수동 시연 체크리스트 우선** | 6영업일 내 자동화 도입으로 배포를 늦추지 않는다. |

## 5-1. 승인된 작업 경계

- 이번 구현은 **frontend와 배포 인프라 문서**에만 적용한다.
- Backend·AI Service·DB schema·분석 알고리즘·API/WebSocket 계약은 변경하지 않는다.
- Compose·Jenkins·Nginx의 구조 변경은 실제 실패가 확인될 때까지 하지 않고, 현재 서비스명 기준의 검증·복구 절차만 문서화한다.
- 패키지·lockfile·환경변수 값은 변경하지 않는다.

## 6. 검증 계획

### Frontend

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

`npm`은 현재 로컬 설치 상태 확인에는 사용할 수 있지만, Docker/Jenkins와 동일한 재현 검증의 기준은 pnpm으로 둔다.

### Compose·배포

```text
docker compose config --quiet
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet
docker compose ps
docker compose images
docker compose logs --tail=200 nginx backend ai-service migrate
```

### 발표 전 수동 시연 체크리스트

```text
1. Nginx 주소로 대시보드 접속
2. 대시보드 요약·시설 목록·Kakao 지도 표시 확인
3. 시설 상세 직접 URL과 새로고침 확인
4. 최신 센서·CCTV 이미지·YOLO/XGBoost 결과 확인
5. 분석 요청 실행 및 AnalysisJob 생성 확인
6. ai-service의 분석·callback 로그 확인
7. DB 결과 저장 또는 backend 최신 상태 확인
8. WebSocket 이벤트 수신 뒤 지도·목록·상세 반영 확인
9. API 지연·오류·Kakao key 누락 시 fallback 확인
10. 360px 모바일과 발표 해상도에서 핵심 버튼·텍스트·스크롤 확인
```

## 7. 장애 대응 기준

| 증상 | 먼저 확인할 명령 또는 위치 |
| --- | --- |
| 화면이 열리지 않음 | `docker compose ps`, `docker compose logs --tail=200 nginx frontend` |
| API 502 | `docker compose logs --tail=200 nginx backend migrate` |
| WebSocket 연결 실패 | Nginx `/ws` 설정, `docker compose logs --tail=200 nginx backend` |
| 분석이 processing에서 멈춤 | `docker compose logs --tail=200 ai-service backend`, AnalysisJob 상태 |
| 모델 파일 오류 | `SMARTDRAIN_YOLO_MODEL_PATH`, host 파일 크기·권한, ai-service 시작 로그 |
| DB 인증·migration 오류 | `.env`의 연결 키 존재 여부, `docker compose logs --tail=200 db migrate` |
| 이전 컨테이너·port 충돌 | `docker compose ps`, 해당 host port 점유 프로세스 |

`docker compose down -v`, image prune, volume 삭제는 시연 데이터와 DB를 지울 수 있으므로 이번 계획의 자동 복구 명령에서 제외한다.

## 8. 승인 후 제안 커밋 메시지

제목:

```text
chore: 발표 환경의 빌드와 배포 재현성을 안정화
```

내용:

```text
- TypeScript 검사와 production build의 실패 은폐 여부를 제거한다.
- Compose, 환경변수, 모델 mount, Nginx proxy의 발표 전 확인 절차를 고정한다.
- 분석 callback과 WebSocket 반영을 포함한 수동 시연·복구 체크리스트를 문서화한다.
```
