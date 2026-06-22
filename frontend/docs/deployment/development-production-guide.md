# SmartDrain 개발·운영 및 배포 가이드

## 1. 목적

이 문서는 SmartDrain을 개발 환경과 운영 환경에서 같은 기준으로 실행·검증·배포하기 위한 팀 가이드다. frontend 담당자도 API URL, WebSocket, Vercel 환경변수, 장애 확인 지점을 이해할 수 있도록 작성한다.

| 환경 | 실행 위치 | CI/CD | 외부 진입 | 목표 |
| --- | --- | --- | --- | --- |
| 개발 | 개인 VirtualBox의 Ubuntu | Jenkins | Cloudflare 개발 서브도메인 | 팀 통합 테스트와 데모 검증 |
| 운영/배포 | AWS + Vercel | GitHub Actions | Cloudflare 운영 서브도메인 | 공개 데모와 배포 흐름 제시 |

## 2. 전체 흐름

```text
개발
Git push → Jenkins (VirtualBox Ubuntu)
         → lint / AI pytest / Docker build / 개발 Compose smoke test
         → Docker Compose + Nginx → Cloudflare 개발 서브도메인

운영
main merge → GitHub Actions → test / image publish / AWS deploy
사용자 → app.<메인도메인> → Vercel frontend
       → api.<메인도메인> → Cloudflare → AWS Nginx → backend / AI / DB
```

Vercel frontend와 AWS API는 서로 다른 origin이 될 가능성이 높다. 이 경우 `NEXT_PUBLIC_API_BASE_URL`은 `/api`가 아니라 `https://api.<운영도메인>`을 사용하며, backend `CORS_ORIGINS`에는 실제 Vercel 도메인과 사용자 지정 frontend 도메인을 명시한다. WebSocket helper는 HTTPS API URL을 `wss://`로 변환한다.

## 3. 개발: VirtualBox Ubuntu + Jenkins

```text
개발자 브라우저 → https://dev.<메인도메인> → Cloudflare
                → VirtualBox Ubuntu Nginx → Docker Compose 서비스

Git push → Jenkins → 검사·image build·개발 Compose 재기동
```

개인 VirtualBox는 가능한 경우 Cloudflare Tunnel로 연결해 원본 IP/포트를 외부에 열지 않는다. Tunnel을 쓰지 않으면 포트포워딩, VM 고정 IP, 방화벽, TLS, origin 접근 제한을 팀이 별도로 관리해야 한다.

| 용도 | 권장 이름 | 대상 |
| --- | --- | --- |
| 개발 통합 화면 | `dev.<메인도메인>` | VirtualBox Ubuntu Nginx |
| 운영 frontend | `app.<메인도메인>` 또는 루트 도메인 | Vercel |
| 운영 API/WebSocket | `api.<메인도메인>` | AWS Nginx/ALB |

Cloudflare 프록시를 사용할 때는 실제 도메인에서 SSL/TLS와 WebSocket 연결을 확인한다. API와 WebSocket에는 캐시 규칙을 적용하지 않는다.

### Jenkins 최소 파이프라인

| 순서 | 단계 | 실패 시 확인 |
| --- | --- | --- |
| 1 | checkout 및 `.env` 존재 확인 | secret을 출력하지 않고 중단 |
| 2 | Compose config 검증 | 환경변수/문법 수정 |
| 3 | frontend lint/build | 코드 오류 수정 |
| 4 | `python -m pytest ai_service` | AI 계약 회귀 수정 |
| 5 | Docker image build | Dockerfile/의존성 수정 |
| 6 | 개발 Compose 재기동 | migration·healthcheck 로그 확인 |
| 7 | smoke test | `/`, `/api/dashboard/summary`, WebSocket 확인 |

Jenkins credential에는 Git 접근 토큰, Cloudflare Tunnel token 등 최소 권한만 저장한다. Jenkins console log에 `.env`, AWS key, DB URL을 출력하지 않는다.

