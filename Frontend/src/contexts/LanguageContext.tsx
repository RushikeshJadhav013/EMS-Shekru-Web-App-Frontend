import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '@/i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKey;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Try to get user-specific language preference first
    const userId = localStorage.getItem('userId');
    if (userId) {
      const userLangKey = `language_${userId}`;
      const userSaved = localStorage.getItem(userLangKey);
      if (userSaved) {
        return (userSaved as Language);
      }
    }
    
    // Fallback to global language preference
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    // Save language preference for specific user if available
    const userId = localStorage.getItem('userId');
    if (userId) {
      const userLangKey = `language_${userId}`;
      localStorage.setItem(userLangKey, language);
    }
    
    // Also save global preference as fallback
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  // Update language when user changes (login/logout)
  useEffect(() => {
    const handleStorageChange = () => {
      const userId = localStorage.getItem('userId');
      if (userId) {
        const userLangKey = `language_${userId}`;
        const userSaved = localStorage.getItem(userLangKey);
        if (userSaved && userSaved !== language) {
          setLanguage(userSaved as Language);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [language]);

  const value = {
    language,
    setLanguage,
    t: translations[language],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};