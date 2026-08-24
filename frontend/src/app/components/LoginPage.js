'use client';

import React, { useState } from 'react';
import { Stethoscope, User, Lock, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('doctor'); // 'doctor' | 'assistant'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Frontend validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError(mode === 'doctor' ? 'Please enter your password.' : 'Please enter your 4-digit passcode.');
      return;
    }
    if (mode === 'assistant' && !/^\d{4}$/.test(password)) {
      setError('Passcode must be exactly 4 numeric digits.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'doctor'
        ? `${API_BASE}/auth/doctor/login`
        : `${API_BASE}/auth/assistant/login`;

      const body = mode === 'doctor'
        ? { email: email.trim(), password }
        : { email: email.trim(), passcode: password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }

      // Never log credentials
      login(data.token, data.user);

    } catch {
      setError('Unable to connect to the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setPassword('');
    setError('');
    setShowPassword(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Decorative ambient blobs */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(0,153,255,0.12) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '10%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(0,210,255,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100px',
            height: '100px',
            borderRadius: '24px',
            marginBottom: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,153,255,0.35)'
          }}>
            <img
              src="/Suwa sahana.jpg"
              alt="GP Clinic Logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: '800',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '4px'
          }}>
            GP CLINIC RANNA
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Suwa Sahana Medical Centre
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel" style={{ padding: '32px' }}>

          {/* Role Tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '28px',
            border: '1px solid var(--glass-border)'
          }}>
            <button
              type="button"
              onClick={() => handleModeSwitch('doctor')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'doctor'
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
                  : 'transparent',
                color: mode === 'doctor' ? 'white' : 'var(--text-secondary)',
                fontWeight: mode === 'doctor' ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.25s ease',
                boxShadow: mode === 'doctor' ? '0 4px 12px rgba(0,153,255,0.3)' : 'none'
              }}
            >
              <ShieldCheck size={16} />
              Doctor
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('assistant')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'assistant'
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : 'transparent',
                color: mode === 'assistant' ? 'white' : 'var(--text-secondary)',
                fontWeight: mode === 'assistant' ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.25s ease',
                boxShadow: mode === 'assistant' ? '0 4px 12px rgba(124,58,237,0.3)' : 'none'
              }}
            >
              <User size={16} />
              Assistant
            </button>
          </div>

          {/* Role badge */}
          <div style={{
            textAlign: 'center',
            marginBottom: '20px',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
          }}>
            {mode === 'doctor'
              ? 'Sign in with your email and password'
              : 'Sign in with your email and 4-digit passcode'}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Email */}
            <div>
              <label className="label-glass">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-email"
                  type="email"
                  className="input-glass"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  autoComplete="email"
                  style={{ paddingLeft: '42px' }}
                  disabled={loading}
                />
                <User
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none'
                  }}
                />
              </div>
            </div>

            {/* Password / Passcode */}
            <div>
              <label className="label-glass">
                {mode === 'doctor' ? 'Password' : '4-Digit Passcode'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : (mode === 'assistant' ? 'password' : 'password')}
                  className="input-glass"
                  placeholder={mode === 'doctor' ? '••••••••' : '••••'}
                  value={password}
                  onChange={(e) => {
                    const val = mode === 'assistant'
                      ? e.target.value.replace(/\D/g, '').slice(0, 4) // digits only, max 4
                      : e.target.value;
                    setPassword(val);
                    setError('');
                  }}
                  maxLength={mode === 'assistant' ? 4 : undefined}
                  inputMode={mode === 'assistant' ? 'numeric' : 'text'}
                  autoComplete={mode === 'doctor' ? 'current-password' : 'off'}
                  style={{ paddingLeft: '42px', paddingRight: '42px', letterSpacing: mode === 'assistant' ? '0.4em' : 'normal' }}
                  disabled={loading}
                />
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px'
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mode === 'assistant' && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Enter the 4-digit passcode assigned by your doctor
                </div>
              )}
            </div>

            {/* Error display */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.85rem',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'fadeIn 0.2s ease'
              }}>
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{
                marginTop: '4px',
                padding: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                background: mode === 'doctor'
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
                  : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                boxShadow: mode === 'doctor'
                  ? '0 4px 20px rgba(0,153,255,0.3)'
                  : '0 4px 20px rgba(124,58,237,0.3)',
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In as {mode === 'doctor' ? 'Doctor' : 'Assistant'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)'
        }}>
          GP Clinic Systems • Secure Medical Management
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
