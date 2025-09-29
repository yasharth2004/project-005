import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState, LoginCredentials } from '../types';
import { authAPI } from '../services/api';

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authAPI.login(credentials);
          const { user, token } = response.data.data;
          
          // Store token in localStorage
          localStorage.setItem('authToken', token);
          
          set({ 
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role
            }, 
            isAuthenticated: true, 
            isLoading: false 
          });
          
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Login failed', 
            isLoading: false 
          });
        }
      },

      logout: () => {
        // Clear token from localStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        set({ 
          user: null, 
          isAuthenticated: false, 
          error: null 
        });
        // Navigation to login will happen automatically
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);