import { randomUUID } from 'node:crypto';

export const LEVELS = ['beginner', 'intermediate', 'advanced'];

export class BffError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'BffError';
    this.code = code;
    this.status = status;
  }
}

const apiBase = () =>
  (process.env.COZE_API_BASE || 'https://api.coze.cn').replace(/\/+$/, '');

export const workflowIds = () => ({
  analyze: process.env.COZE_WORKFLOW_ANALYZE || '',
  exercise: process.env.COZE_WORKFLOW_EXERCISE || '',
  chat: process.env.COZE_WORKFLOW_CHAT || '',
  ocr: process.env.COZE_WORKFLOW_OCR || '',
});

/**
 * Mock mode keeps the whole frontend demo-able without a Coze token.
 * It activates when COZE_MOCK=1, or when the token/workflow id is missing.
 */
export function isMockMode(kind) {
  if (process.env.COZE_MOCK === '1') return true;
  if (!process.env.COZE_TOKEN) return true;
  if (kind && !workflowIds()[kind]) return true;
  return false;
}

/** Coze returns `data` as a JSON string in most deployments. */
export function parseMaybeJson(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function serializeParameters(parameters) {
  const stringify = process.env.COZE_STRINGIFY_PARAMS !== '0';
  if (!stringify) return parameters;

  return Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => {
      if (value === null || value === undefined) return [key, ''];
      if (typeof value === 'object') return [key, JSON.stringify(value)];
      return [key, value];
    })
  );
}

/**
 * 方案 B：直接调用 Coze Workflow API（不走 Agent）。
 * Docs: POST {COZE_API_BASE}/v1/workflow/run
 */