### 개발 VM 모델 artifact

개발 VM의 YOLO 모델 `best.pt`는 Git과 Docker image에서 분리해 `/opt/smartdrain-data/models/best.pt`에 저장한다. Jenkins Secret File `.env`에는 아래 값을 넣고, Compose가 파일 하나만 읽기 전용으로 mount하게 한다.

```dotenv
SMARTDRAIN_YOLO_MODEL_PATH=/opt/smartdrain-data/models/best.pt
```

XGBoost 모델 `ai_service/model/sewer_xgboost_model.json`은 저장소에서 추적하는 경량 artifact이므로 Docker image에 포함된다. `/app/ai_service/model` 전체를 VM 경로로 mount하면 이 파일이 가려지므로 `best.pt` 파일만 mount한다. 모델 파일은 Jenkins workspace(`/apps/smart-drain`)에 두지 않아 checkout과 배포 이미지 build에 영향을 주지 않게 한다.

## 4. 운영: AWS + GitHub Actions + Vercel

인턴 프로젝트는 동작하는 배포 흐름과 운영 판단 근거를 보여주는 것이 중요하다. 처음부터 모든 AWS 관리형 서비스를 구성할 필요는 없다.

| 단계 | 구성 | 보여줄 수 있는 것 | 권장 시점 |
| --- | --- | --- | --- |
| A. 데모 최소 | EC2 1대 + Docker Compose + Nginx + PostgreSQL volume | containerized backend/AI/DB, healthcheck, Cloudflare API 도메인 | 1차 공개 데모 |
| B. 안정성 보강 | EC2 backend/AI + Amazon RDS PostgreSQL | DB와 앱 분리, backup/접속 정책 | 데이터 중요도·운영 기간이 늘 때 |
| C. 확장 시연 | ECS/Fargate 또는 별도 image 배포 + ECR | image 배포와 관리형 실행 환경 | 시간·예산·학습 목표가 남을 때 |

현재는 A를 완성하고 RDS는 “도입 판단 기준과 연결 변수 분리”까지 문서화하는 것을 권장한다. RDS는 비용, VPC/보안 그룹, 백업, 팀 AWS 권한이 확정된 뒤 진행한다. Compose, migration, Nginx, CI/CD, secret 분리를 안정적으로 보여주는 편이 MVP 데모에는 더 설득력 있다.

```text
Frontend: GitHub main → GitHub Actions → Vercel production → app.<메인도메인>
API:      GitHub main → GitHub Actions → Docker image → AWS → api.<메인도메인>
```

Vercel에는 frontend만 배포한다. PostgreSQL, FastAPI backend, AI service는 Vercel serverless function에 함께 넣지 않는다. 분석 callback과 WebSocket은 AWS 서비스가 담당한다.

### GitHub Actions 권장 흐름

1. Pull Request: frontend lint/build, AI pytest, Compose config 검증.
2. `main` merge: 검증 성공 뒤 Docker image build 및 registry publish.
3. AWS deploy: 승인된 image tag만 EC2/ECS에 반영. credential과 DB secret은 GitHub Secrets 또는 AWS IAM OIDC 역할로 전달.
4. post-deploy: `/`, `/api/dashboard/summary`, WebSocket을 확인하고 실패 시 이전 image tag로 복구.

## 5. 환경변수와 Secret

### 5.1 frontend 환경변수 선언 규칙

| 실행 방식 | 선언 위치 | frontend가 읽는 값 | API 주소 예시 |
| --- | --- | --- | --- |
| Docker Compose 개발/운영 | root `.env`의 `COMPOSE_FRONTEND_*` | Next 설정이 `NEXT_PUBLIC_*`로 변환 | 빈 값(same-origin, API 함수의 `/api/*` 사용) |
| Docker 없이 frontend 로컬 실행 | `frontend/.env.local` | `NEXT_PUBLIC_*` 직접 사용 | `http://localhost:8000` |
| Vercel | Vercel Environment Variables | `NEXT_PUBLIC_*` 직접 사용 | `https://api.<운영도메인>` |

