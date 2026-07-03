# 42 Frontend 번들 측정 기준선 확보 결과

## 작업 목표

보안·성능 리팩터링 전에 실제 client bundle 구성을 확인했다. 측정 결과만으로 지도·차트의 lazy loading이나 Client Component 구조를 변경하지 않고, 다음 판단에 필요한 기준선을 남기는 데 집중했다.

## 변경 내용

| 파일 | 변경 내용 |
| --- | --- |
| `package.json` | `@next/bundle-analyzer`를 devDependency로 추가 |
| `pnpm-lock.yaml` | 분석 도구 의존성 lockfile 반영 |
| `next.config.mjs` | `ANALYZE=true`에서만 bundle analyzer wrapper가 활성화되도록 추가 |
| `docs/plans/plan-28-frontend-security-performance-hardening.md` | 측정 결과와 다음 승인 항목 기록 |

분석 도구는 개발·측정 전용이며, 기본 production build와 브라우저 런타임에 포함되지 않는다.

## 측정 명령과 결과

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `ANALYZE=true pnpm build` | build 통과, 리포트 미생성 | Next.js 16 기본 Turbopack build는 `@next/bundle-analyzer`와 호환되지 않음 |
| `ANALYZE=true pnpm exec next build --webpack` | 통과, `client.html` 등 분석 리포트 생성 | 측정 전용 Webpack build. 기본 build 설정은 유지 |

클라이언트 리포트 기준 주요 수치는 다음과 같다.

| chunk | parsed | gzip | 포함 내용 |
| --- | ---: | ---: | --- |
| 공통 client chunk | 약 354KB | 약 103KB | `recharts`, `react-kakao-maps-sdk`와 하위 의존성 |
| 대시보드 route 전용 | 약 29KB | 약 7KB | 대시보드 표시 컴포넌트 |
| 상세 route 전용 | 약 31KB | 약 8KB | 상세 표시 컴포넌트 |

## 결정

- 대시보드 지도는 핵심 첫 화면 기능이므로 지연 로딩하지 않는다.
- 공통 chunk가 큰 사실만으로 차트를 dynamic import하지 않는다. 실제 모바일 LCP·입력 반응·네트워크 조건을 추가 측정한 뒤 적용 여부를 다시 결정한다.
- Zod, React Hook Form, virtualization, CSP, `next/image` 전환은 이번 단계에 도입하지 않았다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| Webpack analyzer build | 통과 |
| TypeScript | Webpack production build 단계에서 통과 |
| 기본 Turbopack build | 앞선 기준선에서 통과. analyzer 리포트만 생성되지 않음 |

## 다음 단계

실제 모바일 환경에서 대시보드 첫 표시와 상세 차트 진입의 성능을 측정한다. 차트 지연 로딩이 사용자 체감 지연을 줄일 근거가 생길 때만 별도 승인을 받아 적용한다.

## 모바일 런타임 기준선

Docker Compose로 기동한 통합 환경의 Nginx(`http://127.0.0.1:18080`)를 대상으로 Chrome DevTools Protocol 측정을 수행했다. 모바일 화면 크기는 375×667, device scale factor는 2로 고정했고, 캐시를 끈 상태에서 왕복 지연 150ms·다운로드 200KB/s·업로드 75KB/s의 4G 유사 조건을 적용했다.

| 화면 | LCP | CLS | Long task | 관찰 내용 |
| --- | ---: | ---: | ---: | --- |
| 대시보드 `/` | 876ms | 0 | 1건 / 131ms | 첫 표시 자체는 양호했다. 목록·지도 표시에 레이아웃 이동은 관찰되지 않았다. |
| 상세 `/drains/DR-001` | 3,100ms | 0 | 1건 / 79ms | 응답 시작이 약 2.5초로 늦었고, 차트 관련 개발 청크가 함께 내려왔다. |

### 측정 해석과 한계

