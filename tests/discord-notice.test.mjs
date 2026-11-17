import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendNoticeCandidate } from '../src/discord-notice.ts';

const notice = {
  title: '교내 행사 안내', summary: '신청 가능한 교내 행사입니다.',
  reason: '재학생이 참여할 수 있습니다.', source_url: 'https://www.instagram.com/p/example/',
};

test('sends a linked notice and confirms the message ID without triggering mentions', async () => {
  const result = await sendNoticeCandidate(
    { ...notice, audience: '에리카 재학생', deadline: '11월 30일' },
    'https://discord.com/api/webhooks/example/example?thread_id=42',
    async (url, options) => {
      assert.equal(url.searchParams.get('wait'), 'true');
      assert.equal(url.searchParams.get('thread_id'), '42');
      assert.equal(options.method, 'POST');
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.allowed_mentions, { parse: [] });
      assert.equal(payload.embeds[0].url, notice.source_url);
      assert.equal(payload.embeds[0].fields.length, 3);
      return Response.json({ id: '123', channel_id: '456' });
    },
  );
  assert.deepEqual(result, { message_id: '123', channel_id: '456' });
});

test('omits unknown dates and audiences', async () => {
  await sendNoticeCandidate(notice, 'https://discord.com/api/webhooks/example/example', async (_, options) => {
    assert.deepEqual(JSON.parse(options.body).embeds[0].fields, [{ name: '공지 추천 이유', value: notice.reason }]);
    return Response.json({ id: '123', channel_id: '456' });
  });
});

test('does not call Discord when no webhook is configured', async () => {
  await assert.rejects(sendNoticeCandidate(notice, '', async () => assert.fail('unexpected request')), /DISCORD_NOTICE_WEBHOOK_URL/);
});

test('uses only the notice webhook and never falls back to the insight channel', async () => {
  const previousNotice = process.env.DISCORD_NOTICE_WEBHOOK_URL;
  const previousInsight = process.env.DISCORD_WEBHOOK_URL;
  try {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/insight/example';
    process.env.DISCORD_NOTICE_WEBHOOK_URL = 'https://discord.com/api/webhooks/notice/example';
    await sendNoticeCandidate(notice, undefined, async (url) => {
      assert.equal(url.pathname, '/api/webhooks/notice/example');
      return Response.json({ id: '123', channel_id: '456' });
    });
    delete process.env.DISCORD_NOTICE_WEBHOOK_URL;
    await assert.rejects(sendNoticeCandidate(notice, undefined, async () => assert.fail('must not send to insight channel')), /DISCORD_NOTICE_WEBHOOK_URL/);
  } finally {
    if (previousNotice === undefined) delete process.env.DISCORD_NOTICE_WEBHOOK_URL;
    else process.env.DISCORD_NOTICE_WEBHOOK_URL = previousNotice;
    if (previousInsight === undefined) delete process.env.DISCORD_WEBHOOK_URL;
    else process.env.DISCORD_WEBHOOK_URL = previousInsight;
  }
});

test('reports HTTP errors without exposing the response body or retrying', async () => {
  let calls = 0;
  await assert.rejects(sendNoticeCandidate(notice, 'https://discord.com/api/webhooks/example/example', async () => {
    calls++;
    return new Response('sensitive upstream details', { status: 429 });
  }), { message: 'Discord 전송 실패 (429)' });
  assert.equal(calls, 1);
});

test('does not claim success without a created message', async () => {
  await assert.rejects(sendNoticeCandidate(notice, 'https://discord.com/api/webhooks/example/example', async () => Response.json({})), /메시지 생성 결과/);
});
