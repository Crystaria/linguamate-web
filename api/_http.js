import { BffError } from '../server/coze.js';
import { errorResponse } from '../server/handlers.js';

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    const raw = req.body.trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new BffError('INVALID_JSON', '请求体不是合法的 JSON。', 400);
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new BffError('INVALID_JSON', '请求体不是合法的 JSON。', 400);
  }
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function createHandler(fn) {
  return async function handler(req, res) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, {
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: '请使用 POST。' },
      });
      return;
    }

    try {
      const body = await readBody(req);
      sendJson(res, 200, await fn(body));
    } catch (error) {
      const { status, body } = errorResponse(error);
      if (status >= 500) console.error('[bff]', error);
      sendJson(res, status, body);
    }
  };
}
