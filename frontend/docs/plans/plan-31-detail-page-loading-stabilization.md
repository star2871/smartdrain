# 31 배수 시설 상세 페이지 로딩 멈춤 안정화 계획

## 1. 작업 개요

| 항목 | 내용 |
| --- | --- |
| 작업 규모 | 중간 작업 - 상세 페이지 데이터 로딩 흐름과 상태 처리 안정화 |
| 최종 목표 | `/drains/DR-004` 직접 접근, 메인에서 상세 이동, 새로고침 세 경우 모두 상세 화면이 정상 표시되도록 한다. |
| 주요 증상 | 메인에서 상세 페이지로 이동하면 `배수 시설 상세 데이터를 불러오고 있습니다.` 화면에 머물고, 새로고침하면 정상 표시된다. |
| 추가 증상 | 시나리오 진행 중 실시간 데이터가 갱신되는 상태에서 상세 페이지로 이동하면 로딩에 막히는 것으로 보인다. |
| 예상 원인 | 상세 데이터 요청 조건, 로딩 상태 초기화, 목록 쿼리와 상세 쿼리의 의존 관계, 실시간 이벤트 병합 흐름이 꼬였을 가능성이 크다. |
| 수정 가능 범위 | 기본 범위는 `/frontend` 내부. 범위가 다른 파일 수정이 필요하면 사용자 확인 후 진행한다. |

## 2. 확인한 기준

| 문서/파일 | 확인 내용 |
| --- | --- |
| `frontend/AGENTS.md` | `/frontend` 내부 작업 규칙, 중간 작업의 plan 선작성, 검증 및 커밋 메시지 제안 규칙 |
| `frontend/docs/convention/documentation-convention.md` | plan 문서 작성 기준, 한국어 문서화 기준 |
| `frontend/package.json` | 검증 스크립트는 `npm run lint`, `npm run build` 또는 동일한 pnpm 명령으로 실행 가능 |
| `frontend/app/drains/[id]/page.tsx` | 상세 페이지가 client component이며 `params`에서 `id`를 받고 `loadDrainDetailData(id)`를 직접 호출함 |
| `frontend/lib/api/drain-data.ts` | 상세 API, 센서 이력, 위험 이력, 최신 분석, 분석 이력을 묶어서 로딩함 |
| `frontend/lib/query/drain-queries.ts` | `useDrainDetailQuery(drainId)`가 있으나 현재 상세 페이지에서는 직접 사용하지 않음 |

## 3. 현재 코드에서 의심되는 흐름

상세 페이지는 현재 아래 흐름을 가진다.

```text
params에서 id 획득
-> detailData 상태는 undefined로 시작
-> useEffect에서 loadDrainDetailData(id) 호출
-> 성공 시 detailData 설정
-> detailData, drain, meta, sensorSummary 중 하나라도 없으면 로딩 화면 표시
```

현재 코드상 `useEffect` 의존성에는 `id`가 포함되어 있어 단순한 의존성 누락만으로 보기는 어렵다.

다만 다음 지점은 실제 증상과 연결될 수 있다.

| 의심 지점 | 설명 |
| --- | --- |
| 로딩 상태가 `detailData`의 `undefined/null`에만 묶임 | 요청 실패 또는 응답 비정상 상황에서 사용자에게 명확한 실패 상태가 표시되지 않을 수 있다. |
| `drain = sharedDrain ?? detailData?.drain` | 목록 쿼리 데이터와 상세 데이터가 함께 화면 조건에 사용되어, 이동 직후 캐시 상태에 따라 표시 조건이 흔들릴 수 있다. |
| `sensorSummary`가 없으면 로딩 유지 | 상세 데이터가 도착했더라도 `sensorSummary` 계산 결과가 예상과 다르면 계속 로딩처럼 보일 수 있다. |
| React Query 훅 미사용 | 이미 준비된 `useDrainDetailQuery(drainId)`가 있지만 상세 페이지에서는 수동 `useEffect`로 상태를 관리하고 있어 요청 상태와 오류 상태가 분리되어 있다. |
| 실시간 이벤트에서 request id 증가 | WebSocket 이벤트 처리와 상세 재조회가 같은 `detailRequestIdRef`를 공유해, 특정 타이밍에는 정상 응답이 무시될 가능성이 있다. |
| 시나리오 실행 중 이동 | demo scenario나 WebSocket 갱신이 이어지는 동안 상세 페이지에 진입하면, 최초 상세 요청과 실시간 이벤트 적용이 동시에 발생해 로딩 상태가 풀리지 않을 수 있다. |

