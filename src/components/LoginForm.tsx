import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from './ThemeToggle';
import type { LoginCredentials } from '../types';
import './LoginForm.css';

export const LoginForm: React.FC = () => {
  const location = useLocation();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { login, isLoading, error, clearError } = useAuthStore();

  useEffect(() => {
    // Check for success message from signup
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Pre-fill email if provided
      if (location.state.email) {
        setCredentials(prev => ({ ...prev, email: location.state.email }));
      }
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(credentials);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    if (error) clearError();
    if (successMessage) setSuccessMessage(null);
  };

  return (
    <div className="login-container">
      {/* Theme Toggle positioned in top-right */}
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>
      
      <div className="login-card">
        {/* Header with Logo */}
        <div className="login-header">
          <div className="login-logo">
            <div className="login-logo-icon">S</div>
            <div className="login-logo-text">Samsung Prism AI ChatBot</div>
          </div>
          <h2 className="login-title">Sign in to your account</h2>
          <p className="login-subtitle">Welcome back! Please enter your credentials</p>
        </div>

        {/* Login Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          {successMessage && (
            <div className="login-success">
              <div className="success-content">
                <span className="success-icon">✅</span>
                {successMessage}
              </div>
            </div>
          )}
          
          {error && (
            <div className="login-error">
              <div className="error-content">
                <span className="error-icon">⚠</span>
                {error}
              </div>
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="form-input"
              placeholder="Enter your email"
              value={credentials.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="form-input"
              placeholder="Enter your password"
              value={credentials.password}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="login-button"
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="demo-credentials">
          <p className="demo-title">Demo Credentials:</p>
          <div className="demo-list">
            <span>admin@prism.com / admin123 (Admin)</span>
            <span>user@test.com / password123 (User)</span>
            <span>student@prism.com / student123 (Student - Worklet 025)</span>
            <span>student75@prism.com / student123 (Student - Worklet 075)</span>
          </div>
        </div>

        {/* Signup Link */}
        <div className="signup-section">
          <p className="signup-text">
            Don't have an account?{' '}
            <a href="/signup" className="signup-link">
              Create one here
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="login-footer">
        <p>&copy; 2025 Samsung Electronics. All rights reserved.</p>
        <div className="footer-tech">
          
        </div>
      </div>
    </div>
  );
};