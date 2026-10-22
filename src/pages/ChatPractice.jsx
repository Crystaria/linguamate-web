import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, User, Bot, RotateCcw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { sendChatMessage } from '../api/client';
import { adaptChat } from '../api/adapters';
import { addHistoryRecord } from '../api/history';

const OPENINGS = {
  restaurant: {
    en: 'Good evening! Welcome to our restaurant. Would you like to see our menu?',
    zh: '晚上好！欢迎来到我们餐厅。您想看看我们的菜单吗？',
  },
  shopping: {
    en: 'Hi! Welcome to our store. Are you looking for anything in particular?',
    zh: '您好！欢迎来到我们商店。您想找点什么吗？',
  },
  direction: {
    en: 'Excuse me, you look a little lost. Where are you trying to go?',
    zh: '打扰一下，您似乎迷路了。您想去哪里？',
  },
  introduction: {
    en: "Hi there! I don't think we've met. I'm Alex. What's your name?",
    zh: '你好！我们好像还没见过。我叫小明。你叫什么名字？',
  },
};

function fallbackOpening(scenario, language) {
  const entry = OPENINGS[scenario];
  if (entry) return entry[language] || entry.zh;
  return language === 'en'
    ? "Hi! Let's practise a real-life conversation. What would you like to talk about?"
    : '你好！我们来练习一个真实场景对话吧。你想聊些什么？';
}

