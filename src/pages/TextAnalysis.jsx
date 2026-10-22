import React, { useState } from 'react';
import { Send, FileText, Brain, BookOpen, CheckCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { analyzeText, generateExercises } from '../api/client';
import { adaptAnalysis, adaptExercises } from '../api/adapters';
import { addHistoryRecord } from '../api/history';
import MarkdownView from '../components/MarkdownView';
import ExerciseList from '../components/ExerciseList';
const TextAnalysis = ({ userLevel }) => {
  const { t, language } = useLanguage();
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [exercises, setExercises] = useState(null);
  const [answerKey, setAnswerKey] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const handleTextAnalysis = async () => {
    if (!text.trim()) return;

    setLoading(true);
    try {
      const payload = await analyzeText({ text, level: userLevel, language });
      const view = adaptAnalysis(payload.data);

      if (!view.analysis) {
        throw new Error(view.error || '分析结果为空');
      }

      setAnalysis(view.analysis);
      setAnalysisData(view.analysisStructured || null);
      setCurrentStep(2);

      addHistoryRecord({
        content_type: 'text_analysis',
        content: text,
        analysis: view.analysis,
        level: userLevel,
        language,
      });
    } catch (error) {
      console.error('分析失败:', error);
      alert(
        error.message ||
          (language === 'en' ? 'Analysis failed, please retry' : '分析失败，请重试')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateExercises = async () => {
    if (!analysis) return;

    setLoading(true);
    try {
      const payload = await generateExercises({
        text,
        analysis: analysisData || analysis,
        level: userLevel,
        language,
      });
      const view = adaptExercises(payload.data);

      if (!view.questions.length) {
        throw new Error(view.error || '练习生成失败');
      }

      setExercises(view.questions);
      setAnswerKey(view.answerKey);
      setCurrentStep(3);

      addHistoryRecord({
        content_type: 'exercise_generation',
        content: text,
        analysis,
        level: userLevel,
        language,
        exercise_id: view.exerciseId,
        exercise_count: view.questions.length,
      });
    } catch (error) {
      console.error('生成练习失败:', error);
      alert(
        error.message ||
          (language === 'en'
            ? 'Failed to generate exercises, please retry'
            : '生成练习失败，请重试')
      );
    } finally {
      setLoading(false);
    }
  };

  const sampleTexts = [
    "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.",
    "Learning a new language is like opening a door to a new world. It allows you to communicate with people from different cultures and understand their perspectives.",
    "Artificial intelligence is transforming the way we learn languages. With AI-powered tools, students can get personalized feedback and practice in real-time."
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t.textAnalysis.title}</h1>
        <p className="text-gray-600">{t.textAnalysis.subtitle}</p>
      </div>

      {/* 步骤指示器 */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-primary-500' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}>
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{t.textAnalysis.step1.split(': ')[1]}</span>
          </div>
          <div className={`w-8 h-0.5 ${currentStep >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-primary-500' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}>
              <Brain className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{t.textAnalysis.step2.split(': ')[1]}</span>
          </div>
          <div className={`w-8 h-0.5 ${currentStep >= 3 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-primary-500' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}>
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{t.textAnalysis.step3.split(': ')[1]}</span>
          </div>
        </div>
      </div>

      {/* 步骤1: 文本输入 */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">{t.textAnalysis.step1}</h2>
          
          {/* 示例文本 */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              {t.language === 'zh' ? '或者选择示例文本：' : 'Or choose from sample texts:'}
            </p>
            <div className="space-y-2">
              {sampleTexts.map((sample, index) => (
                <button
                  key={index}
                  onClick={() => setText(sample)}
                  className="block w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.textAnalysis.inputPlaceholder}
            className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
          
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-500">
              {t.language === 'zh' ? '当前学习等级: ' : 'Current Learning Level: '}
              {t.chat.levels[userLevel]}
            </span>
            <button
              onClick={handleTextAnalysis}
              disabled={!text.trim() || loading}
              className="flex items-center space-x-2 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{t.textAnalysis.analyze}</span>
            </button>
          </div>
        </div>
      )}

      {/* 步骤2: 分析结果 */}
      {currentStep >= 2 && analysis && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t.textAnalysis.step2}</h2>
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm">{t.textAnalysis.analysisComplete}</span>
            </div>
          </div>
          
          <MarkdownView content={analysis} />

          {currentStep === 2 && (
            <div className="mt-6 text-center">
              <button
                onClick={handleGenerateExercises}
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-2 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mx-auto"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <BookOpen className="w-4 h-4" />
                )}
                <span>{t.textAnalysis.generateExercises}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 原始文本显示 */}
      {currentStep >= 2 && text && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t.textAnalysis.originalText}</h2>
            <div className="flex items-center space-x-2 text-blue-600">
              <FileText className="w-5 h-5" />
              <span className="text-sm">{t.textAnalysis.originalTextTitle}</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">{t.textAnalysis.originalTextDescription}</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
              {text}
            </pre>
          </div>
        </div>
      )}

      {/* 步骤3: 练习题 */}
      {currentStep >= 3 && exercises && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t.textAnalysis.step3}</h2>
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm">{t.textAnalysis.exercisesComplete}</span>
            </div>
          </div>
          
          <ExerciseList
            questions={exercises}
            answerKey={answerKey}
            language={language}
          />

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setCurrentStep(1);
                setText('');
                setAnalysis('');
                setAnalysisData(null);
                setExercises(null);
                setAnswerKey({});
              }}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              {t.textAnalysis.restart}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextAnalysis;
