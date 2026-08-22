'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, Wallet, RefreshCw,
  Play, Square, ChevronLeft,
  Loader, BarChart2, Phone, ChevronDown,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

/* ─── Format Sri Lankan phone number (client-side validation only) ─── */
function formatLkNumber(num) {
  if (!num) return null;
  const clean = num.replace(/\D/g, '');
  if (clean.startsWith('94') && clean.length === 11) return `+${clean}`;
  if (clean.startsWith('0') && clean.length === 10) return `+94${clean.slice(1)}`;
  if (clean.length === 9) return `+94${clean}`;
  return null;
}

export default function SmsTab({ API_BASE, showAlert }) {

  /* ─── Account Status ─── */
  const [accountStatus, setAccountStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  /* ─── Next Visit Patients ─── */
  const [nextVisits, setNextVisits] = useState([]);
  const [nvLoading, setNvLoading] = useState(false);
  const [nvFilter, setNvFilter] = useState('today');

  /* ─── Recipient selector ─── */
  const [recipientMode, setRecipientMode] = useState('All'); // 'All' | 'Individual'
  const [individualNumber, setIndividualNumber] = useState('');
  const [activeLastMonths, setActiveLastMonths] = useState(null);

  /* ─── Message ─── */
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0 });

  /* ── Check account status via backend proxy ── */
  const checkAccountStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await apiFetch('/sms/status', { method: 'POST' });
      setAccountStatus(res);
    } catch (e) {
      setAccountStatus({ success: false, message: e.message });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { checkAccountStatus(); }, []);

  /* ── Load next visit patients ── */
  const loadNextVisits = useCallback(async () => {
    setNvLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      let endpoint = '/patients/next-visits';
      if (nvFilter === 'today') endpoint += `?date=${today}`;
      else if (nvFilter === 'tomorrow') endpoint += `?date=${tomorrow}`;
      const res = await apiFetch(endpoint);
      setNextVisits(Array.isArray(res) ? res : (res.visits || res.data || []));
    } catch (e) {
      setNextVisits([]);
    } finally {
      setNvLoading(false);
    }
  }, [nvFilter]);

  useEffect(() => { loadNextVisits(); }, [nvFilter]);

  /* ── Build recipient list ── */
  const buildRecipients = () => {
    let list = nextVisits.filter(v => v.phone_number || v.contact_number || v.tel_no);
    if (activeLastMonths) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - activeLastMonths);
      list = list.filter(v => {
        const d = new Date(v.visit_date || v.next_visit_date || '');
        return d >= cutoff;
      });
    }
    return list;
  };

  const recipients = buildRecipients();
  const totalCount = recipients.length;

  /* ── Save credentials to backend (stored in DB, never localStorage) ── */
  const handleSaveCreds = async () => {
    if (!editCreds.user_id || !editCreds.api_key) {
      showAlert('User ID and API Key are required.', 'Missing Fields');
      return;
    }
    setSavingCreds(true);
    try {
      await apiFetch('/sms/credentials', {
        method: 'POST',
        body: JSON.stringify(editCreds),
      });
      await loadCredStatus();
      await checkAccountStatus();
      setShowCredsModal(false);
      setEditCreds(p => ({ ...p, api_key: '' })); // clear API key from memory
    } catch (e) {
      showAlert(`Failed to save: ${e.message}`, 'Error');
    } finally {
      setSavingCreds(false);
    }
  };

  /* ── Remove credentials (revert to .env defaults) ── */
  const handleRemoveCreds = async () => {
    try {
      await apiFetch('/sms/credentials', { method: 'DELETE' });
      await loadCredStatus();
      setAccountStatus(null);
      setShowCredsModal(false);
    } catch (e) {
      showAlert(`Failed to remove: ${e.message}`, 'Error');
    }
  };

  /* ── Handle Send / Bulk Send (all calls go through backend proxy) ── */
  const handleSend = async () => {
    if (!message.trim()) { showAlert('Please enter a message.', 'Empty Message'); return; }

    setSending(true);
    setIsSending(true);
    setSendResult(null);

    try {
      if (recipientMode === 'Individual') {
        if (!individualNumber.trim()) {
          showAlert('Please enter a phone number.', 'No Number');
          setSending(false); setIsSending(false);
          return;
        }
        const formatted = formatLkNumber(individualNumber.trim());
        if (!formatted) {
          showAlert('Invalid phone number. Use format: 07XXXXXXXX or +947XXXXXXXX', 'Invalid Number');
          setSending(false); setIsSending(false);
          return;
        }
        setSendProgress({ done: 0, total: 1 });
        const res = await apiFetch('/sms/send', {
          method: 'POST',
          body: JSON.stringify({ contact: formatted, message }),
        });
        setSendResult({ success: res.success, count: res.success ? 1 : 0, balance: res.data?.sms_credit_balance, error: res.message });
        setSendProgress({ done: 1, total: 1 });

      } else {
        const phones = recipients.map(v => v.phone_number || v.contact_number || v.tel_no).filter(Boolean);
        if (phones.length === 0) {
          showAlert('No recipients with phone numbers in the current list.', 'No Recipients');
          setSending(false); setIsSending(false);
          return;
        }
        const formatted = phones.map(formatLkNumber).filter(Boolean);
        setSendProgress({ done: 0, total: formatted.length });

        if (formatted.length === 1) {
          const res = await apiFetch('/sms/send', {
            method: 'POST',
            body: JSON.stringify({ contact: formatted[0], message }),
          });
          setSendResult({ success: res.success, count: res.success ? 1 : 0, error: res.message });
          setSendProgress({ done: 1, total: 1 });
        } else {
          const res = await apiFetch('/sms/send-bulk', {
            method: 'POST',
            body: JSON.stringify({ contacts: formatted, message }),
          });
          setSendResult({ success: res.success, count: res.data?.no_of_recipients || 0, balance: res.data?.sms_credit_balance, error: res.message });
          setSendProgress({ done: formatted.length, total: formatted.length });
        }
      }
      await checkAccountStatus();
    } catch (e) {
      setSendResult({ success: false, error: e.message });
    } finally {
      setSending(false);
      setIsSending(false);
    }
  };

  const handleStop = () => { setIsSending(false); setSending(false); };

  /* ─── Credential source badge ─── */
  const CredBadge = () => {
    if (credLoading) return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Checking...</span>;
    if (credStatus?.source === 'database') return <span style={{ fontSize: '0.72rem', background: 'rgba(22,163,74,0.15)', color: '#16a34a', borderRadius: '10px', padding: '2px 8px', fontWeight: 600 }}>Per-doctor ✓</span>;
    if (credStatus?.source === 'env') return <span style={{ fontSize: '0.72rem', background: 'rgba(245,158,11,0.15)', color: '#d97706', borderRadius: '10px', padding: '2px 8px', fontWeight: 600 }}>System default</span>;
    return <span style={{ fontSize: '0.72rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: '10px', padding: '2px 8px', fontWeight: 600 }}>Not configured</span>;
  };

  /* ─── Render ─── */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '0', minHeight: 'calc(100vh - 70px)', background: 'var(--bg-primary)' }}>
      <style>{`
        .sms-inp { width:100%; background:var(--bg-secondary); border:1px solid var(--glass-border); border-radius:8px; padding:8px 12px; color:var(--text-primary); font-family:inherit; font-size:0.88rem; outline:none; box-sizing:border-box; }
        .sms-inp:focus { border-color:var(--color-secondary); }
        .sms-btn { border:none; border-radius:8px; padding:9px 18px; font-weight:700; font-size:0.88rem; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; gap:6px; }
        .sms-btn-cyan { background:var(--color-secondary); color:#fff; }
        .sms-btn-cyan:hover { opacity:0.88; transform:translateY(-1px); }
        .sms-btn-outline { background:transparent; border:1.5px solid var(--color-secondary); color:var(--color-secondary); }
        .sms-btn-outline:hover { background:var(--accent-blue-bg); }
        .sms-btn-red { background:#ef4444; color:#fff; }
        .sms-btn-red:hover { background:#dc2626; }
        .sms-filter-btn { border:1.5px solid var(--glass-border); border-radius:8px; padding:7px 14px; font-size:0.82rem; font-weight:600; background:transparent; color:var(--text-secondary); cursor:pointer; transition:all 0.15s; }
        .sms-filter-btn.active { background:var(--color-secondary); border-color:var(--color-secondary); color:#fff; }
        .sms-filter-btn:hover:not(.active) { border-color:var(--color-secondary); color:var(--color-secondary); }
        .sms-table th { font-size:0.8rem; color:var(--text-muted); font-weight:600; padding:10px 12px; border-bottom:1px solid var(--glass-border); text-align:left; }
        .sms-table td { font-size:0.86rem; color:var(--text-primary); padding:9px 12px; border-bottom:1px solid var(--glass-border); }
        .sms-table tr:hover td { background:var(--accent-blue-bg); }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ══ LEFT PANEL ══ */}
      <div style={{
        borderRight: '1px solid var(--glass-border)',
        padding: '22px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
        background: 'var(--bg-secondary)',
      }}>

        {/* Account Status Card */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '14px',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>
            Account Status
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Balance</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {accountStatus?.data?.sms_credit_balance ?? '—'}
              </div>
            </div>
            <div style={{ background: '#16a34a', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#bbf7d0', marginBottom: '2px' }}>Success</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                {sendResult?.success ? sendProgress.done : 0}
              </div>
            </div>
            <div style={{ background: '#ef4444', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#fecaca', marginBottom: '2px' }}>Fails</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                {sendResult && !sendResult.success ? 1 : 0}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <button className="sms-btn sms-btn-outline" style={{ padding: '7px 8px', fontSize: '0.78rem' }} onClick={checkAccountStatus} disabled={statusLoading}>
              {statusLoading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
              Check
            </button>
            <button className="sms-btn" style={{ padding: '7px 8px', fontSize: '0.78rem', background: '#7c3aed', color: '#fff' }}>
              <BarChart2 size={13} /> Report
            </button>
            <button className="sms-btn sms-btn-cyan" style={{ padding: '7px 8px', fontSize: '0.78rem' }}>
              <Wallet size={13} /> Top Up
            </button>
          </div>
        </div>

        {/* Recipient Selector */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Recipient</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Eg: 772047332</div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', width: '130px', flexShrink: 0 }}>
              <select
                value={recipientMode}
                onChange={e => setRecipientMode(e.target.value)}
                className="sms-inp"
                style={{ appearance: 'none', paddingRight: '28px', cursor: 'pointer' }}
              >
                <option value="All">All</option>
                <option value="Individual">Individual</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-secondary)', pointerEvents: 'none' }} />
            </div>

            {recipientMode === 'Individual' ? (
              <input
                type="tel"
                className="sms-inp"
                placeholder="Enter Number.."
                value={individualNumber}
                onChange={e => setIndividualNumber(e.target.value)}
                style={{ flex: 1 }}
              />
            ) : (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                Total Count : <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong>
              </span>
            )}
          </div>

          {recipientMode === 'All' && (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '7px' }}>Active in Last:</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[['1 Month', 1], ['3 Month', 3], ['All', null]].map(([lbl, val]) => (
                  <button
                    key={lbl}
                    className={`sms-filter-btn${activeLastMonths === val ? ' active' : ''}`}
                    onClick={() => setActiveLastMonths(val)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recipientMode === 'All' && (
            <p style={{ fontSize: '0.78rem', color: '#ef4444', margin: 0, lineHeight: 1.4 }}>
              Please do not use the system while sending bulk messages
            </p>
          )}
        </div>

        {/* Message Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Message</div>
          <textarea
            className="sms-inp"
            rows={7}
            placeholder={"Enter Your Message here....\n\n(Please make sure to remove the #, &, +, and ; characters from the SMS)"}
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={1500}
            style={{ resize: 'vertical', flex: 1, minHeight: '130px', fontStyle: !message ? 'italic' : 'normal' }}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ background: '#475569', color: '#fff', borderRadius: '12px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
              Chars: {message.length}
            </span>
            <span style={{ background: '#16a34a', color: '#fff', borderRadius: '12px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
              Pages: {Math.ceil(message.length / 160) || 0}/{Math.ceil(1500 / 160)}
            </span>
          </div>
        </div>

        {/* Send Result */}
        {sendResult && (
          <div style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: sendResult.success ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${sendResult.success ? '#16a34a' : '#ef4444'}`,
            fontSize: '0.82rem',
            color: sendResult.success ? '#16a34a' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {sendResult.success ? <CheckCircle size={15} /> : <XCircle size={15} />}
            {sendResult.success
              ? `Sent to ${sendResult.count} recipient${sendResult.count !== 1 ? 's' : ''}${sendResult.balance ? ` · Balance: ${sendResult.balance}` : ''}`
              : sendResult.error || 'Failed to send'}
          </div>
        )}

        {/* Progress bar */}
        {isSending && sendProgress.total > 0 && (
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              Sending {sendProgress.done}/{sendProgress.total}...
            </div>
            <div style={{ height: '6px', background: 'var(--glass-border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(sendProgress.done / sendProgress.total) * 100}%`,
                background: 'var(--color-secondary)',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="sms-btn sms-btn-cyan"
              style={{ flex: 1, justifyContent: 'center', padding: '11px' }}
              onClick={handleSend}
              disabled={sending}
            >
              {sending
                ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                : <><Play size={15} fill="white" /> Send</>
              }
            </button>
            <button className="sms-btn sms-btn-red" style={{ padding: '11px 14px' }} onClick={handleStop} title="Stop">
              <Square size={15} fill="white" />
            </button>
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL — Next Visits Table ══ */}
      <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Next Visit</div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="sms-btn sms-btn-cyan" style={{ padding: '7px 10px' }}><ChevronLeft size={15} /></button>
            <button className="sms-btn sms-btn-red" style={{ padding: '7px 10px' }}><Square size={13} fill="white" /></button>
            {[
              { label: 'Previous', icon: <ChevronLeft size={14} />, val: 'previous' },
              { label: 'Today', val: 'today' },
              { label: 'Tomorrow', val: 'tomorrow' },
              { label: 'View All', val: 'all' },
            ].map(btn => (
              <button
                key={btn.val}
                className={`sms-filter-btn${nvFilter === btn.val ? ' active' : ''}`}
                onClick={() => setNvFilter(btn.val)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {btn.icon}{btn.label}
              </button>
            ))}
            <button className="sms-btn sms-btn-outline" style={{ padding: '7px 10px' }} onClick={loadNextVisits} title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table className="sms-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)' }}>
                <th>Name</th>
                <th>Next Date</th>
                <th>Visit Plan</th>
                <th>Tel No</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {nvLoading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                  <Loader size={22} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
                  Loading...
                </td></tr>
              ) : nextVisits.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <XCircle size={22} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  Next Visits Not Found
                </td></tr>
              ) : (
                nextVisits.map((v, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{v.patient_name || v.name || '—'}</td>
                    <td>{v.next_visit_date || v.next_date || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.visit_plan || v.plan_of_action || '—'}
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Phone size={13} style={{ color: 'var(--color-secondary)' }} />
                        {v.phone_number || v.contact_number || v.tel_no || '—'}
                      </span>
                    </td>
                    <td>{v.age_years != null ? `${v.age_years}Y` : (v.age || '—')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
