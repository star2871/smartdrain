# 50 대시보드 선택 이미지 이전 미리보기 개선 결과

## 작업 목표

대시보드 위험 시설 목록에서 다른 시설을 선택했을 때, 상세 정보 패널의 텍스트와 상태는 새 시설로 바뀌었는데 이미지 영역만 이전 시설 이미지를 잠깐 보여주는 문제를 줄였다.

관제 화면에서는 짧은 순간이라도 주소·상태와 이미지가 서로 다른 시설을 가리키면 신뢰도가 떨어질 수 있으므로, 새 이미지 로딩 중에는 이전 이미지를 유지하지 않고 같은 크기의 갱신 중 placeholder를 보여주는 방향으로 정리했다.

## 변경 전 흐름

```text
DR-001 선택
-> DR-001 이미지 표시
-> DR-002 선택
-> 텍스트/상태/수치는 DR-002로 즉시 변경
-> 새 이미지 로딩 완료 전까지 브라우저가 DR-001 이미지를 잠깐 유지할 수 있음
-> DR-002 이미지 로드 후 교체
```

이 흐름은 React 선택 상태가 늦다기보다, 일반 `<img>`가 새 `src` 이미지를 다운로드하고 디코딩하는 동안 이전에 그린 픽셀을 잠깐 유지할 수 있는 동작과 맞닿아 있다.

## 변경 내용

| 파일 | 변경 내용 |
| --- | --- |
| `components/dashboard/dashboard-main-content.tsx` | 대시보드 상세 패널에 `showImageRefreshPlaceholder` 옵션을 전달한다. |
| `components/drain-summary-panel.tsx` | 선택 시설 이미지 영역에 `SnapshotImage` 표시 컴포넌트를 추가하고, 선택 id와 이미지 URL이 바뀌면 새 이미지 컴포넌트를 재마운트한다. |
| `components/drain-summary-panel.tsx` | 새 이미지 로딩 중에는 이전 이미지를 숨기고, 같은 크기의 `CCTV 이미지 갱신 중` skeleton/placeholder를 표시한다. |
| `docs/plans/plan-34-dashboard-image-selection-stale-preview.md` | 사용자 피드백을 반영한 최종 UX 방향을 추가한다. |

## Nginx 502 원인 후보 확인

사용자 피드백으로 Nginx가 Compose 서비스명이 아니라 컨테이너 IP를 직접 보고 있으면, 컨테이너 재생성 뒤 IP가 바뀌어 502가 날 수 있다는 점을 함께 확인했다.

현재 레포 기준 설정은 이미 서비스 이름을 사용하고 있다.

| 파일 | 확인 내용 | 판단 |
| --- | --- | --- |
| `nginx/default.conf` | `/api/`, `/ws/`는 `proxy_pass http://backend:8000;`, `/`와 `/demo-control`은 `proxy_pass http://frontend:3000;` 사용 | 운영 설정 안전 |
| `nginx/default.dev.conf` | 개발 설정도 backend/frontend 서비스 이름 기준 proxy 사용 | 개발 설정 안전 |
| `docker-compose.yml` | 서비스명이 `backend`, `frontend`, `nginx`로 정의되어 있고 Nginx가 같은 Compose 네트워크에서 접근 | Nginx upstream 이름과 일치 |
| `docker-compose.dev.yml` | Nginx 설정 mount만 `default.dev.conf`로 바꾸며 upstream 이름은 유지 | dev override 안전 |
| 전체 검색 | `172.21.0.4`, `172.21.0.5` 같은 컨테이너 IP 직접 참조는 발견되지 않음 | 현재 코드 수정 불필요 |

따라서 이번 브랜치에서 Nginx 설정 파일 자체를 수정할 필요는 없었다. 다만 운영 서버나 Jenkins workspace에 과거 설정 파일이 남아 있고 그 파일이 `COMPOSE_NGINX_CONF_PATH`로 mount되면, 레포의 `nginx/default.conf`와 달리 IP 직접 참조가 살아 있을 수 있다.

### 502 발생 시 확인 순서

```text
1. docker compose ps 로 frontend/backend/nginx 상태 확인
2. docker compose logs --tail=100 nginx backend frontend 확인
3. nginx container에 mount된 /etc/nginx/conf.d/default.conf 내용 확인
4. proxy_pass가 172.x.x.x IP인지, backend/frontend 서비스명인지 확인
5. IP 직접 참조라면 레포의 nginx/default.conf 또는 nginx/default.dev.conf를 mount하도록 수정
6. nginx 컨테이너 재생성 후 /, /api, /ws smoke 확인
```

