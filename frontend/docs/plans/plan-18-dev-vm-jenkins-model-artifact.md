# 18 개발 VM Jenkins 배포 경로 및 YOLO 모델 artifact 구성 계획

## 1. 작업 개요

| 항목 | 내용 |
| --- | --- |
| 권장 브랜치 | `infra/dev-vm-setting` |
| 작업 규모 | 중간 작업 — Jenkins bootstrap source, Custom Workspace, Docker Compose 모델 mount, 배포 문서를 함께 정렬한다. |
| 최종 목표 | Jenkins가 `dev` 브랜치를 `/apps/smart-drain`에 배포하고, 대용량 YOLO 모델은 Git·Docker image 밖에서 안전하게 사용한다. |
| 비목표 | Jenkins Job/credential의 실제 생성, VM 명령 실행, Cloudflare Tunnel 설정, step·PR 문서 작성 |

## 2. 확정 VM 경로와 책임

| VM 경로 | 책임 | Git 추적 |
| --- | --- | --- |
| `/opt/smartdrain` | Jenkins 컨테이너를 시작하는 bootstrap clone | 추적되는 source clone |
| `/apps/smart-drain` | Jenkins Custom Workspace 및 실제 배포 source | Jenkins가 `dev`를 checkout |
| `/opt/smartdrain-data/models/best.pt` | 대용량 YOLO 모델 | Git·Docker image 제외 |

XGBoost `ai_service/model/sewer_xgboost_model.json`은 작고 버전 관리가 필요한 artifact이므로 Git 추적과 Docker image 포함을 유지한다.

## 3. 구현 방향

1. Jenkinsfile의 내장 실행 node label과 배포 브랜치 표기를 `built-in`, `dev`로 맞춘다. 실제 checkout 브랜치는 Jenkins Job의 `*/dev` 설정으로 고정한다.
2. Compose는 `SMARTDRAIN_YOLO_MODEL_PATH` 환경변수로 host의 `best.pt` 한 파일만 컨테이너 기본 경로에 읽기 전용 mount한다.
3. `.dockerignore`는 YOLO `.pt`만 build context에서 제외하고, XGBoost JSON은 image에 남긴다.
4. Jenkins 테스트 이미지와 backend image 이름은 Compose 프로젝트명으로 분리한다.
5. Custom Workspace 가이드와 개발·운영 가이드에 bootstrap clone, `dev` 브랜치, 모델 경로와 교체 절차를 기록한다.

## 4. 검증 계획

| 검증 | 기대 결과 |
| --- | --- |
| `docker compose config --quiet` | Compose 문법과 환경변수 치환이 통과한다. |
| `SMARTDRAIN_YOLO_MODEL_PATH=/opt/smartdrain-data/models/best.pt docker compose config` | 컨테이너 target이 `/app/ai_service/model/best.pt`로 표시된다. |
| `git ls-files ai_service/model/sewer_xgboost_model.json` | XGBoost JSON이 Git 추적 상태로 남는다. |
| `git diff --check` | 공백 오류가 없다. |

## 5. 사용자 확인이 필요한 사항

- Jenkins Job의 Branch Specifier가 `*/dev`인지 확인한다.
- Jenkins Secret File에 VM `.env`와 `SMARTDRAIN_YOLO_MODEL_PATH=/opt/smartdrain-data/models/best.pt`가 포함되는지 확인한다.
- `/opt/smartdrain-data/models/best.pt`를 복사한 뒤 읽기 권한이 있는지 확인한다.
