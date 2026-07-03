## PR 제목

[refactor] 프론트엔드 보안·성능 경계 기준선 정리

## 작업 내용

- 번들 analyzer와 모바일 production 측정으로 지도·차트 지연 로딩 여부를 판단할 기준선을 확보했습니다.
- production 측정 결과를 근거로 지도·차트 dynamic import, 목록 virtualization, memoization 조정은 적용하지 않았습니다.
- REST API 응답 wrapper와 주요 DTO 필드를 런타임에서 확인하는 guard를 추가했습니다.
- WebSocket 연결 URL 생성 시 허용 scheme과 same-origin fallback을 명시했습니다.
- 보안·성능 강화 계획과 Step 42~44 작업 기록을 정리했습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| 번들 측정 설정 | `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/next.config.mjs` |
| REST API 응답 경계 | `frontend/lib/api/response-guards.ts`, `frontend/lib/api/drains.ts` |
| WebSocket URL 경계 | `frontend/lib/websocket/drain-status-socket.ts` |
| 작업 계획·기록 | `frontend/docs/plans/plan-28-frontend-security-performance-hardening.md`, `frontend/docs/steps/step-42-*`, `frontend/docs/steps/step-43-*`, `frontend/docs/steps/step-44-*` |

## 검증 결과

- `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm exec tsc --noEmit` 통과
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm lint` 통과
  - 기존 `components/fallback-image.tsx`의 native `<img>` 경고 1건 유지
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm build` 통과
  - `/` 정적 route와 `/drains/[id]` 동적 route 생성 확인
- `GET http://127.0.0.1:18080/` 200
- `GET http://127.0.0.1:18080/api/drains` 200
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml ps` 확인
  - `db`, `backend`, `ai-service`, `frontend`, `nginx` 모두 healthy

## 리뷰 포인트

- REST API 응답 guard가 현재 화면에서 사용하는 핵심 필드 위주로만 검증하는 범위가 적절한지 확인합니다.
- WebSocket URL guard가 배포 환경의 same-origin 경로(`/ws/drains/status`)와 충돌하지 않는지 확인합니다.
- bundle analyzer는 측정용 도구이며 기본 production build 동작을 바꾸지 않는지 확인합니다.
- 지도·차트 dynamic import와 virtualization을 적용하지 않은 결정이 production 측정 결과와 맞는지 확인합니다.

## 비고

- Backend·AI Service·DB schema·API/WebSocket 계약은 변경하지 않았습니다.
- Zod, React Hook Form, Sentry, Playwright, CSP/security headers는 이번 범위에서 도입하지 않았습니다.
- `fallback-image.tsx`의 `<img>` 경고는 외부 이미지 도메인·최적화 비용 정책이 확정될 때 별도 검토합니다.
- 호스트 PowerShell의 `pnpm` 직접 실행은 실행 정책과 로컬 pnpm 상태 검사 영향이 있어, 검증은 정상 실행 중인 frontend 컨테이너 내부에서 수행했습니다.
