# 43 Frontend API 런타임 응답 경계 보강 결과

## 작업 목표

Step 42에서 번들·모바일 성능 기준선을 확보한 뒤, P1 항목 중 REST API payload 신뢰 경계를 점검했다. API 계약이나 새 패키지를 바꾸지 않고, 잘못된 응답 형식이 화면 예외로 이어지지 않도록 최소 런타임 guard를 추가했다.

## 변경 내용

| 파일 | 변경 내용 |
| --- | --- |
| `lib/api/response-guards.ts` | API wrapper, 목록 wrapper, 주요 DTO의 type guard 추가 |
| `lib/api/drains.ts` | axios 응답을 `unknown`으로 받은 뒤 guard를 통과한 응답만 반환하도록 변경 |
| `docs/plans/plan-28-frontend-security-performance-hardening.md` | REST API 런타임 경계 보강 결정 기록 |

## 변경 전

- REST API 함수가 axios generic 타입에 의존해 `response.data`를 바로 반환했다.
- `success`, `data.items`, 핵심 DTO 필드가 누락되거나 다른 타입이어도 TypeScript 컴파일 단계에서는 확인할 수 없었다.
- 잘못된 payload가 들어오면 어댑터나 화면에서 `.items`, 날짜, 위험도, 수치 필드 접근 중 예외가 날 수 있었다.

## 변경 후

- `parseApiResponse`, `parseApiListResponse`가 응답 wrapper의 기본 구조를 확인한다.
- 배수구 목록·상세, 센서 이력, 위험도 이력, 대시보드 요약, 분석 결과, 분석 이력에 필요한 최소 필드를 guard로 확인한다.
- 형식이 맞지 않는 응답은 `success: false`, `error.code: "INVALID_RESPONSE"` 형태로 변환해 기존 React Query 오류·fallback 흐름을 사용한다.
- 최신 분석과 분석 이력은 실제 데이터가 없을 수 있으므로 `data: null`을 허용한다.

## NO_CHANGE

- Backend API 경로와 응답 계약은 변경하지 않았다.
- Zod 같은 새 런타임 검증 라이브러리는 도입하지 않았다.
- WebSocket guard는 이미 필수 필드 검증이 있어 이번 단계에서 변경하지 않았다.
- `fallback-image.tsx`의 `<img>` 경고와 `next/image` 전환은 Step 42 기준대로 별도 판단 항목으로 유지했다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm exec tsc --noEmit` | 통과 |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm lint` | 통과. 기존 `fallback-image.tsx`의 `<img>` 경고 1건 유지 |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm build` | 통과 |
| `GET http://127.0.0.1:18080/` | 200 |
| `GET http://127.0.0.1:18080/api/drains` | 200 |

호스트 PowerShell에서 `pnpm` 직접 실행은 실행 정책과 pnpm node_modules 상태 검사 때문에 실패했다. 동일 검증은 정상 실행 중인 frontend 컨테이너 내부에서 수행했다.

## 남은 리스크

- 현재 guard는 화면에서 실제로 사용하는 핵심 필드 위주의 최소 검증이다.
- API 필드가 자주 바뀌거나 오류 응답 종류가 늘어나면 백엔드 스키마와 함께 guard 범위를 조정해야 한다.
- `pnpm.overrides` 경고는 현재 pnpm 버전 정책 변화에 따른 경고이며 이번 작업에서는 설정 파일을 변경하지 않았다.
