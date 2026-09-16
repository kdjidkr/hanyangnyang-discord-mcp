# 하냥냥 Discord MCP

Codex의 주간 PostHog 분석 결과를 Discord Webhook으로 전송하는 원격 MCP 서버입니다.

## 환경변수

- `DISCORD_WEBHOOK_URL`: Discord 채널의 웹훅 URL
- `MCP_AUTH_TOKEN`: 원격 MCP 호출을 보호할 긴 토큰

## 로컬 확인

```bash
npm install
npm run build
vercel dev
```

MCP 주소는 `http://localhost:3000/api/mcp`이며, Vercel 배포 뒤에는 `https://<프로젝트>.vercel.app/api/mcp`입니다.