- 현재 Compose `frontend` 서비스는 `target: development`와 `pnpm dev`로 실행된다. 측정 리소스에 `next-devtools`, Turbopack 개발 청크가 포함됐으므로 전송량·`load` 완료 시간은 **배포 성능 지표로 사용하지 않는다**.
- 상세 페이지의 느린 첫 응답은 개발 서버의 route compile·개발 오버헤드와 통합 API 응답이 섞인 값이다. 이 한 번의 측정만으로 차트 lazy loading이나 API 구조 변경을 결정하지 않는다.
- 두 화면 모두 CLS가 0이어서 이번 조건에서 이미지·지도·차트로 인한 눈에 띄는 초기 레이아웃 이동은 재현되지 않았다.
- 대시보드의 131ms long task와 상세의 79ms long task는 입력 지연 가능성을 점검할 신호이지만, 단일 cold run만으로 최적화 우선순위를 바꿀 근거는 부족하다.

### 결정

- **NO_CHANGE:** 지도와 차트의 dynamic import, memoization 변경, virtualization은 적용하지 않는다.
- **추가 측정 필요:** 배포 이미지 또는 staging에서 같은 뷰포트·네트워크 조건으로 cold/warm 각 3회 이상 측정하고, 상세 차트 탭 전환·대시보드 시설 선택의 INP/long task를 함께 기록한다.
- **다음 판단 기준:** production 측정에서도 상세 첫 표시 LCP가 반복적으로 높고 차트가 LCP 요소가 아닌 경우에만, 상세 차트의 제한적 지연 로딩을 별도 승인 항목으로 제안한다.

## Production 모바일 재측정

개발 서버 수치를 배포 품질로 오해하지 않도록, Dockerfile `runner` 단계의 standalone frontend와 분리된 backend·DB·Nginx를 일시적으로 기동해 같은 조건으로 재측정했다. 기존 18080 개발 스택은 유지했고, 측정용 stack은 18081 포트와 별도 DB·mock seed를 사용한 뒤 종료·삭제했다.

측정 조건은 375×667, device scale factor 2, 캐시 비활성 cold run 및 캐시 사용 warm run 각 3회, 왕복 지연 150ms·다운로드 200KB/s·업로드 75KB/s의 4G 유사 조건이다. 아래 값은 합성 측정의 산술 평균이며 실제 사용자 필드 데이터(CrUX)는 아니다.

| 화면 | Cold LCP | Warm LCP | Cold 전송량 | CLS | Long task 합계 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 대시보드 `/` | 2.37초 | 557ms | 약 339KB | 0.013 | 평균 91ms |
| 상세 `/drains/DR-001` | 803ms | 265ms | 약 487KB | 0 | 평균 224ms |

### 조작 반응 확인

초기 로드가 끝난 warm production 화면에서 각 동작을 3회 반복하고, click 뒤 두 번의 `requestAnimationFrame`까지 걸린 시간을 기록했다. 이 값은 Event Timing 기반 INP가 아니라 동일 환경에서 비교하기 위한 **click-to-next-frame 근사치**다.

| 동작 | 결과 | 해석 |
| --- | ---: | --- |
| 대시보드 `DR-003` 시설 선택 | 32~33ms | 선택 강조와 모바일 요약 표시가 즉시 반영됐다. |
| 상세 XGBoost 탭 전환 | 33~41ms | 2열×3행 정보 패널이 정상 표시됐고, 탭 전환 자체는 병목이 아니었다. |

### 최종 판단

- **NO_CHANGE:** 대시보드 지도 지연 로딩, 상세 차트 `next/dynamic`, 목록 virtualization, 기존 memoization 변경은 적용하지 않는다. 상세의 cold LCP는 양호하고, 차트는 LCP 요소가 아닌 것으로 관찰됐다.
- **관찰 항목:** 상세 화면은 대시보드보다 cold 전송량과 long task 합계가 크다. 현재 MVP 데이터와 조작 반응에서는 체감 지연이 재현되지 않았으므로, 실제 시설·차트 데이터가 증가하거나 저사양 실기기에서 입력 지연이 확인될 때만 다시 프로파일링한다.
- **측정 재현성:** 이 결과는 production Docker build가 성공하고, API 데이터·Nginx same-origin 경로·모바일 화면이 함께 동작하는 것을 확인한 기준선으로 보관한다.