이름을 분리한 이유는 frontend 폴더 전체를 Docker 개발 컨테이너에 bind mount할 때도 로컬 `.env.local`이 Compose 값을 덮어쓰지 않게 하기 위해서다. Compose는 `COMPOSE_FRONTEND_*`만 frontend 컨테이너에 전달하고, `next.config.mjs`가 이를 명시적으로 공개 runtime/build 값으로 주입한다.

root `.env` 전체를 frontend 컨테이너에 파일로 mount하지 않는다. root에는 DB password 같은 값이 있을 수 있으므로, frontend에는 실제로 필요한 공개 변수만 environment로 전달하는 것이 원칙이다.

| 위치 | 넣어도 되는 값 | 넣으면 안 되는 값 |
| --- | --- | --- |
| frontend `NEXT_PUBLIC_*` | 공개 API URL, Kakao JavaScript 키 | DB URL, AWS key, 비밀번호, webhook secret |
| Vercel Environment Variables | frontend 공개 변수 | backend/DB 내부 secret |
| GitHub Actions Variables | AWS region, image repository, 도메인 | access key, DB password, deploy token |
| GitHub Actions Secrets / AWS Secrets Manager | deploy credential, DB password, signing secret | 브라우저 공개 변수 |
| 개발 VM `.env` | 개발 전용 Compose 값 | 운영 secret 복사본 |

RDS로 전환하면 `DATABASE_URL` host만 바꾸지 말고 security group, 백업, SSL 요구 사항도 함께 검토한다.

## 6. 테스트 운영 기준

| 구분 | 개발 VM/Jenkins | 운영/GitHub Actions | 담당 |
| --- | --- | --- | --- |
| 코드 품질 | lint, frontend build | PR 필수 검사 | frontend |
| AI 계약 | pytest | PR/merge 검사 | AI |
| 컨테이너 | 개발 Compose build·healthcheck | production image build·취약점 점검 후보 | infra |
| 통합 | Nginx REST/WebSocket smoke test | public domain smoke test | infra + frontend |
| 수동 UI | 대시보드·지도·상세 확인 | Vercel production 확인 | frontend |

현재 backend 전용 자동 테스트는 별도로 구성되어 있지 않다. API 변경 시 FastAPI 문서 또는 통합 테스트로 확인하고 backend pytest/API smoke test를 후속 과제로 둔다.

## 7. 배포 전 체크리스트

- [ ] 개발과 운영 서브도메인이 분리되어 있다.
- [ ] Cloudflare SSL/TLS와 WebSocket을 실제 도메인에서 확인했다.
- [ ] Vercel `NEXT_PUBLIC_API_BASE_URL`이 운영 API 도메인이다.
- [ ] backend CORS에 Vercel/사용자 지정 frontend origin이 포함되어 있다.
- [ ] 운영 secret은 Git, Docker image, Jenkins log에 포함되지 않는다.
- [ ] 개발 VM의 `best.pt`는 `/opt/smartdrain-data/models/best.pt`에 있고, Jenkins Secret File의 `SMARTDRAIN_YOLO_MODEL_PATH`와 일치한다.
- [ ] migration·복구 절차와 배포 전후 smoke test를 통과했다.
- [ ] 사용하지 않는 AWS 리소스를 종료해 비용을 점검했다.

## 8. 이번 범위 밖 항목

- RDS, private subnet, NAT Gateway 같은 비용이 큰 네트워크 구성
- ECS/Fargate, Kubernetes, autoscaling, Blue/Green 배포
- 실제 CCTV/IoT와 대용량 GPU 모델 artifact 운영

보류 항목은 미구현으로 숨기지 않고 MVP·인턴 프로젝트 범위에서 보류한 이유를 발표와 문서에 명확히 설명한다.
