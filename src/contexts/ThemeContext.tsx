import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Samsung Design System Colors
export const samsungTheme = {
  light: {
    // Primary Samsung Blue
    primary: '#1428A0',
    primaryHover: '#0D1B7A',
    primaryLight: '#2d40b3',
    
    // Background colors
    background: '#FFFFFF',
    backgroundSecondary: '#F8F9FA',
    backgroundTertiary: '#F1F3F4',
    
    // Surface colors
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    
    // Text colors
    textPrimary: '#1C1C1E',
    textSecondary: '#636366',
    textTertiary: '#8E8E93',
    textInverse: '#FFFFFF',
    
    // Border colors
    border: '#E1E5E9',
    borderLight: '#F1F3F4',
    borderHover: '#D1D5DB',
    
    // Status colors
    success: '#30D158',
    error: '#FF3B30',
    warning: '#FF9500',
    info: '#007AFF',
    
    // Chat specific
    chatBackground: '#FFFFFF',
    userMessage: '#1428A0',
    assistantMessage: '#FFFFFF',
    assistantMessageBorder: '#E1E5E9',
  },
  dark: {
    // Primary Samsung Blue (adjusted for dark mode)
    primary: '#4A90E2',
    primaryHover: '#5BA0F2',
    primaryLight: '#6BB0FF',
    
    // Background colors (Samsung One UI Dark)
    background: '#000000',
    backgroundSecondary: '#0D0D0D',
    backgroundTertiary: '#1A1A1A',
    
    // Surface colors
    surface: '#1A1A1A',
    surfaceElevated: '#2A2A2A',
    
    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textTertiary: '#8E8E93',
    textInverse: '#000000',
    
    // Border colors
    border: '#2A2A2A',
    borderLight: '#1A1A1A',
    borderHover: '#3A3A3A',
    
    // Status colors (Samsung One UI Dark variants)
    success: '#4ADB6A',
    error: '#FF6B6B',
    warning: '#FFB340',
    info: '#4A90E2',
    
    // Chat specific
    chatBackground: '#000000',
    userMessage: '#4A90E2',
    assistantMessage: '#1A1A1A',
    assistantMessageBorder: '#2A2A2A',
  }
};

type Theme = typeof samsungTheme.light;
type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem('samsung-prism-theme');
    return (savedTheme as ThemeMode) || 'light';
  });

  const theme = samsungTheme[mode];

  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  // Save theme preference and apply CSS variables
  useEffect(() => {
    localStorage.setItem('samsung-prism-theme', mode);
    
    // Apply theme as CSS custom properties
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
    });
    
    // Add/remove dark mode class
    document.documentElement.classList.toggle('dark-mode', mode === 'dark');
  }, [mode, theme]);

  const value: ThemeContextType = {
    theme,
    mode,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;