import React, { useState } from 'react';
import { Brain, User, LogOut, ChevronDown, Settings, Home } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import './AppLayout.css';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">
              <Brain size={18} />
            </div>
            <div className="logo-text">Samsung PRISM</div>
          </div>
          
          {/* Navigation */}
          <nav className="main-nav">
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
              <Home size={16} />
              <span>Chat</span>
            </Link>
            {isAdmin && (
              <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>
                <Settings size={16} />
                <span>Admin</span>
              </Link>
            )}
          </nav>
        </div>
        
        {/* Right side controls */}
        <div className="header-right">
          <ThemeToggle />
          
          {/* User Menu */}
          <div className="user-menu-container">
            <button 
              className="user-menu-button"
              onClick={toggleUserMenu}
              aria-label="User menu"
            >
              <div className="user-avatar">
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
              <span className="user-name">{user?.name || user?.email}</span>
              <ChevronDown size={16} className={`chevron ${showUserMenu ? 'rotated' : ''}`} />
            </button>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-info">
                  <User size={16} />
                  <div>
                    <div className="user-info-name">{user?.name || user?.email}</div>
                    <div className="user-info-email">{user?.email}</div>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button 
                  className="logout-button"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="app-main">
        {children}
      </main>
      
      <footer className="app-footer">
        <div className="footer-content">
          <p>© {new Date().getFullYear()} Samsung PRISM. All rights reserved.</p>
          <div className="footer-tech">
            <Brain size={16} />
            <span>Powered by RAG Technology</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;