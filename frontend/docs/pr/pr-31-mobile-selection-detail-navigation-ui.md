## PR 제목

[feat] 모바일 시설 선택 및 상세 탐색 UX 개선

## 작업 내용

- 모바일 대시보드에서 선택한 위험 시설 항목 바로 아래에 시설 요약과 상세 이동 버튼을 표시했습니다.
- 목록 선택 강조를 위험 상태색과 분리해, 양호·주의 시설을 선택해도 위험으로 오해하지 않도록 했습니다.
- XGBoost 탭의 6개 정보를 빈칸 없는 2열×3행 격자로 구성하고 긴 날짜·판단 문구의 넘침을 제한했습니다.
- 모바일 상세 화면의 전체 폭 `대시보드로 돌아가기` 바를 제거했습니다.
- 480px 이상 스크롤한 경우에만 우측 하단에 작은 `대시보드` 플로팅 칩과 `위로 가기` 버튼을 표시하도록 변경했습니다.
- 플로팅 버튼이 마지막 콘텐츠를 가리지 않도록 safe area를 고려한 하단 여백을 적용했습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| 모바일 목록 선택 흐름 | `components/drain-risk-list.tsx`, `components/dashboard/dashboard-main-content.tsx` |
| XGBoost 정보 격자 | `components/drain-detail/ai-analysis-tabs.tsx` |
| 상세 빠른 행동 | `components/drain-detail/drain-detail-page-frame.tsx`, `components/drain-detail/mobile-scroll-top-button.tsx` |
| 계획·완료 기록 | `docs/plans/plan-26-dashboard-mobile-selection-summary.md`, `docs/steps/step-39-dashboard-mobile-selection-summary.md` |

## 검증 결과

- `git diff --check` 통과
- `npm.cmd run lint` 통과 — 기존 `components/fallback-image.tsx`의 native `<img>` 경고 1건 유지
- `npm.cmd run build` 통과 — Next.js production build 및 `/`, `/drains/[id]` route 생성 확인

## 리뷰 포인트

- 360×740, 375×667, 390×844에서 선택 시설 요약이 선택 항목 직후에 표시되는지 확인합니다.
- 긴 상세 화면에서 플로팅 `대시보드` 칩과 `위로 가기` 버튼이 CCTV 확대 등 화면 내 조작 요소와 겹치지 않는지 확인합니다.
- 480px 전후 스크롤에서 빠른 행동의 노출 시점이 자연스럽고, 마지막 콘텐츠가 safe area에 가려지지 않는지 확인합니다.
- XGBoost 탭에서 긴 최종 판단 문구가 2열×3행 격자를 벗어나지 않는지 확인합니다.

## 비고

- API DTO, WebSocket 병합, 위험도 계산·정렬, 라우팅 형식은 변경하지 않았습니다.
- 실제 모바일 브라우저·기기 수동 확인은 후속 검증이 필요합니다.