## 4. 수정 방향

1차 수정은 라우팅 구조나 API 연동 방식을 크게 바꾸지 않고, 상세 페이지 내부의 데이터 로딩 상태를 명확하게 정리한다.

| 방향 | 내용 |
| --- | --- |
| `drainId` 정규화 | `id`를 문자열로 확정하고 비어 있으면 요청하지 않는다. |
| 요청 상태 분리 | `isLoading`, `loadError`, `detailData`를 분리하거나 React Query 상태로 통일한다. |
| 실패 상태 종료 | API 실패, 예외, 빈 id 상황에서 로딩이 무한 유지되지 않도록 error 또는 not found 상태로 종료한다. |
| 상세 데이터 우선 표시 | 상세 페이지 본문은 상세 API 결과인 `detailData.drain`을 기본으로 사용하고, 목록 캐시는 보조 정보로만 사용한다. |
| 요청 경합 방지 | 실시간 이벤트와 최초 상세 요청이 서로 정상 응답을 무효화하지 않도록 request id 사용 범위를 재검토한다. |
| 기존 Query 활용 검토 | `useDrainDetailQuery(drainId)`에 `enabled: !!drainId`를 추가하고 상세 페이지에서 사용하는 방식을 검토한다. |
| 시나리오 중 상세 진입 보장 | 시나리오가 실행 중이어도 상세 진입 시에는 현재 URL의 `drainId` 기준 상세 API 응답을 우선 표시하고, 이후 실시간 이벤트는 보강 데이터로만 병합한다. |

권장 1차 구현안은 React Query를 활용하는 것이다.

```tsx
const drainId = id?.trim();

const detailQuery = useDrainDetailQuery(drainId);
```

그리고 `useDrainDetailQuery`는 다음 조건을 가져야 한다.

```tsx
queryKey: ["drains", drainId]
enabled: !!drainId
queryFn: () => loadDrainDetailData(drainId)
```

단, 현재 상세 페이지는 실시간 WebSocket 이벤트를 직접 `detailData`에 병합하고 있으므로, React Query로 완전히 이전할지, 수동 상태를 유지하면서 로딩 종료 조건만 안정화할지는 코드 수정 직전에 한 번 더 판단한다.

## 5. 예상 변경 범위

| 파일 | 변경 예상 |
| --- | --- |
| `app/drains/[id]/page.tsx` | 상세 로딩 조건, 오류 처리, route param 처리, 상세 데이터 우선 표시 흐름 수정 |
| `lib/query/drain-queries.ts` | 필요 시 `useDrainDetailQuery`에 `enabled` 옵션과 빈 id 방어 추가 |
| `docs/steps/step-XX-detail-page-loading-stabilization.md` | 구현 후 실제 변경 내용과 검증 결과 기록 |
| `docs/pr/pr-XX-detail-page-loading-stabilization.md` | 필요 시 PR 요약 작성 |
| `components/dashboard/dashboard-summary-section.tsx` | 대시보드 상단의 `API 응답 기준` 문구 제거 |
| `components/drain-detail/*` | 상세 화면의 API 데이터 배지, 판단 문구, AI 이력 문구 개선 |
| `components/cctv-snapshot-card.tsx`, `components/drain-summary-panel.tsx` | CCTV 이미지를 컬러 표시로 통일하고 최근 캡처 시간 표시 정리 |
| `components/app-header.tsx`, `app/globals.css` | 상단 제목 메인 이동 링크와 화면 텍스트 드래그 선택 방지 |

현재 계획상 `/frontend` 밖의 파일 수정은 필요하지 않다.

## 6. 수정 전 확인할 코드 포인트

| 확인 대상 | 확인할 내용 |
| --- | --- |
| 상세 페이지 최초 진입 | `id`가 비어 있거나 바뀌는 순간에 요청이 어떻게 실행되는지 확인 |
| 메인에서 상세 이동 | Next Link 이동 후 `detailData`, `sharedDrain`, `sensorSummary`가 어떤 순서로 채워지는지 확인 |
| 새로고침 | 직접 URL 접근 시와 클라이언트 이동 시 요청 흐름 차이 확인 |
| API 실패 | `loadDrainDetailData`가 throw, null, 부분 실패 중 어떤 값을 반환하는지 확인 |
| WebSocket 재연결 | 재연결 시 상세 재조회가 최초 요청 결과를 덮거나 무시하지 않는지 확인 |
| 시나리오 실행 중 이동 | `/demo-control` 또는 자동 시나리오로 상태 갱신이 발생하는 동안 `/`에서 `/drains/DR-004`로 이동해도 상세 화면이 표시되는지 확인 |

