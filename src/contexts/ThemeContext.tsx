import React, { createContext, useContext, useState, useEffect } from 'react';

export type ColorTheme = 'default' | 'purple' | 'green' | 'orange' | 'pink' | 'cyan';
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem('userColorTheme');
    return (saved as ColorTheme) || 'default';
  });

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as ThemeMode) || 'light';
  });

  // Handle theme mode (light/dark)
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme mode classes
    root.classList.remove('light', 'dark');
    
    // Determine which theme to apply
    let effectiveTheme: 'light' | 'dark' = 'light';
    
    if (themeMode === 'system') {
      // Use system preference
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      effectiveTheme = themeMode;
    }
    
    // Apply theme
    root.classList.add(effectiveTheme);
    
    // Save to localStorage
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Handle color theme
  useEffect(() => {
    // Remove all theme classes
    document.documentElement.classList.remove(
      'theme-default',
      'theme-purple',
      'theme-green',
      'theme-orange',
      'theme-pink',
      'theme-cyan'
    );
    
    // Add current theme class
    document.documentElement.classList.add(`theme-${colorTheme}`);
    
    // Save to localStorage
    localStorage.setItem('userColorTheme', colorTheme);
  }, [colorTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme);
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ colorTheme, setColorTheme, themeMode, setThemeMode }}>
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
