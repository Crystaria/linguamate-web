#!/usr/bin/env node
/**
 * Lightweight unit tests for src/api/adapters.js.
 * Dependency-free: run with `npm run test:adapters`.
 */
import assert from 'node:assert/strict';
import {
  adaptAnalysis,
  adaptChat,
  adaptExercises,
  adaptOcr,
  gradeAnswer,
  unwrapPayload,
} from '../src/api/adapters.js';

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${String(error.message).split('\n').join('\n        ')}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

/* -------------------------------------------------------------------------- */
/* 1. Coze response unwrapping                                                 */
/* -------------------------------------------------------------------------- */

group('unwrapPayload - nested Coze responses');

test('keeps a plain domain payload untouched', () => {
  assert.deepEqual(unwrapPayload({ reply: 'hi' }), { reply: 'hi' });
});

test('parses a top-level JSON string', () => {
  assert.equal(unwrapPayload('{"reply":"hi"}').reply, 'hi');
});

test('unwraps { output: "<json>" }', () => {
  assert.equal(unwrapPayload({ output: '{"reply":"hi"}' }).reply, 'hi');
});

test('unwraps { result: {...} }', () => {
  assert.equal(unwrapPayload({ result: { opening: 'hello' } }).opening, 'hello');
});

test('unwraps { data: {...} }', () => {
  assert.equal(unwrapPayload({ data: { questions: [] } }).questions.length, 0);
});

test('unwraps several nested layers', () => {
  const nested = { data: JSON.stringify({ output: JSON.stringify({ reply: 'deep' }) }) };
  assert.equal(unwrapPayload(nested).reply, 'deep');
});

test('does not unwrap when domain keys are already present', () => {
  const payload = { output: '{"reply":"wrong"}', reply: 'right' };
  assert.equal(unwrapPayload(payload).reply, 'right');
});

test('keeps sibling metadata when unwrapping output', () => {
  assert.equal(unwrapPayload({ output: '{"reply":"x"}', logid: '123' }).reply, 'x');
});

test('returns {} for null / undefined / empty string', () => {
  assert.deepEqual(unwrapPayload(null), {});
  assert.deepEqual(unwrapPayload(undefined), {});
  assert.deepEqual(unwrapPayload(''), {});
});

test('passes arrays through unchanged', () => {
  assert.deepEqual(unwrapPayload([1, 2]), [1, 2]);
});

/* -------------------------------------------------------------------------- */
/* 2. Local grading - multiple choice                                          */
/* -------------------------------------------------------------------------- */

group('gradeAnswer - multiple choice');

const mc = {
  id: 1,
  type: 'multiple_choice',
  options: ['Learning a new language', 'a new language', 'opens', 'doors'],
};
const mcKey = { 1: 'A' };

test('accepts the exact letter', () => {
  assert.equal(gradeAnswer(mc, mcKey, 'A').isCorrect, true);
});

test('accepts a lowercase letter', () => {
  assert.equal(gradeAnswer(mc, mcKey, 'a').isCorrect, true);
});

test('accepts (a), B. and [c] letter formats', () => {
  assert.equal(gradeAnswer(mc, { 1: 'A' }, '(a)').isCorrect, true);
  assert.equal(gradeAnswer(mc, { 1: 'B' }, 'B.').isCorrect, true);
  assert.equal(gradeAnswer(mc, { 1: 'C' }, '[c]').isCorrect, true);
});

test('accepts surrounding whitespace', () => {
  assert.equal(gradeAnswer(mc, mcKey, '   a   ').isCorrect, true);
});

test('accepts the option text, case-insensitive', () => {
  assert.equal(gradeAnswer(mc, mcKey, 'learning A NEW language').isCorrect, true);
});

test('accepts option text with collapsed whitespace', () => {
  assert.equal(gradeAnswer(mc, mcKey, '  learning   a   new language ').isCorrect, true);
});

test('matches an option-text answer key against a letter answer', () => {
  assert.equal(gradeAnswer(mc, { 1: 'a new language' }, 'B').isCorrect, true);
});

test('rejects a wrong option', () => {
  assert.equal(gradeAnswer(mc, mcKey, 'D').isCorrect, false);
});

test('rejects an empty answer', () => {
  assert.equal(gradeAnswer(mc, mcKey, '   ').isCorrect, false);
});

test('does not throw when options are missing', () => {
  assert.doesNotThrow(() =>
    gradeAnswer({ id: 1, type: 'multiple_choice' }, mcKey, 'A')
  );
});

test('falls back to question.correctAnswer', () => {
  assert.equal(gradeAnswer({ ...mc, correctAnswer: 'A' }, {}, 'a').isCorrect, true);
});

test('supports numeric keys with string question ids', () => {
  assert.equal(gradeAnswer({ ...mc, id: '1' }, mcKey, 'a').isCorrect, true);
});

/* -------------------------------------------------------------------------- */
/* 3. Local grading - sentence building / dialogue completion                  */
/* -------------------------------------------------------------------------- */

