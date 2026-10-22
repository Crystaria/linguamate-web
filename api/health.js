import { handleHealth } from '../server/handlers.js';
import { sendJson } from './_http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, {
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: '请使用 GET。' },
    });
    return;
  }

  sendJson(res, 200, await handleHealth());
}
