# 34 대시보드 선택 이미지 이전 미리보기 개선 계획

## 1. 작업 개요

| 항목 | 내용 |
| --- | --- |
| 작업 브랜치 | `fix/image-selection-stale-preview` |
| 작업 규모 | 중간 작업 - 대시보드 목록 선택 시 상세 패널 이미지 표시 흐름 개선 |
| 최종 목표 | 위험 시설 목록에서 다른 시설을 선택했을 때 상세 정보 영역이 이전 시설 이미지를 잠깐 보여주지 않도록 한다. |
| 주요 증상 | 목록 1 선택 후 목록 2를 누르면 텍스트와 상태는 목록 2로 바뀌지만, 이미지 영역은 짧게 목록 1 이미지를 보여준다. |
| 관찰 조건 | 한 번 본 시설로 다시 이동하면 비교적 빠르고, 일반 compose 배포 조건에서 dev보다 문제가 더 두드러진다. |
| 작업 범위 | `/frontend` 내부 코드와 frontend 작업 문서 |
| 제외 범위 | Backend API 계약 변경, Docker compose 변경, 새 패키지 추가, 지도/차트 구조 변경 |

## 2. 확인한 기준

| 문서/파일 | 확인 내용 |
| --- | --- |
| `frontend/AGENTS.md` | 중간 작업은 코드 수정 전 plan 문서를 작성하고 사용자 확인 후 진행한다. 실제 commit/push는 사용자가 직접 한다. |
| `frontend/docs/convention/documentation-convention.md` | plan 문서에는 사용자가 확인할 내용과 추천 방향을 포함한다. |
| `frontend/docs/steps/step-32-detail-realtime-render-optimization.md` | 상세 화면의 지도·CCTV 카드에 선택적 memoization을 적용했지만, 표시 props가 바뀌면 정상 갱신되도록 하는 것이 원칙이다. |
| `frontend/docs/steps/step-33-cctv-image-url-policy-adjustment.md` | `FallbackImage`는 일반 `<img>` 기반이며 이미지 URL allowlist와 fallback 정책을 가진다. |
| `frontend/docs/steps/step-36-dashboard-latest-cctv-image-contract.md` | 대시보드 선택 패널은 목록 응답의 `latestImageUrl`과 YOLO 이벤트의 `imageUrl`을 사용한다. |
| `frontend/docs/steps/step-42-frontend-security-performance-hardening.md` | 측정 근거 없이 무거운 lazy loading, virtualization, memoization 변경은 하지 않는 방향이 기록되어 있다. |

## 3. 현재 코드 흐름 요약

대시보드 선택 흐름은 아래와 같다.

```text
목록 항목 클릭
-> useDrainStore.selectedDrainId 변경
-> app/page.tsx에서 selectedDrain 계산
-> DashboardMainContent가 DrainDetailPanel에 selectedDrain 전달
-> DrainSummaryPanel이 selectedDrain.latestImageUrl을 FallbackImage src로 전달
-> 브라우저 <img>가 새 src 이미지를 로드
```

관련 위치는 다음과 같다.

| 파일 | 확인 내용 |
| --- | --- |
| `app/page.tsx` | `selectedDrain`을 현재 선택 id로 계산한다. |
| `components/dashboard/dashboard-main-content.tsx` | `DrainDetailPanel`에 `drain={selectedDrain}`, `imageUrl={selectedDrain.latestImageUrl ?? undefined}`를 전달한다. |
| `components/drain-summary-panel.tsx` | 이미지 영역에서 `FallbackImage`에 `imageUrl`을 넘긴다. |
| `components/fallback-image.tsx` | `<img src={currentSrc}>`를 직접 렌더링하며, 새 이미지 로딩 중 상태는 별도로 표시하지 않는다. |
| `components/realtime-drain-sync.tsx` | YOLO 이벤트 수신 시 목록 query cache의 `latestImageUrl`을 갱신한다. |

현재 선택 데이터 계산 자체는 큰 문제가 없어 보인다. 선택된 시설의 주소, 상태, 수치가 즉시 바뀐다면 React 상태 갱신은 정상으로 볼 수 있다.

## 4. 의심 원인

가장 가능성이 큰 원인은 **브라우저 이미지 로딩 동작**이다.

일반 `<img>`는 `src`가 바뀌어도 새 이미지 다운로드와 디코딩이 끝나기 전까지 이전에 그려진 픽셀을 잠깐 유지할 수 있다. 그래서 React props는 이미 목록 2로 바뀌었는데, 이미지 박스에는 목록 1 이미지가 짧게 남아 있는 것처럼 보인다.

증상과도 잘 맞는다.

| 증상 | 해석 |
| --- | --- |
| 한 번 클릭한 시설로 다시 가면 빠름 | 브라우저 캐시에 이미지가 있어 다운로드 시간이 짧다. |
| dev보다 compose 또는 배포에서 두드러짐 | 네트워크 경로, Nginx, 이미지 원본 응답, 캐시 헤더 차이로 이미지 로딩 시간이 더 길어질 수 있다. |
| 텍스트는 바뀌는데 이미지만 늦음 | React 선택 상태보다 이미지 파일 로딩이 병목일 가능성이 높다. |

