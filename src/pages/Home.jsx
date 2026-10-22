import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Image, FileText, Brain, Target, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Home = () => {
  const { t } = useLanguage();
  
  const features = [
    {
      icon: FileText,
      title: t.home.features.textAnalysis,
      description: t.home.features.textAnalysisDesc,
      link: '/text-analysis',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Image,
      title: t.home.features.imageAnalysis,
      description: t.home.features.imageAnalysisDesc,
      link: '/image-analysis',
      color: 'from-green-500 to-green-600'
    },
    {
      icon: MessageCircle,
      title: t.home.features.chat,
      description: t.home.features.chatDesc,
      link: '/chat-practice',
      color: 'from-purple-500 to-purple-600'
    }
  ];

  const highlights = [
    {
      icon: Brain,
      title: t.home.highlights.linguisticsDriven,
      description: t.home.highlights.linguisticsDrivenDesc
    },
    {
      icon: Target,
      title: t.home.highlights.personalizedLearning,
      description: t.home.highlights.personalizedLearningDesc
    },
    {
      icon: Users,
      title: t.home.highlights.immersiveExperience,
      description: t.home.highlights.immersiveExperienceDesc
    }
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            {t.home.hero.title}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-secondary-500">
              {t.home.hero.subtitle}
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {t.home.hero.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/text-analysis"
              className="px-8 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors"
            >
              {t.home.hero.startTextAnalysis}
            </Link>
            <Link
              to="/image-analysis"
              className="px-8 py-3 border-2 border-primary-500 text-primary-500 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              {t.home.hero.uploadImage}
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section>
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          {t.home.coreFeatures}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link
                key={index}
                to={feature.link}
                className="group block p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Highlights Section */}
      <section className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          {t.home.whyChoose}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {highlights.map((highlight, index) => {
            const Icon = highlight.icon;
            return (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Icon className="w-8 h-8 text-primary-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {highlight.title}
                </h3>
                <p className="text-gray-600">
                  {highlight.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Demo Section */}
      <section className="text-center py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          {t.home.demoScenarios.title}
        </h2>
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-lg font-semibold mb-2">{t.home.demoScenarios.uploadTextbook}</h3>
              <p className="text-gray-600">{t.home.demoScenarios.uploadTextbookDesc}</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-lg font-semibold mb-2">{t.home.demoScenarios.chooseLearningMode}</h3>
              <p className="text-gray-600">{t.home.demoScenarios.chooseLearningModeDesc}</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-lg font-semibold mb-2">{t.home.demoScenarios.chatPractice}</h3>
              <p className="text-gray-600">{t.home.demoScenarios.chatPracticeDesc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl text-white">
        <h2 className="text-3xl font-bold mb-4">
          {t.home.cta.title}
        </h2>
        <p className="text-xl mb-8 opacity-90">
          {t.home.cta.description}
        </p>
        <Link
          to="/text-analysis"
          className="inline-block px-8 py-3 bg-white text-primary-500 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          {t.home.cta.startNow}
        </Link>
      </section>
    </div>
  );
};

export default Home;