권장 기준은 아래 형태다.

```nginx
proxy_pass http://frontend:3000;
proxy_pass http://backend:8000;
```

컨테이너 IP는 재생성 때 바뀔 수 있지만, Compose 서비스명은 같은 Compose 네트워크 안에서 내부 DNS로 다시 해석된다. 그래서 운영·개발 모두 IP가 아니라 서비스명 기준으로 유지하는 것이 안전하다.

## Jenkins 배포 직후 502 완화 수정

추가 로그 확인 결과, Nginx 설정 파일은 서비스명을 사용하지만 Jenkins 배포 중 `frontend`, `backend`, `ai-service` 컨테이너는 재생성되고 `nginx` 컨테이너는 기존 Running 상태로 유지될 수 있었다.

이 경우 Nginx 설정 파일에는 `frontend:3000`, `backend:8000`이 적혀 있어도, 실행 중인 Nginx 프로세스가 배포 순간의 upstream 연결 상태 또는 DNS 해석 결과와 어긋나면서 짧은 시간 `connect() failed (111: Connection refused) while connecting to upstream` 502를 낼 수 있다.

### 변경 전 Jenkins 흐름

```text
Deploy stage
-> docker compose up --detach --build --remove-orphans
-> frontend/backend 컨테이너 재생성
-> nginx 컨테이너는 변경이 없으면 기존 Running 유지

Smoke test stage
-> nginx health가 healthy인지 확인
-> / 1회 요청
-> /api/dashboard/summary 1회 요청
-> 한 번이라도 502면 pipeline 실패
```

`depends_on: condition: service_healthy`는 Nginx 컨테이너가 새로 생성될 때의 시작 순서에는 도움을 주지만, 기존 Nginx가 그대로 유지되는 배포에서는 새 upstream 컨테이너 안정화와 Nginx 내부 연결 상태 재정렬을 보장하지 않는다.

### 변경 내용

| 파일 | 변경 내용 |
| --- | --- |
| `.jenkins/scripts/deploy.sh` | 전체 compose 배포 후 `docker compose up --detach --no-deps --force-recreate nginx`를 실행해 Nginx 컨테이너를 명시적으로 재생성한다. |
| `.jenkins/scripts/smoke-test.sh` | Nginx health 확인 뒤 `/`, `/api/dashboard/summary`를 각각 최대 20회, 3초 간격으로 retry한다. |
| `.jenkins/scripts/smoke-test.sh` | 최종 실패 시 `docker compose ps`, `nginx backend frontend` 로그 tail, Nginx 설정 mount source/read-only 상태를 출력한다. |

### 변경 후 Jenkins 흐름

```text
Deploy stage
-> docker compose up --detach --build --remove-orphans
-> frontend/backend/ai-service 필요한 컨테이너 재생성
-> docker compose up --detach --no-deps --force-recreate nginx
-> nginx가 새 컨테이너로 뜨며 현재 Compose DNS/upstream 상태를 다시 사용
-> nginx 설정 mount source/read-only 상태 확인

Smoke test stage
-> nginx health 확인
-> / 요청을 최대 60초 동안 retry
-> /api/dashboard/summary 요청을 최대 60초 동안 retry
-> 성공하면 통과
-> 최종 실패하면 진단 로그 출력 후 실패
```

### 기대 효과

| 항목 | 기대 효과 |
| --- | --- |
| Nginx upstream 상태 | upstream 컨테이너 재생성 뒤 Nginx도 새로 뜨므로 오래된 연결/해석 상태 가능성을 줄인다. |
| Smoke false negative | 배포 직후 짧은 준비 지연을 1회 실패로 판단하지 않는다. |
| 장애 분석 | 실패 시 Nginx, backend, frontend 로그와 mount 상태를 Jenkins console에서 바로 확인할 수 있다. |

### 의도적으로 하지 않은 것

| 항목 | 이유 |
| --- | --- |
| GHCR pull 배포 전환 | 현재 dev 배포 구조는 VM 내부 build/compose up 방식이므로 발표 전 범위를 넘는다. |
| blue/green 또는 무중단 배포 | 구조 변경이 크고 발표 전 리스크가 크다. |
| Nginx 동적 resolver 재설계 | `resolver 127.0.0.11`과 variable proxy 방식은 설정 복잡도가 올라가므로 이번 최소 수정에서 제외한다. |
| Docker prune/build cache 정리 자동화 | 디스크 안정성 보조 이슈이며, 502 직접 완화와 섞지 않는다. |

