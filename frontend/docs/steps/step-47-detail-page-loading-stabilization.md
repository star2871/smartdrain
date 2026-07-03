# 47 배수 시설 상세 페이지 로딩 멈춤 안정화 결과

## 작업 목표

시나리오 실행 또는 WebSocket 실시간 갱신 중 관리자가 `/drains/DR-004` 같은 상세 페이지로 이동했을 때, `배수 시설 상세 데이터를 불러오고 있습니다.` 화면에 멈추지 않도록 상세 로딩 흐름을 안정화했다.

목표 확인 시나리오는 다음과 같다.

| 시나리오 | 기대 결과 |
| --- | --- |
| `/drains/DR-004` 직접 접근 | 상세 API 응답 기준으로 상세 화면 표시 |
| 메인 `/`에서 상세 이동 | 새로고침 없이 상세 화면 표시 |
| 상세 페이지 새로고침 | 동일 상세 화면 복구 |
| 시나리오 실행 중 상세 이동 | 실시간 이벤트가 들어와도 최초 상세 API 응답이 폐기되지 않음 |

## 원인 판단

상세 페이지는 최초 진입 시 `loadDrainDetailData(id)`를 호출하고, 동시에 WebSocket store에 저장된 최신 이벤트를 상세 데이터에 병합한다.

기존 코드에서는 다음 세 이벤트 병합 함수가 모두 `detailRequestIdRef.current`를 증가시켰다.

| 함수 | 기존 문제 |
| --- | --- |
| `applyRealtimeEvent` | 상태 변경 이벤트 적용 전에 상세 요청 id를 증가시킴 |
| `applyYoloEvent` | YOLO 이벤트 적용 전에 상세 요청 id를 증가시킴 |
| `applyXgboostEvent` | XGBoost 이벤트 적용 전에 상세 요청 id를 증가시킴 |

이 때문에 상세 페이지에 진입하자마자 scenario 또는 WebSocket 이벤트 effect가 먼저 실행되면, 아직 응답하지 않은 최초 상세 API 요청이 “오래된 요청”으로 판단되어 무시될 수 있었다.

```text
상세 페이지 진입
-> loadDrainDetailData(DR-004) 요청 시작, requestId = 1
-> store에 남아 있던 DR-004 실시간 이벤트 effect 실행
-> detailRequestIdRef 증가, requestId = 2
-> 최초 상세 API 응답 도착
-> requestId 1 !== current 2 이므로 응답 폐기
-> detailData가 채워지지 않아 로딩 화면 유지
```

새로고침하면 store 이벤트 타이밍과 초기 요청 순서가 달라져 정상 표시될 수 있으므로, 증상이 “이동하면 멈추고 새로고침하면 정상”처럼 보일 수 있다.

## 변경 내용

| 파일 | 변경 내용 |
| --- | --- |
| `app/drains/[id]/page.tsx` | route param `id`를 `drainId`로 trim해서 상세 조회, 목록 조회, 실시간 이벤트 조회에 일관되게 사용 |
| `app/drains/[id]/page.tsx` | 실시간 이벤트 병합 함수에서 `detailRequestIdRef` 증가 제거 |
| `app/drains/[id]/page.tsx` | socket 재연결 재조회가 최초 상세 요청을 취소하지 않도록 current drain id 확인 방식으로 분리 |
| `app/drains/[id]/page.tsx` | `loadError`와 not found 상태를 drain id별로 판단해 이전 상세 상태가 현재 URL에 섞이지 않도록 정리 |
| `app/drains/[id]/page.tsx` | 렌더링 본문은 현재 URL의 `drainId`와 일치하는 `currentDetailData`만 사용 |
| `components/dashboard/dashboard-summary-section.tsx` | 대시보드 상단에서 실시간 갱신과 어긋나는 `API 응답 기준` 문구 제거 |
| `components/drain-detail/drain-detail-page-frame.tsx` | 상세 헤더의 `API 데이터` 배지 제거 |
| `lib/final-decision-label.ts` | `normal`, `field_check`, `dispatch_required`, `monitoring`을 관리자용 한국어 판단 문구로 변환 |
| `components/drain-risk-list.tsx`, `components/drain-summary-panel.tsx`, `components/drain-detail/*` | 위험 목록, 상세 요약, 현재 위험 상태, AI XGBoost, 판단 이력에 한국어 판단 문구 적용 |
| `components/cctv-snapshot-card.tsx`, `components/drain-summary-panel.tsx` | CCTV 카드와 대시보드 상세 패널의 흑백 필터 제거, 최근 캡처 시간 표시 정리 |
| `components/app-header.tsx` | 상단 서비스 제목을 메인 대시보드 링크로 변경 |
| `app/globals.css` | 일반 화면 텍스트 드래그 선택 방지, 입력 요소는 선택 가능하게 유지 |

