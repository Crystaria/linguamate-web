import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

// Load .env / .env.local before importing the handlers so module-level
// configuration (mock mode, default target language) sees the values.
for (const file of ['.env', '.env.local']) {
  const filePath = path.join(projectRoot, file);
  if (existsSync(filePath)) {
    try {
      process.loadEnvFile(filePath);
      console.log(`[bff] loaded ${file}`);
    } catch (error) {
      console.warn(`[bff] failed to load ${file}: ${error.message}`);
    }
  }
}

const { BffError } = await import('./coze.js');
const {
  handleAnalyze,
  handleExercises,
  handleChat,
  handleOcr,
  handleHealth,
  errorResponse,
} = await import('./handlers.js');

const PORT = Number(process.env.PORT || 8787);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 12 * 1024 * 1024);
const ALLOWED_ORIGINS = new Set(
  (
    process.env.DEV_CORS_ORIGIN ||
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const POST_ROUTES = {
  '/api/analyze': handleAnalyze,
  '/api/exercises': handleExercises,
  '/api/chat': handleChat,
  '/api/ocr': handleOcr,
};

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new BffError('PAYLOAD_TOO_LARGE', '请求体过大。', 413);
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new BffError('INVALID_JSON', '请求体不是合法的 JSON。', 400);
  }
}

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/health')) {
      sendJson(res, 200, await handleHealth());
      return;
    }

    const handler = POST_ROUTES[pathname];
    if (!handler) {
      sendJson(res, 404, {
        success: false,
        error: { code: 'NOT_FOUND', message: `未找到端点 ${pathname}` },
      });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, {
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: '请使用 POST。' },
      });
      return;
    }

    const body = await readJson(req);
    const result = await handler(body);
    sendJson(res, 200, result);
  } catch (error) {
    const { status, body } = errorResponse(error);
    if (status >= 500) console.error('[bff]', error);
    sendJson(res, status, body);
  } finally {
    console.log(
      `[bff] ${req.method} ${pathname} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
    );
  }
});

server.listen(PORT, () => {
  console.log(`[bff] LinguaMate BFF listening on http://127.0.0.1:${PORT}`);
  console.log('[bff] endpoints: /api/analyze /api/exercises /api/chat /api/ocr /api/health');
  if (process.env.COZE_MOCK === '1') {
    console.log('[bff] COZE_MOCK=1 -> serving mock fixtures (set COZE_MOCK=0 to call Coze).');
  } else if (!process.env.COZE_TOKEN) {
    console.log('[bff] COZE_TOKEN is empty -> mock fixtures are served.');
  }
});