추가로 확인할 보조 원인은 다음과 같다.

| 원인 후보 | 가능성 | 확인 방법 |
| --- | --- | --- |
| `FallbackImage`가 `failedSrc` 상태를 src 변경 시 초기화하지 않음 | 중간 | 이미지 로딩 실패 후 같은 컴포넌트에서 다른 시설로 이동할 때 fallback/실패 상태가 섞이는지 확인한다. |
| 패널 컴포넌트가 선택 변경 시 같은 인스턴스를 재사용함 | 중간 | `DrainDetailPanel` 또는 이미지 영역에 `key`를 줬을 때 이전 이미지 잔상이 사라지는지 확인한다. |
| 목록 cache의 `latestImageUrl` 값 자체가 늦게 갱신됨 | 낮음~중간 | 선택 직후 React DevTools 또는 콘솔로 `selectedDrain.latestImageUrl`이 이미 새 값인지 확인한다. |
| YOLO 이벤트와 목록 refetch 순서가 URL을 되돌림 | 낮음 | WebSocket 이벤트 수신 직후 query cache의 해당 drain 이미지 URL 변화를 확인한다. |

## 5. 추천 수정 방향

추천 1차 방향은 **이미지 표시 컴포넌트에서 src 변경을 명시적으로 처리하는 것**이다.

사용자가 보기에는 “새 시설을 선택했다”가 중요하므로, 새 이미지가 준비되기 전에는 이전 시설 이미지를 계속 보여주기보다 짧은 skeleton 또는 placeholder를 보여주는 편이 더 안전하다.

| 선택지 | 내용 | 장점 | 단점 | 추천 |
| --- | --- | --- | --- | --- |
| A. `FallbackImage`에 src 변경 감지와 로딩 상태 추가 | `src`가 바뀌면 이전 실패 상태를 초기화하고, 새 이미지 `onLoad` 전에는 placeholder/skeleton을 보여준다. | 모든 이미지 사용처에 일관 적용 가능. 이전 이미지 잔상 원인을 정면으로 해결한다. | 상세 CCTV 카드 등 다른 사용처의 표시 방식도 함께 바뀔 수 있어 확인이 필요하다. | 1순위 |
| B. 대시보드 선택 패널의 이미지 영역만 `key={drain.id}`로 재마운트 | 시설이 바뀌면 이미지 컴포넌트를 새로 만든다. | 변경 범위가 좁고 회귀 위험이 작다. | 새 이미지가 느리면 빈 영역 대신 브라우저 기본 로딩 동작이 남을 수 있다. |
| C. 대시보드 패널에서 이미지 URL을 별도 상태로 preloading 후 교체 | 새 이미지를 미리 로드하고 완료 시 표시한다. | 이전 이미지 잔상 없이 부드러운 전환을 세밀하게 제어할 수 있다. | 코드가 상대적으로 복잡해진다. 현재 MVP에는 과할 수 있다. |
| D. `next/image`로 전환 | 이미지 최적화와 loading 제어를 Next.js에 맡긴다. | 장기적으로 성능 관리에 유리할 수 있다. | 외부 이미지 도메인 정책, 보안 설정, 빌드 설정 영향이 있어 이번 문제의 최소 수정으로는 부적합하다. | 보류 |

### 추천 구현안

1차 구현은 A를 기본으로 하되, 회귀 범위를 줄이기 위해 props를 추가하는 방식을 추천한다.

```text
FallbackImage
-> src가 바뀌면 failedSrc 초기화
-> 새 src 로딩 중에는 이전 이미지가 아니라 fallback 또는 투명한 로딩 상태 표시
-> onLoad 후 실제 이미지 표시
```

대시보드 상세 패널에는 필요하면 `resetKey={drain.id}` 또는 `showFallbackWhileLoading` 같은 명시적인 옵션을 넘긴다. 이렇게 하면 기존 상세 페이지 CCTV 목록처럼 “이전 이미지를 유지하는 편이 나은” 영역이 있다면 동작을 선택적으로 유지할 수 있다.

## 6. 사용자 확인 사항

아래 항목을 확인한 뒤 구현 방향을 확정하면 된다.

| 확인 항목 | 추천 답변 | 이유 |
| --- | --- | --- |
| 새 시설 이미지가 로딩 중일 때 무엇을 보여줄지 | **placeholder 또는 skeleton 표시** | 이전 시설 이미지를 보여주는 것보다 현재 선택과 맞지 않는 정보 노출을 막는 것이 중요하다. |
| 적용 범위 | **대시보드 상세 정보 패널 우선 적용** | 현재 사용자가 겪는 문제를 좁게 해결하고, 상세 페이지 CCTV 카드 회귀를 줄인다. |
| `FallbackImage` 공통 개선 여부 | **src 변경 시 실패 상태 초기화는 공통 적용** | 이미지 실패 상태가 다른 src로 이동할 때 섞이지 않도록 하는 안전한 개선이다. |
| `next/image` 전환 여부 | **이번 작업에서는 보류** | 도메인 정책과 배포 설정 영향이 있어 별도 계획으로 다루는 편이 안전하다. |
| 수동 검증 환경 | **일반 compose 또는 배포와 비슷한 production build 조건에서 확인** | dev에서는 이미지 로딩 지연이 덜 보여 문제가 재현되지 않을 수 있다. |

