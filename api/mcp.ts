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