export async function runWorkflow(kind, parameters) {
  const workflowId = workflowIds()[kind];
  if (!workflowId) {
    throw new BffError(
      'WORKFLOW_NOT_CONFIGURED',
      `缺少 COZE_WORKFLOW_${kind.toUpperCase()}，无法调用工作流。`,
      503
    );
  }

  const token = process.env.COZE_TOKEN;
  if (!token) {
    throw new BffError('TOKEN_MISSING', '缺少 COZE_TOKEN。', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.COZE_TIMEOUT_MS || 60000)
  );

  try {
    const response = await fetch(`${apiBase()}/v1/workflow/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        parameters: serializeParameters(parameters),
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = parseMaybeJson(text) || {};
    const code = payload.code;

    if (!response.ok || (code !== undefined && Number(code) !== 0)) {
      const message =
        payload.msg || payload.message || `Coze 工作流调用失败（HTTP ${response.status}）`;
      throw new BffError('COZE_WORKFLOW_FAILED', message, 502);
    }

    const data = parseMaybeJson(payload.data);
    return {
      data: data === undefined ? {} : data,
      debug: {
        workflowId,
        logId: payload.logid,
        debugUrl: payload.debug_url,
      },
    };
  } catch (error) {
    if (error instanceof BffError) throw error;
    if (error.name === 'AbortError') {
      throw new BffError('COZE_TIMEOUT', 'Coze 工作流响应超时。', 504);
    }
    throw new BffError('COZE_NETWORK_ERROR', error.message, 502);
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Mock fixtures (aligned with linguamate-pro-upgraded/schemas)                */
/* -------------------------------------------------------------------------- */

const mockMarkdown = (text, level, targetLanguage) => `## 📌 文本概览
- 目标语言：${targetLanguage}
- 学习等级：${level}
- 字数：${text.length}

## 🔤 词汇精讲
| 单词 | 词性 | 含义 | 难度 |
| --- | --- | --- | --- |
| learning | n. | 学习 | easy |
| language | n. | 语言 | easy |
| opens | v. | 打开 | medium |
| doors | n. | 门 | easy |

## 🧩 语法结构
- 句子类型：简单句
- 核心语法点：动名词作主语（Learning a new language）
- 复杂度：simple

## 🎯 语义与语境
- 主题：语言学习的价值
- 情感倾向：positive

## 💡 学习建议
1. 重点：掌握动名词作主语的用法
2. 练习：用 "Learning ... opens ..." 造句
3. 下一步：尝试分析一段 80 词左右的短文`;

const mockAnalysis = ({ text, level, targetLanguage }) => ({
  meta: {
    level,
    ui_language: process.env.MOCK_UI_LANGUAGE || 'zh',
    target_language: targetLanguage,
    stats: {
      char_count: text.length,
      word_count: text.trim() ? text.trim().split(/\s+/).length : 0,
      sentence_count: Math.max(1, (text.match(/[.!?。！？]/g) || []).length),
      avg_sentence_length: 12.5,
    },
  },
  summary: '这段话用动名词作主语，表达了“学习一门新语言能带来新机会”的观点。',
  vocabulary: [
    { word: 'learning', pos: 'n.', phonetic: '/ˈlɜːnɪŋ/', meaning: '学习', root_affix: 'learn + -ing', difficulty: 'easy', example: 'Learning keeps us curious.' },
    { word: 'language', pos: 'n.', phonetic: '/ˈlæŋɡwɪdʒ/', meaning: '语言', root_affix: 'lingu- + -age', difficulty: 'easy', example: 'Language shapes the way we think.' },
    { word: 'opens', pos: 'v.', phonetic: '/ˈəʊpənz/', meaning: '打开', root_affix: 'open + -s', difficulty: 'medium', example: 'A smile opens doors.' },
    { word: 'doors', pos: 'n.', phonetic: '/dɔːz/', meaning: '门', root_affix: 'door + -s', difficulty: 'easy', example: 'Opportunity knocks on many doors.' },
  ],
  grammar: {
    sentence_types: ['简单句'],
    key_points: [
      { point: '动名词作主语', explanation: 'Learning a new language 整体作主语，谓语用第三人称单数 opens。', example: 'Learning a new language opens doors.' },
      { point: '一般现在时', explanation: '表达普遍事实或真理。', example: 'Water boils at 100°C.' },
    ],
    complexity: 'simple',
  },
  semantics: {
    topic: '语言学习的价值',
    key_meaning: '学习新语言可以带来更多机会与可能性。',
    context: '常见于励志演讲、教育宣传与个人成长类文章。',
    sentiment: 'positive',
  },
  pragmatics: {
    register: 'neutral',
    intention: '鼓励读者开始或坚持学习语言。',
    cultural_notes: '“opens doors” 是英语中常见的隐喻，表示带来机会。',
  },
  recommendations: {
    focus: ['动名词作主语', '隐喻表达 opens doors'],
    practice: ['用 Learning ... opens ... 造 3 个句子', '朗读并模仿语调'],
    next_steps: ['阅读一段 80 词的短文并标出主语', '复述这段话的大意'],
  },
  reading_practice: text,
  analysis_markdown: mockMarkdown(text, level, targetLanguage),
});

const mockExerciseBank = () => ({
  exercise_set_id: `ex_${Date.now().toString(36)}_mock`,
  level: 'beginner',
  target_language: 'en',
  total: 5,
  questions: [
    {
      id: 1,
      type: 'multiple_choice',
      skill: 'grammar',
      question: '在 "Learning a new language opens doors." 中，主语是什么？',
      options: ['Learning a new language', 'a new language', 'opens', 'doors'],
      correct_answer: 'A',
      explanation: '动名词短语 Learning a new language 整体作主语。',
    },
    {
      id: 2,
      type: 'multiple_choice',
      skill: 'vocabulary',
      question: '"opens doors" 在这句话中最接近的意思是？',
      options: ['打开房门', '带来机会', '关闭大门', '建造房屋'],
      correct_answer: 'B',
      explanation: '这是英语中的隐喻，表示带来新的机会。',
    },
    {
      id: 3,
      type: 'multiple_choice',
      skill: 'reading',
      question: '这句话的情感倾向是？',
      options: ['negative', 'neutral', 'positive', 'unclear'],
      correct_answer: 'C',
      explanation: '句子强调学习语言的价值，整体是积极正面的。',
    },
    {
      id: 4,
      type: 'sentence_building',
      skill: 'grammar',
      prompt: '用下面的词组成一个正确的句子。',
      words: ['Learning', 'a', 'new', 'language', 'opens', 'doors'],
      correct_order: 'Learning a new language opens doors.',
      explanation: '动名词短语作主语，谓语动词用第三人称单数。',
    },
    {
      id: 5,
      type: 'dialogue_completion',
      skill: 'pragmatics',
      scenario: '你在咖啡馆遇到一位正在学英语的朋友。',
      dialogue: [
        { speaker: 'Alex', text: 'Why do you keep learning English?', answer: '' },
        { speaker: 'You', text: '', answer: 'Because it opens doors to new opportunities.' },
      ],
      explanation: '用 because 说明理由，并复用 opens doors 的隐喻。',
    },
  ],
  answer_key: {
    1: 'A',
    2: 'B',
    3: 'C',
    4: 'Learning a new language opens doors.',
    5: 'Because it opens doors to new opportunities.',
  },
});

const scenarioOpening = (scenario, customName) => {
  const map = {
    restaurant: {
      opening: 'Good evening! Welcome to our restaurant. Would you like to see the menu?',
      role: 'server',
      goal: 'Order a meal and ask about the menu.',
    },
    shopping: {
      opening: 'Hi! Welcome to our store. Are you looking for anything in particular?',
      role: 'server',
      goal: 'Ask about products, sizes and prices.',
    },
    direction: {
      opening: 'Excuse me, you look a little lost. Where are you trying to go?',
      role: 'stranger',
      goal: 'Ask for and follow directions.',
    },
    introduction: {
      opening: "Hi there! I don't think we've met. I'm Alex. What's your name?",
      role: 'friend',
      goal: 'Introduce yourself and exchange basic information.',
    },
  };

  return (
    map[scenario] || {
      opening: `Hi! Let's practice ${customName || 'a real-life conversation'}. What would you like to talk about?`,
      role: 'other',
      goal: 'Practise a natural conversation in the chosen scenario.',
    }
  );
};

