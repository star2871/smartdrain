# 45 Frontend 보안 경계 감사 및 측정 기반 리팩터링 결과

## 작업 목표

`refactor/frontend-security-boundary-audit` 브랜치에서 Step 42~44의 성능 측정과 guard 보강 결과를 다시 확인하고, 실제 적용 가치가 있는 리팩터링을 최소 범위로 반영했다. 단순 확인에 그치지 않고 상세 차트 chunk 분리, 지도 계산 memoization, API guard 과잉 검증 완화를 함께 진행했다.

이번 작업의 기준은 “성능 개선처럼 보이는 변경”을 모두 넣는 것이 아니라, 이전 측정 결과와 실제 코드 흐름을 같이 보고 **사용자 체감 지연을 줄일 가능성이 있으면서 기존 UX를 흔들지 않는 변경만 적용**하는 것이었다. 그래서 상세 차트는 분리하고, 대시보드 지도와 목록 virtualization은 보류했다.

## 판단 배경

Step 42의 production 측정에서 대시보드와 상세 화면 모두 LCP와 조작 반응이 MVP 기준으로 큰 병목은 아니었다. 다만 bundle analyzer에서 `recharts`와 `react-kakao-maps-sdk`가 공통 client chunk를 키우는 사실은 확인됐다. 이 둘을 똑같이 지연 로딩하면 chunk는 줄 수 있지만, UX 영향은 다르다.

대시보드 지도는 첫 화면에서 관리자가 바로 보는 핵심 영역이다. 지도 로딩을 늦추면 초기 JS는 줄어도 첫 화면의 주요 정보가 늦게 보일 수 있다. 반대로 상세 센서 차트는 상세 페이지 안의 독립 카드이며, CCTV·위험 요약·AI 분석 탭과 함께 보는 보조 정보에 가깝다. 그래서 `recharts` 기반 차트만 먼저 dynamic import 대상으로 선택했다.

guard 쪽은 반대로 “더 많이 막는 것”이 항상 좋은 방향은 아니었다. 백엔드 schema에서 `latitude`, `longitude`, 상세 `imageUrl`은 null이 될 수 있는데, frontend guard가 이를 잘못된 응답으로 처리하면 정상 API 응답이 화면 오류로 이어질 수 있다. 이번 작업에서는 guard를 약화한 것이 아니라, 백엔드 계약과 화면 fallback 흐름에 맞게 **정상 null과 비정상 payload를 구분**하도록 맞췄다.

## 변경 내용

| 파일 | 변경 내용 |
| --- | --- |
| `app/drains/[id]/page.tsx` | `SensorTrendChart`를 `next/dynamic`으로 지연 로딩하고 깜빡임을 줄이는 경량 skeleton fallback 추가 |
| `components/sensor-trend-chart.tsx` | dynamic import에서 재사용할 props 타입 export |
| `components/risk-map.tsx` | 범례 count와 Kakao marker 생성 memoization 적용, nullable 좌표 type guard 추가 |
| `lib/api/types.ts`, `lib/mock-data.ts` | 백엔드 schema에 맞춰 좌표와 상세 `imageUrl`의 nullable 가능성 반영 |
| `lib/api/response-guards.ts` | 좌표·상세 이미지 guard가 실제 API null 값을 과하게 차단하지 않도록 완화 |
| `eslint.config.mjs` | 컨테이너 내 `.pnpm-store`가 lint scan 대상이 되지 않도록 ignore 추가 |
| `docs/plans/plan-29-frontend-security-boundary-audit.md` | 확인 중심 문구를 적용 중심 계획으로 갱신 |

## 적용한 리팩터링

