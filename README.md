# 하냥냥 Discord MCP

Codex의 주간 PostHog 분석 결과를 Discord Webhook으로 전송하는 원격 MCP 서버입니다.

## 환경변수

- `DISCORD_WEBHOOK_URL`: Discord 채널의 웹훅 URL
- `MCP_AUTH_TOKEN`: 원격 MCP 호출을 보호할 긴 토큰
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase anon key. `service_role` 키는 사용하지 않습니다.

## Supabase 피드백 조회 함수

`get_recent_feedback` 도구를 사용하려면 Supabase에 `get_recent_feedback` RPC 함수를 만들어야 합니다. 현재 운영 DB의 `public.feedbacks` 테이블 구조에 맞춘 예시입니다. 개인정보와 운영 메모는 반환하지 않습니다.

```sql
create or replace function public.get_recent_feedback(
  start_date timestamptz,
  end_date timestamptz,
  result_limit integer default 100
)
returns table (
  created_at timestamptz,
  category text,
  feedback_type text,
  platform text,
  status text,
  content text
)
language sql
security definer
set search_path = public
as $$
  select f.created_at, f.category, f.feedback_type, f.platform, f.status, f.content
  from public.feedbacks f
  where f.created_at >= start_date and f.created_at < end_date
  order by f.created_at desc
  limit least(result_limit, 200);
$$;

revoke all on function public.get_recent_feedback(timestamptz, timestamptz, integer) from public;
grant execute on function public.get_recent_feedback(timestamptz, timestamptz, integer) to anon;
```

현재 `feedbacks` 테이블에는 `anon`과 `authenticated`에 INSERT, UPDATE, DELETE 권한이 부여되어 있습니다. MCP 조회 기능과는 별개로, 운영 DB에서는 실제 쓰기 권한이 필요한 API에만 권한을 남기고 조회 전용 호출 주체에는 `EXECUTE` 권한만 부여하는 것을 권장합니다.

## 로컬 확인

```bash
npm install
npm run build
vercel dev
```

MCP 주소는 `http://localhost:3000/api/mcp`이며, Vercel 배포 뒤에는 `https://<프로젝트>.vercel.app/api/mcp`입니다.