const mockChat = ({ user_message, scenario, custom_scenario_name, conversation_history }) => {
  const history = Array.isArray(conversation_history) ? conversation_history : [];
  const isFirstTurn = history.length === 0 && !String(user_message || '').trim();
  const start = scenarioOpening(scenario, custom_scenario_name);

  if (isFirstTurn) {
    return {
      ...start,
      reply: start.opening,
      reply_translation: '',
      correction: { has_error: false, original: '', corrected: '', note: '' },
      suggestions: [
        'Could I see the menu, please?',
        'What do you recommend?',
        'How much is this?',
      ],
      follow_up_question: start.opening,
      scenario_role: start.role,
      state: { goal: start.goal, progress: 'opening' },
    };
  }

  const message = String(user_message || '').trim();
  const hasCapital = /^[A-Z]/.test(message);
  const hasError = Boolean(message) && !hasCapital;

  return {
    reply: message
      ? `That sounds interesting! You said: "${message}". Tell me a little more about that.`
      : 'I am here whenever you are ready.',
    reply_translation: '听起来很有趣！你能再多说一点吗？',
    correction: hasError
      ? {
          has_error: true,
          original: message,
          corrected: message.charAt(0).toUpperCase() + message.slice(1),
          note: '句首字母需要大写。',
        }
      : { has_error: false, original: '', corrected: '', note: '' },
    suggestions: [
      'I would like to order a coffee.',
      'Could you say that again, please?',
      'That sounds good to me.',
    ],
    follow_up_question: 'What happened next?',
    scenario_role: start.role,
    state: { goal: start.goal, progress: 'in_progress' },
  };
};

const mockOcr = ({ text, level, targetLanguage }) => {
  const extracted =
    String(text || '').trim() ||
    'Today is a good day to learn something new. Every small step counts.';
  return {
    extracted_text: extracted,
    ...mockAnalysis({ text: extracted, level, targetLanguage }),
  };
};

/* -------------------------------------------------------------------------- */
/* Public helpers used by handlers                                             */
/* -------------------------------------------------------------------------- */

export async function analyzeText(params) {
  if (isMockMode('analyze')) {
    return { data: mockAnalysis(params), meta: { mock: true, workflow: 'analyze' } };
  }
  return { ...(await runWorkflow('analyze', params)), meta: { mock: false, workflow: 'analyze' } };
}

export async function generateExercises(params) {
  if (isMockMode('exercise')) {
    const bank = mockExerciseBank();
    return {
      data: { ...bank, level: params.level, target_language: params.target_language },
      meta: { mock: true, workflow: 'exercise' },
    };
  }
  return { ...(await runWorkflow('exercise', params)), meta: { mock: false, workflow: 'exercise' } };
}

export async function chatTurn(params) {
  if (isMockMode('chat')) {
    return { data: mockChat(params), meta: { mock: true, workflow: 'chat' } };
  }
  return { ...(await runWorkflow('chat', params)), meta: { mock: false, workflow: 'chat' } };
}

export async function ocrImage(params) {
  if (isMockMode('ocr')) {
    return { data: mockOcr(params), meta: { mock: true, workflow: 'ocr' } };
  }
  return { ...(await runWorkflow('ocr', params)), meta: { mock: false, workflow: 'ocr' } };
}

export const newTraceId = () => randomUUID();

/**
 * Optional path for OCR: Coze image workflows often prefer a file id over a
 * base64 data URL. Only used when COZE_IMAGE_AS_FILE_ID=1.
 */
export async function uploadImageToCoze({ base64, mimeType = 'image/jpeg', fileName = 'upload.jpg' }) {
  const token = process.env.COZE_TOKEN;
  if (!token) throw new BffError('TOKEN_MISSING', '缺少 COZE_TOKEN。', 503);

  const endpoint =
    process.env.COZE_FILE_UPLOAD_URL || `${apiBase()}/v1/files/upload`;
  const buffer = Buffer.from(base64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), fileName);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const payload = parseMaybeJson(await response.text()) || {};
    if (!response.ok || (payload.code !== undefined && Number(payload.code) !== 0)) {
      throw new BffError(
        'COZE_FILE_UPLOAD_FAILED',
        payload.msg || `Coze 文件上传失败（HTTP ${response.status}）`,
        502
      );
    }
    const fileId = payload.data?.id || payload.data?.file_id;
    if (!fileId) {
      throw new BffError('COZE_FILE_UPLOAD_FAILED', 'Coze 未返回 file id。', 502);
    }
    return fileId;
  } catch (error) {
    if (error instanceof BffError) throw error;
    throw new BffError('COZE_NETWORK_ERROR', error.message, 502);
  }
}
