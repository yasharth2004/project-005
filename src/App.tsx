import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { ThemeProvider } from './contexts/ThemeContext';
import HomePage from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import AdminPage from './pages/AdminPage';

function App() {
  const { isAuthenticated, logout } = useAuthStore();

  // Handle unauthorized globally without full page reload
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('app:unauthorized' as any, handleUnauthorized);
    return () => window.removeEventListener('app:unauthorized' as any, handleUnauthorized);
  }, [logout]);

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
            } 
          />
          
          <Route 
            path="/signup" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />
            } 
          />
          
          {/* Protected route - Home */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected route - Admin */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Catch all route - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;