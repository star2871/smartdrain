# PR 제목

[fix] 대시보드 선택 이미지와 Jenkins Nginx 배포 안정화

## 작업 내용

- 대시보드 위험 시설 목록에서 다른 시설을 선택했을 때, 상세 정보 패널 이미지가 이전 시설 이미지를 잠깐 보여주지 않도록 수정했습니다.
- 새 CCTV 이미지가 로드되기 전에는 같은 크기의 skeleton과 `CCTV 이미지 갱신 중` 문구를 표시해 빈 화면처럼 튀지 않도록 했습니다.
- 대시보드 상세 패널에만 이미지 갱신 placeholder 옵션을 적용해 상세 페이지 CCTV 카드의 기존 동작은 유지했습니다.
- Jenkins 배포 직후 `frontend`/`backend` 컨테이너는 재생성되지만 `nginx` 컨테이너가 기존 상태로 유지되며 upstream 502가 발생할 수 있는 흐름을 완화했습니다.
- Compose 배포 후 `nginx`를 명시적으로 `--force-recreate`하여 Docker DNS/upstream 상태를 다시 잡도록 했습니다.
- Smoke test가 배포 직후 1회 502만으로 실패하지 않도록 `/`, `/api/dashboard/summary` 요청에 retry를 추가했습니다.
- Smoke 최종 실패 시 `docker compose ps`, `nginx/backend/frontend` 로그, Nginx 설정 mount 정보를 Jenkins console에 출력하도록 했습니다.
- `plan-34`, `step-50`에 이미지 잔상 원인, Nginx 502 진단, Jenkins 배포 안정화 내용을 기록했습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| 대시보드 이미지 UX | `frontend/components/dashboard/dashboard-main-content.tsx` |
| 대시보드 상세 패널 | `frontend/components/drain-summary-panel.tsx` |
| Jenkins 배포 | `.jenkins/scripts/deploy.sh` |
| Jenkins smoke test | `.jenkins/scripts/smoke-test.sh` |
| 계획 문서 | `frontend/docs/plans/plan-34-dashboard-image-selection-stale-preview.md` |
| 결과 문서 | `frontend/docs/steps/step-50-dashboard-image-selection-stale-preview.md` |

## 변경 전/후

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 대시보드 시설 선택 이미지 | 텍스트는 새 시설로 바뀌었지만 이미지가 이전 시설 이미지를 잠깐 유지할 수 있음 | 선택 id와 이미지 URL이 바뀌면 이미지 컴포넌트를 새로 마운트하고, 로딩 중 skeleton 표시 |
| 이미지 로딩 중 UX | 이전 이미지가 남거나 브라우저 기본 로딩 동작에 의존 | 같은 크기의 `CCTV 이미지 갱신 중` placeholder 표시 후 새 이미지 opacity 전환 |
| 적용 범위 | 공통 이미지 컴포넌트 동작에 의존 | 대시보드 상세 패널 우선 적용 |
| Jenkins deploy | `docker compose up --detach --build --remove-orphans` 후 nginx가 기존 Running 상태로 유지될 수 있음 | compose 배포 후 `nginx`를 `--force-recreate`로 명시적 재생성 |
| Smoke test | Nginx health 확인 후 `/`, `/api/dashboard/summary` 각각 1회 요청 | 각 endpoint를 최대 20회, 3초 간격으로 retry |
| Smoke 실패 진단 | post failure의 제한된 로그에 의존 | 실패 즉시 ps, 주요 로그, Nginx mount 정보를 출력 |

## 검증 결과

- `npm.cmd --prefix frontend run lint` 통과
  - 기존 `frontend/components/fallback-image.tsx`의 native `<img>` 경고 1건 유지
- `npm.cmd --prefix frontend run build` 통과
  - 최초 실행은 깨진 `.next/dev/types/routes.d.ts` 생성 캐시 때문에 실패
  - `.gitignore` 대상인 `frontend/.next` 캐시 삭제 후 재실행 통과
- Nginx upstream 검색 확인
  - `nginx/default.conf`, `nginx/default.dev.conf`는 `backend:8000`, `frontend:3000` 서비스 이름을 사용
  - `172.21.0.x` 직접 참조는 발견되지 않음
- `git diff --check` 통과
- `.jenkins/scripts/deploy.sh`, `.jenkins/scripts/smoke-test.sh` working tree EOL이 `w/lf`인지 확인

## 비고

- 로컬 Windows 환경에 `sh` 명령이 없어 `sh -n` 문법 검사는 실행하지 못했습니다.
- WSL `bash -n`은 `E_ACCESSDENIED`로 실행되지 않아 shell syntax 검사를 완료하지 못했습니다.
- Jenkins 배포 안정화는 실제 dev VM pipeline에서 `nginx`가 `Recreate`되는지, smoke retry 후 통과하는지 확인해야 합니다.
- Jenkins 컨테이너 자체를 재빌드해야 하는 변경은 아닙니다. 이번 수정은 Jenkins Job이 checkout한 workspace의 `.jenkins/scripts`를 실행하면서 반영됩니다.

## 리뷰 포인트

- 시설을 빠르게 전환할 때 대시보드 상세 패널에서 이전 시설 이미지가 보이지 않는지 확인합니다.
- 이미지 로딩이 느린 환경에서 `CCTV 이미지 갱신 중` placeholder가 레이아웃 흔들림 없이 표시되는지 확인합니다.
- 상세 페이지 CCTV 카드나 이미지 확대 dialog 동작이 의도치 않게 바뀌지 않았는지 확인합니다.
- Jenkins Deploy stage에서 `nginx`가 `--force-recreate`로 재생성되는지 확인합니다.
- Jenkins Smoke test에서 일시적인 502가 retry로 흡수되고, 최종 실패 시 진단 로그가 충분히 남는지 확인합니다.
- 실제 VM의 Jenkins workspace와 `DEPLOY_DIR`가 현재 코드 기준 `/home/yp/apps/smart-drain`으로 일치하는지 확인합니다.