초보 개발자 관점에서 쉽게 말하면, 이번 문제는 “상세 패널이 늦게 바뀐다”기보다 “새 사진이 도착하기 전까지 브라우저가 예전 사진을 화면에 잡고 있다”에 가깝다. 그래서 목록 선택 순간에 이미지 칸을 한 번 비우거나 로딩 표시로 바꾸는 것이 가장 직접적인 해결책이다.

### 사용자 피드백 반영 방향

사용자 피드백에 따라 이번 구현 방향은 아래 기준으로 확정한다.

```text
1. 이전 시설 이미지는 유지하지 않는다.
2. 새 이미지 로딩 중에는 같은 크기의 skeleton/placeholder를 보여준다.
3. 문구는 "CCTV 이미지 갱신 중"으로 짧게 표시한다.
4. 새 이미지가 로드되면 opacity 전환으로 부드럽게 표시한다.
5. 적용 범위는 대시보드 상세 패널 우선으로 제한한다.
```

이 방향은 잘못된 이미지 노출을 막으면서도, 이미지 영역이 흰 화면처럼 비어 보이는 문제를 줄이기 위한 절충안이다.

## 7. 예상 변경 범위

| 파일 | 변경 예상 |
| --- | --- |
| `components/fallback-image.tsx` | src 변경 시 실패 상태 초기화, 선택적 로딩 표시 또는 fallback 표시 옵션 추가 |
| `components/drain-summary-panel.tsx` | 대시보드 상세 패널 이미지에 현재 drain 기준 reset key 또는 loading 옵션 전달 |
| `components/dashboard/dashboard-main-content.tsx` | 필요 시 `DrainDetailPanel`에 선택 id 기반 key 또는 이미지 로딩 정책 props 전달 |
| `docs/steps/step-XX-dashboard-image-selection-stale-preview.md` | 구현 후 변경 내용과 검증 결과 기록 |
| `docs/pr/pr-XX-dashboard-image-selection-stale-preview.md` | 필요 시 PR 요약 작성 |

현재 계획상 `/frontend` 밖의 파일 수정, 새 패키지 설치, API 계약 변경은 필요하지 않다.

## 8. 검증 계획

| 검증 | 방법 | 기대 결과 |
| --- | --- | --- |
| 정적 검사 | `npm.cmd run lint` 또는 `pnpm lint` | ESLint 오류 없음. 기존 `<img>` 경고가 있으면 별도 기록 |
| 빌드 검사 | `npm.cmd run build` 또는 `pnpm build` | Next.js production build 성공 |
| 빠른 선택 전환 | 대시보드에서 DR-001 → DR-002 → DR-003처럼 연속 클릭 | 텍스트와 이미지 영역이 서로 다른 시설 정보를 동시에 보여주지 않음 |
| 느린 이미지 조건 | DevTools Network throttling 또는 compose/prod 환경에서 확인 | 새 이미지 로딩 중 이전 시설 이미지가 남지 않음 |
| 이미지 실패 | 깨진 이미지 URL 또는 차단 URL 확인 | fallback이 정상 표시되고 다음 시설 선택 시 실패 상태가 섞이지 않음 |
| 확대 미리보기 | 이미지 확대 버튼 클릭 | 현재 선택된 시설의 이미지 또는 fallback만 표시 |
| 모바일/데스크톱 | 작은 화면과 2xl 화면에서 확인 | 이미지 영역 레이아웃이 흔들리거나 텍스트와 겹치지 않음 |

## 9. 구현 후 기록할 내용

구현 후 step 문서에는 아래 내용을 남긴다.

- 선택 변경 전/후 이미지 표시 흐름
- `FallbackImage`의 src 변경 처리 방식
- 대시보드 상세 패널에만 적용한 옵션이 있다면 그 이유
- lint/build 결과
- compose 또는 production 유사 조건에서 수동 확인 결과
- 남은 리스크와 추후 `next/image` 전환 검토 조건

## 10. 제안 커밋 메시지

제목:

```text
docs: 대시보드 선택 이미지 잔상 개선 계획 추가
```

내용:

```text
- 목록 선택 시 상세 패널 이미지가 이전 시설 이미지를 잠깐 보여주는 원인을 정리한다.
- FallbackImage와 대시보드 상세 패널 중심의 최소 수정 방향을 제안한다.
- 사용자 확인 사항과 production 유사 환경 검증 계획을 문서화한다.
```
