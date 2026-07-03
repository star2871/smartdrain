# 29 Frontend 보안 경계·guard 감사 및 최소 리팩터링 계획

## 1. 작업 개요

| 항목 | 내용 |
| --- | --- |
| 작업 브랜치 | `refactor/frontend-security-boundary-audit` |
| 작업 규모 | 중간 작업 — 이미 추가된 보안 경계와 guard를 검증하고, 실제로 필요한 정리만 최소 반영한다. |
| 최종 목표 | Step 42~44의 측정·guard 결과를 기준으로 불필요한 guard, 과한 검증, 누락된 경계, 성능 회귀 가능성을 재점검한다. |
| 기본 원칙 | 측정·재현·코드 추적 근거가 있는 경우에만 수정한다. 근거가 부족하면 `NO_CHANGE` 또는 `발표 후`로 남긴다. |
| 작업 범위 | `/frontend` 내부 코드와 frontend 계획·완료·PR 문서 |
| 제외 범위 | Backend·AI·DB schema·API/WebSocket 계약 변경, 라우팅 재설계, 상태 관리 교체, 지도/차트 라이브러리 교체, 새 패키지 도입, 루트 문서 수정 |

## 2. 배경

이전 작업에서 아래 항목을 이미 처리했다.

| 기록 | 완료 내용 | 이번 브랜치에서 확인할 점 |
| --- | --- | --- |
| `step-42` | bundle analyzer, 모바일 dev/prod 측정, dynamic import·virtualization `NO_CHANGE` 결정 | 측정 결과에 비해 남은 성능 리팩터링 후보가 실제로 필요한지 재확인 |
| `step-43` | REST API 응답 wrapper와 DTO 런타임 guard 추가 | guard 범위가 과하거나 부족하지 않은지 확인 |
| `step-44` | WebSocket URL scheme guard와 same-origin fallback 추가 | URL 경계가 배포 환경과 충돌하지 않는지 확인 |
| `pr-33` | dev 병합 전 PR 요약과 검증 결과 정리 | dev 서버 확인 전 리뷰 포인트를 빠짐없이 정리 |

## 3. 추천 진행 방향

이번 브랜치는 **감사 결과를 바탕으로 적용 가능한 최적화와 guard 정리까지 진행하는 브랜치**로 진행한다.

1. 코드 추적으로 guard가 실제 화면 데이터 흐름과 맞는지 확인한다.
2. 실제 API 응답 샘플과 현재 guard 조건을 비교한다.
3. 성능 측정 결과를 기준으로 dynamic import, virtualization, memoization 적용 여부를 결정하고 필요한 범위는 직접 반영한다.
4. 불필요하거나 읽기 어려운 guard만 줄이고, 의미 있는 누락만 보강한다.
5. 적용하지 않는 후보는 `NO_CHANGE`가 아니라 왜 보류하는지와 재검토 조건을 Step 문서로 남긴다.

### 우선 적용 추천

| 후보 | 추천 방향 | 이유 |
| --- | --- | --- |
| 상세 센서 차트 `dynamic import` | **적용** | `recharts`는 공통 client chunk의 큰 비중을 차지했고, 상세 화면의 차트는 첫 화면 핵심 액션보다 아래에 있는 독립 카드다. |
| 지도 `dynamic import` | **적용하지 않음** | 대시보드 핵심 첫 화면 기능이라 지도 로딩 지연이 UX를 떨어뜨릴 수 있다. |
| 목록 virtualization | **현재 보류** | 실제 시설 수가 작고 새 패키지 없이 직접 구현하면 선택·모바일 inline summary UX 복잡도가 커진다. |
| 지도·목록 memoization | **필요한 계산만 적용** | 마커·범례처럼 반복 계산되는 부분은 줄이되, 근거 없는 광범위 memoization은 피한다. |

## 4. 점검 대상과 판단 기준

| ID | 대상 | 확인할 내용 | 추천 판단 |
| --- | --- | --- | --- |
| A-01 | `lib/api/response-guards.ts` | 필수 필드가 화면 사용 범위와 일치하는지, optional/null 허용이 API 계약과 맞는지 확인 | **우선 점검** |
| A-02 | `lib/api/drains.ts` | API 함수가 guard 실패를 기존 오류/fallback 흐름으로 자연스럽게 전달하는지 확인 | **우선 점검** |
| A-03 | `lib/websocket/drain-status-socket.ts` | `NEXT_PUBLIC_WS_URL`, same-origin, 절대 URL 처리와 고정 path 정책이 배포 경로와 맞는지 확인 | **우선 점검** |
| A-04 | `components/fallback-image.tsx` | `<img>` 경고와 URL allowlist가 실제 이미지 정책과 충돌하지 않는지 확인 | **조건부 점검** |
| A-05 | `app/layout.tsx` | `dangerouslySetInnerHTML`이 정적 테마 초기화에만 쓰이는지 확인 | **NO_CHANGE 가능성 높음** |
| A-06 | 지도·차트·목록 성능 | Step 42 production 측정 이후 새 병목 근거가 있는지 확인 | **NO_CHANGE 가능성 높음** |
| A-07 | 의존성 | bundle analyzer와 기존 라이브러리가 dev/prod 재현성에 문제를 만들지 않는지 확인 | **후보 제시만** |

