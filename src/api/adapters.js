/**
 * Adapters: Coze workflow output -> the shapes the existing UI expects.
 * The workflows may return nested JSON strings, so every field goes through
 * `parseMaybeJson` before use.
 */

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

const asString = (value) => (typeof value === 'string' ? value : '');
const asArray = (value) => (Array.isArray(value) ? value : []);

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

export function adaptAnalysis(raw) {
  const payload = parseMaybeJson(raw) || {};
  const nested = parseMaybeJson(payload.analysis);
  const structured =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? nested
      : payload;

  const markdown = firstString(
    structured.analysis_markdown,
    payload.analysis_markdown,
    payload.markdown,
    typeof payload.analysis === 'string' ? payload.analysis : '',
    typeof payload.text === 'string' ? payload.text : ''
  );

  return {
    raw: payload,
    analysis: markdown,
    analysisMarkdown: markdown,
    analysisStructured: structured,
    summary: firstString(structured.summary, payload.summary),
    meta: structured.meta || payload.meta || {},
    vocabulary: asArray(structured.vocabulary || payload.vocabulary),
    grammar: structured.grammar || payload.grammar || {},
    semantics: structured.semantics || payload.semantics || {},
    pragmatics: structured.pragmatics || payload.pragmatics || {},
    recommendations: structured.recommendations || payload.recommendations || {},
    readingPractice: firstString(structured.reading_practice, payload.reading_practice),
    error: firstString(payload.error, structured.error),
  };
}

export function normalizeAnswerKey(raw) {
  const source = parseMaybeJson(raw) || {};
  if (typeof source !== 'object' || Array.isArray(source)) return {};

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => {
      const parsed = parseMaybeJson(value);
      if (Array.isArray(parsed)) return [String(key), parsed.join(' ')];
      if (parsed && typeof parsed === 'object') {
        return [String(key), String(parsed.answer ?? parsed.value ?? '')];
      }
      return [String(key), String(parsed ?? '')];
    })
  );
}

function normalizeDialogue(raw) {
  return asArray(parseMaybeJson(raw)).map((entry) => ({
    speaker: String(entry?.speaker ?? entry?.role ?? ''),
    text: String(entry?.text ?? entry?.content ?? ''),
    answer: String(entry?.answer ?? ''),
  }));
}

export function normalizeQuestion(question, index, answerKey = {}) {
  const source = parseMaybeJson(question) || {};
  const id = source.id ?? index + 1;
  const type = ['multiple_choice', 'sentence_building', 'dialogue_completion'].includes(
    source.type
  )
    ? source.type
    : 'multiple_choice';

  const expected = String(
    answerKey[String(id)] ?? source.correct_answer ?? source.correct_order ?? ''
  );

  return {
    id,
    type,
    skill: source.skill || '',
    question:
      source.question || source.prompt || source.scenario || `Question ${id}`,
    prompt: source.prompt || source.question || '',
    scenario: source.scenario || '',
    options: asArray(source.options).map(String),
    words: asArray(source.words).map(String),
    correctOrder: String(source.correct_order || (type === 'sentence_building' ? expected : '')),
    dialogue: normalizeDialogue(source.dialogue),
    correctAnswer: expected,
    explanation: source.explanation || '',
    raw: source,
  };
}

export function adaptExercises(raw, { answerKey } = {}) {
  const payload = parseMaybeJson(raw) || {};
  const key = normalizeAnswerKey(payload.answer_key || payload.answerKey || answerKey);
  const list = asArray(payload.questions || payload.exercises).map((question, index) =>
    normalizeQuestion(question, index, key)
  );

  return {
    raw: payload,
    exerciseId:
      payload.exercise_set_id || payload.exercise_id || `ex_${Date.now().toString(36)}`,
    questions: list,
    exercises: list,
    answerKey: key,
    total: Number(payload.total ?? list.length) || list.length,
    level: payload.level || '',
    targetLanguage: payload.target_language || '',
    error: typeof payload.error === 'string' ? payload.error : '',
  };
}

function normalizeCorrection(raw) {
  const value = parseMaybeJson(raw);
  if (!value) return { hasError: false, original: '', corrected: '', note: '' };
  if (typeof value === 'string') {
    return { hasError: true, original: '', corrected: value, note: '' };
  }
  return {
    hasError: Boolean(value.has_error ?? value.hasError),
    original: asString(value.original),
    corrected: asString(value.corrected ?? value.correction),
    note: asString(value.note ?? value.explanation),
  };
}

export function adaptChat(raw) {
  const payload = parseMaybeJson(raw) || {};
  const state = parseMaybeJson(payload.state) || {};
  const correction = normalizeCorrection(payload.correction);
  const reply = firstString(payload.reply, payload.opening, payload.response);
  const suggestions = asArray(parseMaybeJson(payload.suggestions)).map(String);

  return {
    raw: payload,
    reply,
    response: reply,
    opening: firstString(payload.opening, reply),
    translation: firstString(
      payload.reply_translation,
      payload.translation,
      payload.translation_text
    ),
    correction,
    suggestions,
    followUpQuestion: firstString(payload.follow_up_question, payload.followUpQuestion),
    role: firstString(payload.role, payload.scenario_role),
    goal: firstString(payload.goal, state.goal),
    progress: firstString(payload.progress, state.progress),
    state,
    error: firstString(payload.error),
  };
}

export function adaptOcr(raw) {
  const payload = parseMaybeJson(raw) || {};
  const analysis = adaptAnalysis(payload);
  return {
    ...analysis,
    raw: payload,
    extractedText: firstString(
      payload.extracted_text,
      payload.extractedText,
      payload.text,
      analysis.readingPractice
    ),
  };
}

const CHOICE_LETTER = /^[A-Z]$/;

function letterForOption(options, value) {
  const target = String(value || '').trim();
  if (!target) return '';

  const index = options.findIndex(
    (option) => String(option).trim().toLowerCase() === target.toLowerCase()
  );
  return index >= 0 ? String.fromCharCode(65 + index) : '';
}

function normalizeSentence(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Local grading: compare against the answer_key delivered with the exercise
 * set, so no `/submit-answer` round trip is required.
 */
export function gradeAnswer(question, answerKey, userAnswer) {
  const expected = String(
    answerKey?.[String(question.id)] ??
      question.correctAnswer ??
      question.correctOrder ??
      ''
  ).trim();
  const actual = String(userAnswer ?? '').trim();

  let isCorrect = false;

  if (question.type === 'multiple_choice') {
    const expectedLetter = CHOICE_LETTER.test(expected)
      ? expected
      : letterForOption(question.options, expected);
    const actualLetter = CHOICE_LETTER.test(actual)
      ? actual
      : letterForOption(question.options, actual);
    isCorrect = Boolean(expectedLetter && actualLetter && expectedLetter === actualLetter);
  } else {
    const alternatives = expected
      .split(/\s*(?:\||\/|;)\s*/)
      .map(normalizeSentence)
      .filter(Boolean);
    const normalizedActual = normalizeSentence(actual);
    isCorrect = Boolean(normalizedActual) && alternatives.includes(normalizedActual);
  }

  return {
    isCorrect,
    correctAnswer: expected,
    userAnswer: actual,
    explanation: question.explanation || '',
  };
}
