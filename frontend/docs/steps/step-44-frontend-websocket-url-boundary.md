# 44 Frontend WebSocket URL 입력 경계 보강 결과

## 작업 목표

REST API 런타임 응답 경계 보강 다음 단계로, WebSocket 연결 URL 생성 경계를 점검했다. 공개 환경변수 또는 API base URL 값이 잘못됐을 때 브라우저 WebSocket 생성자까지 그대로 전달되지 않도록 최소 보강했다.

## 변경 내용

| 파일 | 변경 내용 |
| --- | --- |
| `lib/websocket/drain-status-socket.ts` | WebSocket URL 생성 helper를 추가하고 허용 scheme을 제한 |
| `docs/plans/plan-28-frontend-security-performance-hardening.md` | WebSocket URL 경계 보강 결정 기록 |

## 변경 전

- `NEXT_PUBLIC_WS_URL`이 있으면 path만 붙여 바로 사용했다.
- `NEXT_PUBLIC_API_BASE_URL`은 문자열 치환으로 `http`/`https`를 `ws`/`wss`로 바꿨다.
- `ftp:`, `javascript:`, 깨진 URL 같은 값도 최종적으로 `new WebSocket()`까지 갈 수 있었다.

## 변경 후

- 빈 값과 상대 경로는 현재 origin 기준의 `ws(s)://host/ws/drains/status`로 정규화한다.
- 절대 URL은 `http:`, `https:`, `ws:`, `wss:`만 허용한다.
- 허용 URL도 path는 `/ws/drains/status`로 고정하고 query/hash는 제거한다.
- 허용하지 않는 scheme 또는 파싱 실패 URL은 `null`을 반환해 기존 socket status의 `error` 흐름을 사용한다.

## NO_CHANGE

- WebSocket payload 검증 로직은 이미 이벤트 type과 필수 payload 필드를 확인하므로 변경하지 않았다.
- reconnect delay, cleanup, 재연결 후 query invalidation 흐름은 변경하지 않았다.
- Backend WebSocket 경로와 API 계약은 변경하지 않았다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm exec tsc --noEmit` | 통과 |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm lint` | 통과. 기존 `fallback-image.tsx`의 `<img>` 경고 1건 유지 |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T frontend pnpm build` | 통과 |
| `GET http://127.0.0.1:18080/` | 200 |
| `GET http://127.0.0.1:18080/api/drains` | 200 |

## 남은 리스크

- 현재 frontend는 WebSocket path를 `/ws/drains/status`로 고정한다.
- 향후 배포 환경에서 별도 WebSocket path가 필요하면 환경변수 정책과 URL guard를 함께 조정해야 한다.
- `pnpm.overrides` 경고와 `fallback-image.tsx`의 `<img>` 경고는 기존 관찰 항목으로 유지했다.