## 5. 사용자 확인이 필요한 항목

아래 항목은 코드 수정 전에 사용자의 확인이 필요하다.

| 확인 항목 | 추천 방향 | 이유 |
| --- | --- | --- |
| API guard 범위 축소 | **실제 API 응답과 화면 사용 필드가 일치할 때만 축소** | guard를 줄이면 payload 이상을 늦게 발견할 수 있다. |
| API guard 범위 확대 | **화면 예외가 재현되거나 API 샘플에서 누락 가능성이 확인될 때만 확대** | 모든 DTO를 과하게 검증하면 유지보수 비용이 커진다. |
| Zod 도입 | **이번 브랜치에서는 도입하지 않음** | 새 패키지와 schema 중복 비용이 크고, 현재 type guard로 충분히 좁게 막고 있다. |
| `next/image` 전환 | **이번 브랜치에서는 보류** | 외부 이미지 도메인·최적화 비용·remotePatterns 정책 확인이 먼저 필요하다. |
| CSP/security headers | **Nginx·배포 설정과 함께 별도 브랜치에서 진행** | Kakao 지도, inline theme script, 외부 이미지와 충돌 가능성이 있다. |
| dynamic import | **상세 차트에 한정해 적용** | 지도는 첫 화면 핵심 UI라 보류하고, 차트는 chunk 분리 효과를 확인할 가치가 있다. |
| package 정리 | **삭제하지 말고 후보만 문서화** | dev 서버·Docker·Jenkins 재현성을 깨뜨릴 수 있다. |
| Backend/API 계약 변경 | **이번 범위에서 제외** | frontend 감사 브랜치가 통합 계약을 임의로 바꾸면 위험하다. |

## 6. 수정 후보와 보류 기준

### 수정해도 되는 경우

- guard가 실제 API 성공 응답을 잘못 실패 처리하는 경우
- guard 실패가 기존 오류 UI가 아니라 화면 예외로 이어지는 경우
- WebSocket URL guard가 dev/prod same-origin 경로를 잘못 막는 경우
- 중복 helper가 3곳 이상 반복되고, 공통화해도 읽기 쉬워지는 경우
- 문서의 검증 결과와 실제 코드 상태가 불일치하는 경우

### 수정하지 않는 경우

- 성능 측정 근거 없이 `memo`, `useMemo`, `useCallback`, `next/dynamic`을 추가하는 경우
- API 계약을 frontend에서 새로 확정해야만 가능한 guard 확대
- 새 패키지 도입이 필요한 검증 구조 변경
- 단순 취향에 가까운 파일 분리·이름 변경
- 발표 직전 재현성을 흔들 수 있는 lockfile·Dockerfile 변경

## 7. 예상 변경 파일

| 목적 | 예상 경로 |
| --- | --- |
| API guard 감사·정리 | `lib/api/response-guards.ts`, `lib/api/drains.ts` |
| WebSocket URL guard 감사·정리 | `lib/websocket/drain-status-socket.ts` |
| 이미지 URL 정책 확인 | `components/fallback-image.tsx` |
| 정적 테마 스크립트 확인 | `app/layout.tsx` |
| 작업 기록 | `docs/plans/plan-29-frontend-security-boundary-audit.md`, `docs/steps/step-45-frontend-security-boundary-audit.md` |
| PR 요약 | `docs/pr/pr-34-frontend-security-boundary-audit.md` |

## 8. 검증 계획

| 검증 | 기준 |
| --- | --- |
| 정적 검사 | `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` |
| Docker dev 확인 | `docker compose -f docker-compose.yml -f docker-compose.dev.yml ps`, `GET /`, `GET /api/drains` |
| API guard 확인 | 정상 응답이 통과하고 깨진 wrapper·items·DTO가 실패 응답으로 변환되는지 확인 |
| WebSocket URL 확인 | 빈 값, 상대 경로, `http`, `https`, `ws`, `wss`, 잘못된 scheme의 처리 확인 |
| 기능 회귀 | 대시보드 목록·지도·상세 직접 URL·WebSocket 상태 표시·이미지 fallback 확인 |

호스트 PowerShell의 `pnpm` 실행이 정책 또는 pnpm 상태 검사로 실패하면, 정상 실행 중인 frontend 컨테이너 내부에서 동일 명령을 수행한다.

## 9. 완료 기준

- 필요한 수정 또는 `NO_CHANGE` 판단을 Step 문서에 근거와 함께 기록한다.
- lint, TypeScript, build 결과를 기록한다.
- Docker dev 서버에서 기본 화면과 API proxy 응답을 확인한다.
- dev 병합 전 PR 문서에 리뷰 포인트와 남은 리스크를 정리한다.

## 10. 제안 커밋 메시지

제목:

```text
docs: frontend 보안 경계 감사 계획 추가
```

내용:

```text
- Step 42~44의 성능 측정과 guard 보강 결과를 재검토하는 후속 계획을 추가한다.
- API/WebSocket guard 감사 기준과 수정·보류 조건을 정리한다.
- 사용자 확인 항목과 dev 병합 전 검증 계획을 문서화한다.
```