| 후보 | 적용 여부 | 이유 |
| --- | --- | --- |
| 상세 센서 차트 dynamic import | 적용 | `recharts`는 공통 client chunk의 큰 비중을 차지하며, 상세 차트는 첫 화면 핵심 액션보다 독립적인 카드다. |
| 지도 dynamic import | 보류 | 대시보드 첫 화면 핵심 기능이라 지연 로딩하면 지도 표시 UX가 나빠질 수 있다. |
| 지도 memoization | 적용 | 마커 이미지와 범례 count는 같은 입력에서 반복 생성될 수 있어 계산 경계를 좁혔다. |
| 목록 virtualization | 보류 | 현재 MVP 데이터량이 작고, 새 패키지 없이 직접 구현하면 선택 상태와 모바일 inline summary UX가 복잡해진다. |
| API guard 완화 | 적용 | 백엔드 schema상 좌표와 상세 이미지가 null일 수 있어, null만으로 전체 API 응답을 실패 처리하지 않도록 조정했다. |

## 변경 상세

### 상세 센서 차트 dynamic import

`SensorTrendChart`는 `recharts`를 직접 import한다. Step 42 측정에서 chart/map 계열 라이브러리가 공통 client chunk를 키우는 주요 원인으로 확인됐으므로, 상세 페이지에서 차트 리소스를 분리할 가치가 있었다.

적용 방식은 route 전체를 나누지 않고, 상세 페이지 안에서 차트 컴포넌트만 `next/dynamic`으로 감쌌다. 처음에는 기존 `PlaceholderState`를 재사용하는 방식을 검토했지만, 상세 차트 chunk가 빠르게 로드되는 환경에서는 “센서 차트 준비 중” 같은 안내 문구가 순간적으로 보였다 사라지며 오히려 깜빡임처럼 느껴질 수 있었다.

그래서 최종 구현은 텍스트형 placeholder가 아니라 실제 차트 카드와 비슷한 높이만 예약하는 경량 skeleton fallback으로 바꿨다. 이 fallback은 사용자가 읽어야 하는 문구를 노출하지 않고, 카드 제목·범례·차트 영역 위치만 조용히 잡아 둔다. 실시간 정보를 확인하는 화면에서는 로딩 상태를 크게 알리는 것보다 시선 흐름을 방해하지 않고 레이아웃 흔들림을 막는 편이 더 좋은 UX라고 판단했다.

대시보드 지도에는 같은 방식을 적용하지 않았다. 지도는 첫 화면의 주요 정보이고, Kakao 지도 키가 없거나 좌표가 없을 때도 fallback 지도를 보여주는 흐름이 이미 있다. 따라서 지도 자체를 지연 로딩하면 fallback 판단과 실제 지도 표시 타이밍이 복잡해지고, 관리자가 처음 보는 핵심 화면이 늦어질 수 있다.

### 지도 계산 memoization

`RiskMap`은 렌더링마다 좌표 필터링, 선택 시설 탐색, 범례 count 계산, Kakao marker element 생성을 수행한다. 전체 데이터가 아주 크지는 않지만, WebSocket 이벤트나 선택 상태 변경으로 반복 렌더링될 수 있는 영역이다.

이미 `validDrains`와 `selectedDrain`은 memoization되어 있었고, 이번에는 빠져 있던 범례 count와 marker 생성을 같은 기준으로 정리했다. 특히 marker는 Kakao map 하위 element와 marker image 데이터를 함께 만들기 때문에, `drains`, `selectedId`, `onSelect`가 바뀔 때만 다시 생성되도록 했다.

목록에는 virtualization을 적용하지 않았다. 현재 `DrainRiskListItem`은 이미 `memo`와 prop 비교를 사용하고 있고, 실제 MVP 데이터량도 작다. 직접 virtualization을 추가하면 스크롤 높이 계산, 선택 시설의 모바일 inline summary, 키보드/터치 UX가 함께 복잡해진다. 실제 시설 수 증가나 Profiler 병목이 확인되기 전에는 유지보수 비용이 더 크다고 판단했다.

### API guard nullable 정합성

