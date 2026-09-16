import type { VercelRequest, VercelResponse } from '@vercel/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const server = new McpServer({ name: 'hanyangnyang-discord', version: '0.1.0' });
server.registerTool('send_weekly_insight', { description: '하냥냥 주간 분석을 Discord 웹훅 채널에 보냅니다.', inputSchema: { period: z.string().min(1), title: z.string().min(1).max(256), summary: z.string().min(1).max(4000) } }, async ({ period, title, summary }) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.');
  const result = await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: '하냥냥 주간 인사이트', embeds: [{ title, description: summary, color: 0x6e93f7, fields: [{ name: '분석 기간', value: period }], footer: { text: 'PostHog 주간 분석' } }] }) });
  if (!result.ok) throw new Error(`Discord 전송 실패 (${result.status}): ${(await result.text()).slice(0, 300)}`);
  return { content: [{ type: 'text', text: 'Discord에 주간 인사이트를 전송했습니다.' }] };
});

server.registerTool('get_recent_feedback', {
  description: '지정한 기간의 피드백을 Supabase 읽기 전용 함수로 조회합니다.',
  inputSchema: {
    start_date: z.string().min(1).describe('조회 시작 시각(ISO 8601)'),
    end_date: z.string().min(1).describe('조회 종료 시각(ISO 8601)'),
    limit: z.number().int().min(1).max(200).default(100),
  },
}, async ({ start_date, end_date, limit }) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL과 SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.');
  }

  const result = await fetch(`${supabaseUrl}/rest/v1/rpc/get_recent_feedback`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ start_date, end_date, result_limit: limit }),
  });

  if (!result.ok) {
    throw new Error(`Supabase 피드백 조회 실패 (${result.status}): ${(await result.text()).slice(0, 300)}`);
  }

  const feedback = await result.json();
  return {
    content: [{ type: 'text', text: JSON.stringify(feedback) }],
  };
});

function isAuthorized(request: VercelRequest): boolean {
  const expected = process.env.MCP_AUTH_TOKEN;
  return Boolean(expected && request.headers.authorization === `Bearer ${expected}`);
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method Not Allowed' }); }
  if (!isAuthorized(request)) return response.status(401).json({ error: 'Unauthorized' });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  try { await transport.handleRequest(request, response, request.body); } finally { await transport.close(); await server.close(); }
}
