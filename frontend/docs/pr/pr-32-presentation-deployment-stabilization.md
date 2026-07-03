## PR 제목

[chore] 발표 환경의 빌드·배포 재현성 안정화

## 작업 내용

- Next.js production build가 TypeScript 오류를 무시하지 않도록 `ignoreBuildErrors` 설정을 제거했습니다.
- frontend README에 빌드, 직접 URL, fallback, 분석 callback, 모바일 화면 확인을 포함한 발표 전 체크리스트를 추가했습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| Frontend build 안정화 | `frontend/next.config.mjs` |
| Frontend 발표 체크리스트 | `frontend/README.md` |
| 작업 기록 | `frontend/docs/plans/plan-27-presentation-deployment-stabilization.md`, `frontend/docs/steps/step-41-presentation-deployment-stabilization.md` |

## 검증 결과

- `npm.cmd run lint` 통과 — 기존 `components/fallback-image.tsx`의 native `<img>` 경고 1건 유지
- `npx.cmd tsc --noEmit` 통과
- `npm.cmd run build` 통과 — TypeScript 실행 및 `/`, `/drains/[id]` route 생성 확인
- `docker compose config --quiet` 통과
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet` 통과
- `docker compose ps` 확인 — 현재 실행 중 컨테이너 없음

## 리뷰 포인트

- `ignoreBuildErrors` 제거 후 production build가 TypeScript 단계를 실제 수행하는지 확인합니다.
- frontend README의 발표 전 체크리스트가 기능 확장 없이 화면·fallback·모바일 검증 범위를 충분히 담는지 확인합니다.

## 비고

- Backend·AI Service·DB schema·분석 로직·API/WebSocket 계약은 변경하지 않았습니다.
- 루트 `docs/16_테스트_전략_및_E2E_검증.md`, `docs/17_배포_운영_런북.md`과 Compose·Jenkins·Nginx 설정은 이번 PR 범위에서 제외했습니다.
- Google Fonts는 현재 build가 통과해 변경하지 않았습니다. Jenkins/Docker에서 다운로드 실패가 재현될 때만 fallback을 검토합니다.
- pnpm은 Dockerfile·배포 기준으로 유지합니다. 로컬 pnpm 실행은 도구 환경의 registry/권한 문제로 미실행이므로 Jenkins 또는 Docker에서 재검증이 필요합니다.
