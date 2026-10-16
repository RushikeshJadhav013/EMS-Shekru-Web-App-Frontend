import React, { createContext, useContext, useState, useEffect } from 'react';

export type ColorTheme =
  // IT Professional Themes (4)
  | 'tech-blue'
  | 'cyber-dark'
  | 'cloud-professional'
  | 'developer-dark'
  // Sales Themes (4)
  | 'sales-blue'
  | 'sales-orange'
  | 'revenue-green'
  | 'executive-sales'
  // General Professional Themes (7)
  | 'corporate-blue'
  | 'modern-purple'
  | 'minimal-white'
  | 'ocean'
  | 'emerald'
  | 'sunset'
  | 'premium-dark'
  // Legacy compatibility
  | 'default'
  | 'purple'
  | 'green'
  | 'orange'
  | 'pink'
  | 'cyan';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resetToDefault: () => void;
}

const ALL_THEME_CLASSES = [
  'theme-tech-blue',
  'theme-cyber-dark',
  'theme-cloud-professional',
  'theme-developer-dark',
  'theme-sales-blue',
  'theme-sales-orange',
  'theme-revenue-green',
  'theme-executive-sales',
  'theme-corporate-blue',
  'theme-modern-purple',
  'theme-minimal-white',
  'theme-ocean',
  'theme-emerald',
  'theme-sunset',
  'theme-premium-dark',
  'theme-default',
  'theme-purple',
  'theme-green',
  'theme-orange',
  'theme-pink',
  'theme-cyan',
];

// Normalize legacy theme names to new IDs
const normalizeTheme = (saved: string | null): ColorTheme => {
  if (!saved) return 'tech-blue';
  switch (saved) {
    case 'default':
      return 'tech-blue';
    case 'purple':
      return 'modern-purple';
    case 'green':
      return 'revenue-green';
    case 'orange':
      return 'sales-orange';
    case 'pink':
      return 'sunset';
    case 'cyan':
      return 'ocean';
    default:
      return saved as ColorTheme;
  }
};

const DARK_THEME_IDS: ColorTheme[] = [
  'cyber-dark',
  'developer-dark',
  'executive-sales',
  'premium-dark',
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem('staffly-selected-theme') || localStorage.getItem('userColorTheme');
    return normalizeTheme(saved);
  });

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as ThemeMode) || 'light';
  });

  // Handle combined theme mode and color theme updates
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all previous theme classes
    ALL_THEME_CLASSES.forEach((cls) => root.classList.remove(cls));
    root.classList.remove('light', 'dark');

    // Determine effective display mode (light / dark)
    let effectiveMode: 'light' | 'dark' = 'light';

    if (DARK_THEME_IDS.includes(colorTheme)) {
      effectiveMode = 'dark';
    } else if (themeMode === 'dark') {
      effectiveMode = 'dark';
    } else if (themeMode === 'system') {
      effectiveMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      effectiveMode = 'light';
    }

    // Apply classes and attributes
    root.classList.add(effectiveMode);
    root.classList.add(`theme-${colorTheme}`);
    root.setAttribute('data-theme', colorTheme);
    root.setAttribute('data-mode', effectiveMode);

    // Save to localStorage
    localStorage.setItem('themeMode', themeMode);
    localStorage.setItem('staffly-selected-theme', colorTheme);
    localStorage.setItem('userColorTheme', colorTheme);
  }, [themeMode, colorTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (themeMode === 'system' && !DARK_THEME_IDS.includes(colorTheme)) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const root = document.documentElement;
        const systemDark = mediaQuery.matches;
        root.classList.remove('light', 'dark');
        root.classList.add(systemDark ? 'dark' : 'light');
        root.setAttribute('data-mode', systemDark ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode, colorTheme]);

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme);
    // If selecting a naturally dark theme, align themeMode if currently light
    if (DARK_THEME_IDS.includes(theme)) {
      setThemeModeState('dark');
    }
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const resetToDefault = () => {
    setColorThemeState('tech-blue');
    setThemeModeState('light');
    localStorage.setItem('staffly-selected-theme', 'tech-blue');
    localStorage.setItem('userColorTheme', 'tech-blue');
    localStorage.setItem('themeMode', 'light');
  };

  return (
    <ThemeContext.Provider value={{ colorTheme, setColorTheme, themeMode, setThemeMode, resetToDefault }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
