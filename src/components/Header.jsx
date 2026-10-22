import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, MessageCircle, Image, FileText, History } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageToggle from './LanguageToggle';

const Header = ({ userLevel, setUserLevel }) => {
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: '/', label: t.nav.home, icon: BookOpen },
    { path: '/text-analysis', label: t.nav.textAnalysis, icon: FileText },
    { path: '/image-analysis', label: t.nav.imageAnalysis, icon: Image },
    { path: '/chat-practice', label: t.nav.chat, icon: MessageCircle },
    { path: '/learning-history', label: t.nav.history, icon: History },
  ];

  const levelOptions = [
    { value: 'beginner', label: t.chat.levels.beginner },
    { value: 'intermediate', label: t.chat.levels.intermediate },
    { value: 'advanced', label: t.chat.levels.advanced },
  ];

  return (
    <header className="bg-white shadow-lg border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800">LinguaMate AI</span>
          </Link>

          {/* 导航菜单 */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 学习等级选择器和语言切换 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{t.chat.level}:</span>
              <select
                value={userLevel}
                onChange={(e) => setUserLevel(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {levelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <LanguageToggle />
          </div>
        </div>

        {/* 移动端导航 */}
        <div className="md:hidden pb-4">
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
