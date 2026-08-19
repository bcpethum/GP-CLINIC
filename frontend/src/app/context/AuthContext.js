'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'gp_clinic_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until we've checked localStorage

  /**
   * On app load: check if a token exists in localStorage.
   * If so, call GET /api/auth/me to validate it and restore user state.
   */
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          // Token invalid/expired — clear it
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        // Network error — clear token to be safe
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    };

    restore();
  }, []);

  /**
   * login(token, userData)
   * Called after a successful login API response.
   * Saves token to localStorage and sets user state.
   */
  const login = useCallback((token, userData) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
  }, []);

  /**
   * logout()
   * Clears token from localStorage and resets user state.
   * No server call needed — JWT is stateless.
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  /**
   * getToken()
   * Returns the current JWT token from localStorage.
   */
  const getToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  /**
   * hasPermission(permission)
   * Utility to check a named permission.
   * Doctors always return true. Assistants check their permissions object.
   */
  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.role === 'doctor') return true;
    if (!user.permissions) return false;
    return user.permissions[permission] === true;
  }, [user]);

  /**
   * refreshPermissions()
   * Re-fetches the current user from the server to get updated permissions.
   * Call this after the doctor modifies an assistant's permissions.
   */
  const refreshPermissions = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    getToken,
    hasPermission,
    refreshPermissions,
    isDoctor: user?.role === 'doctor',
    isAssistant: user?.role === 'assistant',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth()
 * Hook to access auth context from any component.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
