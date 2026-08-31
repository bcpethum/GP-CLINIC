'use client';

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';
import LoginPage from './components/LoginPage';
import AssistantTab from './components/AssistantTab';
import DoctorTab from './components/DoctorTab';
import PatientsTab from './components/PatientsTab';
import DrugsTab from './components/DrugsTab';
import DashboardTab from './components/DashboardTab';
import SettingsTab from './components/SettingsTab';
import SmsTab from './components/SmsTab';
import { MessageSquare, AlertCircle, HelpCircle, Loader } from 'lucide-react';
import { API_BASE } from './lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Inner app — only rendered when authenticated
// ─────────────────────────────────────────────────────────────────────────────
function AppContent() {
  const { user, loading, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState(null);
  const [lastError, setLastError] = useState(null);

  // Custom Modal States
  const [modal, setModal] = useState(null);

  const showAlert = (message, title = 'Attention') => {
    return new Promise((resolve) => {
      setModal({ type: 'alert', title, message, resolve });
    });
  };

  const showConfirm = (message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      setModal({ type: 'confirm', title, message, resolve });
    });
  };

  const handleModalClose = (confirmed) => {
    if (modal?.resolve) modal.resolve(confirmed);
    setModal(null);
  };

  // Global error hook
  useEffect(() => {
    const handleGlobalError = (event) => {
      setLastError(event.error ? event.error.message : event.message);
    };
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);

  // Listen for 401 events from API client
  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  // Set default active tab when user logs in
  useEffect(() => {
    if (!user) return;
    if (user.role === 'doctor') {
      setActiveTab('doctor');
    } else {
      // Assistant: pick first permitted tab
      const tabOrder = ['assistant', 'patients', 'dashboard', 'drugs', 'sms'];
      const firstAllowed = tabOrder.find(t => hasPermission(t));
      setActiveTab(firstAllowed || 'assistant');
    }
  }, [user]);

  // ── Show loading spinner while restoring session ──
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: 'var(--text-secondary)'
      }}>
        <Loader size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-secondary)' }} />
        <p style={{ fontSize: '0.9rem' }}>Restoring session...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Show login page when not authenticated ──
  if (!user) {
    return <LoginPage />;
  }

  // ── Permission guard for tab content ──
  const renderTabContent = () => {
    // Check tab permission for assistants
    const permissionKey = activeTab === 'settings' ? 'settings'
      : activeTab === 'sms' ? 'sms'
      : activeTab === 'doctor' ? 'doctor'
      : activeTab;

    if (user.role === 'assistant' && permissionKey && !hasPermission(permissionKey)) {
      return (
        <div className="glass-panel fade-in" style={{
          maxWidth: '500px',
          margin: '60px auto',
          textAlign: 'center',
          padding: '48px 40px'
        }}>
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            border: '1px solid rgba(239,68,68,0.2)'
          }}>
            <AlertCircle size={36} style={{ color: 'var(--color-danger)' }} />
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '10px', color: '#fff' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            You do not have permission to access this section.
            Please contact your doctor to enable access.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'doctor':
        return <DoctorTab API_BASE={API_BASE} showAlert={showAlert} showConfirm={showConfirm} />;
      case 'assistant':
        return <AssistantTab API_BASE={API_BASE} showAlert={showAlert} showConfirm={showConfirm} user={user} />;
      case 'patients':
        return <PatientsTab API_BASE={API_BASE} showAlert={showAlert} showConfirm={showConfirm} />;
      case 'drugs':
        return <DrugsTab API_BASE={API_BASE} showAlert={showAlert} showConfirm={showConfirm} />;
      case 'dashboard':
        return <DashboardTab API_BASE={API_BASE} showAlert={showAlert} showConfirm={showConfirm} />;
      case 'sms':
        return <SmsTab API_BASE={API_BASE} showAlert={showAlert} />;
      case 'settings':
        return <SettingsTab API_BASE={API_BASE} showAlert={showAlert} showConfirm={showConfirm} user={user} />;
      default:
        return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Select a tab to get started.</div>;
    }
  };

  return (
    <div className="app-shell">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="app-main">
        {activeTab ? renderTabContent() : null}
      </main>

      {/* Modal Dialog */}
      {modal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100000, padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            width: '100%', maxWidth: '360px', padding: '22px 24px',
            animation: 'scaleUp 0.18s ease forwards'
          }}>
            {/* Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                background: modal.type === 'confirm' ? '#fee2e2' : '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {modal.type === 'confirm'
                  ? <HelpCircle size={15} color="#dc2626" />
                  : <AlertCircle size={15} color="#2563eb" />}
              </div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#111827' }}>{modal.title}</h4>
            </div>
            {/* Message */}
            <p style={{ margin: '0 0 18px 40px', fontSize: '0.845rem', color: '#6b7280', lineHeight: '1.55' }}>
              {modal.message}
            </p>
            {/* Divider */}
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {modal.type === 'confirm' && (
                <button
                  onClick={() => handleModalClose(false)}
                  style={{
                    padding: '6px 16px', fontSize: '0.845rem', fontWeight: '500',
                    background: '#f9fafb', border: '1px solid #d1d5db',
                    borderRadius: '6px', color: '#374151', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => handleModalClose(true)}
                style={{
                  padding: '6px 18px', fontSize: '0.845rem', fontWeight: '600',
                  background: modal.type === 'confirm' ? '#dc2626' : '#2563eb',
                  border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer'
                }}
              >
                {modal.type === 'confirm' ? 'Delete' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Runtime Error Notification */}
      {lastError && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '20px',
          background: 'rgba(239, 68, 68, 0.95)', color: '#fff',
          padding: '16px 24px', borderRadius: '10px', zIndex: 99999,
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)', fontSize: '0.85rem',
          maxWidth: '450px', border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>⚠️ React Runtime Exception:</strong>
          <p style={{ margin: 0, opacity: 0.9, wordBreak: 'break-word', fontFamily: 'monospace' }}>{lastError}</p>
          <button onClick={() => setLastError(null)} style={{
            marginTop: '10px', background: '#fff', color: 'var(--color-danger)',
            border: 'none', padding: '4px 10px', borderRadius: '4px',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem'
          }}>Dismiss Alert</button>
        </div>
      )}


    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export — wraps everything with AuthProvider
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
