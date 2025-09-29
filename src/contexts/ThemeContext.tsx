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
    // Primary Samsung Blue (Samsung One UI Dark Mode with gradients)
    primary: 'linear-gradient(135deg, #1A73E8 0%, #2196F3 100%)',
    primaryHover: 'linear-gradient(135deg, #2196F3 0%, #42A5F5 100%)',
    primaryLight: 'linear-gradient(135deg, #42A5F5 0%, #64B5F6 100%)',
    
    // Background colors (Samsung One UI Dark - Much Darker with gradients)
    background: 'linear-gradient(135deg, #000000 0%, #0A0A0A 100%)',
    backgroundSecondary: 'linear-gradient(135deg, #0A0A0A 0%, #111111 100%)',
    backgroundTertiary: 'linear-gradient(135deg, #111111 0%, #1A1A1A 100%)',
    
    // Surface colors (Darker surfaces with subtle gradients)
    surface: 'linear-gradient(135deg, #0A0A0A 0%, #111111 100%)',
    surfaceElevated: 'linear-gradient(135deg, #111111 0%, #1A1A1A 100%)',
    
    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#BBBBBB',
    textTertiary: '#999999',
    textInverse: '#000000',
    
    // Border colors (Much darker)
    border: '#222222',
    borderLight: '#111111',
    borderHover: '#333333',
    
    // Status colors (Samsung One UI Dark variants)
    success: '#4ADB6A',
    error: '#FF6B6B',
    warning: '#FFB340',
    info: '#1A73E8',
    
    // Chat specific (Darker with gradients)
    chatBackground: 'linear-gradient(135deg, #000000 0%, #0A0A0A 100%)',
    userMessage: 'linear-gradient(135deg, #1A73E8 0%, #2196F3 100%)',
    assistantMessage: 'linear-gradient(135deg, #0A0A0A 0%, #111111 100%)',
    assistantMessageBorder: '#222222',
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