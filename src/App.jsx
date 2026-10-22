import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import Header from './components/Header';
import Home from './pages/Home';
import TextAnalysis from './pages/TextAnalysis';
import ImageAnalysis from './pages/ImageAnalysis';
import ChatPractice from './pages/ChatPractice';
import LearningHistory from './pages/LearningHistory';
import './App.css';

function App() {
  const [userLevel, setUserLevel] = useState('beginner');

  return (
    <LanguageProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Header userLevel={userLevel} setUserLevel={setUserLevel} />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/text-analysis" element={<TextAnalysis userLevel={userLevel} />} />
              <Route path="/image-analysis" element={<ImageAnalysis userLevel={userLevel} />} />
              <Route path="/chat-practice" element={<ChatPractice userLevel={userLevel} />} />
              <Route path="/learning-history" element={<LearningHistory />} />
            </Routes>
          </main>
        </div>
      </Router>
    </LanguageProvider>
  );
}

export default App;
