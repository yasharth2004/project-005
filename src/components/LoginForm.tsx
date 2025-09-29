import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import type { LoginCredentials } from '../types';
import './LoginForm.css';

export const LoginForm: React.FC = () => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });

  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(credentials);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    if (error) clearError();
  };

  return (
    <div className="login-container">
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
          </div>
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