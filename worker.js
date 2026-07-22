const COZE_ORIGIN = 'https://nbg43svttx.coze.site';
const ALLOWED_ORIGIN = 'https://tzynb112.github.io';

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function withCors(headers, request) {
  const result = new Headers(headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    result.set(key, value);
  }
  return result;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const incomingUrl = new URL(request.url);
    const allowedPath = incomingUrl.pathname === '/api/chat'
      || incomingUrl.pathname === '/api/garden'
      || incomingUrl.pathname === '/api/voices'
      || incomingUrl.pathname.startsWith('/static/');

    if (!allowedPath) {
      return new Response('Not found', { status: 404, headers: corsHeaders(request) });
    }

    if (!env.COZE_TOKEN) {
      return new Response('COZE_TOKEN is not configured', { status: 500, headers: corsHeaders(request) });
    }

    const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, COZE_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${env.COZE_TOKEN}`);
    headers.delete('Host');

    const init = { method: request.method, headers, redirect: 'follow' };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    const upstream = await fetch(targetUrl, init);
    const contentType = upstream.headers.get('content-type') || '';

    if (incomingUrl.pathname === '/api/chat' && contentType.includes('application/json')) {
      const data = await upstream.json();
      if (typeof data.audio_url === 'string' && data.audio_url.startsWith('/')) {
        data.audio_url = new URL(data.audio_url, request.url).toString();
      }
      const responseHeaders = withCors({ 'Content-Type': 'application/json; charset=utf-8' }, request);
      return new Response(JSON.stringify(data), { status: upstream.status, headers: responseHeaders });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: withCors(upstream.headers, request),
    });
  },
};