백엔드 모델과 schema를 확인한 결과 배수구 좌표는 `float | None`, YOLO 이미지 URL도 `str | None`으로 정의되어 있다. 기존 guard는 좌표를 반드시 finite number로 요구하고 상세 `imageUrl`을 optional string으로만 허용했다.

이 조건은 “잘못된 payload 방어”가 아니라 “정상 null 응답 차단”이 될 수 있다. 그래서 DTO 타입을 `number | null`, `string | null`로 맞추고, 지도 컴포넌트에서 실제 렌더링 가능한 좌표만 `hasValidCoordinate`로 좁히도록 책임을 옮겼다. 즉 API 경계는 계약에 맞게 받아들이고, 지도 렌더링 경계에서 표시 가능 여부를 판단한다.

### ESLint ignore 보강

컨테이너 내부에서 lint를 실행할 때 `/app/.pnpm-store`가 scan 대상에 포함되며 `ENOMEM`이 발생했다. 이 폴더는 소스 코드가 아니라 pnpm store 캐시이므로 ESLint 검사 대상이 아니다.

`eslint.config.mjs`의 `globalIgnores`에 `.pnpm-store/**`를 추가해 dev 컨테이너와 로컬 환경 모두에서 lint가 소스 파일만 검사하도록 정리했다. 이 변경은 기능 동작에는 영향을 주지 않고 검증 재현성을 안정화한다.

## 보안·guard 감사 결과

- REST API guard는 wrapper 구조와 핵심 DTO 필드 확인을 유지한다.
- `latitude`, `longitude`는 백엔드 모델과 schema에서 nullable이므로 `number | null`로 맞췄다.
- 상세 `imageUrl`도 최신 YOLO 결과가 없으면 null일 수 있어 `string | null`을 허용했다.
- 지도는 nullable 좌표를 받은 뒤 `hasValidCoordinate`에서 실제 렌더링 가능한 항목만 필터링한다.
- WebSocket URL guard는 이번 단계에서 변경하지 않았다. Step 44의 scheme 제한과 same-origin fallback이 현재 dev/prod 경로와 맞다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm exec tsc --noEmit` | 통과 |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm lint` | 통과. 기존 `fallback-image.tsx`의 `<img>` 경고 1건 유지 |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm build` | 통과 |
| `GET http://127.0.0.1:18080/` | 200 |
| `GET http://127.0.0.1:18080/api/drains` | 200 |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml ps` | `db`, `backend`, `ai-service`, `frontend`, `nginx` 모두 healthy |

## 남은 리스크

- 상세 차트 dynamic import의 실제 chunk 감소 수치는 별도 analyzer 재측정으로 확인할 수 있다.
- 목록 virtualization은 실제 시설 수 증가나 Profiler 병목이 확인될 때 `@tanstack/react-virtual` 같은 검증된 라이브러리 도입을 별도 승인 후 검토한다.
- `fallback-image.tsx`의 `<img>` 경고는 외부 이미지 도메인·최적화 비용 정책이 정리된 뒤 `next/image` 전환 여부를 판단한다.
- CSP/security headers는 Kakao 지도, inline theme script, 외부 이미지 정책과 함께 배포 설정 브랜치에서 다루는 편이 안전하다.

## 다음 단계 추천

dev 병합 후 개발 서버에서 상세 페이지를 열어 차트 영역이 흔들리거나 텍스트 placeholder가 깜빡이지 않고 자연스럽게 실제 차트로 전환되는지 확인한다. 대시보드 지도는 첫 화면에서 기존처럼 즉시 표시되거나 Kakao 키 누락 시 fallback 지도가 표시되어야 한다.

추가 성능 확인이 필요하면 `ANALYZE=true pnpm exec next build --webpack`으로 chart chunk가 실제로 분리됐는지 다시 측정한다. 단, 이 재측정은 현재 기능 검증의 필수 조건은 아니며, PR 리뷰에서 chunk 변화 수치를 요구할 때 수행하면 된다.
