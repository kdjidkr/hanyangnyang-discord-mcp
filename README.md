# 하냥냥 Discord MCP

Codex의 주간 PostHog 분석 결과를 Discord Webhook으로 전송하는 원격 MCP 서버입니다.

## MCP 도구

| 도구 | 기능 |
| --- | --- |
| `get_recent_feedback` | 지정한 기간의 Supabase 피드백 조회 |
| `send_weekly_insight` | 기존 주간 분석 전송 |
| `send_notice_candidate` | 공지 후보의 제목·요약·추천 이유·원문 링크를 Discord로 전송 |

`send_notice_candidate`는 공지 전용 `DISCORD_NOTICE_WEBHOOK_URL` 채널을 사용합니다. 기존 주간 인사이트용 `DISCORD_WEBHOOK_URL`과 별도로 설정해야 합니다. 공지용 URL이 없으면 전송을 중단하며 기존 URL로 대체하지 않습니다. Vercel 프로젝트의 환경변수에 공지용 URL을 저장한 뒤 재배포하세요. `audience`와 `deadline`은 원문에서 확인한 경우에만 입력합니다. 중요도 판단과 중복 확인은 호출하는 작업에서 수행하며, 이 도구는 전송만 담당합니다.

```json
{
  "title": "교내 프로그램 신청 안내",
  "summary": "원문에서 확인한 신청 조건과 내용을 요약합니다.",
  "reason": "학생들이 신청할 수 있는 프로그램이며 접수 기간이 남아 있습니다.",
  "source_url": "https://www.instagram.com/p/EXAMPLE/"
}
```

전송은 Discord의 메시지 생성 응답을 확인한 뒤 성공을 반환합니다. 응답을 받지 못한 경우에는 실제 채널을 확인하기 전에 재전송하지 마세요. 멘션 알림은 기본으로 비활성화합니다. 이 기능은 하냥냥 서비스에 공지를 자동 게시하지 않습니다.

변경 사항을 Vercel에 배포한 뒤 MCP 클라이언트에서 도구 목록을 다시 불러오거나 재연결해야 새 도구가 표시됩니다. 테스트는 Node.js 22.18 이상에서 `npm test`로 실행할 수 있으며, 외부 Discord 요청은 모의 처리합니다.

## 환경변수

- `DISCORD_WEBHOOK_URL`: 기존 주간 인사이트 채널의 웹훅 URL
- `DISCORD_NOTICE_WEBHOOK_URL`: 공지 후보 전용 채널의 웹훅 URL
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