## 변경 후 흐름

상세 페이지의 기준 데이터는 URL의 `drainId`다.

```text
params.id trim
-> drainId 기준 상세 API 요청
-> 실시간 이벤트는 detailData가 이미 있고 drain id가 일치할 때만 병합
-> 이벤트 병합은 상세 API 요청 id를 변경하지 않음
-> 상세 API 응답이 도착하면 currentDetailData로 화면 표시
-> 이후 WebSocket 이벤트는 표시된 상세 데이터에 보강 반영
```

socket 재연결로 상세 데이터를 다시 가져올 때도 최초 상세 요청과 같은 request id를 공유하지 않는다. 대신 응답 시점의 `currentDrainIdRef`가 요청 당시 `drainId`와 같은지 확인해, 다른 상세 페이지로 이동한 뒤 늦게 도착한 응답만 버린다.

## 기대 효과

| 상황 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 시나리오 중 상세 이동 | store 이벤트가 최초 상세 요청을 무효화할 수 있음 | 이벤트가 요청 id를 바꾸지 않아 최초 응답이 정상 반영됨 |
| 상세 페이지 간 이동 | 이전 데이터나 오류 상태가 현재 URL과 섞일 수 있음 | 현재 `drainId`와 일치하는 데이터/오류만 렌더링 |
| socket 재연결 | 재조회가 최초 요청을 취소할 수 있음 | 재조회는 현재 drain id 확인 후 보강 반영 |
| 잘못된 id | 로딩 유지 가능성 | 빈 id는 오류 화면, API null은 not found 처리 |

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm.cmd run lint` | 통과. 기존 `components/fallback-image.tsx`의 native `<img>` 경고 1건 유지 |
| `npm.cmd run build` | 통과. `/drains/[id]` dynamic route 빌드 확인 |
| 문구 검색 | 화면 노출 코드에서 `API 응답`, `API 데이터`, 원시 판단 코드 노출 제거 확인 |

## 남은 리스크

- 실제 브라우저에서 `/demo-control` 시나리오를 실행하면서 `/`에서 `/drains/DR-004`로 이동하는 수동 확인은 추가로 하면 좋다.
- `components/fallback-image.tsx`의 `<img>` lint 경고는 기존 경고이며 이번 상세 로딩 수정 범위에서는 변경하지 않았다.
- 현재 수정은 frontend 내부만 다뤘다. Backend API가 특정 id에서 404, 500, pending을 반환하면 화면은 무한 로딩 대신 오류 또는 not found 흐름으로 빠져야 한다.
- 텍스트 드래그 선택 방지는 전체 관제 화면 기준으로 적용했다. 향후 로그 복사나 표 데이터 복사가 필요해지면 특정 영역에 `user-select: text` 예외를 추가한다.

## 다음 단계 추천

발표 리허설 흐름으로 다음 순서를 확인한다.

```text
1. /demo-control에서 자동 시나리오 시작
2. / 대시보드에서 DR-004 상세 이동
3. 상세 화면이 새로고침 없이 표시되는지 확인
4. 시나리오 상태 변경 후 상세 화면의 상태, 센서, 이력이 갱신되는지 확인
5. 상세 페이지에서 새로고침 후 동일하게 복구되는지 확인
```
