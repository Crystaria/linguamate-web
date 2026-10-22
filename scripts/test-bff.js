#!/usr/bin/env node
/**
 * Offline contract tests for the BFF in COZE_MOCK=1 mode.
 * Starts server/dev-server.js on a random port, checks all 4 endpoints,
 * verifies the fields the React pages consume, then shuts it down.
 * Run with: npm run test:bff
 */
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  adaptAnalysis,
  adaptChat,
  adaptExercises,
  adaptOcr,
} from '../src/api/adapters.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let child;
let logs = '';
let base = '';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function request(pathname, { method = 'GET', body, raw, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (raw !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = raw;
  }

  const response = await fetch(`${base}${pathname}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, headers: response.headers, json, text };
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`BFF exited early (code ${child.exitCode}).\n${logs}`);
    }
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      /* not listening yet */
    }
    await sleep(150);
  }
  throw new Error(`BFF did not become ready within 10s.\n${logs}`);
}

async function test(name, fn) {
  try {
    await fn();
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

function expectEnvelope(body) {
  assert.equal(body.success, true, 'success should be true');
  assert.ok(body.data && typeof body.data === 'object', 'data should be an object');
  assert.ok(body.meta && typeof body.meta === 'object', 'meta should be an object');
  assert.equal(body.meta.mock, true, 'meta.mock should be true in mock mode');
}

function expectString(value, label) {
  assert.equal(typeof value, 'string', `${label} should be a string`);
  assert.ok(value.trim().length > 0, `${label} should not be empty`);
}

function expectArray(value, label) {
  assert.ok(Array.isArray(value), `${label} should be an array`);
}

function expectObject(value, label) {
  assert.ok(
    value && typeof value === 'object' && !Array.isArray(value),
    `${label} should be an object`
  );
}

async function main() {
  const port = await getFreePort();
  base = `http://127.0.0.1:${port}`;

  child = spawn(process.execPath, ['server/dev-server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      COZE_MOCK: '1',
      COZE_TOKEN: '',
      COZE_WORKFLOW_ANALYZE: '',
      COZE_WORKFLOW_EXERCISE: '',
      COZE_WORKFLOW_CHAT: '',
      COZE_WORKFLOW_OCR: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

  await waitForServer();
  console.log(`BFF mock server ready at ${base}`);

  group('Health');

  await test('GET /api/health reports mock mode and no token', async () => {
    const { status, json } = await request('/api/health');
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.service, 'linguamate-bff');
    assert.equal(json.data.mock, true);
    assert.equal(json.data.tokenConfigured, false);
    assert.deepEqual(json.data.workflows, {
      analyze: false,
      exercise: false,
      chat: false,
      ocr: false,
    });
  });

  group('POST /api/analyze');

  await test('returns every field TextAnalysis/ImageAnalysis consume', async () => {
    const { status, json } = await request('/api/analyze', {
      method: 'POST',
      body: {
        text: 'Learning a new language opens doors.',
        level: 'beginner',
        ui_language: 'zh',
        target_language: 'en',
      },
    });

    assert.equal(status, 200);
    expectEnvelope(json);

    const data = json.data;
    expectString(data.analysis_markdown, 'analysis_markdown');
    expectString(data.summary, 'summary');
    expectArray(data.vocabulary, 'vocabulary');
    assert.ok(data.vocabulary.length > 0, 'vocabulary should not be empty');
    for (const item of data.vocabulary) {
      expectString(item.word, 'vocabulary[].word');
      expectString(item.meaning, 'vocabulary[].meaning');
    }
    expectObject(data.grammar, 'grammar');
    expectArray(data.grammar.key_points, 'grammar.key_points');
    expectObject(data.semantics, 'semantics');
    expectObject(data.pragmatics, 'pragmatics');
    expectObject(data.recommendations, 'recommendations');
    expectString(data.reading_practice, 'reading_practice');
    expectObject(data.meta, 'data.meta');
    assert.equal(typeof data.meta.stats.word_count, 'number');

    const adapted = adaptAnalysis(data);
    expectString(adapted.analysis, 'adapted.analysis');
    expectString(adapted.summary, 'adapted.summary');
    assert.ok(adapted.vocabulary.length > 0, 'adapted.vocabulary should not be empty');
  });

  group('POST /api/exercises');

  await test('returns 5 gradable questions with a complete answer_key', async () => {
    const { status, json } = await request('/api/exercises', {
      method: 'POST',
      body: {
        text: 'Learning a new language opens doors.',
        level: 'beginner',
        question_count: 5,
        ui_language: 'zh',
        target_language: 'en',
      },
    });

    assert.equal(status, 200);
    expectEnvelope(json);

    const data = json.data;
    expectArray(data.questions, 'questions');
    assert.equal(data.questions.length, 5, 'should return 5 questions');
    assert.equal(data.total, 5, 'total should match');
    expectObject(data.answer_key, 'answer_key');

    assert.deepEqual(
      data.questions.map((question) => String(question.id)),
      ['1', '2', '3', '4', '5']
    );
    assert.deepEqual(
      data.questions.map((question) => question.type),
      ['multiple_choice', 'multiple_choice', 'multiple_choice', 'sentence_building', 'dialogue_completion']
    );

    for (const question of data.questions) {
      expectString(String(question.id), `question ${question.id}.id`);
      expectString(question.explanation, `question ${question.id}.explanation`);
      expectString(
        data.answer_key[String(question.id)],
        `answer_key[${question.id}]`
      );

      if (question.type === 'multiple_choice') {
        expectArray(question.options, `question ${question.id}.options`);
        assert.ok(question.options.length >= 2, 'multiple choice needs options');
        assert.match(String(question.correct_answer), /^[A-D]$/);
      }
      if (question.type === 'sentence_building') {
        expectArray(question.words, `question ${question.id}.words`);
        assert.ok(question.words.length > 0, 'sentence building needs words');
        expectString(question.correct_order, `question ${question.id}.correct_order`);
      }
      if (question.type === 'dialogue_completion') {
        expectArray(question.dialogue, `question ${question.id}.dialogue`);
        assert.ok(question.dialogue.length > 0, 'dialogue should not be empty');
        for (const line of question.dialogue) {
          assert.equal(typeof line.speaker, 'string');
          assert.equal(typeof line.text, 'string');
          assert.equal(typeof line.answer, 'string');
        }
      }
    }

    const adapted = adaptExercises(data);
    assert.equal(adapted.questions.length, 5);
    for (const question of adapted.questions) {
      expectString(question.question, `adapted question ${question.id}.question`);
      expectString(question.correctAnswer, `adapted question ${question.id}.correctAnswer`);
    }
    assert.equal(adapted.answerKey['1'], 'A');
    assert.equal(adapted.questions[3].type, 'sentence_building');
    assert.ok(adapted.questions[3].words.length > 0);
    assert.equal(adapted.questions[4].dialogue.length, 2);
  });

  group('POST /api/chat');

  await test('first turn returns an opening, role, goal and suggestions', async () => {
    const { status, json } = await request('/api/chat', {
      method: 'POST',
      body: {
        user_message: '',
        scenario: 'restaurant',
        first_turn: true,
        conversation_history: [],
        level: 'beginner',
        ui_language: 'zh',
        target_language: 'en',
      },
    });

    assert.equal(status, 200);
    expectEnvelope(json);

    const data = json.data;
    expectString(data.reply, 'reply');
    expectString(data.opening, 'opening');
    expectArray(data.suggestions, 'suggestions');
    assert.ok(data.suggestions.length > 0, 'suggestions should not be empty');
    expectObject(data.correction, 'correction');
    assert.equal(typeof data.correction.has_error, 'boolean');
    expectString(data.scenario_role, 'scenario_role');
    expectObject(data.state, 'state');
    expectString(data.state.goal, 'state.goal');

    const adapted = adaptChat(data);
    expectString(adapted.reply, 'adapted.reply');
    expectString(adapted.opening, 'adapted.opening');
    expectString(adapted.role, 'adapted.role');
    expectString(adapted.goal, 'adapted.goal');
    assert.equal(adapted.correction.hasError, false);
  });

  await test('follow-up returns reply, translation, correction and suggestions', async () => {
    const { status, json } = await request('/api/chat', {
      method: 'POST',
      body: {
        user_message: 'i want a coffee',
        scenario: 'restaurant',
        conversation_history: [
          { role: 'assistant', content: 'Good evening! Welcome to our restaurant.' },
        ],
        level: 'beginner',
        ui_language: 'zh',
        target_language: 'en',
      },
    });

    assert.equal(status, 200);
    expectEnvelope(json);

    const data = json.data;
    expectString(data.reply, 'reply');
    assert.ok(data.reply.includes('i want a coffee'), 'reply should echo the user message');
    expectString(data.reply_translation, 'reply_translation');
    expectObject(data.correction, 'correction');
    assert.equal(data.correction.has_error, true);
    assert.equal(data.correction.corrected, 'I want a coffee');
    expectArray(data.suggestions, 'suggestions');
    assert.equal(data.suggestions.length, 3);
    expectString(data.follow_up_question, 'follow_up_question');

    const adapted = adaptChat(data);
    expectString(adapted.translation, 'adapted.translation');
    assert.equal(adapted.correction.hasError, true);
    assert.equal(adapted.correction.corrected, 'I want a coffee');
    assert.equal(adapted.suggestions.length, 3);
  });

  group('POST /api/ocr');

  await test('returns extracted text plus the full analysis contract', async () => {
    const image = `data:image/png;base64,${Buffer.from('fake-image-bytes').toString('base64')}`;
    const { status, json } = await request('/api/ocr', {
      method: 'POST',
      body: {
        image_base64: image,
        level: 'beginner',
        ui_language: 'zh',
        target_language: 'en',
      },
    });

    assert.equal(status, 200);
    expectEnvelope(json);

    const data = json.data;
    expectString(data.extracted_text, 'extracted_text');
    expectString(data.analysis_markdown, 'analysis_markdown');
    expectArray(data.vocabulary, 'vocabulary');
    assert.ok(data.vocabulary.length > 0, 'vocabulary should not be empty');
    expectObject(data.grammar, 'grammar');
    expectString(data.reading_practice, 'reading_practice');

    const adapted = adaptOcr(data);
    expectString(adapted.extractedText, 'adapted.extractedText');
    expectString(adapted.analysis, 'adapted.analysis');
    assert.ok(adapted.vocabulary.length > 0, 'adapted.vocabulary should not be empty');
  });

  await test('accepts image_url as an alternative to image_base64', async () => {
    const { status, json } = await request('/api/ocr', {
      method: 'POST',
      body: { image_url: 'https://example.com/example.jpg', target_language: 'en' },
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
    expectString(json.data.extracted_text, 'extracted_text');
  });

  group('Validation and error envelopes');

  await test('rejects empty analyze text with 400 INVALID_INPUT', async () => {
    const { status, json } = await request('/api/analyze', {
      method: 'POST',
      body: { text: '   ' },
    });
    assert.equal(status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INVALID_INPUT');
    expectString(json.error.message, 'error.message');
    expectString(json.meta.traceId, 'meta.traceId');
  });

  await test('rejects OCR without an image', async () => {
    const { status, json } = await request('/api/ocr', { method: 'POST', body: {} });
    assert.equal(status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INVALID_INPUT');
  });

  await test('rejects malformed JSON with 400 INVALID_JSON', async () => {
    const { status, json } = await request('/api/chat', { method: 'POST', raw: '{' });
    assert.equal(status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INVALID_JSON');
  });

  await test('returns 405 for a wrong method', async () => {
    const { status, json } = await request('/api/analyze');
    assert.equal(status, 405);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'METHOD_NOT_ALLOWED');
  });

  await test('returns 404 for an unknown endpoint', async () => {
    const { status, json } = await request('/api/unknown');
    assert.equal(status, 404);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'NOT_FOUND');
  });

  await test('answers CORS preflight for the Vite dev origin', async () => {
    const { status, headers } = await request('/api/analyze', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(status, 204);
    assert.equal(headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.ok(headers.get('access-control-allow-methods').includes('POST'));
  });

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} tests passed`);

  if (failed.length > 0) {
    console.error(`\n${failed.length} test(s) failed:`);
    for (const result of failed) console.error(` - ${result.name}`);
    console.error('\nBFF server logs:\n' + logs);
    process.exitCode = 1;
  } else {
    console.log('ALL BFF CONTRACT TESTS PASSED');
  }
}

main()
  .catch((error) => {
    console.error('\nFATAL: BFF contract tests could not run.');
    console.error(error);
    if (logs) console.error('\nBFF server logs:\n' + logs);
    process.exitCode = 1;
  })
  .finally(() => {
    if (child && child.exitCode === null) child.kill('SIGTERM');
  });



