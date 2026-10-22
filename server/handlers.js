import {
  BffError,
  LEVELS,
  analyzeText,
  chatTurn,
  generateExercises,
  isMockMode,
  ocrImage,
  uploadImageToCoze,
  workflowIds,
  newTraceId,
} from './coze.js';

const DEFAULT_TARGET_LANGUAGE = process.env.DEFAULT_TARGET_LANGUAGE || 'en';

function normalizeLevel(level) {
  const value = String(level || '').toLowerCase();
  return LEVELS.includes(value) ? value : 'beginner';
}

function normalizeLanguage(value, fallback) {
  const language = String(value || '').trim().toLowerCase();
  return /^[a-z]{2,3}(-[a-z0-9]+)?$/.test(language) ? language : fallback;
}

function requireString(value, field, { max = 20000, min = 1 } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) {
    throw new BffError('INVALID_INPUT', `参数 ${field} 不能为空。`, 400);
  }
  if (text.length > max) {
    throw new BffError('INVALID_INPUT', `参数 ${field} 过长（上限 ${max} 字符）。`, 413);
  }
  return text;
}

function languagePair(body) {
  return {
    level: normalizeLevel(body.level),
    ui_language: normalizeLanguage(body.ui_language || body.language, 'zh'),
    target_language: normalizeLanguage(body.target_language, DEFAULT_TARGET_LANGUAGE),
  };
}

function envelope(result) {
  const meta = { ...(result.meta || {}) };
  if (result.debug) meta.debug = result.debug;
  return { success: true, data: result.data ?? {}, meta };
}

export async function handleAnalyze(body = {}) {
  const text = requireString(body.text, 'text');
  const result = await analyzeText({ text, ...languagePair(body) });
  return envelope(result);
}

export async function handleExercises(body = {}) {
  const text = requireString(body.text, 'text');
  const pair = languagePair(body);
  const rawAnalysis = body.analysis;
  const analysis =
    typeof rawAnalysis === 'string'
      ? rawAnalysis
      : rawAnalysis
        ? JSON.stringify(rawAnalysis)
        : '';
  const requested = Number(body.question_count ?? body.count ?? 5);
  const question_count = Math.min(10, Math.max(1, Number.isFinite(requested) ? requested : 5));

  const result = await generateExercises({
    text,
    analysis,
    question_count,
    ...pair,
  });
  return envelope(result);
}

export async function handleChat(body = {}) {
  const rawMessage = body.user_message ?? body.message ?? '';
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  const history = Array.isArray(body.conversation_history)
    ? body.conversation_history.slice(-20)
    : [];
  const isFirstTurn =
    history.length === 0 &&
    !message &&
    (body.first_turn === true || body.opening === true || String(body.scenario || body.context || '') !== '');

  if (!message && !isFirstTurn) {
    throw new BffError('INVALID_INPUT', '参数 user_message 不能为空。', 400);
  }

  const scenarioInput = String(body.scenario || body.context || 'free_talk');
  const scenario = scenarioInput.startsWith('custom') ? 'custom' : scenarioInput;
  const pair = languagePair(body);

  const result = await chatTurn({
    user_message: message,
    scenario,
    conversation_history: history,
    custom_scenario_name: body.custom_scenario_name || '',
    custom_scenario_description: body.custom_scenario_description || '',
    first_turn: isFirstTurn,
    ...pair,
  });
  return envelope(result);
}

function splitDataUrl(value) {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value || '');
  if (!match) return { mimeType: 'image/jpeg', base64: value || '' };
  return { mimeType: match[1], base64: match[2] };
}

export async function handleOcr(body = {}) {
  const raw = String(body.image_base64 || body.image || '');
  let imageUrl = String(body.image_url || '').trim();

  if (!imageUrl && !raw) {
    throw new BffError('INVALID_INPUT', '需要提供 image_base64 或 image_url。', 400);
  }

  if (!imageUrl && raw) {
    const { mimeType, base64 } = splitDataUrl(raw);
    if (!base64) {
      throw new BffError('INVALID_INPUT', 'image_base64 不是有效的 base64 数据。', 400);
    }
    if (process.env.COZE_IMAGE_AS_FILE_ID === '1') {
      imageUrl = await uploadImageToCoze({
        base64,
        mimeType,
        fileName: body.file_name || 'linguamate-upload.jpg',
      });
    } else {
      imageUrl = raw.startsWith('data:') ? raw : `data:${mimeType};base64,${base64}`;
    }
  }

  const pair = languagePair(body);
  const result = await ocrImage({
    image_url: imageUrl,
    text: String(body.text || body.extracted_text || '').slice(0, 5000),
    ...pair,
  });
  return envelope(result);
}

export async function handleHealth() {
  const ids = workflowIds();
  const configured = Object.fromEntries(
    Object.entries(ids).map(([kind, id]) => [kind, Boolean(id)])
  );

  return {
    success: true,
    data: {
      service: 'linguamate-bff',
      apiBase: (process.env.COZE_API_BASE || 'https://api.coze.cn').replace(/\/+$/, ''),
      tokenConfigured: Boolean(process.env.COZE_TOKEN),
      mock: isMockMode(),
      workflows: configured,
      targetLanguage: DEFAULT_TARGET_LANGUAGE,
      traceId: newTraceId(),
    },
  };
}

export function errorResponse(error) {
  const status = error instanceof BffError ? error.status : 500;
  const code = error instanceof BffError ? error.code : 'INTERNAL_ERROR';
  const message =
    error instanceof BffError ? error.message : error?.message || '服务器内部错误。';

  return {
    status,
    body: {
      success: false,
      error: { code, message },
      meta: { traceId: newTraceId() },
    },
  };
}
