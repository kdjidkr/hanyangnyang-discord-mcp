export interface NoticeCandidate {
  title: string;
  summary: string;
  reason: string;
  source_url: string;
  audience?: string;
  deadline?: string;
}

export async function sendNoticeCandidate(
  notice: NoticeCandidate,
  webhookUrl = process.env.DISCORD_NOTICE_WEBHOOK_URL,
  request: typeof fetch = fetch,
) {
  if (!webhookUrl) throw new Error('DISCORD_NOTICE_WEBHOOK_URL 환경변수가 설정되지 않았습니다.');
  const url = new URL(webhookUrl);
  url.searchParams.set('wait', 'true');
  const fields = [{ name: '공지 추천 이유', value: notice.reason }];
  if (notice.audience) fields.push({ name: '대상', value: notice.audience });
  if (notice.deadline) fields.push({ name: '일정·마감', value: notice.deadline });
  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      username: '하냥냥 공지 후보',
      allowed_mentions: { parse: [] },
      embeds: [{ title: notice.title, url: notice.source_url, description: notice.summary,
        color: 0x6e93f7, fields, footer: { text: '공지 게시 전 내용과 원문을 확인해주세요.' } }],
    }),
  });
  if (!response.ok) throw new Error(`Discord 전송 실패 (${response.status})`);
  const message = await response.json() as { id?: string; channel_id?: string };
  if (!message.id || !message.channel_id) {
    throw new Error('Discord 메시지 생성 결과를 확인할 수 없습니다. 중복 전송을 피하려면 채널을 먼저 확인해주세요.');
  }
  return { message_id: message.id, channel_id: message.channel_id };
}
