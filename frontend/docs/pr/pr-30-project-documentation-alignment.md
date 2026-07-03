## PR 제목

[docs] 프로젝트 기준 문서 정합성 점검 및 갱신

## 작업 내용

- 현재 코드, Alembic migration, Docker Compose, Nginx, Jenkins 설정을 기준으로 구현·검증 현황 문서를 추가했습니다.
- AI 모델 artifact 관리, 테스트/E2E 기준, 배포 운영 절차를 각각 현재 기준 문서로 정리했습니다.
- `docs/07_ERD.md`를 실제 테이블명, PK/FK, `analysis_jobs` 구조에 맞게 보정했습니다.
- `docs/11_API명세서.md`에 초안 경로와 현재 구현 경로의 차이를 쉽게 확인할 수 있는 안내를 추가했습니다.
- `frontend/README.md`를 현재 REST·WebSocket·재연결 후 Query cache 보정 흐름에 맞게 갱신했습니다.
- frontend 문서 변경의 이유·코드 근거·영향은 `step-38`과 `docs/14`에 남겼습니다.

## 주요 변경 파일

| 구분 | 파일 |
| --- | --- |
| 구현·검증 기준 | `docs/14_구현현황_및_검증결과.md` |
| AI artifact 기준 | `docs/15_AI_모델_아티팩트_관리_명세.md` |
| 테스트·E2E 기준 | `docs/16_테스트_전략_및_E2E_검증.md` |
| 배포 운영 기준 | `docs/17_배포_운영_런북.md` |
| 기존 문서 보정 | `docs/07_ERD.md`, `docs/11_API명세서.md`, `frontend/README.md` |
| 작업 기록 | `frontend/docs/plans/plan-25-project-documentation-alignment.md`, `frontend/docs/steps/step-38-project-documentation-alignment.md` |

## 검증 결과

- `git diff --check` 통과
- `npm.cmd --prefix frontend run lint` 통과 — 기존 `<img>` 최적화 경고 1건
- `npm.cmd --prefix frontend exec -- tsc --project frontend/tsconfig.json --noEmit` 통과
- `python -m pytest ai_service -q` 미실행 — 현재 Python 환경에 `pytest` 모듈 없음

## 리뷰 포인트

- `docs/14`의 구현 완료·코드 확인·미검증 상태 구분이 발표·인수인계 용도로 충분히 명확한지 확인합니다.
- `docs/07`의 현재 schema가 migration 0001~0003과 일치하는지 확인합니다.
- `docs/11`의 보정표가 실제 frontend/backend 연동 시 혼동을 줄이는지 확인합니다.
- 루트 `README.md`는 원격 최신 변경과 충돌 가능성이 있어 수정하지 않았으며, `docs/14`의 링크 반영 제안만 후속 반영합니다.

## 비고

- 애플리케이션 코드, 설정, migration, 테스트 파일은 수정하지 않았습니다.
- `backend/**`, `ai_service/**`, 루트 `README.md`는 이번 수정 범위에서 제외했습니다.
