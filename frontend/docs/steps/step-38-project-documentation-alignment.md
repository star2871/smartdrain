# 38 프로젝트 문서 정합성 점검 결과

## 1. 작업 목적

루트 `docs`와 `frontend` 문서를 현재 코드·migration·배포 설정 기준으로 점검했다. 애플리케이션 코드와 `backend`, `ai_service` 내부 문서는 수정하지 않았다.

## 2. Frontend 문서 변경 추적

| 문서 | 기존 상태 | 변경 이유·코드 근거 | 영향 |
| --- | --- | --- | --- |
| `frontend/README.md` | 과거 `feat/drain-data-ui` 상태와 WebSocket 제외 범위를 안내 | `realtime-drain-sync.tsx`, `drain-status-socket.tsx`에 WebSocket 3종 이벤트·재연결 Query 무효화 구현 확인 | 현재 실행·데이터 흐름·미구현 테스트 범위를 정확히 안내 |
| `frontend/docs/plans/plan-25-*` | 수정 범위에 backend·AI 문서가 포함됨 | 사용자 확정 범위가 `frontend`, 루트 `docs`임 | 문서 작업 범위와 제외 범위를 명확화 |

## 3. 루트 기준 문서 변경

| 문서 | 변경 이유 | 코드 근거 |
| --- | --- | --- |
| `docs/07_ERD.md` | 과거 논리 모델의 테이블명·PK·필드가 migration과 불일치 | Alembic 0001~0003 |
| `docs/11_API명세서.md` | 초안의 제안 endpoint가 현재 구현 경로와 혼동될 수 있음 | `backend/app/routers/analysis.py`, `sensor_data.py` |
| `docs/14`~`docs/17` | 구현, 모델 artifact, 테스트, 배포 운영의 current source of truth 부재 | 코드·Compose·Nginx·Jenkins·test 구조 |

## 4. 변경하지 않은 항목

- 루트 `README.md`: `origin/dev`에 현재 브랜치에 없는 대규모 변경이 있어 충돌 방지를 위해 수정하지 않았다.
- `frontend/docs/plans`, `steps`, `pr`: 과거 작업 이력의 본문은 재작성하지 않았다.
- `backend/**`, `ai_service/**`: 사용자 확정 범위 밖이므로 읽기 근거로만 사용했다.

## 5. 남은 확인 항목

- YOLO `best.pt`의 버전·SHA256·학습 평가 자료
- Jenkins와 Docker Compose의 실제 실행 결과
- Backend/Frontend 자동 테스트 및 전체 브라우저 E2E 구축

## 6. 검증 결과

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `git diff --check` | 통과 | 문서 공백 오류 없음 |
| `npm.cmd --prefix frontend run lint` | 통과(경고 1건) | 기존 `fallback-image.tsx`의 `<img>` 경고 |
| `npm.cmd --prefix frontend exec -- tsc --project frontend/tsconfig.json --noEmit` | 통과 | 타입 오류 없음 |
| `python -m pytest ai_service -q` | 미실행 | `pytest` 모듈이 현재 환경에 없음 |
