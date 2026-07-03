## PR 제목

[refactor] 프론트엔드 보안 경계 감사와 측정 기반 리팩터링

## 작업 내용

- 상세 센서 차트를 `next/dynamic`으로 분리해 `recharts` 기반 차트 리소스를 상세 페이지에서 지연 로딩하도록 변경했습니다.
- 차트 로딩 중 텍스트형 placeholder 대신 경량 skeleton fallback을 사용해 레이아웃 흔들림과 짧은 깜빡임을 줄였습니다.
- 위험도 지도에서 범례 count와 Kakao marker 생성에 memoization을 적용했습니다.
- 백엔드 schema에 맞춰 배수구 좌표와 상세 이미지 URL의 nullable 가능성을 frontend DTO와 guard에 반영했습니다.
- API guard가 정상적인 `null` 응답을 잘못 실패 처리하지 않도록 조정했습니다.
- 컨테이너 내부 `.pnpm-store`가 ESLint scan 대상에 들어가던 문제를 ignore 설정으로 보강했습니다.
- plan-29와 step-45에 적용 이유, 보류 이유, 검증 결과를 기록했습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| 상세 차트 지연 로딩 | `frontend/app/drains/[id]/page.tsx`, `frontend/components/sensor-trend-chart.tsx` |
| 지도 계산 최적화 | `frontend/components/risk-map.tsx` |
| API nullable 정합성 | `frontend/lib/api/types.ts`, `frontend/lib/api/response-guards.ts`, `frontend/lib/mock-data.ts` |
| 검증 안정화 | `frontend/eslint.config.mjs` |
| 작업 계획·기록 | `frontend/docs/plans/plan-29-frontend-security-boundary-audit.md`, `frontend/docs/steps/step-45-frontend-security-boundary-audit.md` |

## 변경 이유

Step 42의 production 측정에서 지도와 차트 라이브러리가 공통 client chunk를 키우는 사실은 확인됐지만, 모든 무거운 컴포넌트를 지연 로딩하는 것은 적절하지 않았습니다. 대시보드 지도는 첫 화면 핵심 UI라 지연 로딩하지 않고, 상세 센서 차트만 독립 카드로 분리했습니다.

guard는 더 엄격하게 만드는 대신 백엔드 계약과 맞췄습니다. 백엔드 schema에서 좌표와 이미지 URL은 null일 수 있으므로, API 경계에서는 정상 null을 허용하고 지도 렌더링 경계에서 유효 좌표만 표시하도록 역할을 분리했습니다.

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

- 상세 차트 dynamic import가 상세 페이지 UX를 해치지 않고 skeleton fallback 뒤 자연스럽게 정상 차트로 전환되는지 확인합니다.
- 대시보드 지도는 첫 화면 핵심 UI라 dynamic import를 적용하지 않은 판단이 적절한지 확인합니다.
- nullable 좌표가 들어와도 API 응답은 통과하고, 지도에서는 유효 좌표만 렌더링되는지 확인합니다.
- 목록 virtualization을 보류한 판단이 현재 MVP 데이터량과 모바일 inline summary UX 기준으로 적절한지 확인합니다.
- `.pnpm-store/**` ignore가 lint 대상에서 소스 파일을 빠뜨리지 않는지 확인합니다.

## 비고

- Backend·AI Service·DB schema·API/WebSocket 계약은 변경하지 않았습니다.
- 새 패키지는 추가하지 않았습니다.
- 목록 virtualization, `next/image` 전환, CSP/security headers는 조건부 후속 작업으로 남겼습니다.
- 상세 차트 chunk 분리 수치는 필요 시 analyzer build로 별도 재측정할 수 있습니다.
