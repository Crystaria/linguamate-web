import React, { useState } from 'react';
import { CheckCircle, RotateCcw } from 'lucide-react';
import { gradeAnswer } from '../api/adapters';

const LABELS = {
  zh: {
    submit: '提交答案',
    correct: '正确！',
    incorrect: '不正确',
    yourAnswer: '您的答案',
    correctAnswer: '正确答案',
    explanation: '解释',
    reset: '重置',
    total: '共 {n} 题',
    hintWords: '点击单词组句，或直接输入：',
    typeSentence: '请输入完整的句子',
    typeAnswer: '请输入你的回答',
    blank: '（待补全）',
    dialogueFallback: '请写出合适的回答：',
    types: {
      multiple_choice: '选择题',
      sentence_building: '组句题',
      dialogue_completion: '对话补全',
    },
  },
  en: {
    submit: 'Submit Answer',
    correct: 'Correct!',
    incorrect: 'Incorrect',
    yourAnswer: 'Your answer',
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    reset: 'Reset',
    total: '{n} questions',
    hintWords: 'Tap the words to build a sentence, or type it directly:',
    typeSentence: 'Type the complete sentence',
    typeAnswer: 'Type your reply',
    blank: '(to complete)',
    dialogueFallback: 'Write a suitable reply:',
    types: {
      multiple_choice: 'Multiple choice',
      sentence_building: 'Sentence building',
      dialogue_completion: 'Dialogue completion',
    },
  },
};

/**
 * Shared renderer + local grader for all three question types emitted by the
 * Coze exercise workflow. Grading never calls the backend: it compares the
 * user's answer with the answer_key shipped alongside the questions.
 */
export default function ExerciseList({
  questions = [],
  answerKey = {},
  language = 'zh',
  onGraded,
}) {
  const labels = LABELS[language] || LABELS.zh;
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});

  if (!Array.isArray(questions) || questions.length === 0) return null;

  const setAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [String(id)]: value }));
  };

  const submit = (question) => {
    const id = String(question.id);
    if (!String(answers[id] || '').trim()) return;

    const result = gradeAnswer(question, answerKey, answers[id]);
    setResults((prev) => ({ ...prev, [id]: result }));
    if (typeof onGraded === 'function') onGraded(question, result);
  };

  const reset = () => {
    setAnswers({});
    setResults({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {labels.total.replace('{n}', String(questions.length))}
        </span>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <RotateCcw className="w-4 h-4" />
          {labels.reset}
        </button>
      </div>

      {questions.map((question, index) => {
        const id = String(question.id);
        const answer = answers[id] || '';
        const result = results[id];
        const options = question.options || [];

        return (
          <div key={id} className="border-l-4 border-blue-500 pl-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="font-medium text-lg">
                  {index + 1}. {question.question}
                </p>
                <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  {labels.types[question.type] || question.type}
                </span>
              </div>

              {question.type === 'multiple_choice' && options.length > 0 && (
                <div className="space-y-2 mb-4">
                  {options.map((option, optionIndex) => {
                    const letter = String.fromCharCode(65 + optionIndex);
                    return (
                      <label key={optionIndex} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${id}`}
                          value={letter}
                          checked={answer === letter}
                          onChange={() => setAnswer(id, letter)}
                          disabled={Boolean(result)}
                          className="text-blue-600"
                        />
                        <span className={result ? 'opacity-75' : ''}>
                          <span className="font-mono font-semibold mr-1">{letter}.</span>
                          {option}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {question.type === 'sentence_building' && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">{labels.hintWords}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(question.words || []).map((word, wordIndex) => (
                      <button
                        key={wordIndex}
                        type="button"
                        disabled={Boolean(result)}
                        onClick={() => setAnswer(id, `${answer} ${word}`.trim())}
                        className="px-3 py-1 bg-white border border-blue-200 rounded-full text-sm hover:bg-blue-100 disabled:opacity-50"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={answer}
                    onChange={(event) => setAnswer(id, event.target.value)}
                    disabled={Boolean(result)}
                    placeholder={labels.typeSentence}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}

              {question.type === 'dialogue_completion' && (
                <div className="mb-4">
                  {question.scenario && (
                    <p className="text-sm text-gray-600 mb-2">{question.scenario}</p>
                  )}
                  <div className="space-y-2 mb-3 bg-white rounded-lg p-3 border border-blue-100">
                    {(question.dialogue || []).map((entry, dialogueIndex) => (
                      <div key={dialogueIndex} className="flex gap-2 text-sm">
                        <span className="font-medium shrink-0">{entry.speaker}:</span>
                        <span className={entry.text ? 'text-gray-700' : 'text-gray-400 italic'}>
                          {entry.text || labels.blank}
                        </span>
                      </div>
                    ))}
                    {(question.dialogue || []).length === 0 && (
                      <p className="text-sm text-gray-500">{labels.dialogueFallback}</p>
                    )}
                  </div>
                  <input
                    type="text"
                    value={answer}
                    onChange={(event) => setAnswer(id, event.target.value)}
                    disabled={Boolean(result)}
                    placeholder={labels.typeAnswer}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}

              {question.type === 'multiple_choice' && options.length === 0 && (
                <input
                  type="text"
                  value={answer}
                  onChange={(event) => setAnswer(id, event.target.value)}
                  disabled={Boolean(result)}
                  placeholder={labels.typeAnswer}
                  className="w-full p-2 mb-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              )}

              {answer && !result && (
                <button
                  type="button"
                  onClick={() => submit(question)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  {labels.submit}
                </button>
              )}

              {result && (
                <div
                  className={`mt-4 p-3 rounded-lg ${
                    result.isCorrect
                      ? 'bg-green-100 border border-green-300'
                      : 'bg-red-100 border border-red-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    {result.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <span className="w-5 h-5 text-red-600">✗</span>
                    )}
                    <span
                      className={`font-medium ${
                        result.isCorrect ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {result.isCorrect ? labels.correct : labels.incorrect}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>{labels.yourAnswer}：</strong>
                    {result.userAnswer}
                  </p>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>{labels.correctAnswer}：</strong>
                    {result.correctAnswer}
                  </p>
                  {result.explanation && (
                    <p className="text-sm text-gray-700">
                      <strong>{labels.explanation}：</strong>
                      {result.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

