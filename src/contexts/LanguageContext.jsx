import React, { createContext, useContext, useState, useEffect } from 'react';
import { zh } from '../locales/zh';
import { en } from '../locales/en';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // 从localStorage获取保存的语言设置，默认为中文
    return localStorage.getItem('language') || 'zh';
  });

  const [t, setT] = useState(zh);

  useEffect(() => {
    // 保存语言设置到localStorage
    localStorage.setItem('language', language);
    
    // 更新翻译对象
    setT(language === 'zh' ? zh : en);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
  };

  const value = {
    language,
    t,
    toggleLanguage,
    setLanguage
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};



