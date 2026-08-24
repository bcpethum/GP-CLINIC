'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle, XCircle, RefreshCw,
  Play, Square, ChevronLeft,
  Loader, Phone, ChevronDown,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

/* ─── Format Sri Lankan phone number ─── */
function formatLkNumber(num) {
  if (!num) return null;
  const clean = num.replace(/\D/g, '');
  if (clean.startsWith('94') && clean.length === 11) return `+${clean}`;
  if (clean.startsWith('0') && clean.length === 10) return `+94${clean.slice(1)}`;
  if (clean.length === 9) return `+94${clean}`;
  return null;
}

/* ─── Toast ─── */
function Toast({ toasts, removeToast }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: t.type === 'success' ? '#16a34a' : '#ef4444',
          color: '#fff', padding: '12px 18px', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          fontSize: '0.88rem', fontWeight: 600,
          minWidth: '280px', maxWidth: '380px',
          animation: 'smsSlideIn 0.3s ease', pointerEvents: 'auto',
        }}>
          {t.type === 'success' ? <CheckCircle size={18} style={{ flexShrink: 0 }} /> : <XCircle size={18} style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => removeToast(t.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, opacity: 0.7 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function SmsTab({ API_BASE, showAlert }) {

  /* ── Toast ── */
  const [toasts, setToasts] = useState([]);
  const toastRef = useRef(0);
  const addToast = useCallback((msg, type = 'success') => {
    const id = ++toastRef.current;
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);
  const removeToast = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);

  /* ── Account Status ── */
  const [accountStatus, setAccountStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  /* ── Source selector: which mode drives the table ──
     mode = 'next-visit' | 'active'
     When 'next-visit': nvFilter (today/tomorrow/previous/all) drives the table
     When 'active':     activeMonths (1/3/'all') drives the table             */
  const [mode, setMode] = useState('next-visit');  // 'next-visit' | 'active'
  const [nvFilter, setNvFilter] = useState('today');  // today | tomorrow | previous | all
  const [activeMonths, setActiveMonths] = useState(1);  // 1 | 3 | 'all'

  /* ── Table data ── */
  const [tableRows, setTableRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);

  /* ── Row selection (Set of patient IDs) ── */
  const [selectedIds, setSelectedIds] = useState(new Set());

  /* ── Recipient mode ── */
  const [recipientMode, setRecipientMode] = useState('All');  // 'All' | 'Individual'
  const [individualNumber, setIndividualNumber] = useState('');

  /* ── Message & Send ── */
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0 });

  /* ─────────────────────── Data Loaders ─────────────────────── */

  const checkAccountStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await apiFetch('/sms/status', { method: 'POST' });
      setAccountStatus(res);
    } catch (e) {
      setAccountStatus({ success: false });
    } finally {
      setStatusLoading(false);
    }
  }, []);
  useEffect(() => { checkAccountStatus(); }, []);

  const loadData = useCallback(async () => {
    setTableLoading(true);
    setSelectedIds(new Set());  // clear selection on any filter change
    try {
      let endpoint;
      if (mode === 'next-visit') {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        endpoint = '/patients/next-visits';
        if (nvFilter === 'today')    endpoint += `?date=${today}`;
        if (nvFilter === 'tomorrow') endpoint += `?date=${tomorrow}`;
        if (nvFilter === 'previous') endpoint += `?date=${yesterday}`;
        // 'all' → no param
      } else {
        endpoint = '/patients/active';
        if (activeMonths === 1 || activeMonths === 3) endpoint += `?months=${activeMonths}`;
        // 'all' → no param
      }
      const res = await apiFetch(endpoint);
      setTableRows(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('SMS data load error:', e);
      setTableRows([]);
    } finally {
      setTableLoading(false);
    }
  }, [mode, nvFilter, activeMonths]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Derived: patients with phone numbers ── */
  const allWithPhone = tableRows.filter(v => v.tel_no && v.tel_no.trim());
  const selectedWithPhone = allWithPhone.filter(v => selectedIds.has(v.id));

  // Who actually gets the SMS: if rows are selected → those, else all with phone
  const effectiveRecipients = selectedIds.size > 0 ? selectedWithPhone : allWithPhone;
  const totalCount = effectiveRecipients.length;

  /* ─────────────────────── Filter Handlers ─────────────────────── */

  const handleNvFilter = (val) => {
    setMode('next-visit');
    setNvFilter(val);
    // activeMonths keeps its value so re-selecting 'active' mode restores it
  };

  const handleActiveFilter = (val) => {
    setMode('active');
    setActiveMonths(val);
  };

  /* ─────────────────────── Row Selection ─────────────────────── */

  const toggleRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === allWithPhone.length && allWithPhone.length > 0) {
      setSelectedIds(new Set());  // deselect all
    } else {
      setSelectedIds(new Set(allWithPhone.map(v => v.id)));  // select all with phone
    }
  };

  const allSelected = allWithPhone.length > 0 && selectedIds.size === allWithPhone.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  /* ─────────────────────── Send ─────────────────────── */

  const handleSend = async () => {
    if (!message.trim()) { showAlert('Please enter a message.', 'Empty Message'); return; }

    setSending(true);
    setSendResult(null);
    setSendProgress({ done: 0, total: 0 });

    try {
      if (recipientMode === 'Individual') {
        if (!individualNumber.trim()) { showAlert('Please enter a phone number.', 'No Number'); setSending(false); return; }
        const formatted = formatLkNumber(individualNumber.trim());
        if (!formatted) { showAlert('Invalid phone number. Use format: 07XXXXXXXX', 'Invalid Number'); setSending(false); return; }
        setSendProgress({ done: 0, total: 1 });
        const res = await apiFetch('/sms/send', { method: 'POST', body: JSON.stringify({ contact: formatted, message }) });
        setSendProgress({ done: 1, total: 1 });
        if (res.success) {
          setSendResult({ successCount: 1, failCount: 0, balance: res.data?.sms_credit_balance });
          addToast(`✓ SMS sent to ${formatted}${res.data?.sms_credit_balance ? ` · Balance: ${res.data.sms_credit_balance}` : ''}`, 'success');
        } else {
          setSendResult({ successCount: 0, failCount: 1 });
          addToast(`✗ Failed: ${res.message || 'Unknown error'}`, 'error');
        }
      } else {
        if (effectiveRecipients.length === 0) {
          showAlert(selectedIds.size > 0 ? 'Selected patients have no phone numbers.' : 'No patients with phone numbers in the current list.', 'No Recipients');
          setSending(false); return;
        }
        const formatted = effectiveRecipients.map(v => formatLkNumber(v.tel_no)).filter(Boolean);
        setSendProgress({ done: 0, total: formatted.length });

        if (formatted.length === 1) {
          const res = await apiFetch('/sms/send', { method: 'POST', body: JSON.stringify({ contact: formatted[0], message }) });
          setSendProgress({ done: 1, total: 1 });
          if (res.success) {
            setSendResult({ successCount: 1, failCount: 0, balance: res.data?.sms_credit_balance });
            addToast(`✓ SMS sent to 1 patient`, 'success');
          } else {
            setSendResult({ successCount: 0, failCount: 1 });
            addToast(`✗ Failed: ${res.message || 'Unknown error'}`, 'error');
          }
        } else {
          const res = await apiFetch('/sms/send-bulk', { method: 'POST', body: JSON.stringify({ contacts: formatted, message }) });
          setSendProgress({ done: formatted.length, total: formatted.length });
          const sent = res.data?.no_of_recipients || 0;
          const failed = formatted.length - sent;
          setSendResult({ successCount: sent, failCount: failed, balance: res.data?.sms_credit_balance });
          if (res.success) {
            addToast(`✓ Bulk SMS sent to ${sent} patient${sent !== 1 ? 's' : ''}${res.data?.sms_credit_balance ? ` · Balance: ${res.data.sms_credit_balance}` : ''}`, 'success');
            if (failed > 0) addToast(`⚠ ${failed} failed to send`, 'error');
          } else {
            addToast(`✗ Bulk send failed: ${res.message || 'Unknown error'}`, 'error');
          }
        }
      }
      await checkAccountStatus();
    } catch (e) {
      setSendResult({ successCount: 0, failCount: 1 });
      addToast(`✗ Error: ${e.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleStop = () => setSending(false);

  /* ─────────────────────── Render ─────────────────────── */
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
        .sms-filter-btn { border:1.5px solid var(--glass-border); border-radius:8px; padding:7px 14px; font-size:0.82rem; font-weight:600; background:transparent; color:var(--text-secondary); cursor:pointer; transition:all 0.15s; display:flex; align-items:center; gap:4px; }
        .sms-filter-btn.active { background:var(--color-secondary); border-color:var(--color-secondary); color:#fff; }
        .sms-filter-btn:hover:not(.active) { border-color:var(--color-secondary); color:var(--color-secondary); }
        .sms-table th { font-size:1rem; color:var(--text-muted); font-weight:700; padding:14px 16px; border-bottom:1px solid var(--glass-border); text-align:left; }
        .sms-table td { font-size:1rem; color:var(--text-primary); padding:13px 16px; border-bottom:1px solid var(--glass-border); }
        .sms-table tr.selected-row td { background:rgba(6,182,212,0.08); }
        .sms-table tr:hover td { background:var(--accent-blue-bg); cursor:pointer; }
        .sms-cb { width:18px; height:18px; cursor:pointer; accent-color:var(--color-secondary); }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes smsSlideIn { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      <Toast toasts={toasts} removeToast={removeToast} />

      {/* ══ LEFT PANEL ══ */}
      <div style={{ borderRight: '1px solid var(--glass-border)', padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', background: 'var(--bg-secondary)' }}>

        {/* Account Status */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>Account Status</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Balance</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{accountStatus?.data?.sms_credit_balance ?? '—'}</div>
            </div>
            <div style={{ background: '#16a34a', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#bbf7d0', marginBottom: '2px' }}>Success</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{sendResult?.successCount ?? 0}</div>
            </div>
            <div style={{ background: '#ef4444', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#fecaca', marginBottom: '2px' }}>Fails</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{sendResult?.failCount ?? 0}</div>
            </div>
          </div>
          <button className="sms-btn sms-btn-outline" style={{ width: '100%', justifyContent: 'center', padding: '8px' }} onClick={checkAccountStatus} disabled={statusLoading}>
            {statusLoading ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Checking...</> : <><CheckCircle size={13} /> Check Balance</>}
          </button>
        </div>

        {/* Recipient */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Recipient</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Eg: 772047332</div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', width: '130px', flexShrink: 0 }}>
              <select value={recipientMode} onChange={e => { setRecipientMode(e.target.value); setSelectedIds(new Set()); }} className="sms-inp" style={{ appearance: 'none', paddingRight: '28px', cursor: 'pointer' }}>
                <option value="All">All</option>
                <option value="Individual">Individual</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-secondary)', pointerEvents: 'none' }} />
            </div>
            {recipientMode === 'Individual' ? (
              <input type="tel" className="sms-inp" placeholder="Enter Number.." value={individualNumber} onChange={e => setIndividualNumber(e.target.value)} style={{ flex: 1 }} />
            ) : (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                {selectedIds.size > 0
                  ? <><strong style={{ color: 'var(--color-secondary)' }}>{selectedIds.size}</strong> selected / {allWithPhone.length}</>
                  : <>Total: <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong></>
                }
              </span>
            )}
          </div>

          {/* Active in Last — independent from nvFilter */}
          {recipientMode === 'All' && (
            <>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '7px' }}>Active in Last:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[['1 Month', 1], ['3 Month', 3], ['All', 'all']].map(([lbl, val]) => (
                    <button key={lbl} className={`sms-filter-btn${mode === 'active' && activeMonths === val ? ' active' : ''}`} onClick={() => handleActiveFilter(val)} style={{ padding: '12px 4px', fontSize: '0.95rem', justifyContent: 'center' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {mode === 'active' && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {activeMonths === 'all' ? `All time · ${tableRows.length} patients` : `Last ${activeMonths} month${activeMonths > 1 ? 's' : ''} · ${tableRows.length} patients`}
                  {selectedIds.size > 0 && <span style={{ color: 'var(--color-secondary)', fontWeight: 700 }}> · {selectedIds.size} selected</span>}
                </div>
              )}
              <p style={{ fontSize: '0.78rem', color: '#ef4444', margin: 0, lineHeight: 1.4 }}>
                Please do not use the system while sending bulk messages
              </p>
            </>
          )}
        </div>

        {/* Message */}
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
            <span style={{ background: '#475569', color: '#fff', borderRadius: '12px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>Chars: {message.length}</span>
            <span style={{ background: '#16a34a', color: '#fff', borderRadius: '12px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>Pages: {Math.ceil(message.length / 160) || 0}/{Math.ceil(1500 / 160)}</span>
          </div>
        </div>

        {/* Progress */}
        {sending && sendProgress.total > 0 && (
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Sending {sendProgress.done}/{sendProgress.total}...</div>
            <div style={{ height: '6px', background: 'var(--glass-border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(sendProgress.done / sendProgress.total) * 100}%`, background: 'var(--color-secondary)', transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Send Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="sms-btn sms-btn-cyan" style={{ flex: 1, justifyContent: 'center', padding: '11px' }} onClick={handleSend} disabled={sending}>
            {sending ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : <><Play size={15} fill="white" /> {selectedIds.size > 0 ? `Send to ${selectedIds.size}` : 'Send All'}</>}
          </button>
          <button className="sms-btn sms-btn-red" style={{ padding: '11px 14px' }} onClick={handleStop} title="Stop">
            <Square size={15} fill="white" />
          </button>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div style={{ padding: '24px 28px', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {mode === 'active' ? 'Active Patients' : 'Next Visit'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-secondary)', marginTop: '2px' }}>
              {mode === 'active'
                ? (activeMonths === 'all' ? `All time · ${tableRows.length} patients` : `Last ${activeMonths} month${activeMonths > 1 ? 's' : ''} · ${tableRows.length} patients`)
                : `${tableRows.length} patient${tableRows.length !== 1 ? 's' : ''}`
              }
              {selectedIds.size > 0 && <span style={{ color: '#f59e0b', fontWeight: 700, marginLeft: 8 }}>· {selectedIds.size} selected for SMS</span>}
            </div>
          </div>

          {/* Date filter buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: 'Previous', icon: <ChevronLeft size={15} />, val: 'previous' },
              { label: 'Today', val: 'today' },
              { label: 'Tomorrow', val: 'tomorrow' },
              { label: 'View All', val: 'all' },
            ].map(btn => (
              <button
                key={btn.val}
                className={`sms-filter-btn${mode === 'next-visit' && nvFilter === btn.val ? ' active' : ''}`}
                onClick={() => handleNvFilter(btn.val)}
                style={{ opacity: mode === 'active' ? 0.5 : 1, padding: '14px 32px', fontSize: '1.05rem' }}
              >
                {btn.icon}{btn.label}
              </button>
            ))}
            <button className="sms-btn sms-btn-outline" style={{ padding: '14px 16px' }} onClick={loadData} title="Refresh">
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table className="sms-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)' }}>
                <th style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    className="sms-cb"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    title="Select all"
                  />
                </th>
                <th>#</th>
                <th>Name</th>
                <th>Next Date</th>
                <th>Last Visit</th>
                <th>Visit Plan</th>
                <th>Tel No</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {tableLoading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                  <Loader size={22} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
                  Loading...
                </td></tr>
              ) : tableRows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <XCircle size={22} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  {mode === 'active'
                    ? (activeMonths === 'all' ? 'No patients found' : `No patients visited in the last ${activeMonths} month${activeMonths > 1 ? 's' : ''}`)
                    : 'No scheduled visits found'
                  }
                </td></tr>
              ) : (
                tableRows.map((v, i) => {
                  const isSelected = selectedIds.has(v.id);
                  const hasPhone = !!(v.tel_no && v.tel_no.trim());
                  return (
                    <tr
                      key={v.id || i}
                      className={isSelected ? 'selected-row' : ''}
                      onClick={() => hasPhone && toggleRow(v.id)}
                      style={{ userSelect: 'none', opacity: hasPhone ? 1 : 0.6 }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          className="sms-cb"
                          checked={isSelected}
                          disabled={!hasPhone}
                          onChange={() => hasPhone && toggleRow(v.id)}
                          onClick={e => e.stopPropagation()}
                          title={hasPhone ? 'Select' : 'No phone number'}
                        />
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{v.patient_name || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{v.next_visit_date ? new Date(v.next_visit_date).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{v.visit_date ? new Date(v.visit_date).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {v.visit_plan || '—'}
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Phone size={13} style={{ color: hasPhone ? 'var(--color-secondary)' : 'var(--text-muted)' }} />
                          {hasPhone ? v.tel_no : <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>No phone</span>}
                        </span>
                      </td>
                      <td>{v.age != null ? `${v.age}Y` : '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Selection summary bar */}
        {selectedIds.size > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6,182,212,0.1)', border: '1px solid var(--color-secondary)', borderRadius: '10px', padding: '10px 16px' }}>
            <span style={{ fontSize: '0.86rem', color: 'var(--color-secondary)', fontWeight: 600 }}>
              {selectedIds.size} patient{selectedIds.size !== 1 ? 's' : ''} selected for SMS
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
