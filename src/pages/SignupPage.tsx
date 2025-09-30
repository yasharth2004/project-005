import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import type { SignupCredentials, WorkletValidationResponse } from '../types';
import './SignupPage.css';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'role' | 'details' | 'worklet'>('role');
  const [credentials, setCredentials] = useState<SignupCredentials>({
    name: '',
    email: '',
    password: '',
    role: 'student',
    workletId: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workletValidation, setWorkletValidation] = useState<WorkletValidationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingWorklet, setIsValidatingWorklet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);

  const handleRoleSelection = (role: 'admin' | 'student') => {
    setCredentials(prev => ({ ...prev, role }));
    setStep('details');
    setError(null);
    setSuccess(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setCredentials(prev => ({ ...prev, [name]: value }));
    }
    setError(null);
    setSuccess(null);
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password confirmation
    if (credentials.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (credentials.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    // If student, proceed to worklet validation
    if (credentials.role === 'student') {
      setStep('worklet');
    } else {
      // If admin, proceed directly to signup
      await handleSignup();
    }
  };

  const handleWorkletValidation = async () => {
    if (!credentials.workletId) {
      setError('Please enter your worklet ID');
      return;
    }

    setIsValidatingWorklet(true);
    setError(null);

    try {
      const response = await authAPI.verifyWorklet({
        workletId: credentials.workletId
      });

      if (response.data.valid) {
        setWorkletValidation(response.data);
      } else {
        setError(response.data.error || 'Invalid worklet ID');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to validate worklet ID');
    } finally {
      setIsValidatingWorklet(false);
    }
  };

  const handleSignup = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const signupData = { ...credentials };
      if (credentials.role !== 'student') {
        delete signupData.workletId;
      }

      const response = await authAPI.signup(signupData);
      
      if (response.data.success) {
        // Successfully created account - show success message
        setAccountCreated(true);
        setSuccess('Account created successfully! Redirecting to login...');
        
        // Wait 2 seconds to show success message, then redirect
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Account created successfully! Please log in.',
              email: credentials.email 
            } 
          });
        }, 2000);
      } else {
        setError('Account creation failed. Please try again.');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const renderRoleSelection = () => (
    <div className="signup-step">
      <div className="signup-header">
        <h2 className="signup-title">Choose Your Role</h2>
        <p className="signup-subtitle">Select how you'll be using Samsung PRISM</p>
      </div>

      <div className="role-selection">
        <button
          type="button"
          className="role-card student-role"
          onClick={() => handleRoleSelection('student')}
        >
          <div className="role-icon">🎓</div>
          <h3>Student</h3>
          <p>I'm working on a Samsung PRISM worklet and need help with my project</p>
        </button>

        <button
          type="button"
          className="role-card admin-role"
          onClick={() => handleRoleSelection('admin')}
        >
          <div className="role-icon">⚙️</div>
          <h3>Administrator</h3>
          <p>I manage content and oversee the Samsung PRISM platform</p>
        </button>
      </div>
    </div>
  );

  const renderDetailsForm = () => (
    <div className="signup-step">
      <div className="signup-header">
        <h2 className="signup-title">
          Create {credentials.role === 'student' ? 'Student' : 'Admin'} Account
        </h2>
        <p className="signup-subtitle">Enter your account details</p>
      </div>

      <form className="signup-form" onSubmit={handleDetailsSubmit}>
        {error && (
          <div className="signup-error">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="signup-success">
            <div className="success-content">
              <span className="success-icon">✅</span>
              {success}
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="name" className="form-label">Full Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="form-input"
            placeholder="Enter your full name"
            value={credentials.name}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="form-input"
            placeholder="Enter your email address"
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
            minLength={6}
            className="form-input"
            placeholder="Create a password (min 6 characters)"
            value={credentials.password}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            className="form-input"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={handleChange}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setStep('role')}
          >
            Back
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || accountCreated}
          >
            {accountCreated ? (
              <>
                <span className="success-icon">✅</span>
                Account Created Successfully!
              </>
            ) : isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Creating Account...
              </>
            ) : (
              credentials.role === 'student' ? 'Next: Verify Worklet' : 'Create Account'
            )}
          </button>
        </div>
      </form>
    </div>
  );

  const renderWorkletValidation = () => (
    <div className="signup-step">
      <div className="signup-header">
        <h2 className="signup-title">Verify Your Worklet</h2>
        <p className="signup-subtitle">Enter your Samsung PRISM worklet ID to personalize your experience</p>
      </div>

      <div className="worklet-validation">
        {error && (
          <div className="signup-error">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="signup-success">
            <div className="success-content">
              <span className="success-icon">✅</span>
              {success}
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="workletId" className="form-label">Worklet ID</label>
          <input
            id="workletId"
            name="workletId"
            type="text"
            required
            className="form-input"
            placeholder="Enter your worklet ID (e.g., 112, 025)"
            value={credentials.workletId}
            onChange={handleChange}
          />
          <p className="form-help">This helps us provide personalized responses about your specific worklet</p>
        </div>

        {!workletValidation && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleWorkletValidation}
            disabled={isValidatingWorklet || !credentials.workletId}
          >
            {isValidatingWorklet ? (
              <>
                <span className="loading-spinner"></span>
                Validating...
              </>
            ) : (
              'Verify Worklet'
            )}
          </button>
        )}

        {workletValidation && workletValidation.valid && (
          <div className="worklet-success">
            <div className="success-icon">✅</div>
            <h3>Worklet Verified!</h3>
            <div className="worklet-details">
              <p><strong>ID:</strong> {workletValidation.workletDetails?.id}</p>
              <p><strong>Title:</strong> {workletValidation.workletDetails?.title}</p>
              {workletValidation.workletDetails?.description && (
                <p><strong>Description:</strong> {workletValidation.workletDetails.description}</p>
              )}
              {workletValidation.workletDetails?.mentor && (
                <p><strong>Mentor:</strong> {workletValidation.workletDetails.mentor}</p>
              )}
            </div>
            
            <button
              type="button"
              className="btn-primary"
              onClick={handleSignup}
              disabled={isLoading || accountCreated}
            >
              {accountCreated ? (
                <>
                  <span className="success-icon">✅</span>
                  Account Created Successfully!
                </>
              ) : isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Creating Account...
                </>
              ) : (
                'Create Student Account'
              )}
            </button>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setStep('details');
              setWorkletValidation(null);
              setError(null);
              setSuccess(null);
              setAccountCreated(false);
            }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="signup-container">
      {/* Theme Toggle positioned in top-right */}
      <div className="signup-theme-toggle">
        <ThemeToggle />
      </div>
      
      <div className="signup-card">
        {/* Header with Logo */}
        <div className="signup-logo">
          <div className="signup-logo-icon">S</div>
          <div className="signup-logo-text">Samsung Prism AI ChatBot</div>
        </div>

        {/* Progress Indicator */}
        <div className="signup-progress">
          <div className={`progress-step ${step === 'role' ? 'active' : 'completed'}`}>
            <span className="step-number">1</span>
            <span className="step-label">Role</span>
          </div>
          <div className={`progress-step ${step === 'details' ? 'active' : step === 'worklet' ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Details</span>
          </div>
          {credentials.role === 'student' && (
            <div className={`progress-step ${step === 'worklet' ? 'active' : ''}`}>
              <span className="step-number">3</span>
              <span className="step-label">Worklet</span>
            </div>
          )}
        </div>

        {/* Step Content */}
        {step === 'role' && renderRoleSelection()}
        {step === 'details' && renderDetailsForm()}
        {step === 'worklet' && renderWorkletValidation()}

        {/* Login Link */}
        <div className="signup-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="signup-link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="page-footer">
        <p>&copy; 2025 Samsung Electronics. All rights reserved.</p>
      </div>
    </div>
  );
};