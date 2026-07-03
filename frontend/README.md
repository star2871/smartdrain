# SmartDrain Frontend

> 문서 상태: 현재 구현 기준 · 확인 기준일: 2026-06-24

SmartDrain frontend는 Next.js App Router 기반의 빗물받이 위험 관제 화면이다. 대시보드와 시설 상세 화면은 REST API로 초기 데이터를 가져오고, WebSocket 이벤트로 변경된 상태를 반영한다.

## 실행과 검증

패키지 매니저는 lockfile과 Dockerfile 기준으로 `pnpm`을 사용한다.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm build
pnpm exec tsc --noEmit
```

Docker same-origin 개발 환경에서는 Nginx의 `http://localhost:8080`을 사용한다. 로컬 Next.js 개발 서버만 실행하면 기본 주소는 `http://localhost:3000`이다.

## 데이터·실시간 흐름

```text
REST (/api/drains, /api/dashboard/summary, 상세 API)
→ TanStack Query
→ API DTO adapter
→ 대시보드·상세 UI

WebSocket (/ws/drains/status)
→ Zustand 상태와 Query cache 갱신
→ 지도·목록·상세 반영
```

지원 이벤트는 `DRAIN_STATUS_UPDATED`, `YOLO_RESULT_UPDATED`, `XGBOOST_RESULT_UPDATED`다. 재연결이 성공하면 `realtime-drain-sync.tsx`가 시설 목록·요약·선택 시설 Query를 무효화해 REST 상태로 보정한다.

API base URL은 same-origin일 때 비워 둔다. 별도 backend를 직접 실행하는 개발에서만 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`을 설정한다. API helper가 이미 `/api/*` 경로를 포함하므로 base URL에 `/api`를 덧붙이지 않는다.

## 화면 확인

- 대시보드: 상태별 시설 수, Kakao 지도 마커, 위험 시설 목록과 상세 패널을 확인한다.
- 시설 상세: CCTV 스냅샷, 수위·유속 이중 축 차트, YOLO·XGBoost 결과, 위험 이력을 확인한다.
- API 실패 또는 데이터 부재: 실제 데이터처럼 보이는 mock row 대신 오류·연결 대기·placeholder 상태가 표시되는지 확인한다.

현재 frontend에는 component test runner 또는 브라우저 E2E 설정이 없다. lint·TypeScript·build와 수동 통합 확인을 구분해 기록한다.

## 발표 전 Frontend 체크리스트

아래 순서는 기능 추가가 아니라 현재 MVP가 발표 환경에서 동일하게 보이고 동작하는지 확인하기 위한 최소 절차다.

1. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`가 모두 통과하는지 확인한다.
2. Nginx 주소에서 대시보드 첫 화면, 시설 목록, Kakao 지도가 표시되는지 확인한다.
3. 시설 상세 URL을 새 탭·새로고침으로 열어도 CCTV, 센서, YOLO·XGBoost 정보 또는 각 fallback 상태가 깨지지 않는지 확인한다.
4. API 지연·오류, 이미지 로딩 실패, Kakao Map key 누락, WebSocket 연결 대기·재연결 시 빈 화면 대신 안내 상태가 표시되는지 확인한다.
5. 분석 요청 후 AI callback과 WebSocket 이벤트가 지도·목록·상세 화면에 반영되는지 수동 확인한다.
6. 360px 모바일과 발표 해상도에서 텍스트 겹침, 주요 버튼, 스크롤, 지도·CCTV 확대 조작을 확인한다.

`next.config.mjs`는 TypeScript 오류를 무시하지 않는다. build 실패 시에는 오류를 숨기지 말고 타입·환경변수·외부 네트워크·패키지 설치 원인을 구분해 확인한다.

## 관련 문서

- [현재 구현 현황과 검증 범위](../docs/14_구현현황_및_검증결과.md)
- [테스트 전략 및 E2E 검증](../docs/16_테스트_전략_및_E2E_검증.md)
- [Frontend 작업 계획](docs/plans/plan-25-project-documentation-alignment.md)

## 변경 추적

이 문서는 `docs/14_구현현황_및_검증결과.md`의 “기존 문서 정합성 수정 내역”에서 변경 이유·코드 근거·영향을 추적한다. frontend Plan·Step·PR은 작성 당시의 이력이며, 현재 구현 기준으로 재해석하지 않는다.
