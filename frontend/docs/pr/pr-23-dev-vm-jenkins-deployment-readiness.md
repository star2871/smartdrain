## PR 제목

[feat] 개발 VM Jenkins 배포와 AI 모델 검증 구성

## 작업 내용

- Jenkins Declarative Pipeline의 `built-in` node label을 지정해 Custom Workspace 컴파일 오류를 해결했습니다.
- `dev` 브랜치를 `/apps/smart-drain`에 배포하는 Jenkins 구성과 `/opt/smartdrain` bootstrap clone 역할을 정리했습니다.
- YOLO `best.pt`만 VM 외부 절대 경로에서 읽기 전용으로 mount하고, XGBoost JSON은 Git 추적 및 image 포함을 유지했습니다.
- Jenkins Validate 단계에서 컨테이너 내부의 YOLO·XGBoost model artifact 존재와 크기를 확인하도록 추가했습니다.
- 실제 VM 홈 디렉터리 기반 모델 경로와 Jenkins Secret File 설정을 배포 문서에 반영했습니다.

## 변경 파일

| 구분 | 파일 |
| --- | --- |
| Jenkins pipeline | `Jenkinsfile`, `.jenkins/scripts/validate.sh` |
| Compose·환경변수 | `docker-compose.yml`, `.dockerignore`, `.gitignore`, `.env.example` |
| 배포 문서 | `frontend/docs/deployment/*`, `frontend/docs/plans/plan-18-*` |
| 완료 기록 | `frontend/docs/steps/step-20-dev-vm-jenkins-deployment-readiness.md` |

## 검증

- `docker compose config --quiet` 통과
- YOLO 모델 mount target 및 read-only 설정 확인
- XGBoost model JSON의 Git 추적 상태 확인
- backend `/`, AI `/health` healthcheck 경로 정적 확인
- `git diff --check` 통과

## 리뷰 포인트

- Jenkins Job의 SCM Branch Specifier는 반드시 `*/dev`여야 합니다.
- Jenkins Secret File에는 `~`가 아닌 실제 절대 경로의 `SMARTDRAIN_YOLO_MODEL_PATH`를 설정해야 합니다.
- 최초 VM Jenkins build에서 image build, 모델 mount 검증, Nginx smoke test를 확인해야 합니다.

## 비고

- 실제 commit, push, Pull Request 생성과 `dev` merge는 담당자가 진행합니다.
