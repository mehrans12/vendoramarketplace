import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../locales/en.json';
import ur from '../locales/ur.json';
import sd from '../locales/sd.json';

const translations = { en, ur, sd };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem('vendora_language');
    if (saved && (saved === 'en' || saved === 'ur' || saved === 'sd')) {
      return saved;
    }
    // Auto detect from browser
    const browserLang = navigator.language || navigator.userLanguage || 'en';
    if (browserLang.startsWith('ur')) return 'ur';
    if (browserLang.startsWith('sd')) return 'sd';
    return 'en';
  });

  const setLanguage = (lang) => {
    if (lang === 'en' || lang === 'ur' || lang === 'sd') {
      setLanguageState(lang);
      localStorage.setItem('vendora_language', lang);
    }
  };

  // Sync HTML dir and lang tags when language changes
  useEffect(() => {
    const dir = (language === 'ur' || language === 'sd') ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language]);

  // Translate helper supporting nested dot notation keys (e.g., "nav.home")
  const t = (keyPath) => {
    if (!keyPath) return '';
    const keys = keyPath.split('.');
    
    // Attempt resolving active language
    let activeObj = translations[language];
    let activeVal = activeObj;
    for (const key of keys) {
      if (activeVal && typeof activeVal === 'object') {
        activeVal = activeVal[key];
      } else {
        activeVal = undefined;
        break;
      }
    }

    if (activeVal !== undefined) return activeVal;

    // Fallback to English
    let fallbackObj = translations['en'];
    let fallbackVal = fallbackObj;
    for (const key of keys) {
      if (fallbackVal && typeof fallbackVal === 'object') {
        fallbackVal = fallbackVal[key];
      } else {
        fallbackVal = undefined;
        break;
      }
    }

    return fallbackVal !== undefined ? fallbackVal : keyPath;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
