import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image as ImageIcon, Brain, BookOpen, CheckCircle, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { analyzeImage, generateExercises } from '../api/client';
import { adaptOcr, adaptExercises } from '../api/adapters';
import { addHistoryRecord } from '../api/history';
import MarkdownView from '../components/MarkdownView';
import ExerciseList from '../components/ExerciseList';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

const ImageAnalysis = ({ userLevel }) => {
  const { t, language } = useLanguage();
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [exercises, setExercises] = useState(null);
  const [answerKey, setAnswerKey] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setCurrentStep(1);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp'],
    },
    maxFiles: 1,
  });

  const handleImageAnalysis = async () => {
    if (!uploadedFile) return;

    setLoading(true);
    try {
      const imageBase64 = await fileToBase64(uploadedFile);
      const payload = await analyzeImage({
        imageBase64,
        fileName: uploadedFile.name,
        level: userLevel,
        language,
      });
      const view = adaptOcr(payload.data);

      if (!view.analysis && !view.extractedText) {
        throw new Error(view.error || '图片分析结果为空');
      }

      setExtractedText(view.extractedText);
      setAnalysis(view.analysis);
      setAnalysisData(view.analysisStructured || null);
      setCurrentStep(2);

      addHistoryRecord({
        content_type: 'image_analysis',
        content: view.extractedText,
        image_data: imageBase64.length < 200000 ? imageBase64 : '',
        analysis: view.analysis,
        level: userLevel,
        language,
      });
    } catch (error) {
      console.error('图片分析失败:', error);
      alert(
        error.message ||
          (language === 'en' ? 'Image analysis failed, please retry' : '图片分析失败，请重试')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateExercises = async () => {
    if (!analysis || !extractedText) return;

    setLoading(true);
    try {
      const payload = await generateExercises({
        text: extractedText,
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
        content: extractedText,
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

  const resetAnalysis = () => {
    setUploadedFile(null);
    setExtractedText('');
    setAnalysis('');
    setAnalysisData(null);
    setExercises(null);
    setAnswerKey({});
    setCurrentStep(1);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t.imageAnalysis.title}</h1>
        <p className="text-gray-600">{t.imageAnalysis.subtitle}</p>
      </div>

      {/* 步骤指示器 */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-primary-500' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}>
              <ImageIcon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{t.language === 'en' ? 'Upload' : '上传'}</span>
          </div>
          <div className={`w-6 h-0.5 ${currentStep >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-primary-500' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}>
              <Brain className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{t.language === 'en' ? 'Analysis' : '分析'}</span>
          </div>
          <div className={`w-6 h-0.5 ${currentStep >= 3 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-primary-500' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}>
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{t.language === 'en' ? 'Exercises' : '练习题'}</span>
          </div>
        </div>
      </div>

      {/* 步骤1: 图片上传 */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">{t.imageAnalysis.step1}</h2>
          
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-primary-600">
                {t.language === 'zh' ? '释放文件以上传...' : 'Drop file to upload...'}
              </p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  {t.language === 'en' ? (
                    <>Drag image here, or <span className="text-primary-500">click to select file</span></>
                  ) : (
                    <>拖拽图片到这里，或 <span className="text-primary-500">点击选择文件</span></>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {t.imageAnalysis.supportedFormats}
                </p>
              </div>
            )}
          </div>

          {uploadedFile && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUploadedFile(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <span className="text-sm text-gray-500">
              {t.language === 'en' ? 'Current Learning Level: ' : '当前学习等级: '}{userLevel === 'beginner' ? (t.language === 'en' ? 'Beginner' : '初学者') : userLevel === 'intermediate' ? (t.language === 'en' ? 'Intermediate' : '中级') : (t.language === 'en' ? 'Advanced' : '高级')}
            </span>
            <button
              onClick={handleImageAnalysis}
              disabled={!uploadedFile || loading}
              className="flex items-center space-x-2 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Brain className="w-4 h-4" />
              )}
              <span>{t.imageAnalysis.startAnalysis}</span>
            </button>
          </div>
        </div>
      )}

      {/* 步骤2: OCR识别和分析结果 */}
      {currentStep >= 2 && (
        <div className="space-y-6">
          {/* 识别的文本 */}
          {extractedText && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{t.imageAnalysis.extractedText}</h2>
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">{t.imageAnalysis.ocrComplete}</span>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm text-gray-700">
                  {extractedText}
                </pre>
              </div>
            </div>
          )}

          {/* 分析结果 */}
          {analysis && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{t.imageAnalysis.analysisResult}</h2>
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">{t.imageAnalysis.analysisComplete}</span>
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
                    <span>{t.imageAnalysis.generateExercises}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 步骤3: 练习题 */}
      {currentStep >= 3 && exercises && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t.imageAnalysis.personalizedExercises}</h2>
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm">{t.imageAnalysis.exercisesComplete}</span>
            </div>
          </div>
          
          <ExerciseList
            questions={exercises}
            answerKey={answerKey}
            language={language}
          />

          <div className="mt-6 text-center">
            <button
              onClick={resetAnalysis}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
{t.imageAnalysis.restart}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageAnalysis;