group('gradeAnswer - sentence building / dialogue completion');

const sentence = {
  id: 4,
  type: 'sentence_building',
  correctOrder: 'Learning a new language opens doors.',
  correctAnswer: 'Learning a new language opens doors.',
};
const sentenceKey = { 4: 'Learning a new language opens doors.' };

test('accepts the exact sentence', () => {
  assert.equal(
    gradeAnswer(sentence, sentenceKey, 'Learning a new language opens doors.').isCorrect,
    true
  );
});

test('ignores case and extra whitespace', () => {
  assert.equal(
    gradeAnswer(sentence, sentenceKey, '  learning   a new LANGUAGE opens doors  ').isCorrect,
    true
  );
});

test('ignores trailing punctuation', () => {
  assert.equal(
    gradeAnswer(sentence, sentenceKey, 'Learning a new language opens doors!!!').isCorrect,
    true
  );
});

test('ignores internal punctuation', () => {
  const key = { 5: 'Because it opens doors to new opportunities.' };
  const answer = 'because, it opens doors to new opportunities';
  assert.equal(
    gradeAnswer({ id: 5, type: 'dialogue_completion' }, key, answer).isCorrect,
    true
  );
});

test('normalizes curly apostrophes', () => {
  assert.equal(
    gradeAnswer(
      { id: 9, type: 'dialogue_completion' },
      { 9: "I don't know." },
      'I don’t know'
    ).isCorrect,
    true
  );
});

test('treats hyphens as word separators', () => {
  const key = { 11: 'It is a well-known fact.' };
  assert.equal(
    gradeAnswer({ id: 11, type: 'sentence_building' }, key, 'it is a well known fact').isCorrect,
    true
  );
});

test('accepts alternatives separated by |', () => {
  const key = { 6: 'Hello | Hi there' };
  assert.equal(
    gradeAnswer({ id: 6, type: 'dialogue_completion' }, key, 'hi there').isCorrect,
    true
  );
});

test('accepts alternatives separated by / and ;', () => {
  const key = { 7: 'Yes/Yeah;Sure' };
  assert.equal(
    gradeAnswer({ id: 7, type: 'dialogue_completion' }, key, 'sure').isCorrect,
    true
  );
});

test('keeps CJK text and strips Chinese punctuation', () => {
  const key = { 10: '我不知道。' };
  assert.equal(
    gradeAnswer({ id: 10, type: 'dialogue_completion' }, key, '我不知道').isCorrect,
    true
  );
});

test('rejects a wrong sentence', () => {
  assert.equal(
    gradeAnswer(sentence, sentenceKey, 'Learning a language opens doors').isCorrect,
    false
  );
});

test('rejects a punctuation-only answer', () => {
  assert.equal(gradeAnswer(sentence, sentenceKey, '!!! ...').isCorrect, false);
});

test('uses correctOrder when the answer key is empty', () => {
  assert.equal(
    gradeAnswer(sentence, {}, 'learning a new language opens doors').isCorrect,
    true
  );
});

/* -------------------------------------------------------------------------- */
/* 4. Adapter smoke tests                                                      */
/* -------------------------------------------------------------------------- */

group('adapter smoke tests');

test('adaptAnalysis maps markdown and vocabulary', () => {
  const result = adaptAnalysis({
    output: '{"analysis_markdown":"# hi","vocabulary":[{"word":"hi"}]}',
  });
  assert.equal(result.analysis, '# hi');
  assert.equal(result.analysisMarkdown, '# hi');
  assert.equal(result.vocabulary[0].word, 'hi');
});

test('adaptExercises maps questions and answer_key', () => {
  const result = adaptExercises({
    questions: [
      {
        id: 1,
        type: 'multiple_choice',
        question: 'Q1',
        options: ['x', 'y'],
        correct_answer: 'A',
      },
    ],
    answer_key: { 1: 'A' },
  });
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].correctAnswer, 'A');
  assert.deepEqual(result.questions[0].options, ['x', 'y']);
  assert.equal(result.answerKey['1'], 'A');
});

test('adaptChat maps translation and correction', () => {
  const result = adaptChat({
    reply: 'Hi',
    reply_translation: '你好',
    correction: { has_error: true, original: 'i', corrected: 'I' },
    suggestions: ['Hello'],
  });
  assert.equal(result.translation, '你好');
  assert.equal(result.correction.hasError, true);
  assert.deepEqual(result.suggestions, ['Hello']);
});

test('adaptOcr exposes extractedText and analysis', () => {
  const result = adaptOcr({ extracted_text: 'Hello', analysis_markdown: '# md' });
  assert.equal(result.extractedText, 'Hello');
  assert.equal(result.analysis, '# md');
});

/* -------------------------------------------------------------------------- */

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} tests passed`);

if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed:`);
  for (const result of failed) console.error(` - ${result.name}`);
  process.exit(1);
}

console.log('ALL ADAPTER TESTS PASSED');


