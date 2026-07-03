## PR 제목

[fix] 배수 시설 상세 페이지 로딩 멈춤 안정화

## 작업 내용

- `/drains/[id]` 상세 페이지에서 route param `id`를 `drainId`로 정규화해 상세 조회, 목록 매칭, 실시간 이벤트 조회에 일관되게 사용했습니다.
- WebSocket 실시간 이벤트 병합 함수가 최초 상세 API 요청을 무효화하지 않도록 `detailRequestIdRef` 증가를 제거했습니다.
- socket 재연결 시 상세 재조회가 최초 로딩 요청을 취소하지 않도록, request id 대신 현재 `drainId` 일치 여부로 늦은 응답을 방어했습니다.
- 현재 URL의 `drainId`와 일치하는 상세 데이터, 오류, not found 상태만 렌더링하도록 정리했습니다.
- 시나리오 실행 중 관리자가 상세 페이지로 이동해도 상세 API 응답이 먼저 화면을 세우고, 이후 실시간 이벤트가 보강 반영되도록 했습니다.
- 메인/상세 화면에서 `API 응답 기준`, `API 데이터`처럼 실시간 갱신과 맞지 않는 문구를 제거했습니다.
- CCTV 카드와 대시보드 상세 패널 이미지를 컬러 표시로 통일하고, 최근 캡처 시간을 일반 시간 표시 형식으로 정리했습니다.
- `normal`, `dispatch_required` 같은 내부 판단 코드를 관리자용 한국어 문구로 변환해 위험 목록, 상세 요약, AI 판단 정보, 이력에 반영했습니다.
- 상단 네비게이션의 서비스 제목을 메인 대시보드 링크로 바꾸고, 일반 화면 텍스트 드래그 선택을 막았습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| 상세 페이지 로딩 안정화 | `frontend/app/drains/[id]/page.tsx` |
| 판단 문구 변환 | `frontend/lib/final-decision-label.ts` |
| CCTV/판단 문구 UX | `frontend/components/cctv-snapshot-card.tsx`, `frontend/components/drain-detail/*`, `frontend/components/drain-risk-list.tsx`, `frontend/components/drain-summary-panel.tsx` |
| 대시보드/네비게이션 UX | `frontend/components/dashboard/dashboard-summary-section.tsx`, `frontend/components/app-header.tsx`, `frontend/app/globals.css` |
| 계획 문서 | `frontend/docs/plans/plan-31-detail-page-loading-stabilization.md` |
| 작업 기록 | `frontend/docs/steps/step-47-detail-page-loading-stabilization.md` |

## 검증 결과

- `npm.cmd run lint` 통과
  - 기존 `frontend/components/fallback-image.tsx`의 native `<img>` 경고 1건 유지
- `npm.cmd run build` 통과
  - `/drains/[id]` dynamic route 빌드 확인
- 문구 검색으로 화면 코드에서 `API 응답`, `API 데이터`, 원시 판단 코드 노출 제거 확인

## 리뷰 포인트

- `/demo-control` 자동 시나리오 실행 중 `/`에서 `/drains/DR-004`로 이동해도 로딩 화면에 멈추지 않는지 확인합니다.
- 상세 화면 진입 직후 WebSocket 이벤트가 들어와도 상세 API 응답이 폐기되지 않는지 확인합니다.
- 상세 페이지 간 이동 시 이전 상세 데이터나 오류 상태가 현재 URL에 섞이지 않는지 확인합니다.
- 잘못된 drain id 접근 시 무한 로딩이 아니라 not found 또는 오류 화면으로 빠지는지 확인합니다.
- CCTV 카드와 확대 이미지가 모두 컬러로 보이는지 확인합니다.
- XGBoost 판단과 판단 이력에 내부 코드 대신 관리자용 한국어 문구가 표시되는지 확인합니다.
- 상단 서비스 제목 클릭 시 `/`로 이동하는지 확인합니다.
- 화면 드래그 시 일반 텍스트가 선택되지 않고, 입력 요소는 선택 가능한지 확인합니다.

## 비고

- 이번 수정은 `/frontend` 내부로만 제한했습니다.
- `step-46-presentation-demo-control-usage-guideline.md`의 기존 미커밋 변경은 건드리지 않았습니다.
- 실제 브라우저 수동 확인은 발표 리허설 환경에서 시나리오를 켠 상태로 한 번 더 진행하는 것을 권장합니다.
