import axios from 'axios';

/**
 * All browser requests go through the BFF (`/api`) — the Coze token never
 * reaches the client. Override with VITE_API_BASE_URL when the BFF lives on a
 * different origin (e.g. a separate Railway service).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
export const TARGET_LANGUAGE = import.meta.env.VITE_TARGET_LANGUAGE || 'en';

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
});

function unwrap(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('BFF 返回了无法解析的响应。');
  }

  if (payload.success === false) {
    const error = new Error(payload.error?.message || '请求失败，请稍后重试。');
    error.code = payload.error?.code || 'BFF_ERROR';
    error.traceId = payload.meta?.traceId;
    throw error;
  }

  return payload;
}

function toClientError(error) {
  if (error.response) {
    const payload = error.response.data;
    const message =
      payload?.error?.message ||
      payload?.detail ||
      `请求失败（HTTP ${error.response.status}）`;
    const wrapped = new Error(message);
    wrapped.code = payload?.error?.code || 'HTTP_ERROR';
    wrapped.status = error.response.status;
    return wrapped;
  }

  if (error.request) {
    return new Error(
      '无法连接 BFF。请确认已运行 `npm run dev:api`，或检查 VITE_API_BASE_URL 配置。'
    );
  }

  return error;
}

async function post(path, body) {
  try {
    const { data } = await http.post(path, body);
    return unwrap(data);
  } catch (error) {
    throw toClientError(error);
  }
}

export function analyzeText({ text, level, language, targetLanguage }) {
  return post('/analyze', {
    text,
    level,
    ui_language: language,
    target_language: targetLanguage || TARGET_LANGUAGE,
  });
}

export function generateExercises({
  text,
  analysis,
  level,
  language,
  questionCount = 5,
  targetLanguage,
}) {
  return post('/exercises', {
    text,
    analysis,
    level,
    question_count: questionCount,
    ui_language: language,
    target_language: targetLanguage || TARGET_LANGUAGE,
  });
}

export function analyzeImage({
  imageBase64,
  fileName,
  level,
  language,
  text,
  targetLanguage,
}) {
  return post('/ocr', {
    image_base64: imageBase64,
    file_name: fileName,
    text,
    level,
    ui_language: language,
    target_language: targetLanguage || TARGET_LANGUAGE,
  });
}

export function sendChatMessage({
  message,
  scenario,
  level,
  language,
  history,
  firstTurn = false,
  customScenarioName,
  customScenarioDescription,
}) {
  return post('/chat', {
    user_message: message || '',
    scenario,
    level,
    ui_language: language,
    target_language: TARGET_LANGUAGE,
    conversation_history: history || [],
    first_turn: firstTurn,
    custom_scenario_name: customScenarioName,
    custom_scenario_description: customScenarioDescription,
  });
}

export async function checkHealth() {
  try {
    const { data } = await http.get('/health');
    return unwrap(data);
  } catch (error) {
    throw toClientError(error);
  }
}

export default http;