const ChatPractice = ({ userLevel }) => {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('');
  const [conversationStarted, setConversationStarted] = useState(false);
  const [customScenarios, setCustomScenarios] = useState([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customScenarioName, setCustomScenarioName] = useState('');
  const [customScenarioDescription, setCustomScenarioDescription] = useState('');
  const [role, setRole] = useState('');
  const [goal, setGoal] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startConversation = async (scenario) => {
    const scenarioId = typeof scenario === 'string' ? scenario : scenario.id;
    const meta = typeof scenario === 'object' ? scenario : null;

    setSelectedScenario(scenarioId);
    setContext(scenarioId);
    setConversationStarted(true);
    setMessages([]);
    setRole('');
    setGoal('');
    setLoading(true);

    try {
      const payload = await sendChatMessage({
        scenario: scenarioId,
        level: userLevel,
        language,
        history: [],
        firstTurn: true,
        customScenarioName: scenarioId.startsWith('custom_')
          ? meta?.title || customScenarioName
          : undefined,
        customScenarioDescription: scenarioId.startsWith('custom_')
          ? meta?.description || customScenarioDescription
          : undefined,
      });
      const view = adaptChat(payload.data);

      setRole(view.role);
      setGoal(view.goal);
      setMessages([
        {
          type: 'ai',
          content: view.reply || view.opening || fallbackOpening(scenarioId, language),
          translation: view.translation,
          correction: view.correction,
          suggestions: view.suggestions,
        },
      ]);
    } catch (error) {
      console.error('开始对话失败:', error);
      setMessages([{ type: 'ai', content: fallbackOpening(scenarioId, language) }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading || !conversationStarted) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    const newMessages = [...messages, { type: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      const conversationHistory = messages
        .filter((msg) => msg.type === 'user' || msg.type === 'ai')
        .map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        }))
        .filter((msg) => msg.content);

      const currentScenario = [...conversationStarters, ...customScenarios].find(
        (item) => item.id === selectedScenario
      );

      const payload = await sendChatMessage({
        message: userMessage,
        scenario: selectedScenario,
        level: userLevel,
        language,
        history: conversationHistory,
        customScenarioName: selectedScenario.startsWith('custom_')
          ? currentScenario?.title
          : undefined,
        customScenarioDescription: selectedScenario.startsWith('custom_')
          ? currentScenario?.description
          : undefined,
      });
      const view = adaptChat(payload.data);

      setMessages([
        ...newMessages,
        {
          type: 'ai',
          content:
            view.reply ||
            view.response ||
            (language === 'en' ? 'I am here. Please continue.' : '我在听，请继续。'),
          translation: view.translation,
          correction: view.correction,
          suggestions: view.suggestions,
        },
      ]);

      if (view.role) setRole(view.role);
      if (view.goal) setGoal(view.goal);

      addHistoryRecord({
        content_type: 'chat_practice',
        content: userMessage,
        analysis: view.reply,
        level: userLevel,
        language,
        scenario: selectedScenario,
      });
    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages([
        ...newMessages,
        {
          type: 'ai',
          content:
            error.message ||
            (language === 'en'
              ? 'Sorry, I encountered some issues. Please try again later.'
              : '抱歉，我遇到了一些问题。请稍后再试。'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetChat = () => {
    setMessages([]);
    setContext('');
    setSelectedScenario('');
    setConversationStarted(false);
    setInputMessage('');
    setShowCustomInput(false);
    setCustomScenarioName('');
    setCustomScenarioDescription('');
    setRole('');
    setGoal('');
  };

  const conversationStarters = t.language === 'en' ? [
    {
      id: "restaurant",
      title: "Restaurant Ordering",
      description: "Practice ordering food at a restaurant",
      starter: "Hello, I'd like to order some pasta."
    },
    {
      id: "direction",
      title: "Asking for Directions",
      description: "Practice asking for and giving directions",
      starter: "Excuse me, how do I get to the train station?"
    },
    {
      id: "shopping",
      title: "Shopping",
      description: "Practice shopping conversations",
      starter: "How much does this shirt cost?"
    },
    {
      id: "introduction",
      title: "Self Introduction",
      description: "Practice self-introduction and daily conversation",
      starter: "Hello, my name is John, nice to meet you."
    }
  ] : [
    {
      id: "restaurant",
      title: "餐厅点餐",
      description: "练习在餐厅点餐的对话",
      starter: "你好，我想点一份意大利面。"
    },
    {
      id: "direction",
      title: "问路",
      description: "练习问路和指路的对话",
      starter: "请问去火车站怎么走？"
    },
    {
      id: "shopping",
      title: "购物",
      description: "练习在商店购物的对话",
      starter: "这件衣服多少钱？"
    },
    {
      id: "introduction",
      title: "自我介绍",
      description: "练习自我介绍和日常交流",
      starter: "你好，我叫小明，很高兴认识你。"
    }
  ];

  const addStarterMessage = (starter) => {
    setInputMessage(starter);
  };

  const startScenario = (scenario) => {
    startConversation(scenario);
  };

  const addCustomScenario = () => {
    if (customScenarioName.trim() && customScenarioDescription.trim()) {
      const newScenario = {
        id: `custom_${Date.now()}`,
        title: customScenarioName.trim(),
        description: customScenarioDescription.trim(),
        starter: t.language === 'en' ? `Let's practice ${customScenarioName.trim().toLowerCase()}` : `让我们练习${customScenarioName.trim()}`
      };
      
      setCustomScenarios([...customScenarios, newScenario]);
      setCustomScenarioName('');
      setCustomScenarioDescription('');
      setShowCustomInput(false);
    }
  };

  const deleteCustomScenario = (scenarioId) => {
    setCustomScenarios(customScenarios.filter(s => s.id !== scenarioId));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t.chat.title}</h1>
        <p className="text-gray-600">{t.chat.subtitle}</p>
      </div>

      {/* 场景选择界面 */}
      {!conversationStarted && (
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {t.language === 'en' ? 'Choose a Conversation Scenario' : '选择对话场景'}
            </h2>
            <p className="text-gray-600">
              {t.language === 'en' 
                ? 'Select a scenario to start a natural conversation practice session'
                : '选择一个场景开始自然的对话练习'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 预定义场景 */}
            {conversationStarters.map((scenario, index) => (
              <button
                key={index}
                onClick={() => startScenario(scenario)}
                className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg border border-blue-200 hover:border-blue-300 transition-all duration-200 text-left group"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-blue-500 text-white rounded-lg mb-4 group-hover:bg-blue-600 transition-colors">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{scenario.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{scenario.description}</p>
                <div className="text-xs text-blue-600 font-medium">
                  {t.language === 'en' ? 'Start Conversation' : '开始对话'} →
                </div>
              </button>
            ))}

            {/* 自定义场景 */}
            {customScenarios.map((scenario, index) => (
              <div
                key={scenario.id}
                className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 relative group"
              >
                <button
                  onClick={() => startScenario(scenario)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-green-500 text-white rounded-lg mb-4 group-hover:bg-green-600 transition-colors">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{scenario.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{scenario.description}</p>
                  <div className="text-xs text-green-600 font-medium">
                    {t.language === 'en' ? 'Start Conversation' : '开始对话'} →
                  </div>
                </button>
                <button
                  onClick={() => deleteCustomScenario(scenario.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  title={t.language === 'en' ? 'Delete' : '删除'}
                >
                  ×
                </button>
              </div>
            ))}

            {/* 添加自定义场景按钮 */}
            <button
              onClick={() => setShowCustomInput(true)}
              className="p-6 bg-gradient-to-br from-gray-50 to-slate-50 hover:from-gray-100 hover:to-slate-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-all duration-200 text-center group"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-gray-400 text-white rounded-lg mb-4 mx-auto group-hover:bg-gray-500 transition-colors">
                <span className="text-xl">+</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {t.language === 'en' ? 'Create Custom' : '创建自定义场景'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t.language === 'en' ? 'Add your own conversation scenario' : '添加您自己的对话场景'}
              </p>
              <div className="text-xs text-gray-600 font-medium">
                {t.language === 'en' ? 'Click to Add' : '点击添加'} →
              </div>
            </button>
          </div>

          {/* 自定义场景输入表单 */}
          {showCustomInput && (
            <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t.language === 'en' ? 'Create Custom Scenario' : '创建自定义场景'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.language === 'en' ? 'Scenario Name' : '场景名称'}
                  </label>
                  <input
                    type="text"
                    value={customScenarioName}
                    onChange={(e) => setCustomScenarioName(e.target.value)}
                    placeholder={t.language === 'en' ? 'e.g., Job Interview, Travel Planning' : '例如：工作面试、旅行规划'}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.language === 'en' ? 'Scenario Description' : '场景描述'}
                  </label>
                  <textarea
                    value={customScenarioDescription}
                    onChange={(e) => setCustomScenarioDescription(e.target.value)}
                    placeholder={t.language === 'en' ? 'Describe what this scenario involves...' : '描述这个场景涉及的内容...'}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={addCustomScenario}
                    disabled={!customScenarioName.trim() || !customScenarioDescription.trim()}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t.language === 'en' ? 'Create Scenario' : '创建场景'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomScenarioName('');
                      setCustomScenarioDescription('');
                    }}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    {t.language === 'en' ? 'Cancel' : '取消'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-yellow-800 text-sm font-bold">!</span>
                </div>
              </div>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">
                  {t.language === 'en' ? '💡 Conversation Tips:' : '💡 对话技巧：'}
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    {t.language === 'en' 
                      ? 'AI will respond naturally based on your selected scenario'
                      : 'AI会根据您选择的场景自然地回应'}
                  </li>
                  <li>
                    {t.language === 'en'
                      ? 'Try to use appropriate vocabulary and expressions for each situation'
                      : '尝试使用适合每种情况的词汇和表达'}
                  </li>
                  <li>
                    {t.language === 'en'
                      ? 'Ask follow-up questions to keep the conversation flowing'
                      : '提出后续问题让对话持续进行'}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 对话界面 */}
      {conversationStarted && (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* 侧边栏 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">
                {t.language === 'zh' ? '对话设置' : 'Conversation Settings'}
              </h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'en' ? 'Current Scenario:' : '当前场景：'}
                </label>
                <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
                  {[...conversationStarters, ...customScenarios].find(s => s.id === selectedScenario)?.title}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.chat.level}
                </label>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {t.chat.levels[userLevel]}
                </div>
              </div>

              <button
                onClick={resetChat}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.chat.clearChat}</span>
              </button>
            </div>
          </div>

        {/* 聊天区域 */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg h-[600px] flex flex-col">
            {/* 聊天头部 */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">LinguaMate AI</h3>
                  <p className="text-sm text-gray-500">
                    {goal ||
                      (t.language === 'en'
                        ? 'Your language learning partner'
                        : '你的语言学习伙伴')}
                  </p>
                  {role && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {role}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t.language === 'en' ? 'Conversation started! AI is waiting for your response.' : '对话已开始！AI正在等待您的回应。'}</p>
                  <p className="text-sm mt-2">{t.language === 'en' ? 'Type your message below to continue the conversation.' : '在下方输入您的消息来继续对话。'}</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${
                        message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          message.type === 'user'
                            ? 'bg-primary-500'
                            : 'bg-gradient-to-r from-primary-500 to-secondary-500'
                        }`}
                      >
                        {message.type === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.translation && (
                          <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">
                            {message.translation}
                          </p>
                        )}
                        {message.correction?.hasError && (
                          <div className="mt-2 text-xs bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800">
                            <div>
                              <strong>{message.correction.corrected}</strong>
                            </div>
                            {message.correction.note && <div>{message.correction.note}</div>}
                          </div>
                        )}
                        {message.suggestions?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {message.suggestions.slice(0, 3).map((suggestion, suggestionIndex) => (
                              <span
                                key={suggestionIndex}
                                className="text-xs bg-white/70 border border-gray-200 rounded-full px-2 py-0.5 text-gray-600"
                              >
                                {suggestion}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-gray-100 px-4 py-2 rounded-lg">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t.chat.placeholder}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={2}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || loading}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t.language === 'zh' ? '按 Enter 发送，Shift + Enter 换行' : 'Press Enter to send, Shift + Enter for new line'}
              </p>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default ChatPractice;
