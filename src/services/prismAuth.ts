import axios, { AxiosResponse } from 'axios';
import { PrismAuthCredentials, PrismAuthResponse, PrismSession } from '../types';

const PRISM_BASE_URL = 'https://www.srib.in/prismApp';
const SESSION_STORAGE_KEY = 'prism_session';

class PrismAuthService {
  private session: PrismSession | null = null;

  constructor() {
    this.loadSessionFromStorage();
  }

  // Load session from localStorage
  private loadSessionFromStorage(): void {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        // Check if session is still valid
        if (new Date(session.expiresAt) > new Date()) {
          this.session = {
            ...session,
            expiresAt: new Date(session.expiresAt)
          };
        } else {
          this.clearSession();
        }
      }
    } catch (error) {
      console.error('Error loading session from storage:', error);
      this.clearSession();
    }
  }

  // Save session to localStorage
  private saveSessionToStorage(session: PrismSession): void {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session to storage:', error);
    }
  }

  // Clear session from memory and storage
  private clearSession(): void {
    this.session = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  // Authenticate with PRISM credentials
  async login(credentials: PrismAuthCredentials): Promise<PrismAuthResponse> {
    try {
      console.log('🔐 Attempting PRISM authentication...');
      
      // First, try to get the login page to establish session
      const loginPageResponse = await axios.get(`${PRISM_BASE_URL}/login`, {
        withCredentials: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      // Extract cookies from the login page response
      const setCookieHeaders = loginPageResponse.headers['set-cookie'] || [];
      const cookies = setCookieHeaders.map(cookie => cookie.split(';')[0]);

      // Prepare login data
      const loginData = new URLSearchParams({
        username: credentials.username,
        password: credentials.password,
        // Add any additional fields that might be required
        remember: 'false'
      });

      // Attempt login with credentials
      const loginResponse = await axios.post(
        `${PRISM_BASE_URL}/api/auth/login`,
        loginData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies.join('; '),
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': `${PRISM_BASE_URL}/login`
          }
        }
      );

      // Check if login was successful
      if (loginResponse.status === 200) {
        // Extract session information
        const authCookies = loginResponse.headers['set-cookie'] || setCookieHeaders;
        const sessionCookies = authCookies.map(cookie => cookie.split(';')[0]);
        
        // Extract user information from response
        const userInfo = this.extractUserInfo(loginResponse.data);
        
        if (userInfo && userInfo.uid) {
          // Create session object
          const session: PrismSession = {
            token: this.extractSessionToken(sessionCookies),
            cookies: sessionCookies,
            uid: userInfo.uid,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            userInfo: {
              name: userInfo.name,
              email: userInfo.email
            }
          };

          this.session = session;
          this.saveSessionToStorage(session);

          console.log('✅ PRISM authentication successful');
          return {
            success: true,
            sessionToken: session.token,
            cookies: session.cookies,
            userInfo: userInfo
          };
        }
      }

      throw new Error('Invalid response from PRISM server');
    } catch (error) {
      console.error('❌ PRISM authentication failed:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            error: 'Invalid username or password'
          };
        } else if (error.response?.status === 403) {
          return {
            success: false,
            error: 'Access denied. Please check your PRISM account permissions.'
          };
        } else if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
          return {
            success: false,
            error: 'Unable to connect to PRISM server. Please check your internet connection.'
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  // Extract user information from login response
  private extractUserInfo(responseData: any): { uid: string; name: string; email: string } | null {
    try {
      // Handle different response formats
      if (responseData && typeof responseData === 'object') {
        // If response contains user data directly
        if (responseData.uid || responseData.userId) {
          return {
            uid: responseData.uid || responseData.userId,
            name: responseData.name || responseData.fullName || 'PRISM User',
            email: responseData.email || responseData.emailAddress || ''
          };
        }
        
        // If response contains nested user data
        if (responseData.user) {
          return {
            uid: responseData.user.uid || responseData.user.userId,
            name: responseData.user.name || responseData.user.fullName || 'PRISM User',
            email: responseData.user.email || responseData.user.emailAddress || ''
          };
        }
      }
      
      // If we can't extract user info, return null
      return null;
    } catch (error) {
      console.error('Error extracting user info:', error);
      return null;
    }
  }

  // Extract session token from cookies
  private extractSessionToken(cookies: string[]): string {
    for (const cookie of cookies) {
      if (cookie.includes('JSESSIONID') || cookie.includes('sessionToken') || cookie.includes('authToken')) {
        return cookie.split('=')[1] || cookie;
      }
    }
    return cookies[0] || '';
  }

  // Get current session
  getSession(): PrismSession | null {
    if (this.session && new Date(this.session.expiresAt) > new Date()) {
      return this.session;
    }
    this.clearSession();
    return null;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  // Get authenticated headers for API calls
  getAuthHeaders(): Record<string, string> {
    const session = this.getSession();
    if (!session) {
      throw new Error('No valid session found. Please login first.');
    }

    return {
      'Cookie': session.cookies.join('; '),
      'Authorization': `Bearer ${session.token}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.5',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${PRISM_BASE_URL}/dashboard`
    };
  }

  // Logout and clear session
  async logout(): Promise<void> {
    try {
      const session = this.getSession();
      if (session) {
        // Attempt to logout from server
        await axios.post(
          `${PRISM_BASE_URL}/api/auth/logout`,
          {},
          {
            headers: this.getAuthHeaders(),
            withCredentials: true
          }
        );
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      this.clearSession();
    }
  }

  // Get current user UID
  getCurrentUID(): string | null {
    const session = this.getSession();
    return session?.uid || null;
  }

  // Get current user info
  getCurrentUserInfo(): { name: string; email: string } | null {
    const session = this.getSession();
    return session?.userInfo || null;
  }
}

// Export singleton instance
export const prismAuthService = new PrismAuthService();
export default prismAuthService;