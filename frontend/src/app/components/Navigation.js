'use client';

import React, { useState } from 'react';
import { Bell, LogOut, ShieldCheck, User, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Logout Confirmation Modal
// ─────────────────────────────────────────────────────────────────────────────
function LogoutModal({ userName, isDoctor, onConfirm, onCancel }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.18s ease'
        }}
      />

      {/* Modal Card */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        background: '#ffffff',
        borderRadius: '20px',
        padding: '36px 32px 28px',
        width: '360px',
        maxWidth: '92vw',
        boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        animation: 'slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
        textAlign: 'center'
      }}>

        {/* Icon */}
        <div style={{
          width: '64px', height: '64px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '2px solid rgba(239, 68, 68, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <LogOut size={28} color="#ef4444" />
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '1.25rem', fontWeight: '700',
          color: '#0f172a', marginBottom: '8px'
        }}>
          Sign Out
        </h2>

        {/* Message */}
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '6px', lineHeight: 1.6 }}>
          You are signing out as
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: isDoctor ? 'rgba(0,100,200,0.07)' : 'rgba(124,58,237,0.07)',
          border: `1px solid ${isDoctor ? 'rgba(0,100,200,0.2)' : 'rgba(124,58,237,0.2)'}`,
          borderRadius: '50px',
          padding: '6px 16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: isDoctor
              ? 'linear-gradient(135deg, #0064c8, #00b4d8)'
              : 'linear-gradient(135deg, #7c3aed, #a855f7)',
            width: '24px', height: '24px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {isDoctor ? <ShieldCheck size={12} color="white" /> : <User size={12} color="white" />}
          </div>
          <span style={{
            fontSize: '0.9rem', fontWeight: '600',
            color: isDoctor ? '#0f172a' : '#4c1d95'
          }}>
            {userName}
          </span>
          <span style={{
            fontSize: '0.75rem',
            color: isDoctor ? '#0064c8' : '#7c3aed',
            fontWeight: '500'
          }}>
            {isDoctor ? 'Doctor' : 'Assistant'}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '11px 0',
              borderRadius: '12px',
              border: '1.5px solid rgba(0,0,0,0.12)',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '11px 0',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 12px rgba(239,68,68,0.35)'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(239,68,68,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.35)'; }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -44%); } to { opacity: 1; transform: translate(-50%, -50%); } }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Navigation({ activeTab, setActiveTab }) {
  const { user, logout, hasPermission, isDoctor } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const ALL_TABS = [
    { id: 'doctor',    name: 'Doctor',    permKey: 'doctor' },
    { id: 'assistant', name: 'Assistant', permKey: 'assistant' },
    { id: 'patients',  name: 'Patients',  permKey: 'patients' },
    { id: 'drugs',     name: 'Drugs',     permKey: 'drugs' },
    { id: 'dashboard', name: 'Dashboard', permKey: 'dashboard' },
    { id: 'sms',       name: 'SMS',       permKey: 'sms' },
    { id: 'settings',  name: 'Settings',  permKey: 'settings' },
  ];

  const visibleTabs = ALL_TABS.filter(tab => {
    if (isDoctor) return true;
    return hasPermission(tab.permKey);
  });

  const handleTabClick = (tabId) => setActiveTab(tabId);

  const displayName = isDoctor
    ? (user?.name && user.name.trim().toLowerCase().startsWith('dr') ? user.name : `Dr. ${user?.name}`)
    : user?.name;

  return (
    <>
      <nav style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        padding: '10px 24px',
        background: '#ffffff',
        borderBottom: '1px solid rgba(0, 100, 200, 0.12)',
        boxShadow: '0 2px 12px rgba(0, 80, 180, 0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        gap: '16px'
      }}>
        {/* Brand / Logo — Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '42px', height: '42px',
            borderRadius: '10px', overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,153,255,0.25)', flexShrink: 0
          }}>
            <img src="/Suwa sahana.jpg" alt="GP Clinic Logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: '700', fontSize: '1.2rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
            GP CLINIC
          </span>
        </div>

        {/* Tab Navigation Pills — Center */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'rgba(0, 100, 200, 0.05)',
            borderRadius: '50px', padding: '4px',
            border: '1px solid rgba(0, 100, 200, 0.15)',
            gap: '2px', overflowX: 'auto',
            scrollbarWidth: 'none', maxWidth: '100%'
          }}>
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  style={{
                    background: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? '#ffffff' : '#475569',
                    border: 'none', borderRadius: '50px',
                    padding: '8px 18px', fontSize: '0.95rem',
                    fontWeight: isActive ? '700' : '500',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap', flexShrink: 0,
                    boxShadow: isActive ? '0 2px 8px rgba(0,119,230,0.3)' : 'none'
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,100,200,0.1)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: User Info + Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
          {/* Notification Bell */}
          <div
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => alert('No new notifications')}
            title="Notifications"
          >
            <div style={{
              background: 'rgba(0, 100, 200, 0.07)',
              border: '1px solid rgba(0, 100, 200, 0.15)',
              padding: '9px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              <Bell size={17} />
            </div>
          </div>

          {/* User Badge */}
          {user && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(0, 100, 200, 0.06)',
              border: '1px solid rgba(0, 100, 200, 0.15)',
              borderRadius: '50px', padding: '5px 14px 5px 5px',
              whiteSpace: 'nowrap'
            }}>
              <div style={{
                background: isDoctor
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
                  : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                {isDoctor ? <ShieldCheck size={15} color="white" /> : <User size={15} color="white" />}
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', lineHeight: 1.2 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.75rem', color: isDoctor ? 'var(--color-primary)' : '#7c3aed', fontWeight: '600' }}>
                  {isDoctor ? 'Doctor' : 'Assistant'}
                </div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Sign Out"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444', padding: '9px',
              borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease', flexShrink: 0
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <LogOut size={17} />
          </button>
        </div>
      </nav>

      {/* Custom Logout Confirmation Modal */}
      {showLogoutModal && (
        <LogoutModal
          userName={displayName}
          isDoctor={isDoctor}
          onConfirm={() => { setShowLogoutModal(false); logout(); }}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </>
  );
}