## 변경 후 흐름

```text
DR-001 선택
-> DR-001 이미지 표시
-> DR-002 선택
-> 텍스트/상태/수치는 DR-002로 즉시 변경
-> 이미지 컴포넌트가 DR-002 기준으로 새로 마운트됨
-> 이전 DR-001 이미지는 화면에서 제거됨
-> 같은 크기의 "CCTV 이미지 갱신 중" skeleton 표시
-> DR-002 이미지 onLoad 후 opacity 전환으로 표시
```

## 적용 범위

이번 변경은 대시보드 상세 정보 패널에 우선 적용했다.

| 구분 | 처리 |
| --- | --- |
| 대시보드 우측 상세 패널 | 적용 |
| 상세 페이지 CCTV 카드 | 변경 없음 |
| 이미지 확대 dialog | 기존처럼 현재 선택 이미지 URL을 사용 |
| `next/image` 전환 | 보류 |
| API 계약 변경 | 없음 |
| 새 패키지 추가 | 없음 |

## 기대 효과

| 항목 | 기대 효과 |
| --- | --- |
| 정확성 | 텍스트는 새 시설인데 이미지는 이전 시설인 상태를 피한다. |
| 안정감 | 빈 흰 화면 대신 같은 크기의 skeleton을 보여줘 화면이 깨진 느낌을 줄인다. |
| 회귀 위험 | 적용 범위를 대시보드 상세 패널로 제한해 상세 페이지 CCTV 카드 동작은 유지한다. |

## 검증 결과

| 명령어 | 결과 | 비고 |
| --- | --- | --- |
| `npm.cmd --prefix frontend run lint` | 통과 | 기존 `components/fallback-image.tsx`의 `<img>` 성능 경고 1건 유지 |
| `npm.cmd --prefix frontend run build` | 통과 | 최초 실행은 깨진 `.next/dev/types/routes.d.ts` 생성 캐시 때문에 실패했으며, `.gitignore` 대상인 `frontend/.next` 캐시 삭제 후 재실행 통과 |
| Nginx upstream 검색 | 통과 | `nginx/default*.conf`는 `backend:8000`, `frontend:3000` 서비스 이름을 사용하고, `172.21.0.x` 직접 참조는 발견되지 않음 |
| `sh -n .jenkins/scripts/deploy.sh` | 미실행 | 현재 로컬 Windows 환경에 `sh` 명령이 없어 shell syntax 검사를 실행하지 못함 |
| `sh -n .jenkins/scripts/smoke-test.sh` | 미실행 | 현재 로컬 Windows 환경에 `sh` 명령이 없어 shell syntax 검사를 실행하지 못함 |
| `bash -n .jenkins/scripts/deploy.sh` | 실패 | WSL bash 실행이 `E_ACCESSDENIED`로 막혀 문법 검사를 완료하지 못함 |
| `bash -n .jenkins/scripts/smoke-test.sh` | 실패 | WSL bash 실행이 `E_ACCESSDENIED`로 막혀 문법 검사를 완료하지 못함 |
| `git ls-files --eol .jenkins/scripts/deploy.sh .jenkins/scripts/smoke-test.sh` | 통과 | 두 shell script working tree가 `w/lf`로 정리됨 |
| `git diff --check` | 통과 | 공백 오류 없음. Windows Git의 CRLF 경고는 표시됨 |

## 남은 확인 사항

- 일반 compose 또는 배포와 비슷한 production 조건에서 DR-001, DR-002, DR-003을 빠르게 전환하며 이전 이미지가 남지 않는지 수동 확인한다.
- 이미지 로딩이 아주 느린 조건에서 skeleton 문구와 확대 버튼이 어색하지 않은지 확인한다.
- 향후 외부 이미지 도메인과 크기 정책이 확정되면 `next/image` 전환은 별도 계획으로 검토한다.
- 실제 운영 VM 또는 Jenkins 배포 경로에서 Nginx 컨테이너가 레포의 `nginx/default.conf`를 mount하는지 확인한다. 과거 IP 직접 참조 설정 파일이 mount되어 있으면 컨테이너 재생성 뒤 502가 재발할 수 있다.
- Jenkins dev 배포에서 `nginx`가 `Recreate`되는지, smoke test가 일시적인 502를 retry 후 통과하는지 실제 pipeline으로 확인한다.
