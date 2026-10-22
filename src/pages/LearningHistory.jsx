import React, { useState, useEffect } from 'react';
import { Clock, FileText, Image, MessageCircle, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { getHistoryRecords, clearHistoryRecords, HISTORY_EVENT } from '../api/history';
import { useLanguage } from '../contexts/LanguageContext';

const LearningHistory = () => {
  const { t } = useLanguage();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const load = () => {
      const next = getHistoryRecords()
        .map((record) => ({
          ...record,
          type: record.type || record.content_type || 'text_analysis',
          timestamp: record.timestamp || record.created_at,
        }))
        .filter((record) => record.timestamp);

      setRecords(next);
      setSelectedRecord((current) =>
        current ? next.find((record) => record.id === current.id) || null : null
      );
      setLoading(false);
    };

    load();
    window.addEventListener(HISTORY_EVENT, load);
    return () => window.removeEventListener(HISTORY_EVENT, load);
  }, []);

  const clearAllRecords = async () => {
    setClearing(true);
    try {
      const count = records.length;
      clearHistoryRecords();
      setRecords([]);
      setSelectedRecord(null);
      setShowClearConfirm(false);
      alert(
        t.language === 'en'
          ? `Successfully cleared ${count} learning records`
          : `成功清除 ${count} 条学习记录`
      );
    } catch (error) {
      console.error('清除学习记录失败:', error);
      alert(
        t.language === 'en' ? 'Failed to clear learning records' : '清除学习记录失败'
      );
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const locale = t.language === 'en' ? 'en-US' : 'zh-CN';
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'text_analysis':
        return <FileText className="w-5 h-5" />;
      case 'image_analysis':
        return <Image className="w-5 h-5" />;
      case 'chat_practice':
        return <MessageCircle className="w-5 h-5" />;
      case 'exercise_generation':
        return <FileText className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getContentTypeLabel = (type) => {
    switch (type) {
      case 'text_analysis':
        return t.history.textAnalysis;
      case 'image_analysis':
        return t.history.imageAnalysis;
      case 'chat_practice':
        return t.history.chatPractice;
      case 'exercise_generation':
        return t.language === 'en' ? 'Exercise Generation' : '练习生成';
      default:
        return t.history.textAnalysis;
    }
  };

  const getLevelBadge = (level) => {
    const levelMap = {
      beginner: { 
        label: t.language === 'en' ? 'Beginner' : '初学者', 
        color: 'bg-green-100 text-green-800' 
      },
      intermediate: { 
        label: t.language === 'en' ? 'Intermediate' : '中级', 
        color: 'bg-yellow-100 text-yellow-800' 
      },
      advanced: { 
        label: t.language === 'en' ? 'Advanced' : '高级', 
        color: 'bg-red-100 text-red-800' 
      }
    };
    
    const levelInfo = levelMap[level] || levelMap.beginner;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${levelInfo.color}`}>
        {levelInfo.label}
      </span>
    );
  };

  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t.history.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t.history.title}</h1>
        <p className="text-gray-600">{t.history.subtitle}</p>
        {records.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 mx-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.language === 'en' ? 'Clear All Records' : '清除所有记录'}</span>
            </button>
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">{t.history.noHistory}</h2>
          <p className="text-gray-500">
            {t.language === 'en' 
              ? 'Start using LinguaMate AI for language learning, and your records will appear here.' 
              : '开始使用 LinguaMate AI 进行语言学习，记录将在这里显示。'
            }
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 记录列表 */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-primary-500">
                        {getContentTypeIcon(record.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {getContentTypeLabel(record.type)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(record.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getLevelBadge(record.level)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(record);
                        }}
                        className="text-gray-400 hover:text-primary-500 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-gray-700 mb-3">
                    {truncateText(record.content)}
                  </div>
                  
                  {record.analysis && (
                    <div className="text-sm text-gray-500">
                      {t.language === 'en' ? 'Linguistic analysis generated' : '已生成语言学分析'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 详情面板 */}
          <div className="lg:col-span-1">
            {selectedRecord ? (
              <div className="bg-white rounded-lg shadow-lg p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t.language === 'en' ? 'Learning Details' : '学习详情'}
                  </h2>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.language === 'en' ? 'Learning Type' : '学习类型'}
                    </label>
                    <div className="flex items-center space-x-2">
                      {getContentTypeIcon(selectedRecord.type)}
                      <span className="text-sm text-gray-900">
                        {getContentTypeLabel(selectedRecord.type)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.language === 'en' ? 'Learning Level' : '学习等级'}
                    </label>
                    {getLevelBadge(selectedRecord.level)}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.language === 'en' ? 'Learning Time' : '学习时间'}
                    </label>
                    <p className="text-sm text-gray-900">
                      {formatDate(selectedRecord.timestamp)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.language === 'en' ? 'Original Content' : '原始内容'}
                    </label>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedRecord.content}
                      </pre>
                    </div>
                  </div>

                  {selectedRecord.analysis && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.language === 'en' ? 'Linguistic Analysis' : '语言学分析'}
                      </label>
                      <div className="bg-gray-50 p-3 rounded-lg max-h-60 overflow-y-auto">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                          {selectedRecord.analysis}
                        </pre>
                      </div>
                    </div>
                  )}

                  {selectedRecord.image_data && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.language === 'en' ? 'Original Image' : '原始图片'}
                      </label>
                      <img
                        src={
                          selectedRecord.image_data.startsWith('data:')
                            ? selectedRecord.image_data
                            : `data:image/jpeg;base64,${selectedRecord.image_data}`
                        }
                        alt={t.language === 'en' ? 'Learning image' : '学习图片'}
                        className="w-full rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  {t.language === 'en' ? 'Select a record to view details' : '选择记录查看详情'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {t.language === 'en' 
                    ? 'Click on a learning record on the left to view detailed content and analysis results' 
                    : '点击左侧的学习记录查看详细内容和分析结果'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 清除确认对话框 */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t.language === 'en' ? 'Confirm Clear All Records' : '确认清除所有记录'}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              {t.language === 'en' 
                ? 'Are you sure you want to clear all learning records? This action cannot be undone.' 
                : '您确定要清除所有学习记录吗？此操作无法撤销。'}
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={clearing}
              >
                {t.language === 'en' ? 'Cancel' : '取消'}
              </button>
              <button
                onClick={clearAllRecords}
                disabled={clearing}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                {clearing && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>{t.language === 'en' ? 'Clear All' : '清除全部'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningHistory;
