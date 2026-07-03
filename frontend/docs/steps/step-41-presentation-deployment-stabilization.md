# 41 발표·배포 재현성 안정화 결과

## 작업 결과

발표 전 마무리 작업을 frontend 범위에 한정했다. 루트 `docs/16`, `docs/17`은 기존 문서의 취지를 유지하기 위해 수정하지 않았다. Backend·AI Service·DB schema·분석 로직·API/WebSocket 계약은 변경하지 않았다.

가장 중요한 변경은 Next.js build에서 TypeScript 오류를 무시하던 설정을 제거한 것이다. 이후 production build가 실제 TypeScript 검사를 수행하며 통과하는 것을 확인했다.

## 변경 내용

| 구분 | 변경 전 | 변경 후 |
| --- | --- | --- |
| Next.js 타입 검사 | `ignoreBuildErrors: true`로 build 단계의 타입 오류를 숨길 수 있음 | 설정 제거. production build에서 TypeScript를 실제 실행 |
| Frontend 발표 절차 | lint·build·화면 확인 안내가 분산됨 | frontend README에 build·직접 URL·fallback·분석 callback·모바일 확인 체크리스트 추가 |

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `frontend/next.config.mjs` | TypeScript `ignoreBuildErrors` 설정 제거 |
| `frontend/README.md` | 발표 전 Frontend 체크리스트 추가 |
| `frontend/docs/plans/plan-27-presentation-deployment-stabilization.md` | 승인된 frontend·infra 전용 작업 경계 기록 |

## 검증 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm.cmd run lint` | 통과 | 오류 0건. 기존 `components/fallback-image.tsx`의 native `<img>` 경고 1건 유지 |
| `npx.cmd tsc --noEmit` | 통과 | 진단 출력 없음 |
| `npm.cmd run build` | 통과 | `Running TypeScript` 단계가 실행되고 `/`, `/drains/[id]` build 성공 |
| `docker compose config --quiet` | 통과 | 운영 Compose 문법 확인 |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet` | 통과 | 개발 Compose 병합 문법 확인 |
| `docker compose ps` | 기동 서비스 없음 | 현 환경에는 컨테이너·이미지가 없어 runtime health와 분석 흐름은 미실행 |
| `pnpm lint / exec tsc / build` | 미실행 | 로컬 pnpm이 registry metadata 조회와 임시 파일 삭제 권한 오류로 시작하지 못함. Docker/Jenkins의 pnpm 검증은 실제 배포 환경에서 수행 필요 |

## 유지한 결정

- Google Fonts는 현재 production build가 통과했으므로 변경하지 않았다. Docker/Jenkins에서 외부 폰트 다운로드 실패가 재현될 때만 시스템 폰트 fallback을 검토한다.
- `package-lock.json`과 `pnpm-lock.yaml`은 삭제하지 않았다. Dockerfile과 배포 기준은 pnpm으로 유지한다.
- 위험 이력의 `score: 0`은 현재 UI에서 표시하지 않아 발표 전 수정하지 않는다.
- Compose·Jenkins·Nginx 구조와 루트 운영 문서는 이번 변경 범위에서 제외했다.

## 남은 수동 확인

1. Jenkins 또는 발표 VM에서 Secret File이 `.env`로 복사되고 모델 mount가 정상인지 확인한다.
2. 전체 Compose 기동 뒤 db → migrate → backend → ai-service → frontend → nginx health를 확인한다.
3. 분석 요청부터 YOLO/XGBoost callback, DB 저장, WebSocket 화면 반영까지 한 번 시연한다.
4. 360px 모바일과 발표 해상도에서 직접 URL·새로고침·오류 fallback·핵심 조작을 확인한다.
