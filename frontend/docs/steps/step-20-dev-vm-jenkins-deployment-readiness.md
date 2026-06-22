# 20 개발 VM Jenkins 배포 준비 결과

## 변경 요약

개발 VM의 Jenkins 배포 경로와 모델 artifact 책임을 정리하고, 배포 전에 컨테이너가 두 모델 파일을 실제로 읽을 수 있는지 검증하도록 구성했다.

| 구분 | 적용 내용 |
| --- | --- |
| Jenkins 실행 | `built-in` node에서 `/deploy/smart-drain` Custom Workspace 사용 |
| 배포 source | VM `/apps/smart-drain`을 Jenkins가 `dev` 브랜치로 checkout |
| Jenkins bootstrap | VM `/opt/smartdrain` clone에서 전용 Jenkins Compose 실행 |
| YOLO 모델 | VM `/home/<VM-user>/apps/opt/smartdrain-data/models/best.pt`를 단일 파일 read-only mount |
| XGBoost 모델 | `ai_service/model/sewer_xgboost_model.json` Git 추적 및 image 포함 유지 |

## 변경 전/후

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| Jenkins agent | `node` agent에 label 누락으로 Pipeline 컴파일 실패 | `label 'built-in'` 지정 |
| YOLO 모델 검증 | Compose 설정만 확인 | Validate 단계에서 컨테이너 mount와 파일 크기 확인 |
| 모델 mount 범위 | 전체 model directory mount 가능성 | `best.pt` 한 파일만 mount해 XGBoost JSON 유지 |
| 모델 경로 문서 | VM 경로와 홈 디렉터리 표기가 혼재 | `/home/<VM-user>/apps/opt/...` 실제 절대 경로 기준으로 통일 |

## 검증 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `docker compose config --quiet` | 통과 | Compose 문법 확인 |
| 모델 mount config 확인 | 통과 | target `/app/ai_service/model/best.pt`, read-only 확인 |
| XGBoost Git 추적 확인 | 통과 | `git ls-files ai_service/model/sewer_xgboost_model.json` 확인 |
| backend·AI health endpoint 정적 확인 | 통과 | backend `/`, AI `/health` 사용 |
| `git diff --check` | 통과 | 공백 오류 없음 |
| Jenkins 실제 build | 미실행 | `dev` merge 뒤 VM Jenkins에서 최초 실행 필요 |

## 배포 전 확인 사항

1. Jenkins Job Branch Specifier를 `*/dev`로 설정한다.
2. Jenkins Secret File `smartdrain-dev-env-file`에 실제 절대 경로의 `SMARTDRAIN_YOLO_MODEL_PATH`를 넣는다.
3. VM에서 `best.pt` 파일의 존재와 읽기 권한을 확인한다.
4. 첫 Jenkins build 뒤 `/`, `/api/dashboard/summary`, 실제 AI 분석 요청을 확인한다.

## 남은 리스크

- 로컬 Docker daemon에 접근할 수 없어 Docker image build·컨테이너 실행은 이 작업 환경에서 검증하지 못했다.
- VM Docker daemon이 모델 source path를 mount할 수 있어야 하며, Validate 단계에서 실패하면 Jenkins Secret File의 실제 경로를 먼저 확인해야 한다.