## 7. 검증 계획

| 검증 | 방법 | 기대 결과 |
| --- | --- | --- |
| 정적 검사 | `npm run lint` 또는 `pnpm lint` | ESLint 오류 없음 |
| 빌드 검사 | `npm run build` 또는 `pnpm build` | Next.js 빌드 성공 |
| 직접 접근 | `/drains/DR-004` 접속 | 로딩 후 상세 화면 표시 또는 명확한 오류/404 표시 |
| 메인 이동 | `/`에서 DR-004 상세 링크 클릭 | 새로고침 없이 상세 화면 표시 |
| 새로고침 | 상세 페이지에서 브라우저 새로고침 | 동일한 상세 화면 표시 |
| 실패 케이스 | 잘못된 id 접근 | 무한 로딩 대신 not found 또는 오류 화면 표시 |
| 시나리오 중 상세 이동 | 시나리오 실행 중 `/`에서 `/drains/DR-004` 이동 | 새로고침 없이 상세 화면 표시, 이후 실시간 상태 갱신 반영 |
| 시나리오 중 상세 새로고침 | 시나리오 실행 중 상세 페이지 새로고침 | 상세 API 응답 기준으로 화면 복구 후 실시간 이벤트 계속 반영 |
| 운영 문구 | 메인/상세 화면 확인 | `API 응답 기준`, `API 데이터`처럼 실시간 갱신과 어긋나는 문구가 보이지 않음 |
| CCTV UX | 상세/대시보드 패널 이미지 확인 | 카드 이미지와 확대 이미지가 모두 컬러로 표시됨 |
| 판단 문구 | 위험 목록, 상세 요약, AI XGBoost, 이력 확인 | `normal`, `dispatch_required` 같은 내부 코드 대신 관리자용 한국어 문구 표시 |

## 8. 남은 리스크

| 리스크 | 대응 |
| --- | --- |
| Backend API 응답이 특정 id에서 늦거나 실패함 | Network 결과를 확인하고 프론트는 무한 로딩을 방지한다. |
| React Query 전환이 실시간 병합 로직과 충돌함 | 전면 전환 대신 수동 상태 안정화로 범위를 줄인다. |
| 시나리오 갱신 타이밍에 상세 요청이 무시됨 | 최초 상세 API 요청과 실시간 이벤트 병합의 request id를 분리하거나, 상세 요청 성공 결과가 이벤트 때문에 폐기되지 않도록 조정한다. |
| 기존 사용자 변경 파일 존재 | 현재 `docs/steps/step-46-presentation-demo-control-usage-guideline.md`에 미커밋 변경이 있으므로 건드리지 않는다. |

## 9. 진행 순서

1. `app/drains/[id]/page.tsx`의 로딩 조건과 요청 경합 지점을 더 세밀하게 확인한다.
2. 필요한 경우 `docs/convention/code-convention.md`를 확인한 뒤 코드 수정에 들어간다.
3. 상세 데이터 요청이 `drainId`가 있을 때만 실행되도록 정리한다.
4. API 실패와 `null` 응답에서 로딩이 끝나도록 오류 또는 not found 흐름을 명확히 한다.
5. 상세 화면 표시 조건에서 목록 캐시 의존도를 낮춘다.
6. 시나리오 실행 중 상세 이동 시 최초 상세 요청과 실시간 이벤트가 충돌하지 않는지 확인하고 필요한 방어 로직을 추가한다.
7. lint/build를 실행하고 결과를 기록한다.
8. step 문서와 PR 문서를 필요한 범위에서 작성한다.
9. 마지막에 `git status`를 확인하고 한글 Conventional Commit 메시지를 제안한다.

## 10. 제안 커밋 메시지

제목:

```text
fix: 배수 시설 상세 페이지 로딩 상태 안정화
```

내용:

```text
- 상세 페이지 진입 시 drainId 기준으로 상세 데이터를 안정적으로 요청하도록 정리한다.
- API 실패와 빈 응답에서 로딩 화면이 무한 유지되지 않도록 오류 상태를 보강한다.
- 메인 이동, 직접 접근, 새로고침, 시나리오 실행 중 상세 이동 시 상세 화면 표시 흐름을 검증한다.
- 메인/상세 화면의 실시간 데이터 문구, CCTV 색상, 판단 문구, 네비게이션 UX를 함께 개선한다.
```
