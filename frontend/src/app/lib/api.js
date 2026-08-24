/**
 * Centralized API client for GP Clinic frontend.
 *
 * Automatically attaches:
 *   - Authorization: Bearer <JWT> header from localStorage
 *   - Content-Type: application/json for non-FormData requests
 *
 * Handles:
 *   - 401 Unauthorized → clears token and triggers re-login
 *   - Error responses → throws with readable error message
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'gp_clinic_token';

/**
 * apiFetch(path, options?)
 *
 * @param {string} path - API path relative to API_BASE, e.g. '/patients'
 * @param {RequestInit} options - fetch options (method, body, etc.)
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - With a user-readable message on failure
 *
 * Usage:
 *   const patients = await apiFetch('/patients');
 *   const result = await apiFetch('/patients', { method: 'POST', body: JSON.stringify(data) });
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = { ...options.headers };

  // Attach auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Auto-set Content-Type for JSON (but not for FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  // Handle 401 — token expired or invalid
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    // Dispatch a custom event so AuthContext or page.js can react
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    const data = await response.json().catch(() => ({}));
    throw new AuthError(data.error || 'Session expired. Please log in again.', 401);
  }

  // Handle 403 Forbidden
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    throw new AuthError(data.error || 'You do not have permission to perform this action.', 403);
  }

  // Handle other HTTP errors
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  // Parse JSON response (handle empty body)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

/**
 * Custom error class for auth-related failures (401, 403)
 */
export class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Convenience helpers for common HTTP methods
 */
export const api = {
  get: (path) => apiFetch(path),
  post: (path, data) => apiFetch(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => apiFetch(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
  upload: (path, formData) => apiFetch(path, { method: 'POST', body: formData }),
};

export default apiFetch;
