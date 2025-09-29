import type { User } from '../types';

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 6;
};

export const formatUserName = (user: User): string => {
  return user.name || user.email.split('@')[0];
};

// Token management (if using JWT)
export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth-token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth-token', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('auth-token');
};